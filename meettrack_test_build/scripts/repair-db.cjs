const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const sbConfig = JSON.parse(fs.readFileSync("./supabase-config.json", "utf8"));
const sb = createClient(sbConfig.supabaseUrl, sbConfig.supabaseAnonKey);

async function repair() {
  console.log("1. Repairing Rezaul 12:30 slot...");
  const { error: rErr } = await sb
    .from("attendance_logs")
    .update({
      mentor_join_time: null,
      mentor_leave_time: null,
      duration_seconds: 0,
      mentor_status: null,
      punctuality: "completed"
    })
    .eq("slot_id", "slot-tr-1788512741578-428-2026-09-06-1230");
  if (rErr) console.error("Rezaul repair error:", rErr);
  else console.log("✅ Rezaul 12:30 slot repaired.");

  console.log("2. Repairing Arsalan Adeeb 17:00 slot (clearing mistaken student join)...");
  const { error: aErr } = await sb
    .from("attendance_logs")
    .update({
      student_join_time: null,
      student_leave_time: null,
      duration_seconds: 0,
      student_status: "Absent",
      punctuality: "scheduled"
    })
    .eq("slot_id", "slot-tr-1788681466900-152-2026-09-06-1700");
  if (aErr) console.error("Arsalan repair error:", aErr);
  else console.log("✅ Arsalan Adeeb 17:00 slot repaired.");

  console.log("3. Repairing Uttam 17:00 slot (setting mentor on-time join at 17:00 IST = 11:30 UTC)...");
  const { error: uErr } = await sb
    .from("attendance_logs")
    .update({
      mentor_join_time: "2026-09-06T11:30:00.000Z",
      mentor_status: "On Time",
      punctuality: "in_progress"
    })
    .eq("slot_id", "slot-tr-1788380548099-652-2026-09-06-1700");
  if (uErr) console.error("Uttam repair error:", uErr);
  else console.log("✅ Uttam 17:00 slot repaired.");
}

repair().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
