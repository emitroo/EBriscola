// A private deck picked by one guest becomes the deck on every phone in the lobby, including phones that never
// entered the code; picking a regular deck turns it off again.
const L = require('./lib');
(async () => {
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

  // Only Anna unlocks the deck, then picks it.
  await anna.click('.deck-choice');
  check('Settlers hidden before unlock', !(await pickers(anna)).includes('settlers'));
  await anna.click('.unlock-box summary');
  await anna.fill('#unlock-code', 'REDACTED');
  await anna.click('[data-act=unlock]');
  await anna.click('[data-act=close]');
  await waitDeck(anna, 'Settlers');
  await waitDeck(host, 'Settlers');
  await waitDeck(luca, 'Settlers');
  check('host and Luca switched to Settlers without the code', (await deckName(host)) === 'Settlers' && (await deckName(luca)) === 'Settlers');
  check('shared label shown', !!(await luca.$('.deck-shared')));
  check('Settlers now in Luca\'s picker', await luca.evaluate(() => window.__briscola.S.settings.unlocked.includes('settlers')));
  await luca.screenshot({ path: `${L.OUT}/shared-deck-luca-lobby.png` });

  // In the game every phone draws Settlers cards.
  await host.click('[data-act=speed][data-v=fast]');
  await host.click('[data-act=deal]');
  for (const g of [anna, luca]) await g.waitForSelector('#game:not([hidden]) .hand', { timeout: 15000 });
  await host.waitForSelector('#game:not([hidden]) .hand', { timeout: 15000 });
  const usesSettlers = (p) => p.evaluate(() => !!document.querySelector('#game .hand use[href^="#bs-settlers"]'));
  check('all three hands drawn with Settlers', (await usesSettlers(host)) && (await usesSettlers(anna)) && (await usesSettlers(luca)));
  await luca.screenshot({ path: `${L.OUT}/shared-deck-luca-game.png` });

  // Luca turns it off from the in-game menu by picking a regular deck; everyone goes back to their own choice.
  // The table re-renders on every play, so tap through the DOM rather than waiting for a stable element.
  const tap = (p, sel) => p.waitForFunction((s) => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel, { timeout: 10000 });
  await tap(luca, '.icon-btn[data-act=menu]');
  await tap(luca, '.sheet [data-act=decks], [data-act=decks]');
  await tap(luca, '[data-act=pick-deck][data-v=napoletane]');
  await host.waitForFunction(() => !document.querySelector('#game .hand use[href^="#bs-settlers"]'), null, { timeout: 10000 });
  await luca.waitForFunction(() => !!document.querySelector('#game .hand use[href^="#bs-napoletane"]'), null, { timeout: 10000 });
  check('host back to its own deck, Luca on Napoletane', !(await usesSettlers(host)) && !(await usesSettlers(luca)));
  check('Anna keeps Settlers (her own pick)', await usesSettlers(anna));

  const errs = [host, anna, luca].flatMap((p) => p.errs);
  check('no page errors ' + JSON.stringify(errs), !errs.length);
  await b.close();
  process.exit(ok.every(Boolean) ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
