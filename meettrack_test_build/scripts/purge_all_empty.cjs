const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const cfg = JSON.parse(fs.readFileSync('supabase-config.json', 'utf8'));
const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

async function purgeAllEmpty() {
  console.log('--- Purging ALL empty rows from Supabase attendance_logs ---');
  let totalPurged = 0;
  while (true) {
    const { data: rows, error } = await sb
      .from('attendance_logs')
      .select('id, date, mentor_join_time, student_join_time, duration_seconds')
      .is('mentor_join_time', null)
      .is('student_join_time', null)
      .or('duration_seconds.is.null,duration_seconds.eq.0')
      .limit(300);

    if (error) {
      console.error('Error selecting:', error);
      break;
    }

    if (!rows || rows.length === 0) {
      console.log('No more empty rows found.');
      break;
    }

    const ids = rows.map(r => r.id);
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      const { error: delErr } = await sb.from('attendance_logs').delete().in('id', chunk);
      if (delErr) {
        console.error('Delete error:', delErr);
      } else {
        totalPurged += chunk.length;
      }
    }
    console.log(`Purged ${ids.length} rows (Total so far: ${totalPurged})`);
  }

  // Final count of attended rows
  const { data: finalRows } = await sb
    .from('attendance_logs')
    .select('id, date, trainer_name, student_name, mentor_join_time, student_join_time, duration_seconds, punctuality')
    .order('date', { ascending: false });

  console.log(`\n🎉 Total legitimate attended records in Supabase: ${finalRows ? finalRows.length : 0}`);
  const perDate = {};
  (finalRows || []).forEach(r => {
    perDate[r.date] = (perDate[r.date] || 0) + 1;
  });
  console.log('Attended records per date:', perDate);
  (finalRows || []).slice(0, 10).forEach(r => {
    console.log(`[${r.date}] ${r.trainer_name} -> student: ${r.student_name}, mJoin: ${r.mentor_join_time}, sJoin: ${r.student_join_time}, dur: ${r.duration_seconds}s`);
  });
}

purgeAllEmpty();
