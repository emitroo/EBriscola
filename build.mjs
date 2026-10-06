// Bundles src/ into a single self-contained index.html (offline PWA) and dist/artifact.html (claude.ai Artifact fragment).
// Usage: node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const css = read('./src/style.css');
const body = read('./src/body.html');
const scripts = ['vendor/qrcode.min.js', 'vendor/jsQR.min.js', 'engine.js', 'ai.js', 'decks.js', 'photos.js', 'i18n.js', 'net.js', 'app.js'].map((f) => read('./src/' + f)).join('\n;\n');
// Keep a literal "</script" out of inline code.
const js = scripts.replace(/<\/script/gi, '<\\/script');

const description = 'EBriscola: Briscola for 2 to 4 players on one phone or several, with regional Italian decks.';

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#113524">
<meta name="description" content="${description}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="EBriscola">
<title>EBriscola</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-180.png">
<style>
${css}
body { touch-action: manipulation; }
</style>
</head>
<body>
${body}
<script>
${js}
</script>
<script>
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // A new version activates in the background; reload into it unless a game is on screen.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const game = document.getElementById('game');
    if (!hadController || reloading || (game && !game.hidden)) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {}));
}
</script>
</body>
</html>
`;

// The Artifact host wraps the page in its own document skeleton and pads :root by the safe-area insets.
const artifact = `<title>EBriscola</title>
<style>
${css}
body { touch-action: manipulation; }
#game { padding-top: 0; padding-bottom: 0; }
</style>
${body}
<script>window.BRISCOLA_NO_NET = true;</script>
<script>
${js}
</script>
`;

writeFileSync(new URL('./index.html', import.meta.url), standalone);
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/artifact.html', import.meta.url), artifact);

// Service worker cache name follows the content so phones pick up new versions.
const version = createHash('sha1').update(standalone).digest('hex').slice(0, 10);
const sw = read('./src/sw.template.js').replace('__VERSION__', version);
writeFileSync(new URL('./sw.js', import.meta.url), sw);

console.log(`index.html ${(standalone.length / 1024).toFixed(1)} KB, sw version ${version}`);
