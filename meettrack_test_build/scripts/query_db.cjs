const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const cfg = JSON.parse(fs.readFileSync('supabase-config.json', 'utf8'));
const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

async function check() {
  console.log('--- Checking Supabase attendance_logs ---');
  try {
    const { data, error } = await sb
      .from('attendance_logs')
      .select('id, date, slot_id, trainer_name, student_name, student_email, mentor_join_time, student_join_time, duration_seconds, punctuality, updated_at')
      .order('date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase Query Error:', error);
      return;
    }

    console.log(`Retrieved ${data.length} rows.`);
    const dates = {};
    data.forEach(r => {
      dates[r.date] = (dates[r.date] || 0) + 1;
    });
    console.log('Rows per date:', dates);

    const attended = data.filter(r => r.mentor_join_time || r.student_join_time || (r.duration_seconds && r.duration_seconds > 0));
    console.log(`Total attended rows: ${attended.length}`);
    console.log('Sample attended rows:');
    attended.slice(0, 10).forEach(r => {
      console.log(`[${r.date}] ${r.trainer_name} (${r.slot_id}): student=${r.student_name} (${r.student_email}), mJoin=${r.mentor_join_time}, sJoin=${r.student_join_time}, dur=${r.duration_seconds}s, status=${r.punctuality}`);
    });
  } catch (err) {
    console.error('Exception:', err);
  }
}

check();
