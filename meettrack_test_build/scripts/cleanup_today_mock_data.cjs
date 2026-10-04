const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data_store.json');
const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));

const today = '2026-09-16';

console.log('--- Cleaning up today mock data from data_store.json ---');

// 1. Remove all mock attendance logs for 2026-09-16
const beforeLogs = (data.attendanceLogs || []).length;
data.attendanceLogs = (data.attendanceLogs || []).filter(l => l.date !== today);
console.log(`Removed ${beforeLogs - data.attendanceLogs.length} mock logs for ${today}.`);

// 2. Reset any slots for 2026-09-16 to clean scheduled open slots
if (Array.isArray(data.slots)) {
  data.slots.forEach(slot => {
    if (slot.date === today) {
      slot.studentName = 'Open Slot';
      slot.studentEmail = '';
      slot.status = 'scheduled';
    }
  });
}

fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
console.log('✅ data_store.json cleaned successfully.');
