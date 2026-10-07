// The AWS functions, run against fake AWS clients (no account needed).
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const crypto = require('crypto');

// Stand-ins for the AWS SDK modules that the Lambda runtime provides.
class Cmd { constructor(input) { this.input = input; this.name = this.constructor.name; } }
const fakes = {
  '@aws-sdk/client-s3': { S3Client: class {}, GetObjectCommand: class GetObjectCommand extends Cmd {} },
  '@aws-sdk/client-dynamodb': { DynamoDBClient: class {}, UpdateItemCommand: class UpdateItemCommand extends Cmd {} },
  '@aws-sdk/client-cloudfront': {
    CloudFrontClient: class {}, GetDistributionConfigCommand: class GetDistributionConfigCommand extends Cmd {},
    UpdateDistributionCommand: class UpdateDistributionCommand extends Cmd {},
  },
  '@aws-sdk/client-lambda': { LambdaClient: class {}, PutFunctionConcurrencyCommand: class PutFunctionConcurrencyCommand extends Cmd {} },
};
const load = Module._load;
Module._load = function (req, ...rest) { return fakes[req] || load.call(this, req, ...rest); };

const TOKEN = 'ab'.repeat(32);
process.env.TOKEN_HASH = crypto.createHash('sha256').update(TOKEN).digest('hex');
process.env.ORIGINS = 'https://emitroo.github.io';
const pack = require('../aws/functions/pack.js');
const cutoff = require('../aws/functions/cutoff.js');

// A DynamoDB that honours the conditional counter like the real one.
function fakeDb() {
  const items = {};
  return { items, fail: false, async send(c) {
    if (this.fail) throw new Error('ProvisionedThroughputExceededException');
    const k = c.input.Key.k.S, lim = +c.input.ExpressionAttributeValues[':l'].N;
    if ((items[k] || 0) >= lim) { const e = new Error('cond'); e.name = 'ConditionalCheckFailedException'; throw e; }
    items[k] = (items[k] || 0) + 1;
  } };
}
const PACK = Buffer.from('EBD1 encrypted bytes');
pack.d.s3 = { async send(c) { assert.strictEqual(c.name, 'GetObjectCommand'); return { Body: { transformToByteArray: async () => new Uint8Array(PACK) } }; } };
const call = (token, extra = {}) => pack.handler({ requestContext: { http: { method: extra.method || 'GET' } },
  headers: { 'x-pack-token': token, 'cloudfront-viewer-address': (extra.ip || '1.2.3.4') + ':443', origin: extra.origin || '' } });

test('pack: right token gets the pack, wrong token gets 403, junk gets 400', async () => {
  pack.d.db = fakeDb();
  const ok = await call(TOKEN, { origin: 'https://emitroo.github.io' });
  assert.strictEqual(ok.statusCode, 200);
  assert.ok(ok.isBase64Encoded);
  assert.deepStrictEqual(Buffer.from(ok.body, 'base64'), PACK);
  assert.strictEqual(ok.headers['access-control-allow-origin'], 'https://emitroo.github.io');
  assert.strictEqual(ok.headers['cache-control'], 'no-store');
  assert.strictEqual((await call('cd'.repeat(32))).statusCode, 403);
  assert.strictEqual((await call('not-a-token')).statusCode, 400);
});

test('pack: CORS only for the allowed origin; preflight answered', async () => {
  pack.d.db = fakeDb();
  const pre = await call('', { method: 'OPTIONS', origin: 'https://emitroo.github.io' });
  assert.strictEqual(pre.statusCode, 204);
  assert.strictEqual(pre.headers['access-control-allow-headers'], 'x-pack-token');
  const other = await call(TOKEN, { origin: 'https://evil.example' });
  assert.strictEqual(other.headers['access-control-allow-origin'], undefined);
  assert.strictEqual((await call(TOKEN, { method: 'POST' })).statusCode, 405);
});

test('pack: 10 tries per IP per 10 minutes, then 429 (even with the right token)', async () => {
  pack.d.db = fakeDb();
  let now = Date.UTC(2026, 9, 7, 12, 0, 0);
  pack.d.now = () => now;
  for (let i = 0; i < 10; i++) assert.strictEqual((await call('cd'.repeat(32))).statusCode, 403);
  assert.strictEqual((await call(TOKEN)).statusCode, 429);
  assert.strictEqual((await call(TOKEN, { ip: '5.6.7.8' })).statusCode, 200, 'other IPs unaffected');
  now += 10 * 60 * 1000;
  assert.strictEqual((await call(TOKEN)).statusCode, 200, 'next window');
});

test('pack: 300 tries a day across all IPs, then 429', async () => {
  pack.d.db = fakeDb();
  pack.d.now = () => Date.UTC(2026, 9, 7, 12, 0, 0);
  for (let i = 0; i < 300; i++) assert.strictEqual((await call('cd'.repeat(32), { ip: '10.0.' + (i >> 8) + '.' + (i & 255) })).statusCode, 403);
  assert.strictEqual((await call(TOKEN, { ip: '9.9.9.9' })).statusCode, 429);
});

test('pack: fails closed when the counter table is unavailable', async () => {
  pack.d.db = fakeDb();
  pack.d.db.fail = true;
  assert.strictEqual((await call(TOKEN)).statusCode, 429);
});

test('cut-off: stops the pack function and disables the distribution', async () => {
  process.env.PACK_FN = 'ebriscola-pack';
  process.env.DIST_ID = 'E123';
  const sent = [];
  cutoff.d.lambda = { async send(c) { sent.push(c); } };
  cutoff.d.cf = { async send(c) {
    sent.push(c);
    if (c.name === 'GetDistributionConfigCommand') return { ETag: 'etag1', DistributionConfig: { Enabled: true, Comment: 'EBriscola' } };
    return {};
  } };
  await cutoff.handler({ Records: [{ Sns: { Subject: 'ALARM: CfRequestsHourlyCutoff' } }] });
  assert.deepStrictEqual(sent[0].input, { FunctionName: 'ebriscola-pack', ReservedConcurrentExecutions: 0 });
  const upd = sent.find((c) => c.name === 'UpdateDistributionCommand');
  assert.strictEqual(upd.input.IfMatch, 'etag1');
  assert.strictEqual(upd.input.DistributionConfig.Enabled, false);
  assert.strictEqual(upd.input.DistributionConfig.Comment, 'EBriscola', 'rest of the config kept');
});

test('cut-off: already disabled distribution is left alone', async () => {
  const sent = [];
  cutoff.d.lambda = { async send(c) { sent.push(c); } };
  cutoff.d.cf = { async send(c) { sent.push(c); return { ETag: 'e', DistributionConfig: { Enabled: false } }; } };
  await cutoff.handler({});
  assert.ok(!sent.some((c) => c.name === 'UpdateDistributionCommand'));
});

test('pack token: tool hash matches what the server checks for the same code', async () => {
  const P = require('../src/photos.js');
  const t = await P.token('  Some Code ');
  assert.match(t, /^[0-9a-f]{64}$/);
  assert.strictEqual(t, await P.token('some code'), 'normalised like the pack key');
  const { execFileSync } = require('child_process');
  const hash = execFileSync(process.execPath, ['tools/pack-token.mjs', 'some code'], { cwd: __dirname + '/..' }).toString().trim();
  assert.strictEqual(hash, crypto.createHash('sha256').update(t).digest('hex'));
});
