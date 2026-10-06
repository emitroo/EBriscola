// Browser test: see test/e2e/README.md. Needs Playwright (global or local) and the app served on http://localhost:8765.
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const SP = process.argv[2] || require('os').tmpdir(), MODE = process.argv[3];
const BROKER = 'ws://localhost:9000/peerjs?key=peerjs';
const base = 'http://localhost:8765/?broker=' + encodeURIComponent(BROKER);
const log = (...a) => console.log(...a);
(async () => {
  const b = await chromium.launch();
  const mk = async (dev) => { const c = await b.newContext({ ...devices[dev] }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.goto(base); await p.evaluate(() => localStorage.clear()); await p.goto(base); return p; };
  const host = await mk('Pixel 7'), guest = await mk('iPhone 13'); log('pages up');
  await host.fill('#seat-name-0', 'Marco'); await host.locator('#seat-name-0').blur();
  async function qrPair(fromBanner) {
    if (await host.locator('#setup:not([hidden])').count()) await host.click('[data-act=pair-qr]');
    else { await host.click('[data-act=menu]'); await host.click('.sheet [data-act=phones]'); await host.click('.sheet [data-act=pair-qr]'); }
    await host.waitForFunction(() => document.querySelector('#pq-mycode')?.value.startsWith('B1.'), null, { timeout: 15000 });
    const offer = await host.$eval('#pq-mycode', e => e.value); log('offer ok');

    await guest.evaluate(() => window.__briscola.openJoin(''));
    await guest.fill('#pj-name', 'Anna');
    await guest.evaluate(() => document.querySelector('#pair-layer details').open = true);
    await guest.fill('#pj-paste', offer); await guest.click('[data-act=join-paste]');
    await guest.waitForFunction(() => document.querySelector('#pj-mycode')?.value.startsWith('B1.'), null, { timeout: 15000 });
    const answer = await guest.$eval('#pj-mycode', e => e.value); log('answer ok');
    await host.evaluate(() => document.querySelector('#pair-layer details').open = true);
    await host.fill('#pq-paste', answer); await host.click('[data-act=pair-paste]');
    await host.waitForFunction(() => !document.querySelector('#pair-layer .sheet'), null, { timeout: 20000 });
  }
  async function roomPair() {
    await host.click('[data-act=room-open]');
    await host.waitForSelector('#room-code', { timeout: 15000 });
    const code = await host.$eval('#room-code', e => e.textContent.trim());
    await guest.click('[data-act=join-open]'); await guest.fill('#pj-name', 'Anna'); await guest.fill('#pj-room', code); await guest.click('[data-act=join-room]');
    return code;
  }
  const online = () => host.evaluate(() => Object.values(window.__briscola.net.devices).map(d => d.online).join());
  async function playTurns(k, untilDone) {
    for (let i = 0; i < 3000 && (untilDone || k > 0); i++) {
      const st = await Promise.all([host, guest].map(p => p.evaluate(() => ({ done: !!document.querySelector('.sheet .result-banner'), play: document.querySelectorAll('.hand:not(.off) .hc').length }))));
      if (st[0].done && st[1].done) return true;
      for (const [p, s] of [[host, st[0]], [guest, st[1]]]) if (s.play && !s.done) { k--; await p.evaluate(() => { document.querySelector('.hand:not(.off) .hc')?.click(); document.querySelector('.hand:not(.off) .hc.sel')?.click(); }); }
      await host.waitForTimeout(120);
    }
    return false;
  }
  if (MODE === 'qr') await qrPair(false); else await roomPair();
  await host.waitForSelector('.dev-row .sdot.on', { timeout: 30000 });
  await host.click('[data-act=speed][data-v=fast]');
  await host.click('[data-act=deal]');
  await guest.waitForSelector('#game:not([hidden]) .hand', { timeout: 10000 });
  await playTurns(6, false);
  log('before drop, devices online:', await online(), 'tricks', await host.evaluate(() => window.__briscola.S.session.G.tricks));
  await guest.evaluate(() => window.__briscola.net.guest.link.close('test-drop'));
  await host.waitForFunction(() => Object.values(window.__briscola.net.devices).every(d => !d.online), null, { timeout: 20000 });
  log('host sees phone offline. host chip:', await host.$eval('.net-chip', e => e.textContent).catch(() => 'none'));
  await guest.waitForTimeout(300);
  await guest.screenshot({ path: `${SP}/rc-${MODE}-guest-lost.png` });
  if (MODE === 'qr') {
    log('guest status:', await guest.evaluate(() => window.__briscola.net.guest.status));
    await qrPair(true);
  }
  await host.waitForFunction(() => Object.values(window.__briscola.net.devices).every(d => d.online), null, { timeout: 30000 });
  log('reconnected, devices online:', await online());
  await guest.waitForSelector('#game:not([hidden]) .hand', { timeout: 10000 });
  if (MODE === 'room') {
    await playTurns(4, false);
    await guest.reload();
    await guest.waitForSelector('[data-act=rejoin]', { timeout: 10000 });
    log('after reload guest sees:', await guest.$eval('[data-act=rejoin]', e => e.textContent));
    await guest.click('[data-act=rejoin]');
    await guest.waitForSelector('#game:not([hidden]) .hand', { timeout: 30000 });
    log('rejoined after reload');
  }
    const done = await playTurns(0, true);
  await guest.waitForTimeout(400);
  const res = await Promise.all([host, guest].map(p => p.evaluate(() => document.querySelector('.result-banner h2')?.textContent)));
  log('hand completed:', done, JSON.stringify(res), 'errors', JSON.stringify(host.errs), JSON.stringify(guest.errs));
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
