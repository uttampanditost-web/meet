import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function check() {
  try {
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error:", error);
      process.exit(1);
    }

    console.log(`Total logs in supabase: ${data.length}`);
    const byDate = {};
    data.forEach((l) => {
      byDate[l.date] = (byDate[l.date] || 0) + 1;
    });
    console.log("Logs by date:", byDate);

    console.log("\n--- Logs for 2026-09-13 ---");
    data.filter(l => l.date === "2026-09-13").forEach(l => {
      console.log(`ID: ${l.id} | Slot: ${l.slot_id} | Trainer: ${l.trainer_name} | Start: ${l.start_time}-${l.end_time} | MentorIn: ${l.mentor_join_time} | StudentIn: ${l.student_join_time} | Student: ${l.student_name} (${l.student_email}) | Duration: ${l.duration_seconds} | Status: ${l.mentor_status}`);
    });

    console.log("\n--- Logs for 2026-09-14 ---");
    data.filter(l => l.date === "2026-09-14").forEach(l => {
      console.log(`ID: ${l.id} | Slot: ${l.slot_id} | Trainer: ${l.trainer_name} | Start: ${l.start_time}-${l.end_time} | MentorIn: ${l.mentor_join_time} | StudentIn: ${l.student_join_time} | Student: ${l.student_name} (${l.student_email}) | Duration: ${l.duration_seconds} | Status: ${l.mentor_status}`);
    });

    process.exit(0);
  } catch (err) {
    console.error("Exception:", err);
    process.exit(1);
  }
}

check();

