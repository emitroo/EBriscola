// Shared helpers for the browser tests. Needs Playwright (local or global) and the app served at BASE.
const { chromium, devices } = (() => {
  try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
})();

const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = process.env.OUT || require('os').tmpdir();
const log = (...a) => console.log(...a);

function url(params) {
  const q = new URLSearchParams(params || {}).toString();
  return BASE + (q ? (BASE.includes('?') ? '&' : '?') + q : '');
}

async function launch(args) {
  const opts = { args: args || [] };
  if (process.env.HTTPS_PROXY && /^https:/.test(BASE)) opts.proxy = { server: process.env.HTTPS_PROXY };
  return chromium.launch(opts);
}

/** A fresh phone with empty storage. */
async function phone(browser, model, params, extra) {
  const ctx = await browser.newContext(Object.assign({ ...devices[model] }, extra || {}));
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(url(params));
  await p.evaluate(() => localStorage.clear());
  await p.goto(url(params));
  return p;
}

const devicesOnline = (host) => host.evaluate(() => Object.values(window.__briscola.net.devices).filter((d) => d.online).length);

async function hostNearby(host, name) {
  await host.click('[data-act=host-nearby]');
  await host.fill('#seat-name-0', name); await host.locator('#seat-name-0').blur();
}

/** Nearby pairing with the text codes (headless browsers have no camera). */
async function pairNearby(host, guest, guestName) {
  const before = await devicesOnline(host);
  await host.evaluate(() => window.__briscola.hostPairQR());
  await host.waitForFunction(() => document.querySelector('#pq-mycode')?.value.startsWith('B1.'), null, { timeout: 15000 });
  const offer = await host.$eval('#pq-mycode', (e) => e.value);
  await guest.evaluate(() => window.__briscola.openNearbyJoin());
  if (guestName) await guest.fill('#pj-name', guestName);
  await guest.evaluate(() => { document.querySelector('#pair-layer details').open = true; });
  await guest.fill('#pj-paste', offer);
  await guest.click('[data-act=join-paste]');
  await guest.waitForFunction(() => document.querySelector('#pj-mycode')?.value.startsWith('B1.'), null, { timeout: 15000 });
  const answer = await guest.$eval('#pj-mycode', (e) => e.value);
  await host.evaluate(() => { document.querySelector('#pair-layer details').open = true; });
  await host.fill('#pq-paste', answer);
  await host.click('[data-act=pair-paste]');
  await host.waitForFunction((n) => Object.values(window.__briscola.net.devices).filter((d) => d.online).length > n, before, { timeout: 30000 });
  return { offer, answer };
}

async function hostOnline(host, name) {
  await host.click('[data-act=host-online]');
  await host.fill('#seat-name-0', name); await host.locator('#seat-name-0').blur();
  await host.waitForSelector('#room-code', { timeout: 20000 });
  return host.$eval('#room-code', (e) => e.textContent.trim());
}

async function joinOnline(guest, code, name) {
  await guest.click('[data-act=join-online]');
  await guest.fill('#my-name', name);
  await guest.fill('#pj-room', code);
  await guest.click('[data-act=join-room]');
  await guest.waitForSelector('.lobby-seats .lobby-seat', { timeout: 40000 });
}

/** Tap cards on every phone whose turn it is until all show the hand summary (or `turns` taps are made). */
async function play(phones, turns) {
  let taps = 0;
  for (let i = 0; i < 4000; i++) {
    const st = await Promise.all(phones.map((p) => p.evaluate(() => ({
      done: !!document.querySelector('.sheet .result-banner'),
      play: document.querySelectorAll('.hand:not(.off) .hc').length,
      handoff: !!document.querySelector('.overlay.handoff'),
    }))));
    if (st.every((s) => s.done)) return true;
    for (let k = 0; k < phones.length; k++) {
      const p = phones[k], s = st[k];
      if (s.done) continue;
      if (s.handoff) { await p.waitForTimeout(460); await p.evaluate(() => document.querySelector('.overlay.handoff button')?.click()); continue; }
      if (s.play) {
        taps++;
        await p.evaluate(() => { document.querySelector('.hand:not(.off) .hc')?.click(); document.querySelector('.hand:not(.off) .hc.sel')?.click(); });
        if (turns && taps >= turns) return false;
      }
    }
    await phones[0].waitForTimeout(120);
  }
  return false;
}

/** True if a guest phone ever holds real values for cards it should not see. */
async function guestSeesOnly(guest) {
  return guest.evaluate(() => {
    const B = window.__briscola, s = B.S.session;
    if (!s || !s.G || s.G.phase === 'over') return true;
    return s.G.hands.every((h, p) => s.cfg.seats[p].remote === 'me' || h.every((c) => c === -1)) && s.G.deck.every((c) => c === -1);
  });
}

const summary = (p) => p.evaluate(() => document.querySelector('.result-banner h2')?.textContent || null);

module.exports = { chromium, devices, BASE, OUT, log, url, launch, phone, devicesOnline, hostNearby, pairNearby, hostOnline, joinOnline, play, guestSeesOnly, summary };
