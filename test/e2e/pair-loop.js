// Repeated nearby pairings between the same two phones, to catch intermittent failures. Usage: node pair-loop.js [rounds=8]
const L = require('./lib');
(async () => {
  const rounds = +process.argv[2] || 8;
  const b = await L.launch();
  const host = await L.phone(b, 'Pixel 7'), guest = await L.phone(b, 'iPhone 13');
  await L.hostNearby(host, 'Marco');
  let ok = 0;
  for (let i = 0; i < rounds; i++) {
    const t0 = Date.now();
    const r = await L.pairNearby(host, guest, 'Anna').then(() => true, () => false);
    L.log(i, r ? 'OK' : 'FAIL', Date.now() - t0, 'ms');
    if (r) ok++;
    await guest.evaluate(() => { const B = window.__briscola; if (B.net.guest && B.net.guest.link) B.net.guest.link.close('x'); document.querySelector('[data-act=pair-close]')?.click(); });
    await host.evaluate(() => document.querySelector('[data-act=pair-close]')?.click());
    await host.waitForTimeout(1500);
  }
  L.log('paired', ok, '/', rounds);
  await b.close();
  process.exit(ok === rounds ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
