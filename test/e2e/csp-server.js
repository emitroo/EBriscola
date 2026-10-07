// Serves the repo root with the same security headers CloudFront adds (read from aws/template.yaml), to check the
// app works under that Content-Security-Policy.  node test/e2e/csp-server.js [port]   (default 8766)
// EXTRA_CONNECT adds connect-src sources for local runs (e.g. a local signalling server); CI uses the policy as is.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '../..');
const tpl = fs.readFileSync(path.join(root, 'aws/template.yaml'), 'utf8');
const m = /ContentSecurityPolicy: >-\n([\s\S]*?)\n\s+CustomHeadersConfig/.exec(tpl);
let csp = m[1].split('\n').map((l) => l.trim()).join(' ');
if (process.env.EXTRA_CONNECT) csp = csp.replace("connect-src 'self'", "connect-src 'self' " + process.env.EXTRA_CONNECT);
const headers = {
  'content-security-policy': csp, 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer',
  'permissions-policy': /Header: Permissions-Policy, Value: '([^']+)'/.exec(tpl)[1],
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const port = +process.argv[2] || 8766;
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(root, p.endsWith('/') ? p + 'index.html' : p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, headers); return res.end(); }
  res.writeHead(200, { ...headers, 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('csp server on', port, '\n' + csp));
