// One phone: 1 human + CPUs (or pass-and-play), full hand. Usage: node one-phone.js [players=4] [humans=1]
const L = require('./lib');
(async () => {
  const n = +process.argv[2] || 4, humans = +process.argv[3] || 1;
  const b = await L.launch();
  const p = await L.phone(b, 'Pixel 7');
  await p.click('[data-act=go-local]');
  await p.click(`[data-act=n][data-v="${n}"]`);
  for (let i = humans; i < n; i++) await p.click(`[data-act="seat-kind-${i}"][data-v="c"]`);
  await p.click('[data-act=speed][data-v=fast]');
  await p.click('[data-act=deal]');
  const done = await L.play([p]);
  L.log('one phone,', n, 'players,', humans, 'human(s): hand completed', done, '-', await L.summary(p), '| errors', JSON.stringify(p.errs));
  await b.close();
  process.exit(done && !p.errs.length ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
