const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const sb = createClient(
  'https://wlohfdgsivmuxcvflhxf.supabase.co',
  'sb_publishable_4FbWghoLJxa508QLO6Xg_A_ZIHacZBb'
);

async function main() {
  try {
    for (const d of ['2026-09-10', '2026-09-11']) {
      const { data, error } = await sb
        .from('attendance_logs')
        .select('*')
        .eq('date', d);

      if (error) {
        console.error('Error for', d, error);
        continue;
      }
      console.log(`Date: ${d} -> ${data ? data.length : 0} logs`);
      if (data && data.length > 0) {
        data.forEach(l => {
          console.log(`  ${l.start_time}-${l.end_time} | ${l.trainer_name} | student: ${l.student_name} | MIn: ${l.mentor_join_time} | SIn: ${l.student_join_time} | dur: ${l.duration_seconds} | punct: ${l.punctuality}`);
        });
      }
    }
  } catch (err) {
    console.error('Exception:', err);
  } finally {
    process.exit(0);
  }
}

main();
