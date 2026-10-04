import React, { useState } from "react";
import { X, Clock, UserCheck, CheckCircle2, User, Mail, Video, Calendar } from "lucide-react";
import { Trainer, AttendanceLog } from "../types";
import { getLocalDateString } from "../lib/dateUtils";

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainers: Trainer[];
  userEmail?: string;
  onSuccess: () => void;
}

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
  isOpen,
  onClose,
  trainers,
  userEmail,
  onSuccess,
}) => {
  const todayStr = getLocalDateString();

  const [selectedTrainerId, setSelectedTrainerId] = useState(trainers[0]?.id || "");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:30");

  const [mentorJoined, setMentorJoined] = useState(true);
  const [mentorJoinTime, setMentorJoinTime] = useState("10:01");
  const [mentorLeftTime, setMentorLeftTime] = useState("10:30");

  const [studentJoined, setStudentJoined] = useState(true);
  const [studentJoinTime, setStudentJoinTime] = useState("10:03");
  const [studentLeftTime, setStudentLeftTime] = useState("10:28");

  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const selectedTrainer = trainers.find((t) => t.id === selectedTrainerId);
      const mentorJoinedAtIso = mentorJoined
        ? new Date(`${date}T${mentorJoinTime}:00`).toISOString()
        : null;
      const mentorLeftAtIso = mentorJoined && mentorLeftTime
        ? new Date(`${date}T${mentorLeftTime}:00`).toISOString()
        : null;

      const studentJoinedAtIso = studentJoined
        ? new Date(`${date}T${studentJoinTime}:00`).toISOString()
        : null;
      const studentLeftAtIso = studentJoined && studentLeftTime
        ? new Date(`${date}T${studentLeftTime}:00`).toISOString()
        : null;

      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainerId: selectedTrainerId,
          trainerName: selectedTrainer?.name || "Mentor",
          studentName: studentName || "Customer Participant",
          studentEmail,
          date,
          startTime,
          endTime,
          mentorJoinedAt: mentorJoinedAtIso,
          mentorLeftAt: mentorLeftAtIso,
          studentJoinedAt: studentJoinedAtIso,
          studentLeftAt: studentLeftAtIso,
          notes,
          userEmail,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error("Failed to manually log attendance:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-xs text-slate-200">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Record Google Meet Attendance</h3>
              <p className="text-[11px] text-slate-400">
                Log exact mentor & customer join/exit timestamps into the Journal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trainer Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Select Mentor / Trainer
            </label>
            <select
              value={selectedTrainerId}
              onChange={(e) => setSelectedTrainerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              required
            >
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email || t.specialization})
                </option>
              ))}
              {trainers.length === 0 && (
                <option value="default">Default Mentor</option>
              )}
            </select>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Customer / Student Name
              </label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Customer Email (Optional)
              </label>
              <input
                type="email"
                placeholder="rahul@example.com"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Date & Slot Times */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Slot Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Slot End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* Mentor Timestamps */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Mentor Join & Exit Timestamps
              </span>
              <label className="flex items-center space-x-1 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mentorJoined}
                  onChange={(e) => setMentorJoined(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
                />
                <span>Mentor Attended</span>
              </label>
            </div>

            {mentorJoined && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400">Mentor Joined At</span>
                  <input
                    type="time"
                    value={mentorJoinTime}
                    onChange={(e) => setMentorJoinTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Mentor Left At</span>
                  <input
                    type="time"
                    value={mentorLeftTime}
                    onChange={(e) => setMentorLeftTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Student/Customer Timestamps */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-teal-400 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Customer Join & Exit Timestamps
              </span>
              <label className="flex items-center space-x-1 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={studentJoined}
                  onChange={(e) => setStudentJoined(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-0"
                />
                <span>Customer Attended</span>
              </label>
            </div>

            {studentJoined && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400">Customer Joined At</span>
                  <input
                    type="time"
                    value={studentJoinTime}
                    onChange={(e) => setStudentJoinTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Customer Left At</span>
                  <input
                    type="time"
                    value={studentLeftTime}
                    onChange={(e) => setStudentLeftTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Notes / Audit Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Session completed successfully on Google Meet"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? "Saving..." : "Save Attendance Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
