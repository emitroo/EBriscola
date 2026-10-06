# Browser tests

These drive the real app in headless Chromium with simulated phones (Pixel 7 and iPhone 13 profiles).
They run in GitHub Actions on every push that touches the app (`.github/workflows/e2e.yml`), where the
online tests use the real public PeerJS server. They are not part of `npm test` because they need Playwright.

Locally:

```
npm run build
python3 -m http.server 8765                 # from the repo root
node test/e2e/peer-server.js                # optional local signalling server (npm i peer express)
export BROKER="ws://localhost:9000/peerjs?key=peerjs"   # omit to use 0.peerjs.com

node test/e2e/one-phone.js 4 1              # 1 human + 3 CPU on one phone
node test/e2e/two-phones.js online          # host + guest join by code
node test/e2e/two-phones.js online relay    # same, forced through the built-in TURN relay
node test/e2e/lobby-online.js               # host + 3 guests join by code, 4-phone hand
node test/e2e/host-pack.js                  # host loads a pack once; guests in later lobbies get it by joining
node test/e2e/shared-deck.js                # Settlers picked by one guest shows on every phone, photos passed phone to phone
node test/e2e/reconnect.js online           # drop, automatic rejoin, page reload + rejoin
node test/e2e/two-phones.js nearby          # nearby QR pairing (text codes), full hand
node test/e2e/reconnect.js nearby           # drop and re-pair with QR
node test/e2e/camera-scan.js                # guest scans a real host QR through a fake camera
node test/e2e/pair-loop.js 9                # repeated pairing, to catch intermittent failures
node test/e2e/peerjs-probe.js               # which message shapes the signalling server accepts
node test/e2e/turn-probe.js                 # does the built-in TURN relay work (or TURN_JSON='[...]')
```

Screenshots go to `$OUT` (default: the system temp directory).
