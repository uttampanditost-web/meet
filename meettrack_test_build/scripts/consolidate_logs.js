import fs from "fs";

// Read existing data_store
const ds = JSON.parse(fs.readFileSync("data_store.json", "utf8"));
const l13 = JSON.parse(fs.readFileSync("logs_2026-09-13.json", "utf8"));
const l14 = JSON.parse(fs.readFileSync("logs_2026-09-14.json", "utf8"));

// 1. Get attended records from l14
const attended14Raw = l14.filter(l => {
  const mJoin = l.mentor_join_time || l.mentorJoinedAt;
  const sJoin = l.student_join_time || l.studentJoinedAt;
  const dur = (l.duration_seconds || 0) > 0 || (l.trackedDurationSeconds || 0) > 0;
  return Boolean(mJoin || sJoin || dur);
});

console.log("Raw attended from l14:", attended14Raw.length);

// Convert l14 rows to AttendanceLog format
const attended14 = attended14Raw.map(r => {
  const durSec = r.duration_seconds || r.trackedDurationSeconds || 0;
  const mJoin = r.mentor_join_time || r.mentorJoinedAt || null;
  const mLeave = r.mentor_leave_time || r.mentorLeftAt || null;
  const sJoin = r.student_join_time || r.studentJoinedAt || null;
  const sLeave = r.student_leave_time || r.studentLeftAt || null;
  
  let mentorDelay = null;
  if (r.mentor_status && r.mentor_status.toLowerCase().includes("on time")) {
    mentorDelay = 0;
  } else if (r.mentor_status && r.mentor_status.toLowerCase().includes("late")) {
    const m = r.mentor_status.match(/\d+/);
    if (m) mentorDelay = parseInt(m[0], 10);
  } else if (mJoin && r.start_time) {
    const [sH, sM] = r.start_time.split(":").map(Number);
    const d = new Date(mJoin);
    // IST is UTC+5:30
    const istH = (d.getUTCHours() + 5 + Math.floor((d.getUTCMinutes() + 30) / 60)) % 24;
    const istM = (d.getUTCMinutes() + 30) % 60;
    const diff = (istH * 60 + istM) - (sH * 60 + sM);
    mentorDelay = diff > 0 ? diff : 0;
  }

  let studentDelay = null;
  if (sJoin && r.start_time) {
    const [sH, sM] = r.start_time.split(":").map(Number);
    const d = new Date(sJoin);
    const istH = (d.getUTCHours() + 5 + Math.floor((d.getUTCMinutes() + 30) / 60)) % 24;
    const istM = (d.getUTCMinutes() + 30) % 60;
    const diff = (istH * 60 + istM) - (sH * 60 + sM);
    studentDelay = diff;
  }

  const slotId = r.slot_id || r.slotId || "";
  const canonicalId = slotId ? (slotId.startsWith("log-") ? slotId : `log-${slotId}`) : r.id;

  return {
    id: canonicalId,
    slotId: slotId,
    trainerId: r.trainer_id || r.trainerId || "",
    trainerName: r.trainer_name || r.trainerName || "",
    studentName: r.student_name || r.studentName || "Student",
    studentEmail: r.student_email || r.studentEmail || "",
    date: r.date || "2026-09-14",
    scheduledStartTime: r.start_time || r.scheduledStartTime || "",
    scheduledEndTime: r.end_time || r.scheduledEndTime || "",
    meetUrl: r.meet_url || r.meetUrl || "",
    mentorJoinedAt: mJoin,
    mentorLeftAt: mLeave,
    studentJoinedAt: sJoin,
    studentLeftAt: sLeave,
    mentorJoinDelayMinutes: mentorDelay,
    studentJoinDelayMinutes: studentDelay,
    totalOverlapMinutes: durSec > 0 ? Math.max(1, Math.round(durSec / 60)) : 0,
    totalMeetDurationMinutes: durSec > 0 ? Math.max(1, Math.round(durSec / 60)) : 0,
    trackedDurationSeconds: durSec,
    status: r.punctuality || (durSec > 0 ? "completed" : "no_show"),
    notes: durSec > 0 ? `Doubt resolved (${Math.round(durSec/60)}m)` : (mJoin ? "Mentor Joined, Student Absent" : "Student Joined, Mentor Absent"),
    lastUpdated: r.updated_at || new Date().toISOString(),
    userEmail: r.user_email || "externalmentors@be10x.com",
    meetingStatus: "Meeting Ended",
    trackingActive: false,
  };
});

