import React, { useState, useMemo, useEffect } from "react";
import { Slot, Trainer, AttendanceLog } from "../types";
import { generateGoogleCalendarWebUrl } from "../lib/calendarService";
import { getLocalDateString, getTodayString, getTomorrowString, getOffsetDateString } from "../lib/dateUtils";
import { getTrainerSlug } from "./TrainersGrid";
import { generateDaySlotsForTrainer } from "../lib/slotGenerator";
import {
  Clock,
  Plus,
  Search,
  Video,
  ExternalLink,
  Edit,
  Trash2,
  Layers,
  Sparkles,
  Check,
  ArrowRight,
  BookmarkPlus,
  Calendar,
  X,
  Play,
  Square,
  UserCheck,
  CheckCircle,
  AlertTriangle,
  Copy
} from "lucide-react";

interface SlotSchedulerProps {
  slots: Slot[];
  trainers: Trainer[];
  logs?: AttendanceLog[];
  selectedDate: string;
  onDateChange?: (date: string) => void;
  onSaveSlot: (slotData: Partial<Slot>) => void;
  onDeleteSlot: (id: string) => void;
  onSessionControl?: (
    slotId: string,
    action: "start" | "student_join" | "end_session" | "student_leave",
    studentName?: string,
    studentEmail?: string
  ) => void;
  isConnected?: boolean;
  onConnectGoogle?: () => void;
  isAdmin?: boolean;
}

