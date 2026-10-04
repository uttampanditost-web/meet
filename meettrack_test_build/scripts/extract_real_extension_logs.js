import fs from 'fs';
import path from 'path';

const extDir = 'C:\\Users\\Admin\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Local Extension Settings\\cmfhopmhaagcfnjflfppceclmkenjkpc';
const files = fs.readdirSync(extDir);

console.log('Files in extension dir:', files);

const extractedLogs = [];

for (const file of files) {
  if (file.endsWith('.log') || file.endsWith('.ldb')) {
    const full = path.join(extDir, file);
    try {
      const content = fs.readFileSync(full, 'latin1');
      
      // Look for JSON objects containing date 2026-09-16 or slotId or attendance
      // Let's find all occurrences of JSON-like structures
      const regex = /\{[^{}]*"(?:slotId|scheduledStartTime|mentorJoinedAt|studentJoinedAt|trainerName)"[^{}]*\}/g;
      const matches = content.match(regex) || [];
      console.log(`File ${file}: found ${matches.length} regex matches`);

      for (const m of matches) {
        try {
          const parsed = JSON.parse(m);
          if (parsed.date === '2026-09-16' || (parsed.slotId && parsed.slotId.includes('2026-09-16'))) {
            extractedLogs.push(parsed);
          }
        } catch(e) {}
      }

      // Also search for array structures or larger objects
      const arrayRegex = /\[\{.*?\}\]/g;
      const arrMatches = content.match(arrayRegex) || [];
      for (const arr of arrMatches) {
        try {
          const parsed = JSON.parse(arr);
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
              if (item && (item.date === '2026-09-16' || (item.slotId && item.slotId.includes('2026-09-16')))) {
                extractedLogs.push(item);
              }
            });
          }
        } catch(e) {}
      }
    } catch(e) {
      console.error('Err reading', file, e.message);
    }
  }
}

console.log(`Total extracted logs for 2026-09-16: ${extractedLogs.length}`);
console.log('Unique logs:');
const map = new Map();
extractedLogs.forEach(l => {
  const k = l.slotId || l.id || `${l.trainerName}_${l.scheduledStartTime}`;
  map.set(k, l);
});

console.log(`Unique count: ${map.size}`);
for (const [k, v] of map.entries()) {
  console.log(JSON.stringify(v, null, 2));
}
