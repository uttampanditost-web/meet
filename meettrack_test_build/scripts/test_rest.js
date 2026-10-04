import sbConfig from "../supabase-config.json" with { type: "json" };

async function test() {
  const url = `${sbConfig.supabaseUrl}/rest/v1/attendance_logs?select=id,date,slot_id,trainer_name,student_name,mentor_join_time,student_join_time,duration_seconds&limit=5`;
  console.log("Fetching url:", url);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        apikey: sbConfig.supabaseAnonKey,
        Authorization: `Bearer ${sbConfig.supabaseAnonKey}`,
      },
    });
    console.log("Status:", res.status, "took:", Date.now() - start, "ms");
    const json = await res.json();
    console.log("Data length:", json.length);
    console.log("Sample:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
test();