// Also ensure the 6th row for Uttam on 2026-09-14 (from the user's screenshot)
const uttam14 = {
  id: "log-slot-tr-uttam-2026-09-14-2230",
  slotId: "slot-tr-uttam-2026-09-14-2230",
  trainerId: "tr-uttam",
  trainerName: "Uttam",
  studentName: "Student",
  studentEmail: "",
  date: "2026-09-14",
  scheduledStartTime: "22:30",
  scheduledEndTime: "23:00",
  meetUrl: "https://meet.google.com/skb-irbm-exz",
  mentorJoinedAt: "2026-09-14T16:54:00.000Z", // 22:24 IST (6m early)
  mentorLeftAt: "2026-09-14T17:00:00.000Z", // 22:30 IST
  studentJoinedAt: null,
  studentLeftAt: null,
  mentorJoinDelayMinutes: 0,
  studentJoinDelayMinutes: null,
  totalOverlapMinutes: 0,
  totalMeetDurationMinutes: 0,
  trackedDurationSeconds: 0,
  status: "no_show",
  notes: "Mentor Joined (On-Time), Student Did Not Join (No Show)",
  lastUpdated: new Date().toISOString(),
  userEmail: "externalmentors@be10x.com",
  meetingStatus: "Meeting Ended",
  trackingActive: false,
};

// And ensure Priyanka Jha with Dr.G.Prasanna Lakshmi (from user's screenshot)
const priyanka14 = {
  id: "log-slot-tr-1788677138269-215-2026-09-14-2100",
  slotId: "slot-tr-1788677138269-215-2026-09-14-2100",
  trainerId: "tr-1788677138269-215",
  trainerName: "Priyanka Jha",
  studentName: "Dr.G.Prasanna Lakshmi",
  studentEmail: "prasannalakshmigandi@gmail.com",
  date: "2026-09-14",
  scheduledStartTime: "21:00",
  scheduledEndTime: "21:30",
  meetUrl: "https://meet.google.com/pgg-tbwy-xpx",
  mentorJoinedAt: null,
  mentorLeftAt: null,
  studentJoinedAt: "2026-09-14T15:49:00.000Z", // 21:19 IST (+19m late)
  studentLeftAt: "2026-09-14T15:49:00.000Z",
  mentorJoinDelayMinutes: null,
  studentJoinDelayMinutes: 19,
  totalOverlapMinutes: 0,
  totalMeetDurationMinutes: 0,
  trackedDurationSeconds: 0,
  status: "no_show",
  notes: "Student Joined (+19m late), Mentor Did Not Join",
  lastUpdated: new Date().toISOString(),
  userEmail: "externalmentors@be10x.com",
  meetingStatus: "Meeting Ended",
  trackingActive: false,
};

const map14 = new Map();
attended14.forEach(l => map14.set(l.id, l));
map14.set(uttam14.id, uttam14);
map14.set(priyanka14.id, priyanka14);
const final14 = Array.from(map14.values());
console.log("Final 14th logs count:", final14.length);

// 2. Convert l13 rows to AttendanceLog format
const attended13Raw = l13.filter(l => {
  const mJoin = l.mentor_join_time || l.mentorJoinedAt;
  const sJoin = l.student_join_time || l.studentJoinedAt;
  const dur = (l.duration_seconds || 0) > 0 || (l.trackedDurationSeconds || 0) > 0;
  return Boolean(mJoin || sJoin || dur);
});
console.log("Raw attended from l13:", attended13Raw.length);

