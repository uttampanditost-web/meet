import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function run() {
  try {
    const start = Date.now();
    const { data, error } = await Promise.race([
      supabase.from("trainers").select("id, name").limit(3),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout after 5s")), 5000))
    ]);
    if (error) {
      console.log("Supabase error:", error.message);
    } else {
      console.log(`Supabase responded in ${Date.now() - start}ms with:`, data);
    }
  } catch (e) {
    console.log("Failed:", e.message);
  }
  process.exit(0);
}

run();
