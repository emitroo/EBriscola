// Browser test: see test/e2e/README.md. Needs Playwright (global or local) and the app served on http://localhost:8765.
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const [SP, N, HUM, TAG, extra] = [process.argv[2] || require('os').tmpdir(), +process.argv[3], +process.argv[4], process.argv[5], process.argv[6] || ''];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click(`[data-act=n][data-v="${N}"]`);
  for (let i = HUM; i < N; i++) await p.click(`[data-act="seat-kind-${i}"][data-v="c"]`);
  await p.click('[data-act=speed][data-v=fast]');
  if (extra.includes('it')) await p.click('[data-act=lang][data-v=it]');
  if (extra.includes('swap')) await p.click('[data-act=swap][data-v="2"]');
  if (extra.includes('score')) await p.locator('#o-score').check({ force: true });
  await p.fill('#seat-name-0', 'Marco');
  await p.screenshot({ path: `${SP}/${TAG}-setup.png`, fullPage: true });
  await p.click('[data-act=deal]');
  await p.waitForTimeout(300);
  const shotAt = [3, 9];
  let turns = 0;
  for (let i = 0; i < 4000; i++) {
    const st = await p.evaluate(() => ({
      done: !!document.querySelector('.sheet .result-banner'),
      ho: !!document.querySelector('.overlay.handoff'),
      play: document.querySelectorAll('.hand:not(.off) .hc').length,
      swap: !!document.querySelector('[data-act=do-swap]'),
    }));
    if (i % 400 === 0) console.log(i, JSON.stringify(st));
    if (i === 1500) { await p.screenshot({ path: `${SP}/${TAG}-stuck.png` }); console.log(await p.evaluate(() => document.querySelector('.status')?.textContent + ' | ' + document.querySelector('#layer').textContent.slice(0, 200))); }
    if (st.done) break;
    if (st.ho) { await p.waitForTimeout(460); await p.evaluate(() => document.querySelector('.overlay.handoff button')?.click()); continue; }
    if (st.play) {
      turns++;
      if (shotAt.includes(turns)) await p.screenshot({ path: `${SP}/${TAG}-t${turns}.png` });
      if (st.swap) { await p.evaluate(() => document.querySelector('[data-act=do-swap]').click()); console.log('human swapped'); }
      await p.evaluate(() => { const c = document.querySelector('.hand:not(.off) .hc'); c.click(); document.querySelector('.hand:not(.off) .hc.sel')?.click(); });
    }
    await p.waitForTimeout(100);
  }
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${SP}/${TAG}-summary.png` });
  console.log(TAG, 'human turns', turns, 'errors:', JSON.stringify(errs));
  await b.close();
})();
