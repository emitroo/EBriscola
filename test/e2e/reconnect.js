// Drop the guest's connection mid-hand and recover. Usage: node reconnect.js nearby|online
//   nearby: re-pair with QR codes. online: automatic rejoin, then a page reload and one-tap rejoin.
const L = require('./lib');
(async () => {
  const mode = process.argv[2] || 'online';
  const params = process.env.BROKER ? { broker: process.env.BROKER } : {};
  const b = await L.launch();
  const host = await L.phone(b, 'Pixel 7', params), guest = await L.phone(b, 'iPhone 13', params);
  if (mode === 'nearby') { await L.hostNearby(host, 'Marco'); await L.pairNearby(host, guest, 'Anna'); }
  else { const code = await L.hostOnline(host, 'Marco'); await L.joinOnline(guest, code, 'Anna'); }
  await host.click('[data-act=speed][data-v=fast]');
  await host.click('[data-act=deal]');
  await guest.waitForSelector('#game:not([hidden]) .hand', { timeout: 15000 });
  await L.play([host, guest], 6);
  await guest.evaluate(() => window.__briscola.net.guest.link.close('test-drop'));
  await host.waitForFunction(() => Object.values(window.__briscola.net.devices).every((d) => !d.online), null, { timeout: 25000 });
  L.log('host sees the phone drop:', await host.$eval('.net-chip', (e) => e.textContent).catch(() => 'no chip'));
  if (mode === 'nearby') await L.pairNearby(host, guest);
  await host.waitForFunction(() => Object.values(window.__briscola.net.devices).every((d) => d.online), null, { timeout: 40000 });
  await guest.waitForSelector('#game:not([hidden]) .hand', { timeout: 15000 });
  L.log('reconnected and back in the game');
  if (mode === 'online') {
    await L.play([host, guest], 4);
    await guest.reload();
    await guest.waitForSelector('#pj-room', { timeout: 10000 });
    L.log('after reload the join screen has the code:', await guest.$eval('#pj-room', (e) => e.value));
    await guest.click('[data-act=join-room]');
    await guest.waitForSelector('#game:not([hidden]) .hand', { timeout: 40000 });
    L.log('rejoined after reload');
  }
  const done = await L.play([host, guest]);
  L.log('hand completed', done, JSON.stringify([await L.summary(host), await L.summary(guest)]), '| errors', JSON.stringify(host.errs), JSON.stringify(guest.errs));
  await b.close();
  process.exit(done ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
