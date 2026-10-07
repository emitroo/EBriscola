// Prints the SHA-256 of a pack's download token, for the PackTokenHash parameter of the AWS stack.
//   node tools/pack-token.mjs '<code>'
// The pack server stores only this hash; the code and the encryption key never leave the phones.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const P = createRequire(import.meta.url)('../src/photos.js');
const code = process.argv[2];
if (!code) { console.error("usage: node tools/pack-token.mjs '<code>'"); process.exit(1); }
console.log(createHash('sha256').update(await P.token(code)).digest('hex'));
