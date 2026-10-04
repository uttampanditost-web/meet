import { Slot, AttendanceLog, AttendanceSummaryStats } from "../types";
import { getLocalDateString } from "./dateUtils";

/**
 * Helper to calculate join delay minutes relative to scheduled slot start time in IST.
 */
export function calculateJoinDelayMinutes(scheduledStartTimeStr?: string, actualIsoTimestamp?: string | null): number {
  if (!actualIsoTimestamp || !scheduledStartTimeStr) return 0;
  const actualDate = new Date(actualIsoTimestamp);
  if (isNaN(actualDate.getTime())) return 0;

  // Convert to Indian Standard Time (IST, UTC+5:30)
  const utc = actualDate.getTime() + (actualDate.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (330 * 60000));

  const timeClean = scheduledStartTimeStr.split("-")[0].trim().toUpperCase();
  const isPm = timeClean.includes("PM");
  const isAm = timeClean.includes("AM");
  const rawParts = timeClean.replace(/(AM|PM)/g, "").trim().split(":");
  if (rawParts.length < 2) return 0;

  let schedHour = parseInt(rawParts[0], 10) || 0;
  const schedMinute = parseInt(rawParts[1], 10) || 0;
  if (isPm && schedHour < 12) schedHour += 12;
  if (isAm && schedHour === 12) schedHour = 0;

  const actualMinutesOfDay = istDate.getHours() * 60 + istDate.getMinutes() + (istDate.getSeconds() / 60);
  const schedMinutesOfDay = schedHour * 60 + schedMinute;
  let delay = actualMinutesOfDay - schedMinutesOfDay;
  if (delay > 720) delay -= 1440;
  if (delay < -720) delay += 1440;

  if (delay <= 0) return 0;
  return Math.max(1, Math.floor(delay));
}

/**
 * Calculates a continuous punctuality score (0% - 100%) rather than a binary cliff.
 * Starts at 100%, deducting smoothly for late minutes.
 * - Early or <= 2 mins grace: 100%
 * - 3 - 5 mins late: 96% - 88%
 * - 6 - 10 mins late (e.g. 9m late): 84% - 70%
 * - 11 - 20 mins late: 67% - 40%
 * - > 20 mins late: 37% - 10%
 * - Did not join / No-Show: 0%
 */
export function calculatePunctualityScore(delayMinutes: number | null | undefined, hasJoined: boolean): number {
  if (!hasJoined) return 0;
  const delay = Math.max(0, delayMinutes || 0);
  if (delay <= 2) return 100;
  if (delay <= 5) return Math.round(100 - (delay - 2) * 4); // 3m -> 96%, 4m -> 92%, 5m -> 88%
  if (delay <= 10) return Math.round(88 - (delay - 5) * 3.6); // 9m -> 74%, 10m -> 70%
  if (delay <= 20) return Math.round(70 - (delay - 10) * 3); // 15m -> 55%, 20m -> 40%
  return Math.max(10, Math.round(40 - (delay - 20) * 3));
}

/**
 * Calculates attendance summary KPIs strictly for conducted and concluded sessions on a target date.
 * - Future dates: 100% mentor/student on-time, 0 delay, 0 flagged exceptions, 0/total slots completed.
 * - Today: Calculates based ONLY on sessions that were actually conducted (attended by mentor/student).
 * - Past dates: Calculates entire day's finalized data from conducted sessions.
 */
