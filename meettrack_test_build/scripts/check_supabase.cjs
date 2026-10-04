const { createClient } = require('@supabase/supabase-js');
const sbConfig = require('../supabase-config.json');

const supabase = createClient(sbConfig.supabaseUrl, sbConfig.supabaseAnonKey);

async function run() {
  console.log('Querying Supabase...');
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Supabase error:', error);
    return;
  }

  console.log('Total rows fetched:', data.length);
  data.forEach((r, idx) => {
    console.log(`[${idx}] date=${r.date} trainer=${r.trainer_name} student=${r.student_name} mentor_join=${r.mentor_join_time} student_join=${r.student_join_time} dur=${r.duration_seconds} punct=${r.punctuality} status=${r.status} updated=${r.updated_at}`);
  });
}

run();
