# Browser tests

These drive the real app in headless Chromium with simulated phones (Pixel 7 and iPhone 13 profiles).
They are not part of `npm test` because they need Playwright, a local web server and, for room codes,
a local PeerJS server.

```
npm run build
python3 -m http.server 8765            # in one terminal, from the repo root
node test/e2e/peer-server.js           # in another (npm i peer express), for room-code tests

node test/e2e/one-phone.js  <outdir> 4 1 g4        # 1 human + 3 CPU on one phone, full hand
node test/e2e/two-phones.js <outdir> qr            # two phones paired by QR text codes, full hand
node test/e2e/two-phones.js <outdir> room ws://localhost:9000/peerjs?key=peerjs
node test/e2e/reconnect.js  <outdir> qr            # drop the link mid-hand, re-pair, finish
node test/e2e/reconnect.js  <outdir> room          # drop, automatic rejoin, page reload + rejoin, finish
node test/e2e/camera-scan.js <outdir>              # guest scans a real host QR through a fake camera feed
node test/e2e/pair-loop.js 9                       # repeated pairing, to catch intermittent failures
```

`<outdir>` receives screenshots. Each script prints what it checked and any page errors.
