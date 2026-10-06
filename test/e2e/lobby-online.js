// One host, three guests join the online lobby by code; seats fill automatically up to 4 players.
const L = require('./lib');
(async () => {
  const params = {};
  if (process.env.BROKER) params.broker = process.env.BROKER;
  const b = await L.launch();
  const host = await L.phone(b, 'Pixel 7', params);
  const code = await L.hostOnline(host, 'Marco');
  const names = ['Anna', 'Luca', 'Sofia'];
  const guests = [];
  for (const [i, nm] of names.entries()) {
    const g = await L.phone(b, i % 2 ? 'Pixel 7' : 'iPhone 13', params);
    await L.joinOnline(g, code, nm);
    guests.push(g);
  }
  await host.waitForFunction(() => window.__briscola.S.settings.lobby.n === 4, null, { timeout: 10000 });
  await guests[2].waitForFunction(() => document.querySelectorAll('.lobby-seats .lobby-seat').length === 4, null, { timeout: 10000 });
  L.log('lobby code', code, '| host seats:', await host.evaluate(() => { const L2 = window.__briscola.S.settings.lobby; return L2.seats.slice(0, L2.n).map((s) => (s.remote ? 'phone' : s.cpu ? 'cpu' : 'host')).join(', '); }));
  L.log('last guest sees:', await guests[2].$eval('.lobby-seats', (e) => e.innerText.replace(/\n/g, ' ')));
  await host.screenshot({ path: `${L.OUT}/lobby4-host.png`, fullPage: true });
  await guests[0].screenshot({ path: `${L.OUT}/lobby4-guest.png` });
  await host.click('[data-act=speed][data-v=fast]');
  await host.click('[data-act=deal]');
  for (const g of guests) await g.waitForSelector('#game:not([hidden]) .hand', { timeout: 15000 });
  const all = [host].concat(guests);
  const done = await L.play(all);
  const res = await Promise.all(all.map(L.summary));
  const errs = all.flatMap((p) => p.errs);
  L.log('4 phones, hand completed', done, JSON.stringify(res), '| errors', JSON.stringify(errs));
  await b.close();
  process.exit(done && new Set(res).size === 1 && !errs.length ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
