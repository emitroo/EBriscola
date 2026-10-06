// The host loads a photo pack once. After restarting the app, every lobby they host shares the private deck, and
// guests who never touched the deck or the pack get it with its photos, streamed from the host's phone.
const L = require('./lib');
const fs = require('fs'), path = require('path');
const PH = require('../../src/photos.js');

(async () => {
  const CODE = 'test pack code';
  const file = path.join(L.OUT, 'host-pack.ebdeck');
  const data = PH.b64(new Uint8Array(fs.readFileSync(path.join(__dirname, '../../icon-192.png'))));
  const cards = [0, 7, 8, 9, 10, 20, 28, 30, 39];
  const photos = {};
  for (const c of cards) photos[c] = { type: 'image/png', data };
  fs.writeFileSync(file, await PH.seal({ deck: 'settlers', photos }, CODE));
  const N = cards.length;

  const params = {};
  if (process.env.BROKER) params.broker = process.env.BROKER;
  const b = await L.launch();
  const ok = [];
  const check = (label, cond) => { ok.push(cond); L.log(cond ? 'ok  ' : 'FAIL', label); };
  const count = (p) => p.evaluate(() => window.__briscola.photoCount('settlers'));
  const gotDeck = (p) => p.waitForFunction((n) => (document.querySelector('.deck-choice strong') || {}).textContent === 'Settlers'
    && window.__briscola.photoCount('settlers') === n && !!document.querySelector('.deck-choice image[href^="blob:"]'), N, { timeout: 20000 }).then(() => true, () => false);

  // Once, on the host's phone, before any game.
  const host = await L.phone(b, 'Pixel 7', params);
  await host.click('[data-act=go-local]');
  await host.click('.deck-choice');
  await host.click('.unlock-box summary');
  await host.setInputFiles('#unlock-pack', file);
  await host.fill('#unlock-code', CODE);
  await host.click('[data-act=unlock]');
  await host.waitForFunction((n) => window.__briscola.photoCount('settlers') === n, N, { timeout: 20000 });
  await host.click('[data-act=close]');
  await host.waitForFunction(async (n) => Object.keys(await window.BriscolaPhotos.load('settlers')).length === n, N, { timeout: 10000 });

  // Close and reopen the app.
  await host.reload();
  await host.waitForFunction((n) => window.__briscola.photoCount('settlers') === n, N, { timeout: 10000 }).catch(() => {});
  check('host keeps the photos after restarting the app', (await count(host)) === N);
  await host.click('[data-act=go-home]').catch(() => {});

  // First lobby: two guests who do nothing but join.
  const code1 = await L.hostOnline(host, 'Marco');
  const anna = await L.phone(b, 'iPhone 13', params);
  await L.joinOnline(anna, code1, 'Anna');
  const luca = await L.phone(b, 'Pixel 7', params);
  await L.joinOnline(luca, code1, 'Luca');
  check('Anna got Settlers and the photos just by joining', await gotDeck(anna));
  check('Luca got Settlers and the photos just by joining', await gotDeck(luca));
  await luca.screenshot({ path: `${L.OUT}/host-pack-guest.png` });

  // The host closes that lobby and opens a new one: still shared, a new guest gets it too.
  await host.click('[data-act=host-end]');
  await host.click('[data-act=host-end-yes]');
  await host.waitForSelector('[data-act=host-online]', { timeout: 10000 });
  const code2 = await L.hostOnline(host, 'Marco');
  const sofia = await L.phone(b, 'Pixel 7', params);
  await L.joinOnline(sofia, code2, 'Sofia');
  check('second lobby: Sofia got Settlers and the photos just by joining', await gotDeck(sofia));

  await host.click('[data-act=speed][data-v=fast]');
  await host.click('[data-act=deal]');
  await sofia.waitForSelector('#game:not([hidden]) .hand', { timeout: 15000 });
  check('Sofia\'s hand is drawn with Settlers', await sofia.evaluate(() => !!document.querySelector('#game .hand use[href^="#bs-settlers"]')));
  const done = await L.play([host, sofia]);
  check('hand played to the end', done);

  const errs = [host, anna, luca, sofia].flatMap((p) => p.errs);
  check('no page errors ' + JSON.stringify(errs), !errs.length);
  await b.close();
  process.exit(ok.every(Boolean) ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
