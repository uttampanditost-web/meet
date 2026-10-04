import fs from "fs";
if (fs.existsSync("data_store.json")) {
  const data = JSON.parse(fs.readFileSync("data_store.json", "utf-8"));
  console.log("Trainers:", data.trainers ? data.trainers.length : 0);
  console.log("Slots:", data.slots ? data.slots.length : 0);
  console.log("AttendanceLogs:", data.attendanceLogs ? data.attendanceLogs.length : 0);
  const logs14 = (data.attendanceLogs || []).filter(l => (l.date === "2026-09-14" || (l.slotId && l.slotId.includes("2026-09-14"))));
  console.log("Logs for 14th:", logs14.length);
  const logs11 = (data.attendanceLogs || []).filter(l => (l.date === "2026-09-11" || (l.slotId && l.slotId.includes("2026-09-11"))));
  console.log("Logs for 11th:", logs11.length);
  const attended = (data.attendanceLogs || []).filter(l => l.mentorJoinedAt || l.studentJoinedAt || (l.trackedDurationSeconds && l.trackedDurationSeconds > 0));
  console.log("Attended count:", attended.length);
  console.log("Attended samples:", JSON.stringify(attended.map(l => ({
    id: l.id,
    date: l.date,
    slotId: l.slotId,
    trainer: l.trainerName,
    student: l.studentName,
    mentorJoined: l.mentorJoinedAt,
    studentJoined: l.studentJoinedAt,
    duration: l.trackedDurationSeconds,
    status: l.status
  })), null, 2));
} else {
  console.log("No data_store.json found");
}
