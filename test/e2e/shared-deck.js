// A private deck picked by one guest becomes the deck on every phone in the lobby, including phones that never
// entered the code, and its photos travel from that guest's phone through the host to the others (nothing is
// downloaded from the site). Only the host can turn it off again.
const L = require('./lib');
const fs = require('fs'), path = require('path');
const PH = require('../../src/photos.js');

// A test pack with placeholder images (the app icon) on the cards shown in the deck preview and a few others.
async function testPack(file, code) {
  const data = PH.b64(new Uint8Array(fs.readFileSync(path.join(__dirname, '../../icon-192.png'))));
  const photos = {};
  for (const c of [0, 10, 20, 28, 30, 37, 38, 39]) photos[c] = { type: 'image/png', data };
  fs.writeFileSync(file, await PH.seal({ deck: 'settlers', photos }, code));
  return Object.keys(photos).length;
}

(async () => {
  // PACK=<file> PACK_N=<photos> PACK_CODE=<code> runs the same flow with a real pack (never commit one).
  const CODE = process.env.PACK_CODE || 'test pack code';
  const pack = process.env.PACK || path.join(L.OUT, 'test-settlers.ebdeck');
  const packN = process.env.PACK ? +process.env.PACK_N : await testPack(pack, CODE);
  const params = {};
  if (process.env.BROKER) params.broker = process.env.BROKER;
  const b = await L.launch();
  const host = await L.phone(b, 'Pixel 7', params);
  const code = await L.hostOnline(host, 'Marco');
  const anna = await L.phone(b, 'iPhone 13', params);
  await L.joinOnline(anna, code, 'Anna');
  const luca = await L.phone(b, 'Pixel 7', params);
  await L.joinOnline(luca, code, 'Luca');
  await host.waitForFunction(() => window.__briscola.S.settings.lobby.n === 3, null, { timeout: 10000 });
  const deckName = (p) => p.$eval('.deck-choice strong', (e) => e.textContent);
  const waitDeck = (p, name) => p.waitForFunction((n) => (document.querySelector('.deck-choice strong') || {}).textContent === n, name, { timeout: 10000 });
  const pickers = async (p) => p.$$eval('.deck-tile', (ts) => ts.map((t) => t.dataset.v));
  const ok = [];
  const check = (label, cond) => { ok.push(cond); L.log(cond ? 'ok  ' : 'FAIL', label); };

  // Only Anna has the code and the photo pack.
  await anna.click('.deck-choice');
  check('Settlers hidden before unlock', !(await pickers(anna)).includes('settlers'));
  await anna.click('.unlock-box summary');
  await anna.setInputFiles('#unlock-pack', pack);
  await anna.fill('#unlock-code', 'wrongcode');
  await anna.click('[data-act=unlock]');
  await anna.waitForFunction(() => /Wrong code|sbagliato/.test(document.querySelector('#unlock-status').textContent), null, { timeout: 15000 });
  check('wrong code rejected', true);
  await anna.fill('#unlock-code', CODE);
  await anna.click('[data-act=unlock]');
  await anna.waitForFunction((n) => window.__briscola.photoCount('settlers') === n, packN, { timeout: 20000 });
  check('pack opened on Anna\'s phone: ' + packN + ' photos', true);
  await anna.click('[data-act=close]');
  await waitDeck(anna, 'Settlers');
  await waitDeck(host, 'Settlers');
  await waitDeck(luca, 'Settlers');
  check('host and Luca switched to Settlers without the code', (await deckName(host)) === 'Settlers' && (await deckName(luca)) === 'Settlers');
  check('shared label shown', !!(await luca.$('.deck-shared')));
  check('Settlers now in Luca\'s picker', await luca.evaluate(() => window.__briscola.S.settings.unlocked.includes('settlers')));
  const hasPhotos = (p, n) => p.waitForFunction((k) => window.__briscola.photoCount('settlers') === k && !!document.querySelector('.deck-choice image[href^="blob:"]'), n, { timeout: 20000 }).then(() => true, () => false);
  check('photos reached the host (from Anna)', await hasPhotos(host, packN));
  const t0 = Date.now();
  check('photos reached Luca (through the host)', await hasPhotos(luca, packN));
  L.log('host to Luca transfer finished within', Date.now() - t0, 'ms of the host having them');
  await luca.waitForFunction(async (k) => Object.keys(await window.BriscolaPhotos.load('settlers')).length === k, packN, { timeout: 10000 }); // saved
  await luca.reload();
  await luca.waitForFunction((k) => window.__briscola.photoCount('settlers') === k, packN, { timeout: 10000 }).catch(() => {});
  check('Luca keeps the photos after closing and reopening the app', (await luca.evaluate(() => window.__briscola.photoCount('settlers'))) === packN);
  await luca.click('[data-act=join-room]'); // the join screen comes back with the last code filled in
  await luca.waitForSelector('.lobby-seats .lobby-seat', { timeout: 40000 });
  await waitDeck(luca, 'Settlers');
  const net = await luca.evaluate(() => performance.getEntriesByType('resource').filter((r) => /settlers|ebdeck/.test(r.name)).length);
  check('no photo was downloaded from the site', net === 0);
  await luca.screenshot({ path: `${L.OUT}/shared-deck-luca-lobby.png` });

  // In the game every phone draws Settlers cards.
  await host.click('[data-act=speed][data-v=fast]');
  await host.click('[data-act=deal]');
  for (const g of [anna, luca]) await g.waitForSelector('#game:not([hidden]) .hand', { timeout: 15000 });
  await host.waitForSelector('#game:not([hidden]) .hand', { timeout: 15000 });
  const usesSettlers = (p) => p.evaluate(() => !!document.querySelector('#game .hand use[href^="#bs-settlers"]'));
  check('all three hands drawn with Settlers', (await usesSettlers(host)) && (await usesSettlers(anna)) && (await usesSettlers(luca)));
  await luca.screenshot({ path: `${L.OUT}/shared-deck-luca-game.png` });

  // The table re-renders on every play, so tap through the DOM rather than waiting for a stable element.
  const tap = (p, sel) => p.waitForFunction((s) => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel, { timeout: 10000 });
  const pickDeck = async (p, id) => { await tap(p, '.icon-btn[data-act=menu]'); await tap(p, '[data-act=decks]'); await tap(p, `[data-act=pick-deck][data-v=${id}]`); };

  // A guest picking a regular deck doesn't turn the shared deck off: only the host can.
  await pickDeck(luca, 'napoletane');
  await host.waitForTimeout(1500);
  check('guest can\'t turn the shared deck off', (await usesSettlers(host)) && (await usesSettlers(luca)) && (await usesSettlers(anna)));

  // The host picks a regular deck: everyone goes back to their own choice.
  await pickDeck(host, 'triestine');
  await luca.waitForFunction(() => !!document.querySelector('#game .hand use[href^="#bs-napoletane"]'), null, { timeout: 10000 });
  check('host turned it off: host on Triestine, Luca on his own pick (Napoletane)', !(await usesSettlers(host)) && !(await usesSettlers(luca)));
  check('Anna keeps Settlers (her own pick)', await usesSettlers(anna));

  const errs = [host, anna, luca].flatMap((p) => p.errs);
  check('no page errors ' + JSON.stringify(errs), !errs.length);
  await b.close();
  process.exit(ok.every(Boolean) ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
