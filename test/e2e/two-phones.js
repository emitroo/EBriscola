// Browser test: see test/e2e/README.md. Needs Playwright (global or local) and the app served on http://localhost:8765.
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const SP = process.argv[2] || require('os').tmpdir(), MODE = process.argv[3] || 'qr', BROKER = process.argv[4] || '';
const base = 'http://localhost:8765/' + (BROKER ? '?broker=' + encodeURIComponent(BROKER) : '');
(async () => {
  const b = await chromium.launch();
  const mk = async (dev) => { const c = await b.newContext({ ...devices[dev] }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); }); await p.goto(base); await p.evaluate(() => localStorage.clear()); await p.goto(base); return p; };
  const host = await mk('Pixel 7'), guest = await mk('iPhone 13');
  await host.fill('#seat-name-0', 'Marco'); await host.locator('#seat-name-0').blur();
  if (MODE === 'qr') {
    await host.click('[data-act=pair-qr]');
    await host.waitForFunction(() => document.querySelector('#pq-mycode')?.value.startsWith('B1.'), null, { timeout: 15000 });
    const offer = await host.$eval('#pq-mycode', e => e.value);
    console.log('offer code length', offer.length);
    await host.screenshot({ path: SP + '/mp-host-pair.png' });
    await guest.click('[data-act=join-open]');
    await guest.fill('#pj-name', 'Anna');
    await guest.evaluate(() => document.querySelector('details').open = true);
    await guest.fill('#pj-paste', offer);
    await guest.click('[data-act=join-paste]');
    await guest.waitForFunction(() => document.querySelector('#pj-mycode')?.value.startsWith('B1.'), null, { timeout: 15000 });
    const answer = await guest.$eval('#pj-mycode', e => e.value);
    console.log('answer code length', answer.length);
    await guest.screenshot({ path: SP + '/mp-guest-reply.png' });
    await host.evaluate(() => document.querySelector('details').open = true);
    await host.fill('#pq-paste', answer);
    await host.click('[data-act=pair-paste]');
  } else {
    await host.click('[data-act=room-open]');
    await host.waitForSelector('#room-code', { timeout: 15000 });
    const code = await host.$eval('#room-code', e => e.textContent.trim());
    console.log('room', code);
    await host.screenshot({ path: SP + '/mp-host-room.png' });
    await guest.click('[data-act=join-open]');
    await guest.fill('#pj-name', 'Anna');
    await guest.fill('#pj-room', code);
    await guest.click('[data-act=join-room]');
  }
  await host.waitForSelector('.dev-row .sdot.on', { timeout: 30000 });
  await guest.waitForSelector('.lobby-seats .lobby-seat', { timeout: 10000 });
  await guest.waitForTimeout(400);
  console.log('connected; guest lobby:', await guest.$eval('.lobby-seats', e => e.innerText.replace(/\n/g, ' | ')));
  await host.screenshot({ path: SP + '/mp-host-setup.png' });
  await guest.screenshot({ path: SP + '/mp-guest-lobby.png' });
  await host.click('[data-act=speed][data-v=fast]');
  await host.click('[data-act=deal]');
  await guest.waitForSelector('#game:not([hidden]) .hand', { timeout: 10000 });
  let leak = false, shots = 0, turns = { host: 0, guest: 0 };
  for (let i = 0; i < 3000; i++) {
    const [h, g] = await Promise.all([host, guest].map(p => p.evaluate(() => ({
      done: !!document.querySelector('.sheet .result-banner'),
      play: document.querySelectorAll('.hand:not(.off) .hc').length,
      hidden: (window.__briscola.S.session?.G?.hands || []).map(x => x.join(',')),
      role: window.__briscola.net.role,
    }))));
    if (g.role === 'guest' && !g.done && g.hidden[0] && !g.hidden[0].split(',').every(x => x === '-1')) leak = true;
    if (h.done && g.done) break;
    for (const [p, st, k] of [[host, h, 'host'], [guest, g, 'guest']]) {
      if (st.play && !st.done) {
        turns[k]++;
        if (k === 'guest' && turns.guest === 4 && shots++ < 1) { await guest.screenshot({ path: SP + '/mp-guest-game.png' }); await host.screenshot({ path: SP + '/mp-host-game.png' }); }
        await p.evaluate(() => { const c = document.querySelector('.hand:not(.off) .hc'); c && c.click(); document.querySelector('.hand:not(.off) .hc.sel')?.click(); });
      }
    }
    await host.waitForTimeout(120);
  }
  await guest.waitForTimeout(500);
  await guest.screenshot({ path: SP + '/mp-guest-summary.png' });
  const res = await Promise.all([host, guest].map(p => p.evaluate(() => document.querySelector('.result-banner h2')?.textContent)));
  console.log('summary host/guest:', JSON.stringify(res), 'turns', JSON.stringify(turns), 'leak', leak);
  // next hand requested from the guest phone
  await guest.click('[data-act=guest-next]');
  await host.waitForFunction(() => !document.querySelector('.sheet .result-banner'), null, { timeout: 5000 });
  await guest.waitForFunction(() => !document.querySelector('.sheet .result-banner'), null, { timeout: 5000 });
  console.log('next hand started from guest:', await host.evaluate(() => window.__briscola.S.session.M.hand));
  console.log('errors host', JSON.stringify(host.errs), 'guest', JSON.stringify(guest.errs));
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
