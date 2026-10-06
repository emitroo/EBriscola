// Builds an encrypted photo pack for a private deck. The pack only opens with the deck code.
//   node tools/make-pack.mjs <folder> <code> [out.ebdeck] [deck-id]
// The folder holds one image per card, named by card id: c00.jpg … c39.jpg (jpg, png or webp).
// Card id = suit × 10 + rank − 1; suits Denari 0, Coppe 1, Spade 2, Bastoni 3; Fante 8, Cavallo 9, Re 10.
// Keep the folder and the pack out of the repo (both are in .gitignore).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const P = createRequire(import.meta.url)('../src/photos.js');

const [dir, code, out = 'settlers.ebdeck', deck = 'settlers'] = process.argv.slice(2);
if (!dir || !code) { console.error('usage: node tools/make-pack.mjs <folder> <code> [out.ebdeck] [deck-id]'); process.exit(1); }
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const photos = {};
for (const f of readdirSync(dir)) {
  const m = /^c(\d\d)\.(jpe?g|png|webp)$/i.exec(f);
  if (!m || +m[1] > 39) continue;
  photos[+m[1]] = { type: TYPES[m[2].toLowerCase()], data: P.b64(new Uint8Array(readFileSync(join(dir, f)))) };
}
const n = Object.keys(photos).length;
if (!n) { console.error('no cNN.jpg/png/webp files in', dir); process.exit(1); }
const bytes = await P.seal({ deck, photos }, code);
const back = await P.open(bytes, code); // check it opens
if (Object.keys(back.photos).length !== n) { console.error('pack check failed'); process.exit(1); }
writeFileSync(out, bytes);
console.log(`${out}: ${n} photos for "${deck}", ${(bytes.length / 1024).toFixed(0)} KB`);