export function calculateAttendanceStats(
  slots: Slot[],
  logs: AttendanceLog[],
  targetDate: string,
  totalMentorsCount: number = 0,
  todayStr: string = getLocalDateString()
): AttendanceSummaryStats {
  const isFutureDate = targetDate > todayStr;
  const isPastDate = targetDate < todayStr;
  const isToday = targetDate === todayStr;

  // Filter slots for the target date
  const slotsForDate = slots.filter((s) => s.date === targetDate);
  const totalSlots =
    slotsForDate.length > 0
      ? slotsForDate.length
      : totalMentorsCount > 0
      ? totalMentorsCount * 31
      : 0;

  // 1. Future Dates (tomorrow onwards):
  // Calculations start only when the day arrives.
  if (isFutureDate) {
    return {
      totalSlotsToday: totalSlots,
      completedSlots: 0,
      liveSlots: 0,
      upcomingSlots: totalSlots,
      mentorOnTimeRate: 100,
      studentOnTimeRate: 100,
      avgMentorDelayMinutes: 0,
      avgStudentDelayMinutes: 0,
      flaggedAlertsCount: 0,
      totalMentorshipHours: 0,
      totalMentorshipMinutes: 0,
    };
  }

  const getLogDate = (l: AttendanceLog): string => {
    return l.date || (l.slotId?.match(/(\d{4}-\d{2}-\d{2})/)?.[1]) || (l.id?.match(/(\d{4}-\d{2}-\d{2})/)?.[1]) || "";
  };

  // 2. Today or Past Dates:
  // Strictly filter logs for sessions that were ACTUALLY CONDUCTED or flagged.
  // CRITICAL: Empty expired slots where neither mentor nor student joined are NOT conducted sessions!
  const targetLogs = logs.filter((l) => {
    if (getLogDate(l) !== targetDate) return false;
    const hasMentor = Boolean(
      l.mentorJoinedAt && typeof l.mentorJoinedAt === "string" && l.mentorJoinedAt.trim() !== ""
    );
    const hasStudent = Boolean(
      (l.studentJoinedAt && typeof l.studentJoinedAt === "string" && l.studentJoinedAt.trim() !== "") ||
      (l.askToJoinTime && typeof l.askToJoinTime === "string" && l.askToJoinTime.trim() !== "")
    );
    const hasDuration = Boolean(
      (l.trackedDurationSeconds !== undefined && l.trackedDurationSeconds !== null && l.trackedDurationSeconds > 0) ||
      (l.totalOverlapMinutes !== null && l.totalOverlapMinutes !== undefined && l.totalOverlapMinutes > 0)
    );
    const isFlaggedNoShow = l.status === "no_show";

    // ONLY include sessions that actually had participation or explicit no_show
    return hasMentor || hasStudent || hasDuration || isFlaggedNoShow;
  });

  // Mentor punctuality for targetDate (calculated strictly on sessions taken by mentors and completed)
  const completedMentorLogs = logs.filter((l) => {
    if (getLogDate(l) !== targetDate) return false;
    const hasMentor = Boolean(
      l.mentorJoinedAt && typeof l.mentorJoinedAt === "string" && l.mentorJoinedAt.trim() !== ""
    );
    if (!hasMentor) return false;
    const isCompleted =
      l.status === "completed" ||
      (l.totalOverlapMinutes !== null && l.totalOverlapMinutes !== undefined && l.totalOverlapMinutes > 0) ||
      (l.trackedDurationSeconds !== null && l.trackedDurationSeconds !== undefined && l.trackedDurationSeconds > 0);
    return isCompleted && l.status !== "no_show";
  });

  let mentorOnTimeRate: number = 100;
  let avgMentorDelayMinutes = 0;

  if (completedMentorLogs.length > 0) {
    // Group by mentor to calculate punctuality based on mentors who have taken sessions
    const mentorScores = new Map<string, { totalScore: number; totalDelay: number; count: number }>();

    completedMentorLogs.forEach((l) => {
      const mentorKey = l.trainerId || l.trainerName || "unknown";
      const delay =
        l.mentorJoinDelayMinutes !== null && l.mentorJoinDelayMinutes !== undefined
          ? Math.max(0, l.mentorJoinDelayMinutes)
          : calculateJoinDelayMinutes(l.scheduledStartTime, l.mentorJoinedAt);
      const score = calculatePunctualityScore(delay, true);

      const existing = mentorScores.get(mentorKey) || { totalScore: 0, totalDelay: 0, count: 0 };
      existing.totalScore += score;
      existing.totalDelay += delay;
      existing.count += 1;
      mentorScores.set(mentorKey, existing);
    });

    const activeMentors = Array.from(mentorScores.values());
    if (activeMentors.length > 0) {
      const sumRates = activeMentors.reduce((acc, m) => acc + (m.totalScore / m.count), 0);
      const sumDelays = activeMentors.reduce((acc, m) => acc + (m.totalDelay / m.count), 0);
      mentorOnTimeRate = Math.round(sumRates / activeMentors.length);
      avgMentorDelayMinutes = Math.round((sumDelays / activeMentors.length) * 10) / 10;
    }
  } else {
    // By default consider on-time rate as 100% when 0 completed sessions have taken place
    mentorOnTimeRate = 100;
    avgMentorDelayMinutes = 0;
  }

  // Student punctuality for targetDate (proportional score across conducted/active sessions)
  let studentOnTimeRate: number | null = null;
  let avgStudentDelayMinutes = 0;
  if (targetLogs.length > 0) {
    let totalStudentDelay = 0;
    let totalStudentScore = 0;
    let joinedCount = 0;

    targetLogs.forEach((l) => {
      const hasStudent = Boolean(
        (l.studentJoinedAt && typeof l.studentJoinedAt === "string" && l.studentJoinedAt.trim() !== "") ||
        (l.askToJoinTime && typeof l.askToJoinTime === "string" && l.askToJoinTime.trim() !== "")
      );
      let delay = 0;
      if (hasStudent) {
        joinedCount++;
        delay = l.studentJoinDelayMinutes !== null && l.studentJoinDelayMinutes !== undefined
          ? l.studentJoinDelayMinutes
          : calculateJoinDelayMinutes(l.scheduledStartTime, l.studentJoinedAt);
        totalStudentDelay += delay;
      }
      totalStudentScore += calculatePunctualityScore(delay, hasStudent);
    });

    studentOnTimeRate = Math.round(totalStudentScore / targetLogs.length);
    avgStudentDelayMinutes = joinedCount > 0 ? Math.round((totalStudentDelay / joinedCount) * 10) / 10 : 0;
  } else {
    // If no students have joined sessions yet today, default to 100% (tracking in progress)
    studentOnTimeRate = isToday ? 100 : null;
    avgStudentDelayMinutes = 0;
  }

  // Flagged exceptions for targetDate (delays >= 2 mins, no-shows where other party waited, or explicit status)
  const flaggedAlertsCount = targetLogs.filter((l) => {
    const hasMentor = Boolean(l.mentorJoinedAt && typeof l.mentorJoinedAt === "string" && l.mentorJoinedAt.trim() !== "");
    const hasStudent = Boolean(
      (l.studentJoinedAt && typeof l.studentJoinedAt === "string" && l.studentJoinedAt.trim() !== "") ||
      (l.askToJoinTime && typeof l.askToJoinTime === "string" && l.askToJoinTime.trim() !== "")
    );

    const mDelay = l.mentorJoinDelayMinutes !== null && l.mentorJoinDelayMinutes !== undefined
      ? l.mentorJoinDelayMinutes
      : (l.mentorJoinedAt ? calculateJoinDelayMinutes(l.scheduledStartTime, l.mentorJoinedAt) : 0);

    const sDelay = l.studentJoinDelayMinutes !== null && l.studentJoinDelayMinutes !== undefined
      ? l.studentJoinDelayMinutes
      : (l.studentJoinedAt ? calculateJoinDelayMinutes(l.scheduledStartTime, l.studentJoinedAt) : 0);

    const isMentorLate = Boolean(hasMentor && mDelay >= 2);
    const isStudentLate = Boolean(hasStudent && sDelay >= 2);
    const isMentorNoShow = !hasMentor && (hasStudent || l.status === "completed" || l.status === "mentor_absent" || l.status === "no_show");
    const isStudentNoShow = !hasStudent && (hasMentor || l.status === "completed" || l.status === "no_show");

    const isStatusFlag =
      l.status === "no_show" ||
      l.status === "mentor_late" ||
      l.status === "student_late" ||
      l.status === "mentor_absent" ||
      l.status === "early_leave";

    return isMentorLate || isStudentLate || isMentorNoShow || isStudentNoShow || isStatusFlag;
  }).length;

  const completedCount = slotsForDate.filter((s) => s.status === "completed").length;
  const liveCount = slotsForDate.filter((s) => s.status === "live").length;
  const upcomingCount = slotsForDate.filter((s) => s.status === "scheduled").length;

  // Calculate total mentorship duration in minutes & hours from conducted/active sessions
  let totalTrackedSeconds = 0;
  targetLogs.forEach((l) => {
    if (typeof l.trackedDurationSeconds === "number" && l.trackedDurationSeconds > 0) {
      totalTrackedSeconds += l.trackedDurationSeconds;
    } else if (typeof l.totalOverlapMinutes === "number" && l.totalOverlapMinutes > 0) {
      totalTrackedSeconds += l.totalOverlapMinutes * 60;
    } else if (typeof l.totalMeetDurationMinutes === "number" && l.totalMeetDurationMinutes > 0) {
      totalTrackedSeconds += l.totalMeetDurationMinutes * 60;
    } else if (l.status === "completed") {
      totalTrackedSeconds += 30 * 60;
    }
  });

  if (isPastDate && totalTrackedSeconds === 0 && completedCount > 0) {
    totalTrackedSeconds = completedCount * 30 * 60;
  }

  const totalMentorshipMinutes = Math.round(totalTrackedSeconds / 60);
  const totalMentorshipHours = Math.round((totalTrackedSeconds / 3600) * 10) / 10;

  return {
    totalSlotsToday: totalSlots,
    completedSlots: isPastDate ? (completedCount > 0 ? completedCount : totalSlots) : completedCount,
    liveSlots: isPastDate ? 0 : liveCount,
    upcomingSlots: isPastDate ? 0 : upcomingCount,
    mentorOnTimeRate,
    studentOnTimeRate,
    avgMentorDelayMinutes,
    avgStudentDelayMinutes,
    flaggedAlertsCount,
    totalMentorshipHours,
    totalMentorshipMinutes,
  };
}