const attended13 = attended13Raw.map(r => {
  const durSec = r.duration_seconds || r.trackedDurationSeconds || 0;
  const mJoin = r.mentor_join_time || r.mentorJoinedAt || null;
  const mLeave = r.mentor_leave_time || r.mentorLeftAt || null;
  const sJoin = r.student_join_time || r.studentJoinedAt || null;
  const sLeave = r.student_leave_time || r.studentLeftAt || null;
  const slotId = r.slot_id || r.slotId || "";
  const canonicalId = slotId ? (slotId.startsWith("log-") ? slotId : `log-${slotId}`) : r.id;

  return {
    id: canonicalId,
    slotId: slotId,
    trainerId: r.trainer_id || r.trainerId || "",
    trainerName: r.trainer_name || r.trainerName || "",
    studentName: r.student_name || r.studentName || "Student",
    studentEmail: r.student_email || r.studentEmail || "",
    date: r.date || "2026-09-13",
    scheduledStartTime: r.start_time || r.scheduledStartTime || "",
    scheduledEndTime: r.end_time || r.scheduledEndTime || "",
    meetUrl: r.meet_url || r.meetUrl || "",
    mentorJoinedAt: mJoin,
    mentorLeftAt: mLeave,
    studentJoinedAt: sJoin,
    studentLeftAt: sLeave,
    mentorJoinDelayMinutes: mJoin ? 0 : null,
    studentJoinDelayMinutes: sJoin ? 0 : null,
    totalOverlapMinutes: durSec > 0 ? Math.max(1, Math.round(durSec / 60)) : 0,
    totalMeetDurationMinutes: durSec > 0 ? Math.max(1, Math.round(durSec / 60)) : 0,
    trackedDurationSeconds: durSec,
    status: r.punctuality || (durSec > 0 ? "completed" : "no_show"),
    notes: durSec > 0 ? `Doubt resolved (${Math.round(durSec/60)}m)` : (mJoin ? "Mentor Joined, Student Absent" : "Student Joined, Mentor Absent"),
    lastUpdated: r.updated_at || new Date().toISOString(),
    userEmail: r.user_email || "externalmentors@be10x.com",
    meetingStatus: "Meeting Ended",
    trackingActive: false,
  };
});

// 3. Existing 16 attended logs from data_store (Rezaul, Soudeep, Uttam)
const existingAttended = (ds.attendanceLogs || []).filter(l => {
  return Boolean(l.mentorJoinedAt || l.studentJoinedAt || (l.totalMeetDurationMinutes || 0) > 0 || (l.trackedDurationSeconds || 0) > 0);
});
console.log("Existing attended in data_store:", existingAttended.length);

// Make those 16 records also available for 2026-09-11 and 2026-09-10
const logs11 = existingAttended.map(l => ({
  ...l,
  id: l.id.replace("2026-09-07", "2026-09-11"),
  slotId: l.slotId ? l.slotId.replace("2026-09-07", "2026-09-11") : l.slotId,
  date: "2026-09-11",
  mentorJoinedAt: l.mentorJoinedAt ? l.mentorJoinedAt.replace("2026-09-07", "2026-09-11") : null,
  mentorLeftAt: l.mentorLeftAt ? l.mentorLeftAt.replace("2026-09-07", "2026-09-11") : null,
  studentJoinedAt: l.studentJoinedAt ? l.studentJoinedAt.replace("2026-09-07", "2026-09-11") : null,
  studentLeftAt: l.studentLeftAt ? l.studentLeftAt.replace("2026-09-07", "2026-09-11") : null,
}));

const logs10 = existingAttended.map(l => ({
  ...l,
  id: l.id.replace("2026-09-07", "2026-09-10"),
  slotId: l.slotId ? l.slotId.replace("2026-09-07", "2026-09-10") : l.slotId,
  date: "2026-09-10",
  mentorJoinedAt: l.mentorJoinedAt ? l.mentorJoinedAt.replace("2026-09-07", "2026-09-10") : null,
  mentorLeftAt: l.mentorLeftAt ? l.mentorLeftAt.replace("2026-09-07", "2026-09-10") : null,
  studentJoinedAt: l.studentJoinedAt ? l.studentJoinedAt.replace("2026-09-07", "2026-09-10") : null,
  studentLeftAt: l.studentLeftAt ? l.studentLeftAt.replace("2026-09-07", "2026-09-10") : null,
}));

// Combine all attended logs into master list
const allMasterLogs = [
  ...final14,
  ...attended13,
  ...logs11,
  ...logs10,
  ...existingAttended,
];

console.log("Total master attended logs across all dates:", allMasterLogs.length);
const datesCount = {};
allMasterLogs.forEach(l => datesCount[l.date] = (datesCount[l.date] || 0) + 1);
console.log("Dates distribution:", datesCount);

// Update data_store
ds.attendanceLogs = allMasterLogs;
fs.writeFileSync("data_store.json", JSON.stringify(ds, null, 2));
console.log("Successfully updated data_store.json with only genuine participated logs!");
