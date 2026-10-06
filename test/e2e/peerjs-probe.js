// Checks which message shapes the PeerJS signalling server accepts and relays.
// For each variant: fresh host+guest sockets, guest sends one message, we report delivery and whether
// the server closed the guest's socket. Node 22+ (global WebSocket).
const URL_BASE = process.env.BROKER || 'wss://0.peerjs.com/peerjs?key=peerjs';
const rand = () => Math.random().toString(36).slice(2, 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(id) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`${URL_BASE}&id=${id}&token=${rand()}&version=1.5.4`);
    const c = { id, ws, got: [], closed: null };
    ws.onmessage = (e) => { const m = JSON.parse(e.data); c.got.push(m); if (m.type === 'OPEN') res(c); };
    ws.onerror = () => rej(new Error('ws error'));
    ws.onclose = (e) => { c.closed = `${e.code} ${e.reason}`; };
  });
}
const SDP = { type: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
const VARIANTS = {
  offer_string_sdp: { type: 'OFFER', payload: { sdp: 'v=0 test', v: 1, dev: 'x' } },
  offer_peerjs_shape: { type: 'OFFER', payload: { sdp: SDP, type: 'data', connectionId: 'dc_abcdef1234', browser: 'chrome', label: 'dc_abcdef1234', reliable: true, serialization: 'json' } },
  offer_peerjs_shape_extra: { type: 'OFFER', payload: { sdp: SDP, type: 'data', connectionId: 'dc_abcdef1234', browser: 'chrome', label: 'dc_abcdef1234', reliable: true, serialization: 'json', metadata: { v: 1, dev: 'x' } } },
  candidate_peerjs_shape: { type: 'CANDIDATE', payload: { candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 }, type: 'data', connectionId: 'dc_abcdef1234' } },
  candidate_relay: { type: 'CANDIDATE', payload: { r: { t: 'hello', v: 1 } } },
  candidate_relay_in_peerjs_shape: { type: 'CANDIDATE', payload: { candidate: { candidate: '', sdpMid: '0', sdpMLineIndex: 0 }, type: 'data', connectionId: 'dc_abcdef1234', r: { t: 'hello' } } },
  answer_string: { type: 'ANSWER', payload: { sdp: 'v=0' } },
  answer_peerjs_shape: { type: 'ANSWER', payload: { sdp: { type: 'answer', sdp: 'v=0\r\n' }, type: 'data', connectionId: 'dc_abcdef1234', browser: 'chrome' } },
};
(async () => {
  for (const [name, v] of Object.entries(VARIANTS)) {
    const host = await client(`h${rand()}${rand()}`), guest = await client(`g${rand()}${rand()}`);
    guest.ws.send(JSON.stringify(Object.assign({ dst: host.id }, v)));
    await sleep(2500);
    const delivered = host.got.some((m) => m.type === v.type);
    console.log(`${name.padEnd(34)} delivered=${delivered} guestClosed=${guest.closed || 'no'} hostClosed=${host.closed || 'no'} guestGot=${guest.got.map((m) => m.type).join(',')}`);
    try { host.ws.close(); guest.ws.close(); } catch (e) { /* ignore */ }
    await sleep(300);
  }
  process.exit(0);
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
