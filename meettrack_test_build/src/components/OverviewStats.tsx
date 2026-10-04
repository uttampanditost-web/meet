import React, { useState } from "react";
import { AttendanceSummaryStats, Trainer, Slot, AttendanceLog } from "../types";
import { calculatePunctualityScore, calculateJoinDelayMinutes } from "../lib/statsUtils";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  TrendingUp,
  Sparkles,
  ArrowLeft,
  X,
  Calendar,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Users,
  Award,
  Video
} from "lucide-react";

interface OverviewStatsProps {
  stats: AttendanceSummaryStats;
  trainers?: Trainer[];
  slots?: Slot[];
  logs?: AttendanceLog[];
  selectedDate?: string;
  onFilterFlagged?: () => void;
  onNavigateToLogs?: () => void;
}

type ExpandedWidgetType = "mentor_sessions" | "mentor_ontime" | "student_punctuality" | "flagged_exceptions" | null;

export const OverviewStats: React.FC<OverviewStatsProps> = ({
  stats,
  trainers = [],
  slots = [],
  logs = [],
  selectedDate,
  onFilterFlagged,
  onNavigateToLogs,
}) => {
  const [expandedWidget, setExpandedWidget] = useState<ExpandedWidgetType>(null);

  // Format date helper (DD-MM-YYYY)
  const displayDate = (() => {
    if (!selectedDate) return "";
    const parts = selectedDate.split("-");
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : selectedDate;
  })();

  const getLogDate = (l: AttendanceLog): string => {
    return l.date || (l.slotId?.match(/(\d{4}-\d{2}-\d{2})/)?.[1]) || (l.id?.match(/(\d{4}-\d{2}-\d{2})/)?.[1]) || "";
  };

  // Filter logs for selected date
  const dateLogs = selectedDate ? logs.filter((l) => getLogDate(l) === selectedDate) : logs;

  // Filter active valid mentors (filter out any auto/profile artifacts)
  const activeTrainers = trainers.filter((t) => {
    const n = (t.name || "").toLowerCase().trim();
    return !t.id.startsWith("tr-auto-") && !n.includes("user profile") && !n.includes("profile picture") && n !== "google meet mentor";
  });

  // Calculate detailed per-mentor statistics for today based on sessions taken and completed by mentor
  const mentorStats = activeTrainers.map((t) => {
    const tLogs = dateLogs.filter((l) => l.trainerId === t.id);

    // Count only sessions actually taken by the mentor and completed
    const completed = tLogs.filter((l) => {
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

    const live = tLogs.filter(
      (l) =>
        (l.status === "in_progress" || l.trackingActive) &&
        Boolean(l.mentorJoinedAt && typeof l.mentorJoinedAt === "string" && l.mentorJoinedAt.trim() !== "")
    );
    const unattended = 0;
    
    // Total delivered overlap hours
    const totalMinutes = completed.reduce((acc, curr) => acc + (curr.totalOverlapMinutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    // Sessions logged is strictly the count of completed sessions taken by this mentor
    const sessionsLogged = completed.length;

    // Calculate punctuality and avg join delay strictly based on completed sessions taken by mentor
    let onTimeRate = 100;
    let avgDelay = "0";

    if (sessionsLogged > 0) {
      let totalDelay = 0;
      let totalScore = 0;

      completed.forEach((l) => {
        const delay =
          l.mentorJoinDelayMinutes !== null && l.mentorJoinDelayMinutes !== undefined
            ? Math.max(0, l.mentorJoinDelayMinutes)
            : calculateJoinDelayMinutes(l.scheduledStartTime, l.mentorJoinedAt);
        totalDelay += delay;
        totalScore += calculatePunctualityScore(delay, true);
      });

      avgDelay = (totalDelay / sessionsLogged).toFixed(1);
      onTimeRate = Math.round(totalScore / sessionsLogged);
    }

    return {
      trainer: t,
      completedCount: completed.length,
      sessionsLogged,
      liveCount: live.length,
      unattendedCount: unattended,
      totalHours,
      onTimeRate,
      avgDelay,
      logs: tLogs,
    };
  });

  // Active mentors who have actually taken and completed sessions today
  const mentorsWithConductedSessions = mentorStats.filter((m) => m.sessionsLogged > 0);

  // Dynamic overall mentor punctuality calculated strictly based on mentors who took sessions
  const effectiveMentorOnTimeRate =
    mentorsWithConductedSessions.length > 0
      ? Math.round(
          mentorsWithConductedSessions.reduce((acc, curr) => acc + curr.onTimeRate, 0) /
            mentorsWithConductedSessions.length
        )
      : (stats.mentorOnTimeRate ?? 100);

  const effectiveAvgMentorDelayMinutes =
    mentorsWithConductedSessions.length > 0
      ? (
          mentorsWithConductedSessions.reduce((acc, curr) => acc + parseFloat(curr.avgDelay || "0"), 0) /
          mentorsWithConductedSessions.length
        ).toFixed(1)
      : (stats.avgMentorDelayMinutes ? stats.avgMentorDelayMinutes.toFixed(1) : "0");

  // Total completed sessions delivered across all mentors today
  const totalCompletedSessions = mentorStats.reduce((acc, curr) => acc + curr.completedCount, 0);

  // Active/conducted logs for selected date where attendance was expected
  const activeDateLogs = dateLogs.filter((l) => {
    const hasM = Boolean(l.mentorJoinedAt && typeof l.mentorJoinedAt === "string" && l.mentorJoinedAt.trim() !== "");
    const hasS = Boolean(l.studentJoinedAt || l.askToJoinTime);
    return hasM || hasS || l.status === "no_show" || (l.totalOverlapMinutes && l.totalOverlapMinutes > 0);
  });

  // Student join stats with proportional scoring
  const studentLogsWithJoin = dateLogs.filter((l) => l.studentJoinedAt || l.askToJoinTime);
  const totalStudentScore = activeDateLogs.reduce((acc, curr) => {
    const hasS = Boolean(curr.studentJoinedAt || curr.askToJoinTime);
    return acc + calculatePunctualityScore(curr.studentJoinDelayMinutes, hasS);
  }, 0);
  const studentOnTimeRate = activeDateLogs.length > 0
    ? Math.round(totalStudentScore / activeDateLogs.length)
    : 100;
  const avgStudentDelay = studentLogsWithJoin.length > 0
    ? (studentLogsWithJoin.reduce((acc, curr) => acc + (curr.studentJoinDelayMinutes || 0), 0) / studentLogsWithJoin.length).toFixed(1)
    : "0";

  // Flagged exceptions logs (mentor late, mentor no-show, student no-show, or flagged status)
  const flaggedLogs = dateLogs.filter((l) => {
    const hasMentor = Boolean(l.mentorJoinedAt && typeof l.mentorJoinedAt === "string" && l.mentorJoinedAt.trim() !== "");
    const hasStudent = Boolean(l.studentJoinedAt || l.askToJoinTime);
    if (!hasMentor && !hasStudent && l.status !== "no_show") return false;

    const isMentorLate = Boolean(hasMentor && (l.mentorJoinDelayMinutes ? l.mentorJoinDelayMinutes > 3 : false));
    const isMentorNoShow = !hasMentor && hasStudent;
    const isStudentNoShow = !hasStudent && hasMentor;
    const isStatusFlag = l.status === "mentor_late" || l.status === "no_show" || l.status === "student_late";

    return isMentorLate || isMentorNoShow || isStudentNoShow || isStatusFlag;
  });

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 select-none">
        {/* WIDGET 1: Mentor Sessions Tracker (formerly Live Mentorship Hours) */}
        <div
          onClick={() => setExpandedWidget("mentor_sessions")}
          className="ios-glass-card rounded-3xl p-5 relative overflow-hidden group cursor-pointer hover:border-sky-400/40 hover:shadow-[0_10px_35px_rgba(56,189,248,0.15)] transition-all"
          title="Click to expand full mentor slot fulfillment breakdown"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              Mentor Sessions Tracker
            </span>
            <span className="text-[10px] font-semibold text-slate-400 group-hover:text-sky-300 transition-colors">
              Expand ↗
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {totalCompletedSessions}{" "}
                <span className="text-sm font-medium text-slate-400">
                  {totalCompletedSessions === 1 ? "completed" : "completed"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                sessions actually taken & completed by mentors
              </p>
            </div>
            <div className="shrink-0 flex items-center">
              {stats.liveSlots > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10 whitespace-nowrap">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <span className="font-mono font-bold text-white text-[13px]">{stats.liveSlots}</span>
                  <span className="text-[11px] font-medium text-emerald-300">Live</span>
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25 whitespace-nowrap">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-sky-400" />
                  {activeTrainers.length} Active Mentors
                </span>
              )}
            </div>
          </div>

          {/* Mini Graphical Bars for Each Mentor */}
          <div className="mt-3.5 pt-2.5 border-t border-white/10 space-y-1.5">
            {mentorStats.slice(0, 3).map((m) => (
              <div key={m.trainer.id} className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-300 font-medium truncate max-w-[140px]">
                    {m.trainer.name}
                  </span>
                  <span className="font-mono text-sky-300 font-semibold">
                    {m.completedCount} <span className="text-slate-400 font-normal">completed</span>
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-sky-500 to-teal-400 h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        totalCompletedSessions > 0
                          ? Math.max(5, Math.round((m.completedCount / totalCompletedSessions) * 100))
                          : (m.completedCount > 0 ? 100 : 0)
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {mentorStats.length > 3 && (
              <p className="text-[10px] text-slate-500 text-right">
                +{mentorStats.length - 3} more mentors (click to view)
              </p>
            )}
          </div>
        </div>

        {/* WIDGET 2: Mentor On-Time & Punctuality */}
        <div
          onClick={() => setExpandedWidget("mentor_ontime")}
          className="ios-glass-card rounded-3xl p-5 relative overflow-hidden group cursor-pointer hover:border-emerald-400/40 hover:shadow-[0_10px_35px_rgba(16,185,129,0.15)] transition-all"
          title="Click to expand mentor punctuality audit"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              Mentor On-Time
            </span>
            <span className="text-[10px] font-semibold text-slate-400 group-hover:text-emerald-300 transition-colors">
              Expand ↗
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {`${effectiveMentorOnTimeRate}%`}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Avg delay:{" "}
                <span className="font-semibold text-slate-200">
                  {effectiveAvgMentorDelayMinutes} mins
                </span>
              </p>
            </div>
            <div className="text-right">
              {(() => {
                const rate = effectiveMentorOnTimeRate;
                if (rate >= 90) {
                  return (
                    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      High Punctuality
                    </span>
                  );
                }
                if (rate >= 70) {
                  return (
                    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                      Minor Delay
                    </span>
                  );
                }
                if (rate >= 40) {
                  return (
                    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/25">
                      Late Arrival
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25">
                    Critical No-Show
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Mini Graphical Punctuality Distribution Bar */}
          <div className="mt-3.5 pt-2.5 border-t border-white/10 space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Punctuality score</span>
              <span className="text-emerald-400 font-semibold font-mono">
                {effectiveMentorOnTimeRate}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 flex overflow-hidden">
              <div
                className="bg-emerald-400 h-full transition-all"
                style={{ width: `${effectiveMentorOnTimeRate}%` }}
                title="Punctuality Score"
              />
              <div
                className="bg-rose-500 h-full transition-all"
                style={{ width: `${Math.max(0, 100 - effectiveMentorOnTimeRate)}%` }}
                title="Delay penalty"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Click to view join timestamps per mentor
            </p>
          </div>
        </div>

        {/* WIDGET 3: Student Attendance & Punctuality */}
        <div
          onClick={() => setExpandedWidget("student_punctuality")}
          className="ios-glass-card rounded-3xl p-5 relative overflow-hidden group cursor-pointer hover:border-purple-400/40 hover:shadow-[0_10px_35px_rgba(168,85,247,0.15)] transition-all"
          title="Click to expand student attendance report"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              Student Punctuality
            </span>
            <span className="text-[10px] font-semibold text-slate-400 group-hover:text-purple-300 transition-colors">
              Expand ↗
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {studentOnTimeRate}%
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Avg delay:{" "}
                <span className="font-semibold text-slate-200">{avgStudentDelay} mins</span>
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25">
                {studentLogsWithJoin.length} Attended
              </span>
            </div>
          </div>

          {/* Mini Graphical Attendance Ratio Bar */}
          <div className="mt-3.5 pt-2.5 border-t border-white/10 space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Attendance rate</span>
              <span className="text-purple-300 font-semibold font-mono">
                {studentLogsWithJoin.length} joined
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(10, Math.round((studentLogsWithJoin.length / (totalCompletedSessions || 1)) * 100)))}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Click to view student wait time & logs
            </p>
          </div>
        </div>

        {/* WIDGET 4: Flagged Delays & Exceptions */}
        <div
          onClick={() => setExpandedWidget("flagged_exceptions")}
          className="ios-glass-card rounded-3xl p-5 relative overflow-hidden group cursor-pointer hover:border-rose-400/40 hover:shadow-[0_10px_35px_rgba(244,63,94,0.15)] transition-all"
          title="Click to expand flagged delays and exceptions"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Flagged Exceptions
            </span>
            <span className="text-[10px] font-semibold text-slate-400 group-hover:text-rose-300 transition-colors">
              Expand ↗
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {flaggedLogs.length}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {flaggedLogs.length === 0 ? "No issues detected" : "Mentor late / No show"}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  flaggedLogs.length > 0
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-white/10 text-slate-400 border border-white/15"
                }`}
              >
                {flaggedLogs.length > 0 ? "Attention Required" : "All Clear"}
              </span>
            </div>
          </div>

          {/* Mini Indicators */}
          <div className="mt-3.5 pt-2.5 border-t border-white/10 space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-400">Exceptions:</span>
              <span className="text-rose-300 font-semibold font-mono">
                {flaggedLogs.length} flagged
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  flaggedLogs.length > 0 ? "bg-rose-500" : "bg-emerald-500"
                }`}
                style={{ width: `${flaggedLogs.length > 0 ? 100 : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Click to inspect exact timestamps & solutions
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXPANDED FULL-SCREEN GLASS MODALS (WITH TOP-LEFT BACK & TOP-RIGHT CLOSE) */}
      {/* ========================================================================= */}
      {expandedWidget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-2xl">
          <div className="ios-glass-card border border-white/20 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.8)] relative animate-flip-expand">
            
            {/* Top Navigation Bar with Back button on left and Close (X) button on right */}
            <div className="p-4 sm:p-5 border-b border-white/15 bg-slate-950/80 backdrop-blur-md flex items-center justify-between shrink-0">
              {/* Top-Left Back Button */}
              <button
                type="button"
                onClick={() => setExpandedWidget(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer border border-white/15 active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              {/* Title & Date Badge */}
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {expandedWidget === "mentor_sessions" && "Mentor Completed Sessions Breakdown"}
                  {expandedWidget === "mentor_ontime" && "Mentor Punctuality & Join Timing Analysis"}
                  {expandedWidget === "student_punctuality" && "Student Attendance & Wait Duration Report"}
                  {expandedWidget === "flagged_exceptions" && "Flagged Delays & Exception Audit"}
                </h3>
                {displayDate && (
                  <span className="hidden sm:inline text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {displayDate}
                  </span>
                )}
              </div>

              {/* Top-Right Close Button */}
              <button
                type="button"
                onClick={() => setExpandedWidget(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors border border-white/15 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MODAL BODY 1: Mentor Sessions Breakdown (Actually taken & completed sessions) */}
            {expandedWidget === "mentor_sessions" && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs text-slate-200">
                {/* Summary Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Completed Sessions</span>
                    <div className="text-2xl font-extrabold text-sky-400 mt-0.5">{totalCompletedSessions}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Mentors</span>
                    <div className="text-2xl font-extrabold text-white mt-0.5">{activeTrainers.length}</div>
                  </div>
                  <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Hours</span>
                    <div className="text-2xl font-extrabold text-emerald-400 mt-0.5">
                      {mentorStats.reduce((acc, curr) => acc + Number(curr.totalHours), 0).toFixed(1)} hrs
                    </div>
                  </div>
                  <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-3 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Live Sessions</span>
                    <div className="text-2xl font-extrabold text-purple-400 mt-0.5">
                      {stats.liveSlots || mentorStats.reduce((acc, curr) => acc + curr.liveCount, 0)}
                    </div>
                  </div>
                </div>

                {/* Per Mentor Detailed Cards */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-sky-400" />
                    Individual Mentor Completed Sessions
                  </h4>

                  {mentorStats.map((m) => {
                    return (
                      <div
                        key={m.trainer.id}
                        className="bg-slate-950/80 border border-white/15 rounded-2xl p-4 space-y-3 hover:border-sky-400/40 transition-all shadow-md"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md text-sm shrink-0">
                              {m.trainer.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h5 className="font-bold text-white text-sm">{m.trainer.name}</h5>
                              <p className="text-[11px] text-slate-400">{m.trainer.specialization || "Mentor"}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25 font-semibold text-[11px]">
                              {m.completedCount} Completed {m.completedCount === 1 ? "Session" : "Sessions"}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-semibold text-[11px]">
                              {m.totalHours} hrs delivered
                            </span>
                            {m.trainer.meetUrl && (
                              <a
                                href={m.trainer.meetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                                title="Open Google Meet Link"
                              >
                                <Video className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Large Progress Bar */}
                        <div className="space-y-1">
                          <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
                            <div
                              className="bg-gradient-to-r from-sky-500 via-blue-500 to-teal-400 h-full rounded-full transition-all duration-700 shadow-sm"
                              style={{
                                width: `${
                                  totalCompletedSessions > 0
                                    ? Math.max(6, Math.round((m.completedCount / totalCompletedSessions) * 100))
                                    : (m.completedCount > 0 ? 100 : 0)
                                }%`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Delivered by Mentor</span>
                            <span className="font-semibold text-slate-300">
                              {m.completedCount} {m.completedCount === 1 ? "session" : "sessions"} completed
                            </span>
                            <span>{m.totalHours} hrs active</span>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-4 pt-1 text-[11px]">
                          <span className="text-slate-400">
                            Completed Sessions: <b className="text-emerald-400">{m.completedCount}</b>
                          </span>
                          {m.liveCount > 0 && (
                            <span className="text-slate-400">
                              Live Now: <b className="text-sky-400">{m.liveCount}</b>
                            </span>
                          )}
                          <span className="text-slate-400">
                            Delivered Overlap: <b className="text-teal-300">{m.totalHours} hrs</b>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODAL BODY 2: Mentor On-Time & Punctuality */}
            {expandedWidget === "mentor_ontime" && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs text-slate-200">
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Overall Mentor Punctuality: {effectiveMentorOnTimeRate}%</h4>
                      <p className="text-slate-400 text-xs">
                        {mentorsWithConductedSessions.length > 0
                          ? `Calculated from ${mentorsWithConductedSessions.length} active mentor(s) who conducted sessions on ${displayDate}`
                          : `Based on actual Google Meet join events on ${displayDate}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-white/15 rounded-2xl overflow-hidden bg-slate-950/80">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase border-b border-white/10">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Mentor</th>
                        <th className="py-3 px-4 font-semibold text-center">On-Time Rate</th>
                        <th className="py-3 px-4 font-semibold text-center">Avg Join Delay</th>
                        <th className="py-3 px-4 font-semibold text-center">Sessions Logged</th>
                        <th className="py-3 px-4 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {mentorStats.map((m) => (
                        <tr key={m.trainer.id} className="hover:bg-white/5">
                          <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold">
                              {m.trainer.name.charAt(0)}
                            </span>
                            {m.trainer.name}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                            {m.onTimeRate}%
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-300">
                            {m.avgDelay} mins
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-300">
                            {m.sessionsLogged}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                              {m.onTimeRate >= 90 ? "Excellent" : "Standard"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MODAL BODY 3: Student Attendance Report */}
            {expandedWidget === "student_punctuality" && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs text-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-3.5 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Attended</span>
                    <div className="text-2xl font-extrabold text-purple-400 mt-1">{studentLogsWithJoin.length} students</div>
                  </div>
                  <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-3.5 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">On-Time Join Rate</span>
                    <div className="text-2xl font-extrabold text-emerald-400 mt-1">{studentOnTimeRate}%</div>
                  </div>
                  <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-3.5 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Average Wait Time</span>
                    <div className="text-2xl font-extrabold text-sky-400 mt-1">{avgStudentDelay} mins</div>
                  </div>
                </div>

                <div className="border border-white/15 rounded-2xl overflow-hidden bg-slate-950/80">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase border-b border-white/10">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Student</th>
                        <th className="py-3 px-4 font-semibold">Mentor</th>
                        <th className="py-3 px-4 font-semibold text-center">Slot Time</th>
                        <th className="py-3 px-4 font-semibold text-center">Joined At</th>
                        <th className="py-3 px-4 font-semibold text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {studentLogsWithJoin.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No student attendances logged for this date yet.
                          </td>
                        </tr>
                      ) : (
                        studentLogsWithJoin.map((log, idx) => (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="py-2.5 px-4 font-medium text-white">{log.studentName || "Customer"}</td>
                            <td className="py-2.5 px-4 text-slate-300">{log.trainerName}</td>
                            <td className="py-2.5 px-4 text-center font-mono text-slate-300">
                              {log.scheduledStartTime} - {log.scheduledEndTime}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono text-purple-300">
                              {log.studentJoinedAt ? new Date(log.studentJoinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-emerald-400">
                              {log.totalOverlapMinutes || 0} mins
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MODAL BODY 4: Flagged Exceptions & Alerts */}
            {expandedWidget === "flagged_exceptions" && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs text-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">Flagged Exceptions for {displayDate}</h4>
                    <p className="text-slate-400 text-xs">Sessions requiring administrator attention</p>
                  </div>
                  {onNavigateToLogs && (
                    <button
                      onClick={() => {
                        setExpandedWidget(null);
                        onNavigateToLogs();
                      }}
                      className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-xl font-semibold transition-all cursor-pointer"
                    >
                      Open Full Attendance Records →
                    </button>
                  )}
                </div>

                {flaggedLogs.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h5 className="font-bold text-white text-sm">Zero Flagged Exceptions</h5>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto">
                      All sessions recorded for this date ran without critical mentor delays or unaddressed no-shows.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {flaggedLogs.map((log, idx) => {
                      const hasMentor = Boolean(log.mentorJoinedAt && typeof log.mentorJoinedAt === "string" && log.mentorJoinedAt.trim() !== "");
                      const hasStudent = Boolean(log.studentJoinedAt || log.askToJoinTime);
                      const mentorDelay = log.mentorJoinDelayMinutes && log.mentorJoinDelayMinutes > 0 ? log.mentorJoinDelayMinutes : 0;
                      const studentDelay = log.studentJoinDelayMinutes && log.studentJoinDelayMinutes > 0 ? log.studentJoinDelayMinutes : 0;
                      const isNotesUnattended = Boolean(log.notes && log.notes.toLowerCase().includes("unattended"));
                      const isUnattended = (!hasMentor && !hasStudent) || isNotesUnattended;
                      const isStudentNoShow = hasMentor && !hasStudent;
                      const isMentorNoShow = !hasMentor && hasStudent;
                      const isZeroOverlap = hasMentor && hasStudent && (log.totalOverlapMinutes === 0 || (!log.trackedDurationSeconds && log.status === "completed"));

                      let badgeText = "Attention Needed";
                      let badgeStyle = "bg-rose-500/20 text-rose-300 border-rose-500/30";
                      let contextReason = log.notes || "Attendance anomaly detected.";

                      if (isUnattended) {
                        badgeText = "Slot Unattended (Both Absent)";
                        badgeStyle = "bg-slate-800/90 text-slate-300 border-white/20";
                        contextReason = "Neither mentor nor student joined during the 30-minute slot duration. Auto-closed as unattended.";
                      } else if (isStudentNoShow) {
                        if (mentorDelay > 0) {
                          badgeText = `Student No-Show & Mentor Late (+${mentorDelay}m)`;
                          badgeStyle = "bg-rose-500/20 text-rose-300 border-rose-500/30";
                          contextReason = `Mentor waited in call (+${mentorDelay}m late arrival), but student never joined.`;
                        } else {
                          badgeText = "Student No-Show (Mentor Waited)";
                          badgeStyle = "bg-rose-500/20 text-rose-300 border-rose-500/30";
                          contextReason = "Mentor was on time and waited in session, but student never joined.";
                        }
                      } else if (isMentorNoShow) {
                        badgeText = "Mentor Did Not Join (Student Waited)";
                        badgeStyle = "bg-rose-500/20 text-rose-300 border-rose-500/30";
                        contextReason = "Student was present in the meeting waiting, but mentor failed to join.";
                      } else if (mentorDelay > 0 && (log.status === "mentor_late" || mentorDelay > 3)) {
                        badgeText = `Mentor Late (+${mentorDelay}m late)`;
                        badgeStyle = "bg-orange-500/20 text-orange-300 border-orange-500/30";
                        contextReason = `Mentor joined ${mentorDelay} minutes after scheduled slot start time.`;
                      } else if (studentDelay > 0 && (log.status === "student_late" || studentDelay > 3)) {
                        badgeText = `Student Late (+${studentDelay}m late)`;
                        badgeStyle = "bg-amber-500/20 text-amber-300 border-amber-500/30";
                        contextReason = `Student joined ${studentDelay} minutes late after slot started.`;
                      } else if (isZeroOverlap) {
                        badgeText = "Zero Overlap (No Interaction)";
                        badgeStyle = "bg-purple-500/20 text-purple-300 border-purple-500/30";
                        contextReason = "Both participants joined but at separate times with no recorded interaction overlap.";
                      } else if (log.status === "no_show") {
                        badgeText = "No-Show";
                        badgeStyle = "bg-rose-500/20 text-rose-300 border-rose-500/30";
                        contextReason = log.notes || "Marked as No-Show.";
                      } else if (log.notes) {
                        badgeText = "Requires Review";
                        badgeStyle = "bg-sky-500/20 text-sky-300 border-sky-500/30";
                        contextReason = log.notes;
                      }

                      return (
                        <div
                          key={idx}
                          className="bg-slate-950/80 border border-rose-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded text-xs">
                                {log.scheduledStartTime} - {log.scheduledEndTime}
                              </span>
                              <span className="font-semibold text-rose-300">{log.trainerName}</span>
                              <span className="text-slate-500">→</span>
                              <span className="text-slate-300">{log.studentName || "Student"}</span>
                            </div>
                            <p className="text-slate-400 text-xs">
                              {contextReason}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-2.5 py-1 rounded-full border font-semibold text-[11px] whitespace-nowrap ${badgeStyle}`}>
                              {badgeText}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
