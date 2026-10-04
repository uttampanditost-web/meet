const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const sbConfig = JSON.parse(fs.readFileSync("./supabase-config.json", "utf8"));
const sb = createClient(sbConfig.supabaseUrl, sbConfig.supabaseAnonKey);

async function repairAll() {
  console.log("Starting Supabase database repair for 2026-09-11...");

  // 1. Screenshot 1: Vansh Agrawal 10:00 - 10:30 slot
  // Fix leave time from 16:00 (10:30 UTC) to 10:30 IST (05:00 UTC)
  console.log("1. Repairing Vansh Agrawal 10:00 slot...");
  const { error: err1 } = await sb
    .from("attendance_logs")
    .update({
      mentor_leave_time: "2026-09-11T05:00:00.000Z",
      student_leave_time: "2026-09-11T05:00:00.000Z",
      duration_seconds: 1,
      punctuality: "completed"
    })
    .eq("id", "log-slot-tr-1788677063287-999-2026-09-11-1000");
  if (err1) console.error("Error repairing 10:00 slot:", err1);
  else console.log("✅ Vansh Agrawal 10:00 slot repaired (Out: 10:30, Dur: 1s).");

  // 2. Screenshot 2: Priyanka Jha 10:30 - 11:00 slot
  // Clear phantom student join at 10:58 (which belonged to 11:00 slot) so empty slot does not show "Did Not Join (Student was present)"
  console.log("2. Repairing Priyanka Jha 10:30 slot...");
  const { error: err2 } = await sb
    .from("attendance_logs")
    .update({
      student_join_time: null,
      student_leave_time: null,
      student_name: "Open Slot",
      student_status: "Absent",
      duration_seconds: 0,
      punctuality: "completed"
    })
    .eq("id", "log-slot-tr-1788677138269-215-2026-09-11-1030");
  if (err2) console.error("Error repairing 10:30 slot:", err2);
  else console.log("✅ Priyanka Jha 10:30 slot repaired (phantom student join cleared).");

  // 3. Screenshot 3: Vansh Agrawal 12:00 - 12:30 slot
  // Fix leave time from 18:00 (12:30 UTC) to 12:30 IST (07:00 UTC) and duration to 1446s (24m 6s)
  console.log("3. Repairing Vansh Agrawal 12:00 slot...");
  const { error: err3 } = await sb
    .from("attendance_logs")
    .update({
      mentor_leave_time: "2026-09-11T07:00:00.000Z",
      student_leave_time: "2026-09-11T07:00:00.000Z",
      duration_seconds: 1446,
      punctuality: "completed"
    })
    .eq("id", "log-slot-tr-1788677063287-999-2026-09-11-1200");
  if (err3) console.error("Error repairing 12:00 slot:", err3);
  else console.log("✅ Vansh Agrawal 12:00 slot repaired (Out: 12:30, Dur: 24m 6s).");

  // 4. Screenshot 4: Vanshika 13:00 - 13:30 slot
  // Reconstruct mentor join time from leave time (13:26:39 - 1376s = 13:03:43 IST = 07:33:43 UTC)
  console.log("4. Repairing Vanshika 13:00 slot...");
  const { error: err4 } = await sb
    .from("attendance_logs")
    .update({
      mentor_join_time: "2026-09-11T07:33:43.000Z",
      mentor_status: "On Time",
      duration_seconds: 1376,
      punctuality: "completed"
    })
    .eq("id", "log-slot-tr-1788677680650-190-2026-09-11-1300");
  if (err4) console.error("Error repairing 13:00 slot:", err4);
  else console.log("✅ Vanshika 13:00 slot repaired (In: 13:03:43, Out: 13:26:39, Dur: 22m 56s).");

  // 5. Screenshot 5: Vansh Agrawal 20:00 - 20:30 slot
  // Fix leave time from 02:00 next day (20:30 UTC) to 20:30 IST (15:00 UTC) and duration to 159s
  console.log("5. Repairing Vansh Agrawal 20:00 slot...");
  const { error: err5 } = await sb
    .from("attendance_logs")
    .update({
      mentor_leave_time: "2026-09-11T15:00:00.000Z",
      student_leave_time: "2026-09-11T15:00:00.000Z",
      duration_seconds: 159,
      punctuality: "completed"
    })
    .eq("id", "log-slot-tr-1788677063287-999-2026-09-11-2000");
  if (err5) console.error("Error repairing 20:00 slot:", err5);
  else console.log("✅ Vansh Agrawal 20:00 slot repaired (Out: 20:30, Dur: 2m 39s).");

  // 6. Check for any other slot with duration > 1800 on 2026-09-11 and clamp to 1800
  console.log("6. Checking for any other runaway duration rows on 2026-09-11...");
  const { data: overlong, error: overErr } = await sb
    .from("attendance_logs")
    .select("id, trainer_name, start_time, duration_seconds, mentor_leave_time, student_leave_time")
    .eq("date", "2026-09-11")
    .gt("duration_seconds", 1800);

  if (!overErr && overlong && overlong.length > 0) {
    console.log(`Found ${overlong.length} other overlong rows:`, overlong.map(r => `${r.trainer_name} ${r.start_time}: ${r.duration_seconds}s`));
    for (const row of overlong) {
      await sb
        .from("attendance_logs")
        .update({ duration_seconds: 1800 })
        .eq("id", row.id);
      console.log(`Clamped ${row.id} to 1800s.`);
    }
  } else {
    console.log("No other runaway duration rows found on 2026-09-11.");
  }

  console.log("All 2026-09-11 database repairs complete!");
}

repairAll()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
