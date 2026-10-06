// Two phones play a full hand. Usage: node two-phones.js nearby|online
//   online uses the real PeerJS server unless BROKER is set (e.g. ws://localhost:9000/peerjs?key=peerjs).
const L = require('./lib');
(async () => {
  const mode = process.argv[2] || 'nearby';
  const params = {};
  if (process.env.BROKER) params.broker = process.env.BROKER;
  const b = await L.launch();
  const host = await L.phone(b, 'Pixel 7', params), guest = await L.phone(b, 'iPhone 13', params);
  const t0 = Date.now();
  if (mode === 'nearby') {
    await L.hostNearby(host, 'Marco');
    const codes = await L.pairNearby(host, guest, 'Anna');
    L.log('nearby pairing ok; code lengths', codes.offer.length, codes.answer.length);
  } else {
    const code = await L.hostOnline(host, 'Marco');
    L.log('lobby code', code);
    await host.screenshot({ path: `${L.OUT}/host-lobby-${mode}.png` });
    await L.joinOnline(guest, code, 'Anna');
    L.log('joined in', Date.now() - t0, 'ms');
  }
  await guest.waitForTimeout(500);
  L.log('guest lobby:', await guest.$eval('.lobby-seats', (e) => e.innerText.replace(/\n/g, ' | ')));
  await guest.screenshot({ path: `${L.OUT}/guest-lobby-${mode}.png` });
  await host.click('[data-act=speed][data-v=fast]');
  await host.click('[data-act=deal]');
  await guest.waitForSelector('#game:not([hidden]) .hand', { timeout: 15000 });
  let leak = false;
  const watch = setInterval(async () => { try { if (!(await L.guestSeesOnly(guest))) leak = true; } catch (e) { /* page busy */ } }, 700);
  await L.play([host, guest], 12);
  await guest.screenshot({ path: `${L.OUT}/guest-game-${mode}.png` });
  const done = await L.play([host, guest]);
  clearInterval(watch);
  const res = [await L.summary(host), await L.summary(guest)];
  await guest.click('[data-act=guest-next]');
  const next = await host.waitForFunction(() => !document.querySelector('.sheet .result-banner'), null, { timeout: 8000 }).then(() => true, () => false);
  L.log('hand completed', done, JSON.stringify(res), '| guest saw only its own cards:', !leak, '| next hand from guest:', next);
  L.log('errors host', JSON.stringify(host.errs), 'guest', JSON.stringify(guest.errs));
  await b.close();
  process.exit(done && !leak && next && res[0] === res[1] && !host.errs.length && !guest.errs.length ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
