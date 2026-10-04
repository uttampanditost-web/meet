import React, { useState, useEffect } from "react";
import { Slot, Trainer, AttendanceLog } from "../types";
import {
  Video,
  UserCheck,
  UserX,
  Clock,
  Activity,
  Globe,
  Sparkles,
  Users
} from "lucide-react";

interface LiveMonitorBarProps {
  slots: Slot[];
  trainers: Trainer[];
  logs: AttendanceLog[];
}

export const LiveMonitorBar: React.FC<LiveMonitorBarProps> = ({
  slots,
  trainers,
  logs,
}) => {
  // Live system clock for 24-hour time display
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Find live slots or slots currently scheduled
  const liveSlots = slots.filter((s) => s.status === "live");
  const upcomingSlots = slots.filter((s) => s.status === "scheduled");
  const completedSlots = slots.filter((s) => s.status === "completed");

  const formattedTime24 = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const formattedTime12 = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const getMeetingStatusBadge = (status?: string) => {
    switch (status) {
      case "Host Joined":
        return "bg-indigo-950/90 text-indigo-300 border-indigo-500/40";
      case "Students Waiting":
        return "bg-amber-950/90 text-amber-300 border-amber-500/40 animate-pulse";
      case "Meeting Started":
        return "bg-emerald-950/90 text-emerald-300 border-emerald-500/40 animate-pulse";
      case "Meeting Ended":
        return "bg-slate-900 text-slate-400 border-slate-700";
      default:
        return "bg-slate-950 text-slate-300 border-slate-800";
    }
  };

  return (
    <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 mb-8 shadow-xl relative overflow-hidden">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-0 pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800 relative z-10">
        <div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Automated Google Meet Live Monitor
              <span className="text-xs font-normal text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                100% Event-Driven
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Continuous background monitoring of Google Meet links. Zero manual actions required.
          </p>
        </div>

        {/* 24-Hour System Clock & Operational Metrics */}
        <div className="flex items-center space-x-3 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-1.5 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="text-slate-400">System Time:</span>
            <strong className="text-white font-mono">{formattedTime12}</strong>
            <span className="text-[10px] text-slate-500 font-mono">({formattedTime24})</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-2 text-[11px]">
            <span className="text-emerald-400 font-semibold">{liveSlots.length} Active</span>
            <span className="text-slate-500">•</span>
            <span className="text-indigo-300">{upcomingSlots.length} Waiting</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{completedSlots.length} Ended</span>
          </div>
        </div>
      </div>

      {/* Live Session Grid */}
      {liveSlots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
          {liveSlots.map((slot) => {
            const trainer = trainers.find((t) => t.id === slot.trainerId);
            const log = logs.find((l) => l.slotId === slot.id);

            const meetingStatus = log?.meetingStatus || slot.meetingStatus || "Waiting";
            const askTime = log?.askToJoinTime || slot.askToJoinTime;
            const requests = log?.joinRequests || [];

            return (
              <div
                key={slot.id}
                className="bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 transition-all shadow-md relative"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={trainer?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250"}
                      alt={slot.trainerName}
                      className="w-9 h-9 rounded-full object-cover border border-indigo-500/30"
                    />
                    <div>
                      <h3 className="font-semibold text-xs text-white line-clamp-1">
                        {slot.trainerName}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Slot: {slot.startTime} - {slot.endTime}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${getMeetingStatusBadge(meetingStatus)}`}>
                    {meetingStatus}
                  </span>
                </div>

                {/* Meeting ID & Details */}
                <div className="bg-slate-900/90 rounded-lg p-2.5 mb-3 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Meeting ID:</span>
                    <span className="font-mono text-indigo-300 font-bold">{log?.meetingId || slot.meetingId || "google-meet"}</span>
                  </div>
                  <div className="text-slate-300 font-medium truncate">
                    Student: <span className="text-white font-semibold">{slot.studentName && slot.studentName !== "Customer" ? slot.studentName : (slot.studentEmail ? slot.studentEmail.split('@')[0] : "Student Participant")}</span>
                  </div>
                  {slot.meetUrl && (
                    <a
                      href={slot.meetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 font-mono pt-1 truncate"
                    >
                      <Video className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="truncate">{slot.meetUrl}</span>
                    </a>
                  )}
                </div>

                {/* Automatic Real-time Timestamps */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mb-2">
                  <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                    <span className="text-slate-400 block mb-0.5">Mentor Join Time:</span>
                    <span className={log?.mentorJoinedAt ? "text-indigo-300 font-bold" : "text-slate-500"}>
                      {log?.mentorJoinedAt ? new Date(log.mentorJoinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Pending"}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                    <span className="text-emerald-400 block mb-0.5">Student Join Time (IN):</span>
                    <span className={askTime || log?.studentJoinedAt ? "text-emerald-300 font-bold" : "text-slate-500"}>
                      {(askTime || log?.studentJoinedAt) ? new Date(log?.studentJoinedAt || askTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Pending"}
                    </span>
                  </div>
                </div>

                {/* Multi-student Requests Log */}
                {requests.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80">
                    <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-indigo-400" />
                        <span>Student Join Requests ({requests.length}):</span>
                      </span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {requests.map((r) => (
                        <div key={r.id} className="p-1.5 bg-slate-900 rounded border border-slate-800 text-[10px] flex items-center justify-between">
                          <span className="text-slate-300 font-medium truncate max-w-[120px]">{r.studentName}</span>
                          <span className="text-amber-300 font-mono">
                            Requested: {new Date(r.askToJoinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-950/60 rounded-xl p-5 border border-slate-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-2 text-indigo-400 mb-1">
                <Globe className="w-4 h-4" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  24/7 Background Google Meet Event Daemon Active
                </h3>
              </div>
              <p className="text-xs text-slate-400 max-w-lg">
                Monitoring mentor links automatically. All meeting join requests, host arrivals, and session durations log in real-time with 0 manual interaction.
              </p>
            </div>
            <div className="text-xs text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Auto-Monitoring Daemon Online</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

