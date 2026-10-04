import sbConfig from "../supabase-config.json" with { type: "json" };
import https from "https";

async function queryDate(date) {
  return new Promise((resolve) => {
    const url = `${sbConfig.supabaseUrl}/rest/v1/attendance_logs?select=id,date,slot_id,trainer_name,student_name,mentor_join_time,student_join_time,duration_seconds,punctuality&date=eq.${date}&limit=100`;
    const req = https.get(
      url,
      {
        headers: {
          apikey: sbConfig.supabaseAnonKey,
          Authorization: `Bearer ${sbConfig.supabaseAnonKey}`,
        },
        timeout: 8000,
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve({ date, status: res.statusCode, count: data.length, data });
          } catch (e) {
            resolve({ date, status: res.statusCode, error: body.slice(0, 200) });
          }
        });
      }
    );
    req.on("error", (e) => resolve({ date, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ date, error: "timeout" });
    });
  });
}

async function main() {
  const dates = ["2026-09-12", "2026-09-13", "2026-09-14", "2026-09-11", "2026-09-10"];
  for (const d of dates) {
    console.log("Checking date in Supabase:", d);
    const res = await queryDate(d);
    console.log("Result for", d, ": status=", res.status, "count=", res.count, "err=", res.error);
    if (res.data && res.data.length > 0) {
      const attended = res.data.filter(r => r.mentor_join_time || r.student_join_time || r.duration_seconds > 0);
      console.log("  Attended on", d, ":", attended.length);
      if (attended.length > 0) {
        console.log("  Sample attended:", attended.slice(0, 3));
      }
    }
  }
}
main();
