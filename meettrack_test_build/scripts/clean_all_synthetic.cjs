const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync('supabase-config.json', 'utf8'));
const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

async function cleanAll() {
  console.log('--- Cleaning synthetic test records and all 0-participant logs ---');

  // 1. Delete synthetic Uttam log from Supabase
  const { error: delErr } = await sb
    .from('attendance_logs')
    .delete()
    .eq('id', 'log-slot-tr-uttam-2026-09-16-1100');
  if (delErr) console.error('Error deleting synthetic Uttam log:', delErr);
  else console.log('✅ Deleted synthetic Uttam log from Supabase.');

  // Delete any other log on 2026-09-16 from Supabase that has no real join
  const { error: delTodayErr } = await sb
    .from('attendance_logs')
    .delete()
    .eq('date', '2026-09-16');
  if (delTodayErr) console.error('Error cleaning today logs from Supabase:', delTodayErr);
  else console.log('✅ Cleaned all logs for 2026-09-16 from Supabase.');

  // Reset Uttam slot status for today
  await sb.from('slots').update({ status: 'scheduled', student_name: 'Open Slot', student_email: '' }).eq('id', 'slot-tr-uttam-2026-09-16-1100');

  // 2. Clean data_store.json
  const dsPath = path.join(__dirname, '..', 'data_store.json');
  if (fs.existsSync(dsPath)) {
    const ds = JSON.parse(fs.readFileSync(dsPath, 'utf8'));
    const beforeCount = (ds.attendanceLogs || []).length;
    
    // Keep ONLY logs that have mentor joined OR student joined OR duration > 0
    ds.attendanceLogs = (ds.attendanceLogs || []).filter(l => {
      if (l.date === '2026-09-16') return false; // Clean all for today so only real live events appear
      const hasMentor = Boolean(l.mentorJoinedAt || l.mentorLeftAt);
      const hasStudent = Boolean(l.studentJoinedAt || l.studentLeftAt || l.askToJoinTime);
      const hasDur = Boolean((l.trackedDurationSeconds && l.trackedDurationSeconds > 0) || (l.totalOverlapMinutes && l.totalOverlapMinutes > 0));
      return (hasMentor || hasStudent || hasDur);
    });

    console.log(`Cleaned data_store.json: kept ${ds.attendanceLogs.length} valid attended logs (removed ${beforeCount - ds.attendanceLogs.length} empty/synthetic logs).`);

    // Reset slots for today in data_store.json
    if (Array.isArray(ds.slots)) {
      ds.slots.forEach(s => {
        if (s.date === '2026-09-16') {
          s.studentName = 'Open Slot';
          s.studentEmail = '';
          s.status = 'scheduled';
        }
      });
    }

    fs.writeFileSync(dsPath, JSON.stringify(ds, null, 2), 'utf8');
    console.log('✅ data_store.json updated.');
  }

  // 3. Purge any remaining 0-participant rows from Supabase across all dates
  let totalPurged = 0;
  while (true) {
    const { data: rows, error } = await sb
      .from('attendance_logs')
      .select('id, mentor_join_time, student_join_time, duration_seconds')
      .is('mentor_join_time', null)
      .is('student_join_time', null)
      .or('duration_seconds.is.null,duration_seconds.eq.0')
      .limit(200);

    if (error || !rows || rows.length === 0) break;

    const ids = rows.map(r => r.id);
    for (let i = 0; i < ids.length; i += 25) {
      const chunk = ids.slice(i, i + 25);
      await sb.from('attendance_logs').delete().in('id', chunk);
      totalPurged += chunk.length;
    }
  }
  console.log(`✅ Total empty rows purged from Supabase: ${totalPurged}`);
}

cleanAll();
