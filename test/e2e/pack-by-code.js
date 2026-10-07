// Unlocking with just the code: the app derives the token, fetches the encrypted pack from the pack server (the real
// AWS function, run locally on another origin, as the GitHub Pages copy would) and decrypts it on the phone.
const L = require('./lib');
const fs = require('fs'), path = require('path');
const PH = require('../../src/photos.js');
const { startPackApi } = require('./pack-api-server');

(async () => {
  const CODE = 'granite otter velvet';
  const data = PH.b64(new Uint8Array(fs.readFileSync(path.join(__dirname, '../../icon-192.png'))));
  const photos = {};
  for (const c of [0, 9, 28]) photos[c] = { type: 'image/png', data };
  const pack = Buffer.from(await PH.seal({ deck: 'settlers', photos }, CODE));
  const origin = new URL(L.BASE).origin;
  const srv = startPackApi({ port: 9100, token: await PH.token(CODE), pack, origin });

  const ok = [];
  const check = (label, cond) => { ok.push(cond); L.log(cond ? 'ok  ' : 'FAIL', label); };
  const b = await L.launch();
  const p = await L.phone(b, 'iPhone 13', {}, {});
  await p.addInitScript(() => { window.EB_TEST_PACK_API = 'http://127.0.0.1:9100/api/pack'; });
  await p.reload();
  await p.click('[data-act=go-local]');
  await p.click('.deck-choice');
  await p.click('.unlock-box summary');
  const status = (re) => p.waitForFunction((s) => new RegExp(s).test(document.querySelector('#unlock-status').textContent), re.source, { timeout: 20000 }).then(() => true, () => false);

  await p.fill('#unlock-code', 'wrong words here');
  await p.click('[data-act=unlock]');
  check('wrong code: server says no', await status(/Wrong code/));
  await p.fill('#unlock-code', CODE);
  await p.click('[data-act=unlock]');
  check('right code, no file: photos fetched and opened', await status(/Unlocked: Settlers, 3 photos/));
  check('stored on the phone', (await p.evaluate(() => window.__briscola.photoCount('settlers'))) === 3);
  check('the code itself was never sent', !(await p.evaluate(() => performance.getEntriesByType('resource').some((r) => /granite/.test(r.name)))));

  // Guessing is throttled: 10 tries per 10 minutes per IP (this phone has used 2).
  for (let i = 0; i < 8; i++) { await p.fill('#unlock-code', 'guess ' + i); await p.click('[data-act=unlock]'); await status(/Wrong code|Too many/); }
  await p.fill('#unlock-code', CODE);
  await p.click('[data-act=unlock]');
  check('after 10 tries: too many tries, even with the right code', await status(/Too many tries/));

  const errs = p.errs.filter((e) => !/status of 40[03]|status of 429/.test(e)); // expected refusals show as console errors
  check('no page errors ' + JSON.stringify(errs), !errs.length);
  await b.close(); srv.close();
  process.exit(ok.every(Boolean) ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
