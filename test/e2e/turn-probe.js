// Can two peers connect when forced through a TURN relay (iceTransportPolicy: 'relay')?
// Prints the relay candidates gathered and whether the data channel opened.
const L = require('./lib');
// Uses the relay servers built into the app, or TURN_JSON='[{"urls":[...],"username":"u","credential":"p"}]'.
(async () => {
  const b = await L.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto(L.url());
  const ICE = process.env.TURN_JSON ? JSON.parse(process.env.TURN_JSON) : await p.evaluate(() => window.BriscolaNet.ONLINE_ICE);
  const r = await p.evaluate(async (ice) => {
    const cfg = { iceServers: ice, iceTransportPolicy: 'relay' };
    const a = new RTCPeerConnection(cfg), c = new RTCPeerConnection(cfg);
    const cands = [];
    a.onicecandidate = (e) => { if (e.candidate) { cands.push(e.candidate.candidate); c.addIceCandidate(e.candidate); } };
    c.onicecandidate = (e) => { if (e.candidate) a.addIceCandidate(e.candidate); };
    const dc = a.createDataChannel('t');
    const opened = new Promise((res) => { dc.onopen = () => res(true); setTimeout(() => res(false), 20000); });
    await a.setLocalDescription(await a.createOffer());
    await c.setRemoteDescription(a.localDescription);
    await c.setLocalDescription(await c.createAnswer());
    await a.setRemoteDescription(c.localDescription);
    const ok = await opened;
    return { ok, relayCandidates: cands.filter((x) => / typ relay/.test(x)).length, state: a.connectionState };
  }, ICE);
  L.log('TURN relay connection:', JSON.stringify(r));
  await b.close();
  process.exit(r.ok ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
