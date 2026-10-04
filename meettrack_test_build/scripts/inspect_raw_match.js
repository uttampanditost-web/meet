import fs from 'fs';
import path from 'path';

const file = 'C:\\Users\\Admin\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Local Extension Settings\\cmfhopmhaagcfnjflfppceclmkenjkpc\\010864.log';
const buf = fs.readFileSync(file);
const str = buf.toString('latin1');

let idx = 0;
let found = 0;
while ((idx = str.indexOf('2026-09-16', idx)) !== -1 && found < 20) {
  const start = Math.max(0, idx - 100);
  const end = Math.min(str.length, idx + 300);
  console.log(`--- Match ${found + 1} at ${idx} ---`);
  console.log(str.slice(start, end).replace(/[^\x20-\x7E\n\r\t]/g, '.'));
  idx += 10;
  found++;
}
