// GET /api/pack with header x-pack-token -> the encrypted photo pack, or 403/429. Only CloudFront can call it.
const C = require('crypto');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const E = process.env;
const d = { s3: new S3Client({}), db: new DynamoDBClient({}), now: () => Date.now() };
exports.d = d;
const ok = (E.ORIGINS || '').split(',');
const hdr = (o) => ({ 'cache-control': 'no-store', vary: 'Origin', ...(ok.includes(o) ? {
  'access-control-allow-origin': o, 'access-control-allow-headers': 'x-pack-token',
  'access-control-allow-methods': 'GET', 'access-control-max-age': '600' } : {}) });
const res = (s, o, b, t) => ({ statusCode: s, headers: { ...hdr(o), 'content-type': t || 'text/plain' },
  body: b || '', isBase64Encoded: !!t });

// Count one attempt against key; false once over limit (also when DynamoDB throttles: fail closed).
async function hit(key, limit, ttl) {
  try {
    await d.db.send(new UpdateItemCommand({ TableName: E.TABLE, Key: { k: { S: key } },
      UpdateExpression: 'ADD #n :1 SET #e = if_not_exists(#e, :e)',
      ConditionExpression: 'attribute_not_exists(#n) OR #n < :l', ExpressionAttributeNames: { '#n': 'n', '#e': 'exp' },
      ExpressionAttributeValues: { ':1': { N: '1' }, ':l': { N: String(limit) },
        ':e': { N: String(Math.floor(d.now() / 1000) + ttl) } } }));
    return true;
  } catch (e) { return false; }
}

exports.handler = async (ev) => {
  const h = ev.headers || {}, o = h.origin || '';
  const m = ev.requestContext && ev.requestContext.http && ev.requestContext.http.method;
  if (m === 'OPTIONS') return res(204, o);
  if (m !== 'GET') return res(405, o);
  const tok = String(h['x-pack-token'] || '');
  if (!/^[0-9a-f]{64}$/.test(tok)) return res(400, o);
  const ip = String(h['cloudfront-viewer-address'] || 'none').replace(/:\d+$/, '');
  const t = d.now(), win = Math.floor(t / 600000), day = Math.floor(t / 86400000);
  // At most 10 tries per IP per 10 minutes, and 300 per day across everyone.
  if (!(await hit('ip#' + ip + '#' + win, 10, 900)) || !(await hit('all#' + day, 300, 90000))) return res(429, o);
  const got = C.createHash('sha256').update(tok).digest();
  const want = Buffer.from(E.TOKEN_HASH || '', 'hex');
  if (want.length !== 32 || !C.timingSafeEqual(got, want)) return res(403, o);
  const r = await d.s3.send(new GetObjectCommand({ Bucket: E.BUCKET, Key: E.KEY }));
  const body = Buffer.from(await r.Body.transformToByteArray()).toString('base64');
  return res(200, o, body, 'application/octet-stream');
};
