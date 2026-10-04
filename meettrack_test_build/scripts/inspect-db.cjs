const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const sbConfig = JSON.parse(fs.readFileSync("./supabase-config.json", "utf8"));
const sb = createClient(sbConfig.supabaseUrl, sbConfig.supabaseAnonKey);

async function check() {
  const { data: uttamSlots } = await sb.from("slots").select("id, trainer_id, start_time, date, student_name").eq("trainer_id", "tr-uttam");
  console.log(`Slots with tr-uttam: ${uttamSlots.length}`);
  const { data: uttamLogs } = await sb.from("attendance_logs").select("id, trainer_id, start_time, date, student_name").eq("trainer_id", "tr-uttam");
  console.log(`Logs with tr-uttam: ${uttamLogs.length}`);

  const { data: soudeepSlots } = await sb.from("slots").select("id, trainer_id, start_time, date, student_name").eq("trainer_id", "tr-soudeep");
  console.log(`Slots with tr-soudeep: ${soudeepSlots.length}`);
  const { data: soudeepLogs } = await sb.from("attendance_logs").select("id, trainer_id, start_time, date, student_name").eq("trainer_id", "tr-soudeep");
  console.log(`Logs with tr-soudeep: ${soudeepLogs.length}`);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
