// Talks to the real PeerJS signalling server with two raw WebSocket clients and prints every message,
// to check how it relays OFFER/ANSWER/CANDIDATE between peers. Node 22+ (global WebSocket).
const URL_BASE = process.env.BROKER || 'wss://0.peerjs.com/peerjs?key=peerjs';
const rand = () => Math.random().toString(36).slice(2, 8);
function client(id, label) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`${URL_BASE}&id=${id}&token=${rand()}&version=1.5.4`);
    const c = { id, ws, got: [] };
    ws.onmessage = (e) => { console.log(label, '<', String(e.data).slice(0, 200)); c.got.push(JSON.parse(e.data)); if (JSON.parse(e.data).type === 'OPEN') res(c); };
    ws.onerror = (e) => { console.log(label, 'error', e.message || e.type); rej(new Error('ws error')); };
    ws.onclose = (e) => console.log(label, 'closed', e.code, e.reason);
    setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'HEARTBEAT' })), 5000).unref();
  });
}
const send = (c, m) => { console.log(c.id.slice(0, 12), '>', JSON.stringify(m).slice(0, 160)); c.ws.send(JSON.stringify(m)); };
(async () => {
  for (const [hostId, guestId] of [[`briscola-${rand().toUpperCase().slice(0, 5)}`, `bg-${rand()}${rand()}-${rand().slice(0, 4)}`], [`brisc${rand()}`, `g${rand()}${rand()}`]]) {
    console.log('==== host', hostId, 'guest', guestId);
    const a = await client(hostId, 'HOST ');
    const b = await client(guestId, 'GUEST');
    send(b, { type: 'OFFER', dst: hostId, payload: { sdp: 'v=0 test', v: 1, dev: 'x' } });
    send(b, { type: 'CANDIDATE', dst: hostId, payload: { r: { t: 'hello', v: 1 } } });
    send(b, { type: 'OFFER', dst: hostId, payload: { sdp: 'v=0', type: 'offer', connectionId: 'dc_test123', browser: 'chrome', label: 'x', reliable: true, serialization: 'json' } });
    await new Promise((r) => setTimeout(r, 2500));
    send(a, { type: 'ANSWER', dst: guestId, payload: { sdp: 'v=0 answer' } });
    send(a, { type: 'CANDIDATE', dst: guestId, payload: { r: { t: 'welcome' } } });
    await new Promise((r) => setTimeout(r, 8000));
    console.log('host received:', a.got.map((m) => m.type).join(','), '| guest received:', b.got.map((m) => m.type).join(','));
    a.ws.close(); b.ws.close();
  }
  process.exit(0);
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
