import fs from 'fs';
import path from 'path';

const baseDir = 'C:\\Users\\Admin\\AppData\\Local\\Google\\Chrome\\User Data\\Default';

function searchFile(full) {
  try {
    const s = fs.readFileSync(full, 'latin1');
    if (s.includes('studentName') || s.includes('student_name') || s.includes('studentJoinedAt') || s.includes('student_join_time')) {
      console.log('Match found in:', full);
      const studentMatches = s.match(/"student(?:Name|_name)"\s*:\s*"([^"]+)"/g) || [];
      const emailMatches = s.match(/"(?:studentEmail|student_email|email)"\s*:\s*"([^"]+)"/g) || [];
      const joinMatches = s.match(/"(?:studentJoinedAt|student_join_time)"\s*:\s*"([^"]+)"/g) || [];
      if (studentMatches.length > 0) {
        console.log('  Students:', studentMatches.slice(0, 10));
      }
      if (emailMatches.length > 0) {
        console.log('  Emails:', emailMatches.slice(0, 10));
      }
      if (joinMatches.length > 0) {
        console.log('  Joins:', joinMatches.slice(0, 10));
      }
    }
  } catch(e) {}
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    try {
      if (fs.statSync(p).isDirectory()) {
        walk(p);
      } else if (f.endsWith('.log') || f.endsWith('.ldb')) {
        searchFile(p);
      }
    } catch(e) {}
  }
}

console.log('--- Searching Local Storage ---');
walk(path.join(baseDir, 'Local Storage'));
console.log('--- Searching Extension Settings ---');
walk(path.join(baseDir, 'Local Extension Settings'));