export const SlotScheduler: React.FC<SlotSchedulerProps> = ({
  slots,
  trainers,
  logs = [],
  selectedDate,
  onDateChange,
  onSaveSlot,
  onDeleteSlot,
  onSessionControl,
  isConnected = false,
  onConnectGoogle,
  isAdmin = false,
}) => {
  const [selectedTrainerFilter, setSelectedTrainerFilter] = useState<string>("all");
  const [selectedDurationFilter, setSelectedDurationFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Single Slot Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Partial<Slot> | null>(null);
  const [selectedDurationPreset, setSelectedDurationPreset] = useState<number>(30); // default 30 mins
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyTrackedLink = (key: string, urlPath: string) => {
    const fullUrl = `${window.location.origin}${urlPath}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Date Helpers
  const formatDisplayDate = (dateStr?: string): string => {
    if (!dateStr) return "";
    const today = getTodayString();
    const tomorrow = getTomorrowString();
    if (dateStr === today) return "Today";
    if (dateStr === tomorrow) return "Tomorrow";
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getCurrentRoundedTime = (): string => {
    const now = new Date();
    const hours = now.getHours();
    const mins = now.getMinutes();
    const roundedMins = mins >= 30 ? 0 : 30;
    const roundedHours = mins >= 30 ? (hours + 1) % 24 : hours;
    return `${roundedHours < 10 ? "0" : ""}${roundedHours}:${roundedMins < 10 ? "0" : ""}${roundedMins}`;
  };

  // Bulk Slot Generator Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTrainerId, setBulkTrainerId] = useState<string>("");
  const [bulkDate, setBulkDate] = useState<string>(selectedDate !== "all" ? selectedDate : getTodayString());
  const [bulkStartTime, setBulkStartTime] = useState<string>("09:00");
  const [bulkEndTime, setBulkEndTime] = useState<string>("13:00");
  const [bulkDuration, setBulkDuration] = useState<number>(30);
  const [bulkTopic, setBulkTopic] = useState<string>("1-on-1 Mentorship Session");

  // Helper to calculate duration in minutes
  const getSlotDurationMinutes = (start: string, end: string): number => {
    if (!start || !end) return 30;
    try {
      const [h1, m1] = start.split(":").map(Number);
      const [h2, m2] = end.split(":").map(Number);
      const totalM1 = h1 * 60 + m1;
      const totalM2 = h2 * 60 + m2;
      const diff = totalM2 - totalM1;
      return diff > 0 ? diff : 30;
    } catch {
      return 30;
    }
  };

  const formatDurationText = (mins: number): string => {
    if (mins < 60) return `${mins}m session`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m session` : `${hrs}h session`;
  };

  const calculateEndTime = (start: string, durationMins: number): string => {
    if (!start) return "14:30";
    const [h, m] = start.split(":").map(Number);
    const totalM = h * 60 + m + durationMins;
    const endH = Math.floor(totalM / 60) % 24;
    const endM = totalM % 60;
    return `${endH < 10 ? "0" : ""}${endH}:${endM < 10 ? "0" : ""}${endM}`;
  };

  // O(1) Pre-indexed lookups for instant card rendering (eliminates multi-million array scan freeze)
  const logsBySlotId = useMemo(() => {
    const map = new Map<string, AttendanceLog>();
    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      if (l.slotId) map.set(l.slotId, l);
    }
    return map;
  }, [logs]);

  const trainersById = useMemo(() => {
    const map = new Map<string, Trainer>();
    for (let i = 0; i < trainers.length; i++) {
      const t = trainers[i];
      if (t.id) map.set(t.id, t);
    }
    return map;
  }, [trainers]);

  const [visibleCount, setVisibleCount] = useState<number>(60);

  useEffect(() => {
    setVisibleCount(60);
  }, [selectedDate, selectedTrainerFilter, searchTerm, selectedDurationFilter]);

  const filteredSlots = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return slots.filter((slot) => {
      // 1. Critical Date Filter: restricts rendering to the active selected date (unless 'all' dates explicitly chosen)
      const matchesDate = !selectedDate || selectedDate === "all" || slot.date === selectedDate;
      if (!matchesDate) return false;

      // 2. Mentor Filter
      const matchesTrainer =
        selectedTrainerFilter === "all" || slot.trainerId === selectedTrainerFilter;
      if (!matchesTrainer) return false;

      // 3. Search Filter
      if (term) {
        const student = (slot.studentName || "").toLowerCase();
        const trainer = (slot.trainerName || "").toLowerCase();
        const topic = (slot.topic || "").toLowerCase();
        if (!student.includes(term) && !trainer.includes(term) && !topic.includes(term)) {
          return false;
        }
      }

      // 4. Duration Filter
      if (selectedDurationFilter !== "all") {
        const duration = getSlotDurationMinutes(slot.startTime, slot.endTime);
        if (selectedDurationFilter === "15" && duration !== 15) return false;
        if (selectedDurationFilter === "30" && duration !== 30) return false;
        if (selectedDurationFilter === "45" && duration !== 45) return false;
        if (selectedDurationFilter === "60" && duration !== 60) return false;
        if (selectedDurationFilter === "long" && duration <= 60) return false;
      }

      return true;
    });
  }, [slots, selectedDate, selectedTrainerFilter, searchTerm, selectedDurationFilter]);

  const displayedSlots = useMemo(() => {
    return filteredSlots.slice(0, visibleCount);
  }, [filteredSlots, visibleCount]);

  const handleOpenAddModal = (targetTrainerId?: string, startTime?: string) => {
    const effectiveTrainerId = targetTrainerId || (selectedTrainerFilter !== "all" ? selectedTrainerFilter : "") || trainers[0]?.id || "";
    const defaultTrainer = trainers.find((t) => t.id === effectiveTrainerId) || trainers[0];
    const initialStart = startTime || getCurrentRoundedTime();
    const initialDuration = 30;
    setSelectedDurationPreset(initialDuration);
    setSavedNotice(null);

    setEditingSlot({
      trainerId: defaultTrainer ? defaultTrainer.id : "",
      trainerName: defaultTrainer ? defaultTrainer.name : "",
      date: selectedDate && selectedDate !== "all" ? selectedDate : getTodayString(),
      startTime: initialStart,
      endTime: calculateEndTime(initialStart, initialDuration),
      studentName: "Open Slot",
      studentEmail: "",
      topic: "1-on-1 Mentorship Session",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (slot: Slot) => {
    const dur = getSlotDurationMinutes(slot.startTime, slot.endTime);
    setSelectedDurationPreset([15, 30, 45, 60, 90, 120].includes(dur) ? dur : -1);
    setSavedNotice(null);
    setEditingSlot(slot);
    setIsModalOpen(true);
  };

  const handleDurationPresetClick = (dur: number) => {
    setSelectedDurationPreset(dur);
    if (editingSlot && editingSlot.startTime) {
      const newEnd = calculateEndTime(editingSlot.startTime, dur);
      setEditingSlot({ ...editingSlot, endTime: newEnd });
    }
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSlot && editingSlot.trainerId) {
      const slotToSave = {
        ...editingSlot,
        date: editingSlot.date || (selectedDate !== "all" ? selectedDate : getTodayString()),
        studentName: editingSlot.studentName || "Open Slot",
        studentEmail: editingSlot.studentEmail || "",
        topic: editingSlot.topic || "1-on-1 Mentorship Session",
      };
      onSaveSlot(slotToSave);
      setIsModalOpen(false);
      setEditingSlot(null);
      setSavedNotice(null);
    }
  };

  // "+ Next Slot" Action inside Single Slot Modal
  const handleSaveAndAddNextSlot = () => {
    if (!editingSlot || !editingSlot.trainerId) return;

    const currentDuration = selectedDurationPreset > 0
      ? selectedDurationPreset
      : getSlotDurationMinutes(editingSlot.startTime || "14:00", editingSlot.endTime || "14:30");

    const targetDate = editingSlot.date || (selectedDate !== "all" ? selectedDate : getTodayString());

    const slotToSave = {
      ...editingSlot,
      date: targetDate,
      studentName: editingSlot.studentName || "Open Slot",
      studentEmail: editingSlot.studentEmail || "",
      topic: editingSlot.topic || "1-on-1 Mentorship Session",
    };
    onSaveSlot(slotToSave);

    const nextStart = editingSlot.endTime || "14:30";
    const nextEnd = calculateEndTime(nextStart, currentDuration);

    setSavedNotice(`✓ Created slot on ${targetDate} (${editingSlot.startTime} - ${editingSlot.endTime})! Ready for next slot (${nextStart} - ${nextEnd}).`);

    setEditingSlot({
      trainerId: editingSlot.trainerId,
      date: targetDate,
      startTime: nextStart,
      endTime: nextEnd,
      studentName: "Open Slot",
      studentEmail: "",
      topic: editingSlot.topic || "1-on-1 Mentorship Session",
    });
  };

  // Quick "+ Next Slot" direct card action button
  const handleQuickAddNextFromCard = (slot: Slot) => {
    const duration = getSlotDurationMinutes(slot.startTime, slot.endTime);
    const nextStart = slot.endTime;
    const nextEnd = calculateEndTime(nextStart, duration);

    onSaveSlot({
      trainerId: slot.trainerId,
      trainerName: slot.trainerName,
      date: slot.date || selectedDate,
      startTime: nextStart,
      endTime: nextEnd,
      studentName: "Open Slot",
      studentEmail: "",
      topic: slot.topic || "1-on-1 Mentorship Session",
      status: "scheduled",
    });
  };

  // Bulk Generator Calculations
  const getBulkSlotsPreview = () => {
    const list: { start: string; end: string }[] = [];
    if (!bulkStartTime || !bulkEndTime || bulkDuration <= 0) return list;

    let currStart = bulkStartTime;
    const [endH, endM] = bulkEndTime.split(":").map(Number);
    const limitTotalM = endH * 60 + endM;

    let count = 0;
    while (count < 40) {
      const [cH, cM] = currStart.split(":").map(Number);
      const currTotalM = cH * 60 + cM;
      if (currTotalM >= limitTotalM) break;

      const nextEndM = currTotalM + bulkDuration;
      if (nextEndM > limitTotalM) break;

      const currEnd = calculateEndTime(currStart, bulkDuration);
      list.push({ start: currStart, end: currEnd });
      currStart = currEnd;
      count++;
    }
    return list;
  };

  const handleExecuteBulkGeneration = (e: React.FormEvent) => {
    e.preventDefault();
    const previewList = getBulkSlotsPreview();
    if (previewList.length === 0) return;

    const targetTrainers = bulkTrainerId === "all" || !bulkTrainerId
      ? trainers
      : trainers.filter((t) => t.id === bulkTrainerId);

    const targetDate = bulkDate || (selectedDate !== "all" ? selectedDate : getTodayString());

    targetTrainers.forEach((tr) => {
      previewList.forEach((item) => {
        onSaveSlot({
          trainerId: tr.id,
          trainerName: tr.name,
          date: targetDate,
          startTime: item.start,
          endTime: item.end,
          studentName: "Open Slot",
          studentEmail: "",
          topic: bulkTopic || "1-on-1 Mentorship Session",
          status: "scheduled",
        });
      });
    });

    setIsBulkModalOpen(false);
  };

  // Quick 1-click Auto-Generate all 31 slots (8:00 AM - 11:00 PM) for this date
  const handleGenerateAll31SlotsForDate = () => {
    const targetTrainers = selectedTrainerFilter === "all" ? trainers : trainers.filter((t) => t.id === selectedTrainerFilter);
    const targetDate = selectedDate !== "all" ? selectedDate : getTodayString();

    targetTrainers.forEach((tr) => {
      const generated = generateDaySlotsForTrainer(tr, targetDate);
      generated.forEach((s) => onSaveSlot(s));
    });
  };

  return (
    <div className="space-y-6">
      {/* Fully Automated Google Calendar & Meet Tracking Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 p-4 rounded-xl shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-600/20 rounded-lg border border-indigo-500/40 shrink-0">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">Fully Automated Google Calendar & Meet Attendance</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>0-Touch Automation Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Slots automatically sync to Google Calendar. When mentors or students click their direct Google Meet links (10 mins before session or anytime), attendance is instantly logged (Mentor "Join now" & Student "Ask to join" requests) with 0 manual effort required!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
              Auto-Tracking Daemon Active
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Control Bar */}
      <div className="ios-glass-card border border-white/15 p-5 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-4 backdrop-blur-2xl shadow-xl">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Mentorship Slot Schedule</span>
            <span className="text-xs font-semibold text-sky-300 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20 font-mono">
              Future Date Booking Enabled
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Book slots for today or future dates across {trainers.length} registered mentors.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Active Schedule Date Selector & Quick Pills */}
          <div className="flex items-center space-x-1.5 bg-black/40 border border-white/10 rounded-xl p-1 backdrop-blur-md">
            <div className="flex items-center px-2 py-0.5 text-xs text-sky-300 font-semibold gap-1 relative cursor-pointer">
              <button
                type="button"
                onClick={(e) => {
                  const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                  try { input?.showPicker?.(); } catch {}
                }}
                className="p-0.5 text-sky-400 hover:text-sky-300"
                title="Open Calendar"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <input
                type="date"
                id="schedule-date-picker"
                style={{ colorScheme: "dark" }}
                value={selectedDate === "all" ? getTodayString() : selectedDate}
                onChange={(e) => onDateChange && onDateChange(e.target.value)}
                onClick={(e) => {
                  try { e.currentTarget.showPicker?.(); } catch {}
                }}
                className="bg-transparent text-white font-medium focus:outline-none text-xs cursor-pointer"
              />
            </div>
            <button
              onClick={() => onDateChange && onDateChange(getTodayString())}
              className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                selectedDate === getTodayString()
                  ? "ios-glass-button bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => onDateChange && onDateChange(getTomorrowString())}
              className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                selectedDate === getTomorrowString()
                  ? "ios-glass-button bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Tomorrow
            </button>
            <button
              onClick={() => onDateChange && onDateChange("all")}
              className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                selectedDate === "all"
                  ? "ios-glass-button bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Dates
            </button>
          </div>

          {/* Filter Trainer */}
          <div className="relative">
            <select
              id="filter-trainer-select"
              value={selectedTrainerFilter}
              onChange={(e) => setSelectedTrainerFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400 cursor-pointer backdrop-blur-md"
            >
              <option value="all">All Mentors ({trainers.length})</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.specialization})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Duration */}
          <div className="relative">
            <select
              id="filter-duration-select"
              value={selectedDurationFilter}
              onChange={(e) => setSelectedDurationFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400 cursor-pointer backdrop-blur-md"
            >
              <option value="all">All Durations</option>
              <option value="15">15 mins</option>
              <option value="30">30 mins</option>
              <option value="45">45 mins</option>
              <option value="60">60 mins (1 hr)</option>
              <option value="long">&gt; 60 mins</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 lg:w-40">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              id="search-slots-input"
              placeholder="Search mentor/topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400 backdrop-blur-md transition-all"
            />
          </div>

          {/* Bulk Slot Generator Button */}
          {isAdmin ? (
            <>
              <button
                id="bulk-slot-btn"
                onClick={() => {
                  setBulkTrainerId(trainers[0]?.id || "all");
                  setBulkDate(selectedDate !== "all" ? selectedDate : getTodayString());
                  setIsBulkModalOpen(true);
                }}
                className="ios-glass-button flex items-center space-x-1.5 px-3.5 py-2 text-sky-200 border border-white/15 rounded-xl text-xs font-semibold shadow transition-all whitespace-nowrap cursor-pointer active:scale-95"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Bulk Add Slots</span>
              </button>

              {/* New Slot Button */}
              <button
                id="add-slot-btn"
                onClick={() => handleOpenAddModal(selectedTrainerFilter !== "all" ? selectedTrainerFilter : undefined)}
                className="ios-glass-button flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow transition-all whitespace-nowrap cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Slot</span>
              </button>
            </>
          ) : (
            <span className="text-[11px] bg-white/[0.04] text-slate-400 border border-white/10 px-3 py-1.5 rounded-xl font-medium">
              View-Only Mode
            </span>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-400 flex items-center justify-between backdrop-blur-md">
          <span>🔒 Viewing slot schedule in read-only mode. Admin privileges are required to create, edit, or delete slots.</span>
        </div>
      )}

      {/* Slots List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedSlots.length > 0 ? (
          displayedSlots.map((slot) => {
            const trainer = trainersById.get(slot.trainerId) || trainers.find((t) => t.id === slot.trainerId);
            const slotLog = logsBySlotId.get(slot.id);
            const hasAttended = Boolean((slotLog?.trackedDurationSeconds && slotLog.trackedDurationSeconds > 30) || (slotLog?.totalOverlapMinutes && slotLog.totalOverlapMinutes > 0));
            const isSoloMentorNoShow = Boolean(slotLog?.mentorJoinedAt) && !slotLog?.studentJoinedAt && !slotLog?.askToJoinTime && (slot.status === "completed" || slotLog?.status === "completed");
            const isNoShow = !hasAttended && (slot.status === "no_show" || slotLog?.status === "no_show" || isSoloMentorNoShow);
            const isCompleted = hasAttended || slot.status === "completed" || slotLog?.status === "completed";
            const isLive = !isNoShow && !isCompleted && (slot.status === "live" || Boolean(slotLog?.trackingActive));
            const durationMins = getSlotDurationMinutes(slot.startTime, slot.endTime);
            const nextSlotEndTime = calculateEndTime(slot.endTime, durationMins);

            return (
              <div
                key={slot.id}
                className={`ios-glass-card rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between group relative overflow-hidden backdrop-blur-2xl ${
                  isLive
                    ? "border-emerald-400/60 bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-teal-950/30 shadow-[0_0_25px_rgba(52,211,153,0.25)] ring-1 ring-emerald-400/40"
                    : isNoShow
                    ? "border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-slate-900/90 to-slate-900/70"
                    : isCompleted
                    ? "border-white/10 bg-white/[0.03] opacity-85"
                    : "border-white/15 bg-gradient-to-br from-white/[0.08] via-slate-900/90 to-white/[0.02] shadow-lg hover:border-sky-400/40 hover:shadow-[0_12px_36px_rgba(56,189,248,0.12)]"
                }`}
              >
                {/* Ambient Top Light */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/20 transition-all" />

                <div>
                  {/* Top Bar: Time, Duration, Date & Status */}
                  <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/10 gap-1.5 flex-wrap">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-sky-300">
                      <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>
                        {slot.startTime} - {slot.endTime}
                      </span>
                      <span className="text-[10px] ios-glass-pill text-sky-300 font-semibold px-2 py-0.5 rounded-full border border-sky-400/30 font-mono">
                        {formatDurationText(durationMins)}
                      </span>
                    </div>

                    {/* Date Badge */}
                    <span className="text-[10px] bg-sky-950/70 text-sky-200 border border-sky-500/30 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-sky-400" />
                      <span>{formatDisplayDate(slot.date)} ({slot.date})</span>
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        isNoShow
                          ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
                          : isCompleted
                          ? "bg-white/[0.05] text-slate-300 border-white/10"
                          : isLive
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse"
                          : "bg-sky-500/15 text-sky-300 border-sky-400/30"
                      }`}
                    >
                      {isNoShow
                        ? "🚫 Student No Show"
                        : isCompleted
                        ? "Completed"
                        : isLive
                        ? "🔴 LIVE NOW"
                        : "Scheduled"}
                    </span>
                  </div>

                  {/* Trainer Info */}
                  <div className="flex items-center space-x-3 mb-3.5">
                    <img
                      src={trainer?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250"}
                      alt={slot.trainerName}
                      className="w-9 h-9 rounded-xl object-cover border-2 border-sky-400/40 shadow-[0_0_12px_rgba(56,189,248,0.2)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {slot.trainerName}
                      </div>
                      <div className="text-[11px] text-sky-300/80 font-medium truncate">
                        {trainer?.specialization || "EdTech Mentor"}
                      </div>
                    </div>
                  </div>

                  {/* Topic Box */}
                  <div className="bg-white/[0.03] backdrop-blur-md p-3 rounded-xl border border-white/10 text-xs mb-3.5 flex items-center justify-between shadow-inner">
                    <div className="truncate pr-2">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Session Topic</span>
                      <span className="text-white font-medium truncate block">{trainer?.specialization || slot.topic || "Mentorship Domain"}</span>
                    </div>
                    <span className="text-[10px] bg-sky-950/70 text-sky-300 px-2.5 py-0.5 rounded-lg border border-sky-500/30 whitespace-nowrap font-mono">
                      Ready
                    </span>
                  </div>
                </div>

                  {/* Google Meet Tracker Controls (Open Meet & Track Student Admit) */}
                  {(() => {
                    const slotLog = logsBySlotId.get(slot.id);
                    const formatTelemetryTime = (iso: string | null | undefined) => {
                      if (!iso) return null;
                      const d = new Date(iso);
                      if (isNaN(d.getTime())) return null;
                      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    };

                    const mentorTime = formatTelemetryTime(slotLog?.mentorJoinedAt);
                    const mentorOutTime = formatTelemetryTime(slotLog?.mentorLeftAt);
                    const studentTime = formatTelemetryTime(slotLog?.studentJoinedAt);
                    const studentOutTime = formatTelemetryTime(slotLog?.studentLeftAt);
                    const askTime = formatTelemetryTime(slotLog?.askToJoinTime || slot.askToJoinTime);

                    const mentorWasPresentWhenAsked = slotLog?.mentorJoinedAt && slotLog?.askToJoinTime
                      ? new Date(slotLog.mentorJoinedAt).getTime() <= new Date(slotLog.askToJoinTime).getTime()
                      : !!slotLog?.mentorJoinedAt;

                    return (
                      <div className="my-2 p-3.5 bg-white/[0.03] backdrop-blur-md rounded-2xl border border-white/10 space-y-3 text-xs shadow-inner">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-sky-300 font-semibold text-[11px]">
                            <Video className="w-3.5 h-3.5 text-sky-400" />
                            <span>Google Meet Tracker</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      if (onSessionControl) {
                                        onSessionControl(slot.id, "start");
                                      } else {
                                        await fetch("/api/events/track", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            slotId: slot.id,
                                            trainerId: slot.trainerId,
                                            meetUrl: slot.meetUrl,
                                            role: "mentor",
                                            action: "mentor_join",
                                            participantName: slot.trainerName,
                                            timestamp: new Date().toISOString()
                                          }),
                                        });
                                      }
                                    } catch (e) {}
                                  }}
                                  className="text-[10px] ios-glass-button bg-sky-500/20 text-sky-200 px-2.5 py-1 rounded-lg font-mono font-medium border border-sky-400/30 transition cursor-pointer active:scale-95"
                                  title="Click to manually trigger/test mentor join for this slot"
                                >
                                  ⚡ Test Join
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("Mark student as 'No Show' for this meeting slot?")) {
                                      if (onSessionControl) {
                                        onSessionControl(slot.id, "no_show", slot.studentName || "Customer", slot.studentEmail);
                                      } else {
                                        fetch("/api/session/control", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ slotId: slot.id, action: "no_show" }),
                                        });
                                      }
                                    }
                                  }}
                                  className="text-[10px] ios-glass-button bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg font-mono font-medium border border-amber-500/30 transition cursor-pointer flex items-center gap-1 active:scale-95"
                                  title="Click to mark student as No Show for this meeting slot"
                                >
                                  🚫 No Show
                                </button>
                              </>
                            )}
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold border ${
                                slot.status === "no_show" || slotLog?.status === "no_show"
                                  ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
                                  : slot.status === "completed"
                                  ? "bg-white/[0.05] text-slate-300 border-white/10"
                                  : slot.status === "live"
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                  : "bg-sky-500/10 text-sky-300 border-sky-400/30"
                              }`}
                            >
                              {slot.status === "no_show" || slotLog?.status === "no_show" ? "🚫 No Show" : slot.status === "completed" ? "Ended (Auto OUT)" : slot.status === "live" ? "Live Session" : "Ready"}
                            </span>
                          </div>
                        </div>

                        {/* Mentor & Student Realtime IN/OUT Cards */}
                        <div className="bg-black/30 backdrop-blur-md p-3 rounded-xl border border-white/10 space-y-2.5">
                          <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-white/10">
                            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                              <span>Live Attendance & Auto OUT</span>
                            </span>
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Role-Specific Tracker</span>
                            </span>
                          </div>

                          {/* Role Statuses - Fully Automated Telemetry Tracking */}
                          <div className="grid grid-cols-1 gap-2 text-[11px]">
                            {/* Mentor Status Card */}
                            <div className={`p-2.5 rounded-lg border ${
                              (slot.status === "completed" || slotLog?.status === "completed") && !mentorTime
                                ? "bg-rose-950/30 border-rose-500/30 text-rose-200"
                                : mentorTime
                                ? "bg-indigo-950/50 border-indigo-500/40 text-indigo-200"
                                : "bg-slate-900 border-slate-800 text-slate-300"
                            }`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`font-semibold flex items-center gap-1.5 ${
                                  (slot.status === "completed" || slotLog?.status === "completed") && !mentorTime
                                    ? "text-rose-300"
                                    : "text-indigo-300"
                                }`}>
                                  <Video className={`w-3.5 h-3.5 ${
                                    (slot.status === "completed" || slotLog?.status === "completed") && !mentorTime
                                      ? "text-rose-400"
                                      : "text-indigo-400"
                                  }`} />
                                  <span>Mentor (Host)</span>
                                </span>
                                <span className={`text-[10px] font-mono font-medium ${
                                  (slot.status === "completed" || slotLog?.status === "completed") && !mentorTime
                                    ? "text-rose-400 font-bold"
                                    : mentorTime
                                    ? "text-indigo-400"
                                    : "text-slate-400"
                                }`}>
                                  {(slot.status === "completed" || slotLog?.status === "completed") && !mentorTime
                                    ? "🚫 Mentor Did Not Join"
                                    : mentorTime
                                    ? "⚡ Auto-Logged"
                                    : "Auto Pending"}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                                <span className={`px-2 py-0.5 rounded border ${
                                  mentorTime
                                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold"
                                    : (slot.status === "completed" || slotLog?.status === "completed") && !mentorTime
                                    ? "bg-rose-950/80 text-rose-300 border-rose-500/30 font-bold"
                                    : "bg-slate-950 text-slate-400 border-slate-800"
                                }`}>
                                  IN: {mentorTime || (slot.status === "completed" || slotLog?.status === "completed" ? "Did Not Join" : "Pending")}
                                </span>
                                <span className={`px-2 py-0.5 rounded border ${
                                  (slot.status === "completed" || slotLog?.status === "completed") && !mentorTime
                                    ? "bg-rose-950/80 text-rose-300 border-rose-500/30"
                                    : "bg-slate-950 text-slate-400 border-slate-800"
                                }`}>
                                  OUT: {mentorOutTime ? mentorOutTime : (slot.status === "completed" || slotLog?.status === "completed" ? (mentorTime ? "Ended" : "Did Not Join") : (mentorTime ? "In Call" : "Pending"))}
                                </span>
                              </div>
                            </div>

                            {/* Student Status Card */}
                            <div className={`p-2.5 rounded-lg border ${
                              slot.status === "no_show" || slotLog?.status === "no_show"
                                ? "bg-amber-950/30 border-amber-500/30 text-amber-200"
                                : studentTime || askTime
                                ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-200"
                                : "bg-slate-900 border-slate-800 text-slate-300"
                            }`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="truncate max-w-[130px]">Student ({slot.studentName && slot.studentName !== "Customer" ? slot.studentName : (slot.studentEmail ? slot.studentEmail.split('@')[0] : "Student")})</span>
                                </span>
                                <span className={`text-[10px] font-mono font-medium ${
                                  slot.status === "no_show" || slotLog?.status === "no_show"
                                    ? "text-amber-400 font-bold"
                                    : studentTime || askTime
                                    ? "text-emerald-400"
                                    : "text-slate-400"
                                }`}>
                                  {slot.status === "no_show" || slotLog?.status === "no_show"
                                    ? "🚫 Participant No-Show"
                                    : studentTime || askTime
                                    ? "⚡ Auto-Logged"
                                    : "Auto Pending"}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                                {/* STUDENT IN TIME */}
                                <span className={`px-2 py-0.5 rounded border ${
                                  slot.status === "no_show" || slotLog?.status === "no_show"
                                    ? "bg-amber-950/80 text-amber-300 border-amber-500/30 font-bold"
                                    : studentTime || askTime
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                                    : "bg-slate-950 text-slate-400 border-slate-800"
                                }`} title="Exact time student joined meeting">
                                  IN: {slot.status === "no_show" || slotLog?.status === "no_show" ? "Did Not Join (No Show)" : studentTime || askTime || "Pending"}
                                </span>

                                {/* STUDENT OUT TIME */}
                                <span className={`px-2 py-0.5 rounded border ${
                                  slot.status === "no_show" || slotLog?.status === "no_show"
                                    ? "bg-amber-950/80 text-amber-300 border-amber-500/30"
                                    : studentOutTime
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold"
                                    : "bg-slate-950 text-slate-400 border-slate-800"
                                }`}>
                                  OUT: {slot.status === "no_show" || slotLog?.status === "no_show" ? "No Show" : studentOutTime ? studentOutTime : (slot.status === "completed" || slotLog?.status === "completed" ? (studentTime || askTime ? "Ended" : "Did Not Join") : (studentTime || askTime ? "In Call" : "Pending"))}
                                </span>
                              </div>

                              {/* Manual Quick Triggers for Student Attendance (Admin Only) */}
                              {isAdmin && (
                                <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-800/80">
                                  <span className="text-[9px] text-slate-400 font-sans">Quick Log:</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onSessionControl) {
                                        onSessionControl(slot.id, "student_join", slot.studentName || "Customer", slot.studentEmail);
                                      }
                                    }}
                                    className="text-[9px] bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 transition cursor-pointer font-sans"
                                  >
                                    + Log Student IN
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onSessionControl) {
                                        onSessionControl(slot.id, "student_leave", slot.studentName || "Customer", slot.studentEmail);
                                      }
                                    }}
                                    className="text-[9px] bg-rose-950/80 hover:bg-rose-900/90 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30 transition cursor-pointer font-sans"
                                  >
                                    + Log Student OUT
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm("Mark student as 'No Show' for this meeting slot?")) {
                                        if (onSessionControl) {
                                          onSessionControl(slot.id, "no_show", slot.studentName || "Customer", slot.studentEmail);
                                        }
                                      }
                                    }}
                                    className="text-[9px] bg-amber-950/80 hover:bg-amber-900/90 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 transition cursor-pointer font-sans"
                                  >
                                    🚫 Mark No Show
                                  </button>
                                </div>
                              )}

                              {/* Mentor Presence Status at Student Request Time */}
                              {askTime && (
                                <div className="mt-2 text-[10px] font-sans pt-1 border-t border-slate-800/80 flex items-center justify-between">
                                  <span className="text-slate-400">Mentor Availability:</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                                    mentorOutTime
                                      ? "bg-slate-800 text-slate-400 border-slate-700"
                                      : mentorWasPresentWhenAsked
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  }`}>
                                    {mentorOutTime
                                      ? `🔴 Mentor Left Call (${mentorOutTime})`
                                      : mentorWasPresentWhenAsked
                                      ? "🟢 Mentor In Call"
                                      : "⚠️ Student Asked Before Mentor Joined"}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Total Session Duration & Early Exit Status Box */}
                            {(() => {
                              const trackedSecs = slotLog?.trackedDurationSeconds;
                              const isTracking = !!slotLog?.trackingActive;
                              const hasStartedTracking = !!slotLog?.trackingStartedAt || (trackedSecs !== undefined && trackedSecs !== null && trackedSecs > 0);

                              if (!hasStartedTracking && !isTracking) {
                                return null;
                              }

                              let durMins = 0;
                              const isTracked = !!slotLog?.trackedDurationSeconds || !!slotLog?.trackingStartedAt;
                              if (trackedSecs !== undefined && trackedSecs !== null && trackedSecs > 0) {
                                durMins = Math.max(1, Math.round(trackedSecs / 60));
                              } else if (slotLog?.totalOverlapMinutes !== null && slotLog?.totalOverlapMinutes !== undefined && slotLog.totalOverlapMinutes > 0) {
                                durMins = slotLog.totalOverlapMinutes;
                              } else if (slotLog?.trackingStartedAt) {
                                const startMs = new Date(slotLog.trackingStartedAt).getTime();
                                const endMs = slotLog.trackingStoppedAt ? new Date(slotLog.trackingStoppedAt).getTime() : Date.now();
                                durMins = Math.max(1, Math.round((endMs - startMs) / 60000));
                              }

                              const isCompleted = slot.status === "completed" || slotLog?.status === "completed";
                              const isEarlyExit = isCompleted && durMins < 30;

                              return (
                                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] text-slate-400 font-sans uppercase font-bold block">
                                        Session Duration
                                      </span>
                                      {isTracked && (
                                        <span className="text-[8px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-1 rounded font-sans font-medium">
                                          Tracked
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-emerald-300 font-bold text-xs">
                                      {trackedSecs && trackedSecs >= 60 ? (
                                        <>
                                          {Math.floor(trackedSecs / 60)}m {trackedSecs % 60}s{" "}
                                          <span className="text-[10px] text-slate-400 font-normal">({durMins} mins)</span>
                                        </>
                                      ) : trackedSecs && trackedSecs > 0 ? (
                                        <>
                                          {trackedSecs}s{" "}
                                          <span className="text-[10px] text-slate-400 font-normal">(1 min)</span>
                                        </>
                                      ) : (
                                        <>
                                          {durMins} mins{" "}
                                          <span className="text-[10px] text-slate-400 font-normal">(30m Slot)</span>
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  {isEarlyExit ? (
                                    <span className="bg-emerald-950/90 text-emerald-300 px-2 py-1 rounded text-[10px] font-semibold border border-emerald-500/40 font-sans flex items-center gap-1 shadow-sm">
                                      <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                                      Doubt Solved Early ({durMins}m / 30m)
                                    </span>
                                  ) : isCompleted ? (
                                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-sans border border-slate-700">
                                      Full 30m Session
                                    </span>
                                  ) : (
                                    <span className="bg-blue-950 text-blue-300 px-2 py-0.5 rounded text-[10px] font-sans border border-blue-500/30 animate-pulse">
                                      Live Session ({durMins}m)
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* 0-Touch Automated Google Meet Tracking Status & Recording Controls */}
                          {!isCompleted && !isNoShow ? (
                            <div className="mt-1 space-y-1.5">
                              <div className="px-2.5 py-1.5 bg-slate-950/80 border border-indigo-500/20 rounded-lg text-[10px] text-slate-300 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                  <span className="font-medium text-emerald-300">Auto-Tracking Active</span>
                                </div>
                                <span className="text-[9px] text-slate-400">Listens for Google Meet join</span>
                              </div>

                              {/* Close Recording & Complete Session Button (Admin Only) */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSessionControl?.(slot.id, "end_session");
                                  }}
                                  className="w-full py-1.5 px-3 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-500/40 hover:border-rose-400 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                >
                                  <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                                  <span>⏹ End Meeting & Close Recording</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className={`mt-1 text-[10px] font-medium flex items-center gap-1.5 p-2 rounded-lg border ${
                              isNoShow
                                ? "bg-amber-950/30 text-amber-300 border-amber-500/30"
                                : "bg-emerald-950/30 text-emerald-400 border-emerald-500/30"
                            }`}>
                              {isNoShow ? (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>Student Marked No Show — Meeting Ended & Closed</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>Meeting Recording Closed & Attendance Saved</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                {/* Footer Controls & Role Join Links */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Direct Google Meet Link */}
                      <div className="inline-flex items-center rounded bg-slate-900 border border-slate-700 overflow-hidden">
                        <a
                          href={slot.meetUrl || trainer?.meetUrl || "https://meet.google.com"}
                          target="_blank"
                          rel="noreferrer"
                          onClick={async () => {
                            try {
                              await fetch("/api/events/track", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  trainerId: slot.trainerId,
                                  meetUrl: slot.meetUrl || trainer?.meetUrl,
                                  role: "mentor",
                                  action: "mentor_join",
                                  participantName: slot.trainerName,
                                  timestamp: new Date().toISOString()
                                }),
                              });
                            } catch (e) {}
                          }}
                          className="flex items-center space-x-1 px-2.5 py-1 text-indigo-300 hover:text-white hover:bg-indigo-600/30 text-[11px] font-mono transition-all font-semibold"
                          title="Open Google Meet & auto-track mentor join"
                        >
                          <Video className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate max-w-[170px] sm:max-w-[220px]">
                            {slot.meetUrl ? slot.meetUrl.replace(/^https?:\/\//, '') : trainer?.meetUrl ? trainer.meetUrl.replace(/^https?:\/\//, '') : 'meet.google.com'}
                          </span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-70 shrink-0" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const link = slot.meetUrl || trainer?.meetUrl || "https://meet.google.com";
                            navigator.clipboard.writeText(link);
                            setCopiedKey(`meet-${slot.id}`);
                            setTimeout(() => setCopiedKey(null), 2000);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border-l border-slate-700 text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                          title="Copy Google Meet URL"
                        >
                          {copiedKey === `meet-${slot.id}` ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-0.5"><Check className="w-3 h-3" /> Copied</span>
                          ) : (
                            <span className="flex items-center gap-0.5"><Copy className="w-2.5 h-2.5 opacity-80" /> Copy Link</span>
                          )}
                        </button>
                           {/* 1-Click Zero-Extension Permanent Master Tracking Link */}
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const trainerObj = trainersById.get(slot.trainerId) || trainers.find((t) => t.id === slot.trainerId);
                            const slug = getTrainerSlug(trainerObj?.name || slot.trainerName, slot.trainerId);
                            const customDomain = localStorage.getItem("meettrack_custom_domain") || (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PUBLIC_JOIN_DOMAIN);
                            const baseUrl = customDomain ? customDomain.trim().replace(/\/+$/, "") : window.location.origin;
                            const permanentUrl = `${baseUrl}/join/${slug}`;
                            navigator.clipboard.writeText(permanentUrl);
                            setCopiedKey(`permanent-${slot.id}`);
                            setTimeout(() => setCopiedKey(null), 2000);
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] flex items-center gap-1.5 font-semibold transition cursor-pointer shadow"
                          title="Copy Permanent Tracking Link (Share with both mentor and students. Mentor logins track as mentor, student logins track as student)"
                        >
                          {copiedKey === `permanent-${slot.id}` ? (
                            <span className="text-white font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Copied Permanent Link!</span>
                          ) : (
                            <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber-300" /> Copy Permanent Tracking Link</span>
                          )}
                        </button>
                      </div>
                      </div>

                      <a
                        href={generateGoogleCalendarWebUrl({
                          date: slot.date,
                          startTime: slot.startTime,
                          endTime: slot.endTime,
                          topic: slot.topic || "Mentorship Session",
                          mentorName: slot.trainerName,
                          studentName: slot.studentName || "Student",
                          meetUrl: trainer?.meetUrl,
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-medium text-[10px] bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded"
                        title="Add session to Google Calendar"
                      >
                        <Calendar className="w-3 h-3 text-emerald-400" />
                        <span>+ Cal</span>
                      </a>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenEditModal(slot)}
                          className="p-1 text-slate-400 hover:text-white transition-colors"
                          title="Edit slot"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteSlot(slot.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Delete slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Consecutive Slot Button on Card (Admin Only) */}
                  {isAdmin && (
                    <button
                      onClick={() => handleQuickAddNextFromCard(slot)}
                      className="w-full py-1.5 bg-slate-950 hover:bg-indigo-950/50 text-indigo-300 hover:text-white border border-slate-800 hover:border-indigo-500/40 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all group"
                      title={`Create next ${durationMins}m slot on ${slot.date} from ${slot.endTime} to ${nextSlotEndTime}`}
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                      <span>+ Add Next Slot ({slot.endTime} → {nextSlotEndTime})</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full ios-glass-card rounded-2xl p-8 text-center border border-white/10">
            <Clock className="w-9 h-9 text-indigo-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No slots matched filter criteria for {selectedDate}</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
              {isAdmin
                ? "Every mentor automatically receives 31 slots (8:00 AM to 11:00 PM). Click below to immediately populate all 31 slots for this date."
                : "No mentorship slots are currently scheduled for this date."}
            </p>
            {isAdmin && trainers.length > 0 && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateAll31SlotsForDate}
                  className="ios-glass-primary px-5 py-2.5 rounded-2xl text-white font-bold text-xs flex items-center gap-2 shadow-xl transition-all cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>⚡ Auto-Generate All 31 Slots (8:00 AM – 11:00 PM)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {filteredSlots.length > displayedSlots.length && (
          <div className="col-span-full flex justify-center py-4">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 60)}
              className="ios-glass-button px-6 py-2.5 rounded-xl border border-sky-500/30 text-sky-300 hover:text-white font-semibold text-xs shadow-lg transition-all cursor-pointer active:scale-95 flex items-center gap-2"
            >
              <span>Load More Slots ({filteredSlots.length - displayedSlots.length} remaining)</span>
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Single Slot Modal */}
      {isModalOpen && editingSlot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl relative text-xs my-auto max-h-[88vh] flex flex-col overflow-hidden">
            {/* Pinned Header with Close X Button */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>{editingSlot.id ? "Edit Mentorship Slot" : "Schedule Mentorship Slot"}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setSavedNotice(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                {savedNotice && (
                  <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{savedNotice}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Select Mentor *
                  </label>
                  <select
                    required
                    value={editingSlot.trainerId}
                    onChange={(e) => {
                      const selectedTrainer = trainers.find((t) => t.id === e.target.value);
                      setEditingSlot({
                        ...editingSlot,
                        trainerId: e.target.value,
                        trainerName: selectedTrainer?.name || editingSlot.trainerName,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {trainers.length === 0 && (
                      <option value="">No mentors registered (Add mentor first)</option>
                    )}
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Slot Date Selection Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Slot Booking Date *</span>
                    <span className="text-[10px] text-indigo-400 font-normal">
                      📅 Select any date from calendar
                    </span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1 cursor-pointer">
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                          try { input?.showPicker?.(); } catch {}
                        }}
                        className="absolute left-2.5 top-2.5 text-indigo-400 hover:text-indigo-300 z-10 p-0.5"
                        title="Open Calendar Pop-up"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                      <input
                        type="date"
                        required
                        style={{ colorScheme: "dark" }}
                        value={editingSlot.date || (selectedDate !== "all" ? selectedDate : getTodayString())}
                        onChange={(e) =>
                          setEditingSlot({ ...editingSlot, date: e.target.value })
                        }
                        onClick={(e) => {
                          try { e.currentTarget.showPicker?.(); } catch {}
                        }}
                        className="w-full bg-slate-950 border border-indigo-500/40 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer font-medium"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingSlot({ ...editingSlot, date: getTodayString() })}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        editingSlot.date === getTodayString()
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      Today
                    </button>
                  </div>
                </div>

                {/* Duration Presets */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Slot Duration Presets
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[15, 30, 45, 60, 90].map((dur) => (
                      <button
                        type="button"
                        key={dur}
                        onClick={() => handleDurationPresetClick(dur)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                          selectedDurationPreset === dur
                            ? "bg-indigo-600 text-white border-indigo-500 shadow"
                            : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {dur}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* 24-Hour Time Period Presets */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Start Time Period (24-Hour)</span>
                    <span className="text-[10px] text-indigo-400 font-normal">Morning, Afternoon, Evening or Night</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[
                      { label: "🌅 Morning", time: "09:00" },
                      { label: "☀️ Afternoon", time: "13:00" },
                      { label: "🌆 Evening", time: "17:00" },
                      { label: "🌙 Night", time: "21:00" },
                    ].map((preset) => (
                      <button
                        type="button"
                        key={preset.time}
                        onClick={() => {
                          const duration = selectedDurationPreset > 0 ? selectedDurationPreset : 30;
                          setEditingSlot({
                            ...editingSlot,
                            startTime: preset.time,
                            endTime: calculateEndTime(preset.time, duration),
                          });
                        }}
                        className={`py-1 px-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                          editingSlot.startTime === preset.time
                            ? "bg-indigo-600 text-white border-indigo-500 shadow"
                            : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start & End Times */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span>Start Time *</span>
                    </label>
                    <input
                      type="time"
                      required
                      style={{ colorScheme: "dark" }}
                      value={editingSlot.startTime || getCurrentRoundedTime()}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const duration = selectedDurationPreset > 0 ? selectedDurationPreset : 30;
                        setEditingSlot({
                          ...editingSlot,
                          startTime: newStart,
                          endTime: calculateEndTime(newStart, duration),
                        });
                      }}
                      className="w-full bg-slate-950 border border-indigo-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      End Time (Changeable)
                    </label>
                    <input
                      type="time"
                      required
                      style={{ colorScheme: "dark" }}
                      value={editingSlot.endTime || calculateEndTime(editingSlot.startTime || getCurrentRoundedTime(), 30)}
                      onChange={(e) => {
                        setSelectedDurationPreset(-1); // custom duration
                        setEditingSlot({ ...editingSlot, endTime: e.target.value });
                      }}
                      className="w-full bg-slate-950 border border-indigo-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer font-medium"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 p-2 rounded-lg flex items-center justify-between">
                  <span>Calculated Slot Length:</span>
                  <span className="font-bold">
                    {formatDurationText(
                      getSlotDurationMinutes(
                        editingSlot.startTime || getCurrentRoundedTime(),
                        editingSlot.endTime || calculateEndTime(editingSlot.startTime || getCurrentRoundedTime(), 30)
                      )
                    )}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Session Topic
                  </label>
                  <input
                    type="text"
                    value={editingSlot.topic || ""}
                    onChange={(e) =>
                      setEditingSlot({ ...editingSlot, topic: e.target.value })
                    }
                    placeholder="e.g. 1-on-1 Mentorship Session"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Pinned Action Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/95 shrink-0 space-y-2">
                <button
                  type="button"
                  onClick={handleSaveAndAddNextSlot}
                  className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg shadow flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    Save & Add Next Slot (+{selectedDurationPreset > 0 ? selectedDurationPreset : 30}m)
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSavedNotice(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-medium transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg font-semibold shadow transition"
                  >
                    Save & Exit
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Slot Generator Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl relative text-xs my-auto max-h-[88vh] flex flex-col overflow-hidden">
            {/* Pinned Header with Close X Button */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Bulk Consecutive Slot Generator</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteBulkGeneration} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                {/* Target Booking Date for Bulk Generation */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Target Booking Date *</span>
                    <span className="text-[10px] text-indigo-400 font-normal">
                      📅 Select any date from calendar
                    </span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1 cursor-pointer">
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                          try { input?.showPicker?.(); } catch {}
                        }}
                        className="absolute left-2.5 top-2.5 text-indigo-400 hover:text-indigo-300 z-10 p-0.5"
                        title="Open Calendar Pop-up"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                      <input
                        type="date"
                        required
                        style={{ colorScheme: "dark" }}
                        value={bulkDate}
                        onChange={(e) => setBulkDate(e.target.value)}
                        onClick={(e) => {
                          try { e.currentTarget.showPicker?.(); } catch {}
                        }}
                        className="w-full bg-slate-950 border border-indigo-500/40 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer font-medium"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkDate(getTodayString())}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        bulkDate === getTodayString()
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      Today
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Select Mentor(s)
                  </label>
                  <select
                    value={bulkTrainerId}
                    onChange={(e) => setBulkTrainerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">⚡ All Active Mentors ({trainers.length})</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration Presets */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Slot Duration per Session
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[15, 30, 45, 60].map((dur) => (
                      <button
                        type="button"
                        key={dur}
                        onClick={() => setBulkDuration(dur)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                          bulkDuration === dur
                            ? "bg-indigo-600 text-white border-indigo-500 shadow"
                            : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {dur} Mins
                      </button>
                    ))}
                  </div>
                </div>

                {/* 24-Hour Quick Shift Presets */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Quick 24-Hour Shift Presets</span>
                    <span className="text-[10px] text-indigo-400 font-normal">Morning, Afternoon, Evening, Night</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 mb-2">
                    {[
                      { label: "⚡ 8 AM - 11 PM", start: "08:00", end: "23:00" },
                      { label: "🌅 Morning", start: "09:00", end: "13:00" },
                      { label: "☀️ Afternoon", start: "13:00", end: "17:00" },
                      { label: "🌆 Evening", start: "17:00", end: "21:00" },
                      { label: "🌙 Night", start: "21:00", end: "01:00" },
                      { label: "⚡ Workday", start: "09:00", end: "18:00" },
                    ].map((preset) => (
                      <button
                        type="button"
                        key={preset.label}
                        onClick={() => {
                          setBulkStartTime(preset.start);
                          setBulkEndTime(preset.end);
                        }}
                        className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold border transition-all text-center ${
                          bulkStartTime === preset.start && bulkEndTime === preset.end
                            ? "bg-indigo-600 text-white border-indigo-500 shadow"
                            : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start & End Overall Time Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Shift Start Time
                    </label>
                    <input
                      type="time"
                      required
                      style={{ colorScheme: "dark" }}
                      value={bulkStartTime}
                      onChange={(e) => setBulkStartTime(e.target.value)}
                      className="w-full bg-slate-950 border border-indigo-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Shift End Time
                    </label>
                    <input
                      type="time"
                      required
                      style={{ colorScheme: "dark" }}
                      value={bulkEndTime}
                      onChange={(e) => setBulkEndTime(e.target.value)}
                      className="w-full bg-slate-950 border border-indigo-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Default Topic for Slots
                  </label>
                  <input
                    type="text"
                    value={bulkTopic}
                    onChange={(e) => setBulkTopic(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Generated Slots Live Preview */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Generated Consecutive Slots Preview ({bulkDate}):
                    </span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {getBulkSlotsPreview().length} Slots per mentor
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {getBulkSlotsPreview().map((slotItem, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 font-mono px-2 py-1 rounded"
                      >
                        #{idx + 1}: {slotItem.start} - {slotItem.end}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pinned Action Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/95 shrink-0 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={getBulkSlotsPreview().length === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg font-bold shadow flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    Generate All {getBulkSlotsPreview().length * (bulkTrainerId === "all" ? trainers.length : 1)} Slots
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
