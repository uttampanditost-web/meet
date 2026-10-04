import sbConfig from "../supabase-config.json" with { type: "json" };
import { createClient } from "@supabase/supabase-js";

const sb = createClient(sbConfig.supabaseUrl, sbConfig.supabaseAnonKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log("Testing queries...");
  
  // Test 1: Simple select with abort controller
  const t0 = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 6000);
    const { data, error } = await sb
      .from("attendance_logs")
      .select("id, date, slot_id, trainer_name, student_name, mentor_join_time, student_join_time, duration_seconds")
      .eq("date", "2026-09-14")
      .limit(50)
      .abortSignal(ac.signal);
    clearTimeout(timer);
    console.log("Query 1 took:", Date.now() - t0, "ms, Count:", data?.length, "Error:", error);
    if (data?.length) {
      console.log("Sample 1:", data[0]);
    }
  } catch (err) {
    console.log("Query 1 failed:", err.message);
  }

  // Test 2: Any records where mentor or student joined
  const t1 = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 6000);
    const { data, error } = await sb
      .from("attendance_logs")
      .select("id, date, slot_id, trainer_name, student_name, mentor_join_time, student_join_time, duration_seconds")
      .not("mentor_join_time", "is", null)
      .limit(50)
      .abortSignal(ac.signal);
    clearTimeout(timer);
    console.log("Query 2 (mentor joined) took:", Date.now() - t1, "ms, Count:", data?.length, "Error:", error);
    if (data?.length) {
      console.log("Sample 2:", data.slice(0, 3));
    }
  } catch (err) {
    console.log("Query 2 failed:", err.message);
  }
}
run();
