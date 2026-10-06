// The guest scans a real host pairing QR through a fake camera feed (jsQR path, as on iPhone),
// then the phones pair across two separate browser processes.
const L = require('./lib');
const fs = require('fs'), { execFileSync } = require('child_process');
(async () => {
  const cam = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
  const hb = await L.launch(cam);
  const host = await L.phone(hb, 'Pixel 7', {}, { permissions: ['camera'] });
  await L.hostNearby(host, 'Marco');
  await host.click('[data-act=pair-qr]');
  await host.waitForFunction(() => document.querySelector('#pq-mycode')?.value.startsWith('B1.'), null, { timeout: 15000 });
  const offer = await host.$eval('#pq-mycode', (e) => e.value);
  const lan = /a=candidate[^\n]* (\d+\.\d+\.\d+\.\d+) \d+ typ host/.test(await host.evaluate(() => window.__briscola.net.pair.link.pc.localDescription.sdp));
  L.log('host offer includes a LAN IPv4 address (camera granted):', lan);
  await host.screenshot({ path: `${L.OUT}/cam-host-step1.png` });
  const matrix = await host.evaluate((code) => { const q = qrcode(0, 'L'); q.addData(code, 'Byte'); q.make(); const n = q.getModuleCount(); const m = []; for (let r = 0; r < n; r++) { let row = ''; for (let c = 0; c < n; c++) row += q.isDark(r, c) ? '1' : '0'; m.push(row); } return m; }, offer);
  fs.writeFileSync(`${L.OUT}/qr.json`, JSON.stringify(matrix));
  execFileSync('python3', [__dirname + '/y4m.py', `${L.OUT}/qr.json`, `${L.OUT}/qr.y4m`]);
  const gb = await L.launch(cam.concat([`--use-file-for-fake-video-capture=${L.OUT}/qr.y4m`]));
  const guest = await L.phone(gb, 'iPhone 13', {}, { permissions: ['camera'] });
  L.log('guest has BarcodeDetector:', await guest.evaluate(() => 'BarcodeDetector' in window), '(false = jsQR, as on iPhone)');
  await guest.click('[data-act=join-nearby]');
  await guest.fill('#pj-name', 'Anna');
  await guest.waitForFunction(() => document.querySelector('#pj-mycode')?.value.startsWith('B1.'), null, { timeout: 25000 });
  L.log('guest scanned the host QR with its camera and shows its reply');
  await guest.screenshot({ path: `${L.OUT}/cam-guest-step2.png` });
  const answer = await guest.$eval('#pj-mycode', (e) => e.value);
  await host.click('[data-act=pair-next]');
  await host.screenshot({ path: `${L.OUT}/cam-host-step2.png` });
  await host.evaluate(() => { document.querySelector('#pair-layer details').open = true; });
  await host.fill('#pq-paste', answer); await host.click('[data-act=pair-paste]');
  const ok = await host.waitForFunction(() => Object.values(window.__briscola.net.devices).some((d) => d.online), null, { timeout: 30000 }).then(() => true, () => false);
  L.log('paired across two browser processes:', ok, '| errors', JSON.stringify(host.errs), JSON.stringify(guest.errs));
  await hb.close(); await gb.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
