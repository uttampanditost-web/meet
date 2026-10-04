import { createClient } from "@supabase/supabase-js";
import sbConfig from "../supabase-config.json" with { type: "json" };

const sb = createClient(sbConfig.supabaseUrl, sbConfig.supabaseAnonKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Connecting to:", sbConfig.supabaseUrl);
  const t0 = Date.now();
  try {
    // Check count of attendance_logs
    const { count, error } = await sb
      .from("attendance_logs")
      .select("*", { count: "exact", head: true });
    
    console.log("Count query took:", Date.now() - t0, "ms");
    console.log("Total attendance_logs count:", count, "Error:", error);

    // Fetch 1 row
    const t1 = Date.now();
    const { data: oneRow, error: err1 } = await sb
      .from("attendance_logs")
      .select("id, date, slot_id, trainer_name, student_name, punctuality, duration_seconds")
      .limit(1);
    console.log("1 row query took:", Date.now() - t1, "ms");
    console.log("One row:", oneRow, "Error:", err1);

    // Fetch dates present in DB
    const t2 = Date.now();
    const { data: recentRows, error: err2 } = await sb
      .from("attendance_logs")
      .select("id, date, slot_id, trainer_name, student_name, punctuality, duration_seconds, mentor_join_time, student_join_time")
      .not("mentor_join_time", "is", null)
      .limit(20);
    console.log("Attended query took:", Date.now() - t2, "ms");
    console.log("Attended count:", recentRows?.length, "Error:", err2);
    if (recentRows?.length) {
      console.log("Attended samples:", JSON.stringify(recentRows.slice(0, 5), null, 2));
    }
  } catch (e) {
    console.error("Exception:", e);
  }
}
main();
