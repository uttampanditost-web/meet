import fs from 'fs';
import path from 'path';

const baseDir = 'C:\\Users\\Admin\\AppData\\Local\\Google\\Chrome\\User Data\\Default';

function searchInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    try {
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        searchInDir(full);
      } else if (f.endsWith('.ldb') || f.endsWith('.log') || f.endsWith('.json')) {
        const str = fs.readFileSync(full, 'latin1');
        if (str.includes('2026-09-16') || str.includes('meettrack') || str.includes('meet.google.com')) {
          const c16 = (str.match(/2026-09-16/g) || []).length;
          if (c16 > 0) {
            console.log('Match in:', full, 'count 2026-09-16:', c16);
          }
        }
      }
    } catch(e) {}
  }
}

console.log('Searching Extension Settings...');
searchInDir(path.join(baseDir, 'Local Extension Settings'));
console.log('Searching Local Storage...');
searchInDir(path.join(baseDir, 'Local Storage'));
console.log('Searching IndexedDB...');
searchInDir(path.join(baseDir, 'IndexedDB'));
