import sbConfig from "../supabase-config.json" with { type: "json" };

async function test() {
  const url = `${sbConfig.supabaseUrl}/rest/v1/attendance_logs?limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: sbConfig.supabaseAnonKey,
      Authorization: `Bearer ${sbConfig.supabaseAnonKey}`,
    },
  });
  console.log("Status:", res.status, res.statusText);
  const text = await res.text();
  console.log("Body preview:\n", text.slice(0, 1000));
}
test();
