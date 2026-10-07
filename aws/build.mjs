// Writes aws/template.yaml from aws/template.src.yaml, inlining the Lambda code (CloudFormation ZipFile, max 4096 chars).
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), 'utf8');
let t = read('template.src.yaml');
for (const [mark, file] of [['__PACK_CODE__', 'functions/pack.js'], ['__CUTOFF_CODE__', 'functions/cutoff.js']]) {
  const code = read(file).trimEnd();
  if (code.length > 4096) throw new Error(`${file} is ${code.length} chars; CloudFormation inline code allows 4096`);
  t = t.replace(mark, code.split('\n').map((l) => (l ? '          ' + l : '')).join('\n'));
}
writeFileSync(new URL('template.yaml', dir), t);
console.log('aws/template.yaml written');
