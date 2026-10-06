// Browser test: see test/e2e/README.md. Needs Playwright (global or local) and the app served on http://localhost:8765.
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const N = +process.argv[2] || 6;
(async () => {
  const b = await chromium.launch();
  const mk = async (dev) => { const c = await b.newContext({ ...devices[dev] }); const p = await c.newPage(); p.on('console', m => { if (m.type() === 'error' || m.text().startsWith('DBG')) console.log('  [' + dev + '] ' + m.text().slice(0, 300)); }); p.on('pageerror', e => console.log('  [' + dev + '] PAGEERR ' + e.message)); await p.goto('http://localhost:8765/'); await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:8765/'); return p; };
  const host = await mk('Pixel 7'), guest = await mk('iPhone 13');
  let ok = 0;
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    await host.evaluate(() => window.__briscola.hostPairQR());
    await host.waitForFunction(() => document.querySelector('#pq-mycode')?.value.startsWith('B1.'), null, { timeout: 15000 });
    const offer = await host.$eval('#pq-mycode', e => e.value);
    const cands = (s) => (s.match(/a=candidate[^\r\n]*/g) || []);
    await guest.evaluate(() => window.__briscola.openJoin(''));
    await guest.evaluate(() => document.querySelector('#pair-layer details').open = true);
    await guest.fill('#pj-paste', offer); await guest.click('[data-act=join-paste]');
    await guest.waitForFunction(() => document.querySelector('#pj-mycode')?.value.startsWith('B1.'), null, { timeout: 15000 });
    const answer = await guest.$eval('#pj-mycode', e => e.value);
    await host.evaluate(() => document.querySelector('#pair-layer details').open = true);
    await host.fill('#pq-paste', answer); await host.click('[data-act=pair-paste]');
    const r = await host.waitForFunction(() => !window.__briscola.net.pair, null, { timeout: 25000 }).then(() => true, () => false);
    const info = await host.evaluate(() => { const l = window.__briscola.net.pair?.link?.pc; return l ? l.iceConnectionState + '/' + l.connectionState : 'closed-ok'; });
    console.log(i, r ? 'OK' : 'FAIL', Date.now() - t0, 'ms', info);
    if (!r) {
      console.log(' host:', await host.evaluate(() => { const P = window.__briscola.net.pair; const l = P && P.link; return JSON.stringify({ dc: l && l.dc && l.dc.readyState, open: l && l.open, busy: P && P.busy, status: document.querySelector('#pq-status')?.textContent, devs: Object.keys(window.__briscola.net.devices).length }); }));
      console.log(' guest2:', await guest.evaluate(() => { const l = window.__briscola.net.guest.link; return JSON.stringify({ dc: l && l.dc && l.dc.readyState, open: l && l.open, closed: l && l.closed, pc: l && l.pc.connectionState }); }));
      console.log(' guest:', await guest.evaluate(() => { const B = window.__briscola, P = B.net.pair, l = P && P.link; return JSON.stringify({ role: B.net.role, pair: !!P, dc: l && l.dc && l.dc.readyState, open: l && l.open, status: document.querySelector('#pj-status')?.textContent, glink: !!(B.net.guest && B.net.guest.link) }); }));
    }
    if (r) ok++;
    else await host.evaluate(() => document.querySelector('[data-act=pair-close]')?.click());
    await guest.evaluate(() => { const B = window.__briscola; if (B.net.guest && B.net.guest.link) B.net.guest.link.close('x'); document.querySelector('[data-act=pair-close]')?.click(); });
    await host.waitForTimeout(1500);
  }
  console.log('ok', ok, '/', N);
  await b.close();
})().catch(e => { console.log('ERR', e.message.split('\n')[0]); process.exit(1); });
