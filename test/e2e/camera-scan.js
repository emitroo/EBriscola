// Browser test: see test/e2e/README.md. Needs Playwright (global or local) and the app served on http://localhost:8765.
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const fs = require('fs'), { execFileSync } = require('child_process');
const SP = process.argv[2] || require('os').tmpdir();
(async () => {
  // 1. Host phone makes a real pairing code.
  const hb = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const hc = await hb.newContext({ ...devices['Pixel 7'], permissions: ['camera'] }); const host = await hc.newPage();
  host.on('pageerror', e => console.log('host err', e.message));
  await host.goto('http://localhost:8765/'); await host.evaluate(() => localStorage.clear()); await host.goto('http://localhost:8765/');
  await host.fill('#seat-name-0', 'Marco'); await host.locator('#seat-name-0').blur();
  await host.click('[data-act=pair-qr]');
  await host.waitForFunction(() => document.querySelector('#pq-mycode')?.value.startsWith('B1.'), null, { timeout: 15000 });
  const offer = await host.$eval('#pq-mycode', e => e.value);
  console.log('host camera status:', await host.$eval('#pq-status', e => e.textContent));
  const hasRealIp = /a=candidate[^\n]* (\d+\.\d+\.\d+\.\d+) \d+ typ host/.test(await host.evaluate(() => window.__briscola.net.pair.link.pc.localDescription.sdp));
  console.log('offer exposes LAN IPv4 (camera granted):', hasRealIp);
  await host.screenshot({ path: SP + '/cam-host.png' });
  // 2. Render the QR to a fake camera video for the guest.
  const matrix = await host.evaluate((code) => { const q = qrcode(0, 'L'); q.addData(code, 'Byte'); q.make(); const n = q.getModuleCount(); const m = []; for (let r = 0; r < n; r++) { let row = ''; for (let c = 0; c < n; c++) row += q.isDark(r, c) ? '1' : '0'; m.push(row); } return m; }, offer);
  fs.writeFileSync(SP + '/qr.json', JSON.stringify(matrix));
  execFileSync('python3', [__dirname + '/y4m.py', SP + '/qr.json', SP + '/qr.y4m']);
  // 3. Guest phone scans it with the camera.
  const gb = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${SP}/qr.y4m`] });
  const gc = await gb.newContext({ ...devices['iPhone 13'], permissions: ['camera'] }); const guest = await gc.newPage();
  guest.on('pageerror', e => console.log('guest err', e.message));
  await guest.goto('http://localhost:8765/'); await guest.evaluate(() => localStorage.clear()); await guest.goto('http://localhost:8765/');
  const bd = await guest.evaluate(() => 'BarcodeDetector' in window);
  console.log('guest BarcodeDetector available:', bd, '(false means the jsQR path, as on iPhone)');
  await guest.click('[data-act=join-open]'); await guest.fill('#pj-name', 'Anna');
  await guest.click('[data-act=join-scan]');
  await guest.waitForFunction(() => document.querySelector('#pj-mycode')?.value.startsWith('B1.'), null, { timeout: 20000 });
  console.log('guest scanned the host QR with the camera and produced a reply');
  await guest.screenshot({ path: SP + '/cam-guest.png' });
  const answer = await guest.$eval('#pj-mycode', e => e.value);
  // 4. Host: paste reply (its fake camera shows a test pattern), different browsers -> real network path.
  await host.evaluate(() => document.querySelector('#pair-layer details').open = true);
  await host.fill('#pq-paste', answer); await host.click('[data-act=pair-paste]');
  const ok = await host.waitForSelector('.dev-row .sdot.on', { timeout: 30000 }).then(() => true, () => false);
  console.log('paired across two separate browser processes:', ok);
  await hb.close(); await gb.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
