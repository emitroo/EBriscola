// Runs the real pack function (aws/functions/pack.js) behind a local HTTP adapter, with in-memory stand-ins for S3
// and DynamoDB, so browser tests can unlock by code from another origin the way the GitHub Pages copy does.
//   startPackApi({ port, token, pack, origin }) -> server
const http = require('http'), crypto = require('crypto'), Module = require('module');

function startPackApi({ port, token, pack, origin }) {
  class Cmd { constructor(i) { this.input = i; } }
  const fakes = {
    '@aws-sdk/client-s3': { S3Client: class {}, GetObjectCommand: class extends Cmd {} },
    '@aws-sdk/client-dynamodb': { DynamoDBClient: class {}, UpdateItemCommand: class extends Cmd {} },
  };
  const load = Module._load;
  Module._load = function (req, ...rest) { return fakes[req] || load.call(this, req, ...rest); };
  Object.assign(process.env, { TOKEN_HASH: crypto.createHash('sha256').update(token).digest('hex'), ORIGINS: origin });
  const fn = require('../../aws/functions/pack.js');
  const counts = {};
  fn.d.db = { async send(c) {
    const k = c.input.Key.k.S, lim = +c.input.ExpressionAttributeValues[':l'].N;
    if ((counts[k] || 0) >= lim) throw new Error('ConditionalCheckFailed');
    counts[k] = (counts[k] || 0) + 1;
  } };
  fn.d.s3 = { async send() { return { Body: { transformToByteArray: async () => new Uint8Array(pack) } }; } };
  return http.createServer(async (req, res) => {
    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v]));
    headers['cloudfront-viewer-address'] = req.socket.remoteAddress + ':' + req.socket.remotePort;
    const r = await fn.handler({ requestContext: { http: { method: req.method } }, headers });
    res.writeHead(r.statusCode, r.headers);
    res.end(r.isBase64Encoded ? Buffer.from(r.body, 'base64') : r.body);
  }).listen(port, '127.0.0.1');
}
module.exports = { startPackApi };
