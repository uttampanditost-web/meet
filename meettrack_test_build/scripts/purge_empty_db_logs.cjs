const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const cfg = JSON.parse(fs.readFileSync('supabase-config.json', 'utf8'));
const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

async function purgeEmptyUnattended() {
  console.log('--- Purging 0-participant empty unattended rows from Supabase attendance_logs ---');
  try {
    // Delete rows where mentor_join_time IS NULL AND student_join_time IS NULL AND duration_seconds = 0 (or null)
    const { data: toDelete, error: selectErr } = await sb
      .from('attendance_logs')
      .select('id, date, trainer_name, mentor_join_time, student_join_time, duration_seconds')
      .is('mentor_join_time', null)
      .is('student_join_time', null)
      .or('duration_seconds.is.null,duration_seconds.eq.0');

    if (selectErr) {
      console.error('Select error:', selectErr);
      return;
    }

    console.log(`Found ${toDelete.length} empty unattended rows to purge.`);

    if (toDelete.length > 0) {
      const ids = toDelete.map(r => r.id);
      // Delete in chunks
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error: delErr } = await sb
          .from('attendance_logs')
          .delete()
          .in('id', chunk);
        if (delErr) console.error('Delete chunk err:', delErr);
      }
      console.log(`✅ Successfully purged ${ids.length} empty unattended rows from Supabase!`);
    }

    // Check remaining attended rows in Supabase
    const { data: remaining } = await sb
      .from('attendance_logs')
      .select('id, date, trainer_name, student_name, mentor_join_time, student_join_time, duration_seconds, punctuality')
      .order('date', { ascending: false });

    console.log(`Total valid attended rows remaining in Supabase: ${remaining.length}`);
    const byDate = {};
    remaining.forEach(r => {
      byDate[r.date] = (byDate[r.date] || 0) + 1;
    });
    console.log('Valid attended rows per date:', byDate);

  } catch (err) {
    console.error('Exception:', err);
  }
}

purgeEmptyUnattended();
