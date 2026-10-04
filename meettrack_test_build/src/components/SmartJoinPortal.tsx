import React, { useState, useEffect } from "react";
import { Slot, Trainer, AttendanceLog } from "../types";
import {
  Video,
  CheckCircle,
  Clock,
  User,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Mail,
  Calendar,
  ExternalLink,
  Lock,
} from "lucide-react";
import {
  loadTrainersFromSupabase,
  loadSlotsFromSupabase,
  loadAttendanceLogsFromSupabase,
  saveAttendanceLogToSupabase,
  saveSlotToSupabase,
} from "../lib/supabaseService";
import { generateDaySlotsForTrainer } from "../lib/slotGenerator";
import { getISTMinutesOfDay, getLocalDateString } from "../lib/dateUtils";

interface SmartJoinPortalProps {
  slotId?: string;
  trainerId?: string;
  defaultRole?: "mentor" | "student";
  onClose?: () => void;
}

const FALLBACK_TRAINERS: Trainer[] = [
  {
    id: "tr-1788512741578-428",
    name: "Rezaul",
    email: "rezaul@gmail.com",
    avatar: "",
    meetUrl: "https://meet.google.com/tok-tbzi-kzt",
    specialization: "LinkedIn",
    slotDuration: 30,
    status: "active",
    userEmail: "externalmentors@be10x.com",
  },
  {
    id: "tr-soudeep",
    name: "Soudeep",
    email: "soudeep@be10x.com",
    avatar: "",
    meetUrl: "https://meet.google.com/cye-bhqi-oxx",
    specialization: "UI/UX",
    slotDuration: 30,
    status: "active",
    userEmail: "externalmentors@be10x.com",
  },
  {
    id: "tr-uttam",
    name: "Uttam",
    email: "uttam.pandit.ost@houseofedtech.in",
    avatar: "",
    meetUrl: "https://meet.google.com/skb-irbm-exz",
    specialization: "Testing",
    slotDuration: 30,
    status: "active",
    userEmail: "externalmentors@be10x.com",
  },
  {
    id: "tr-1788681466900-152",
    name: "Arsalan Adeeb",
    email: "ashnalife@gmail.com",
    avatar: "",
    meetUrl: "https://meet.google.com/uio-ighz-ktu",
    specialization: "1:1 Technical <> Hermes & Composio, WhatsApp Automation, Website Building, Core Software Development",
    slotDuration: 30,
    status: "active",
    userEmail: "externalmentors@be10x.com",
  },
  {
    id: "tr-1788681379361-402",
    name: "Asish Sharma",
    email: "ashish.del70@gmail.com",
    avatar: "",
    meetUrl: "https://meet.google.com/pmo-mdve-wdd",
    specialization: "1:1 Expertise <> AI Tools & Productivity, AI for Marketing, Getting Your First 10 Clients",
    slotDuration: 30,
    status: "active",
    userEmail: "externalmentors@be10x.com",
  },
  {
    id: "tr-1788676637781-728",
    name: "Muskan Bhatia",
    email: "bmuskan065@gmail.com",
    avatar: "",
    meetUrl: "https://meet.google.com/wyd-wqrm-unm",
    specialization: "1:1 Expertise <> AI Tools and Prompts, Content Creation, Career Guidance, Resume",
    slotDuration: 30,
    status: "active",
    userEmail: "externalmentors@be10x.com",
  },
  {
    id: "tr-1788677138269-215",
    name: "Priyanka Jha",
    email: "priyankapunku@gmail.com",
    avatar: "",
    meetUrl: "https://meet.google.com/pgg-tbwy-xpx",
    specialization: "1:1 Expertise <> Domain & Niche Selection, Personal Branding, LinkedIn Profile Optimization",
    slotDuration: 30,
    status: "active",
    userEmail: "externalmentors@be10x.com",
  },
  {
    id: "tr-1788677063287-999",
    name: "Vansh Agrawal",
    email: "vanshagrawal509@gmail.com",
    avatar: "",
    meetUrl: "https://meet.google.com/htw-pmpv-due",
    specialization: "1:1 Technical <> Composio, n8n Expert, AI Automation, WhatsApp Automation",
    slotDuration: 30,
    status: "active",
    userEmail: "externalmentors@be10x.com",
  },
  {
    id: "tr-1788677680650-190",
    name: "Vanshika",
    email: "work.vanshika97@gmail.com",
    avatar: "",
    meetUrl: "https://meet.google.com/dzk-poxf-ird",
    specialization: "1:1 Expertise <> Career Switchers & Career Gaps, Product Management",
    slotDuration: 30,
    status: "active",
    userEmail: "externalmentors@be10x.com",
  },
];

function parseMins(timeStr?: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toUpperCase();
  const isPm = clean.includes("PM");
  const isAm = clean.includes("AM");
  const rawParts = clean.replace(/(AM|PM)/g, "").trim().split(":");
  if (rawParts.length < 2) return 0;
  let hour = parseInt(rawParts[0], 10) || 0;
  const minute = parseInt(rawParts[1], 10) || 0;
  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function matchTrainer(trainersList: Trainer[], targetIdOrSlug: string): Trainer | undefined {
  if (!targetIdOrSlug) return undefined;
  const cleanTarget = decodeURIComponent(targetIdOrSlug).trim().toLowerCase().replace(/^(tr-|mentor-)/, "");

  return trainersList.find((t) => {
    const tid = (t.id || "").toLowerCase().replace(/^(tr-|mentor-)/, "");
    const tname = (t.name || "").toLowerCase().trim();
    const tslug = tname.replace(/\s+/g, "-");
    const temail = (t.email || "").toLowerCase().split("@")[0];

    return (
      tid === cleanTarget ||
      tslug === cleanTarget ||
      tname === cleanTarget ||
      temail === cleanTarget ||
      cleanTarget.includes(tname) ||
      tname.includes(cleanTarget)
    );
  });
}

function getInitialAvailableTrainers(): Trainer[] {
  let list: Trainer[] = [];
  try {
    const cached = localStorage.getItem("meettrack_trainers_all");
    if (cached) list = JSON.parse(cached);
  } catch {}
  const merged = [...list];
  FALLBACK_TRAINERS.forEach((fb) => {
    if (!merged.some((t) => t.id === fb.id || (t.name && fb.name && t.name.toLowerCase().trim() === fb.name.toLowerCase().trim()))) {
      merged.push(fb);
    }
  });
  return merged;
}

export function findBestSmartJoinSlot(allDaySlots: Slot[], clientMins: number): Slot | null {
  if (!allDaySlots || allDaySlots.length === 0) return null;
  const sorted = [...allDaySlots].sort((a, b) => parseMins(a.startTime) - parseMins(b.startTime));

  // User Specification:
  // For a 30-min slot (e.g. 08:00 - 08:30):
  // 1. From [startM - 15] up to [startM + 15] inclusive (e.g. 07:45 up to 08:15), the Smart Link shows this slot (08:00 - 08:30).
  // 2. At the 16th minute (e.g. 08:16 onwards), it changes to the next slot (08:30 - 09:00)!
  const exactActiveSlot = sorted.find((s) => {
    const startM = parseMins(s.startTime);
    return clientMins >= startM - 15 && clientMins <= startM + 15;
  });
  if (exactActiveSlot) return exactActiveSlot;

  // If outside 15m window, return nearest upcoming future slot today
  const nextFutureSlot = sorted.find((s) => parseMins(s.startTime) > clientMins);
  if (nextFutureSlot) return nextFutureSlot;

  // Fallback: If all slots for today have ended, fallback to last slot
  return sorted[sorted.length - 1] || null;
}

function getInitialSlotForTrainer(t: Trainer | undefined): Slot | null {
  if (!t) return null;
  const now = new Date();
  const clientMins = getISTMinutesOfDay(now);
  const clientDate = getLocalDateString(now);
  const fullDaySlots = generateDaySlotsForTrainer(t, clientDate);
  const activeSlot = findBestSmartJoinSlot(fullDaySlots, clientMins);
  if (activeSlot && !activeSlot.meetUrl && t.meetUrl) {
    activeSlot.meetUrl = t.meetUrl;
  }
  return activeSlot;
}

export const SmartJoinPortal: React.FC<SmartJoinPortalProps> = ({
  slotId,
  trainerId,
  defaultRole = "student",
  onClose,
}) => {
  const [role, setRole] = useState<"mentor" | "student">(defaultRole);
  const [mentorEmail, setMentorEmail] = useState("");
  const [studentName, setStudentName] = useState(() => localStorage.getItem("meettrack_student_name") || "");
  const [studentEmail, setStudentEmail] = useState(() => localStorage.getItem("meettrack_student_email") || "");

  // Instant synchronous resolution
  const initialTrainers = React.useMemo(() => getInitialAvailableTrainers(), []);
  const initialTrainer = React.useMemo(() => {
    if (trainerId) return matchTrainer(initialTrainers, trainerId) || null;
    return null;
  }, [trainerId, initialTrainers]);
  const initialSlot = React.useMemo(() => getInitialSlotForTrainer(initialTrainer || undefined), [initialTrainer]);

  const [matchedTrainer, setMatchedTrainer] = useState<Trainer | null>(initialTrainer);
  const [availableTrainers, setAvailableTrainers] = useState<Trainer[]>(initialTrainers);
  const [trainerName, setTrainerName] = useState(initialTrainer?.name || "");
  const [trainerEmail, setTrainerEmail] = useState(initialTrainer?.email || "");
  const [trainerSpecialization, setTrainerSpecialization] = useState(initialTrainer?.specialization || "1:1 Mentorship");
  const [trainerMeetUrl, setTrainerMeetUrl] = useState(initialSlot?.meetUrl || initialTrainer?.meetUrl || "");

  const [slot, setSlot] = useState<Slot | null>(initialSlot);
  // If matched synchronously, loading is immediately FALSE (0ms delay)!
  const [loading, setLoading] = useState(() => {
    if (initialTrainer && initialSlot) return false;
    return Boolean(trainerId || slotId);
  });
  const [joining, setJoining] = useState(false);
  const [joinedSuccess, setJoinedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const resolveTrainerAndSlot = async () => {
      const now = new Date();
      const clientMins = getISTMinutesOfDay(now);
      const clientDate = getLocalDateString(now);

      try {
        // Fast parallel fetch without blocking serverless function cold starts
        const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2500));
        const [supabaseTrainers, supabaseSlots] = await Promise.race([
          Promise.all([
            loadTrainersFromSupabase().catch(() => []),
            loadSlotsFromSupabase(clientDate).catch(() => []),
          ]),
          timeoutPromise.then(() => [[], []]),
        ]);

        if (isCancelled) return;

        let allTrainers = getInitialAvailableTrainers();
        if (supabaseTrainers && supabaseTrainers.length > 0) {
          const merged = [...supabaseTrainers];
          FALLBACK_TRAINERS.forEach((fb) => {
            if (!merged.some((t) => t.id === fb.id || (t.name && fb.name && t.name.toLowerCase().trim() === fb.name.toLowerCase().trim()))) {
              merged.push(fb);
            }
          });
          allTrainers = merged;
          setAvailableTrainers(allTrainers);
          try {
            localStorage.setItem("meettrack_trainers_all", JSON.stringify(allTrainers));
          } catch {}
        }

        let currentTrainer: Trainer | undefined;
        if (trainerId) {
          currentTrainer = matchTrainer(allTrainers, trainerId);
        }

        if (currentTrainer) {
          setMatchedTrainer(currentTrainer);
          setTrainerName(currentTrainer.name || "");
          setTrainerEmail(currentTrainer.email || "");
          setTrainerSpecialization(currentTrainer.specialization || "1:1 Mentorship");
          if (currentTrainer.meetUrl) {
            setTrainerMeetUrl(currentTrainer.meetUrl);
          }

          let candidateSlots: Slot[] = [];
          if (supabaseSlots && supabaseSlots.length > 0) {
            candidateSlots = supabaseSlots.filter((s: Slot) => s.trainerId === currentTrainer?.id);
          }

          const fullDaySlots = generateDaySlotsForTrainer(currentTrainer, clientDate);
          const slotMap = new Map<string, Slot>();
          fullDaySlots.forEach((s) => slotMap.set(s.startTime, s));
          candidateSlots.forEach((s) => slotMap.set(s.startTime, s));
          const allDaySlots = Array.from(slotMap.values()).sort(
            (a, b) => parseMins(a.startTime) - parseMins(b.startTime)
          );

          const resolvedSlot = findBestSmartJoinSlot(allDaySlots, clientMins);

          if (resolvedSlot) {
            const finalSlotMeetUrl = resolvedSlot.meetUrl || currentTrainer.meetUrl || "";
            setSlot((prevSlot) => {
              if (!prevSlot) return { ...resolvedSlot, meetUrl: finalSlotMeetUrl };
              const prevStartM = parseMins(prevSlot.startTime);
              if (clientMins <= prevStartM + 15 && prevSlot.trainerId === resolvedSlot.trainerId) {
                return prevSlot;
              }
              return { ...resolvedSlot, meetUrl: finalSlotMeetUrl };
            });
            if (finalSlotMeetUrl) {
              setTrainerMeetUrl(finalSlotMeetUrl);
            }
          }
        }
      } catch (err) {
        console.debug("SmartJoin background sync notice:", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    resolveTrainerAndSlot();
    const interval = setInterval(resolveTrainerAndSlot, 15000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [slotId, trainerId]);

  const handleSelectTrainer = async (t: Trainer) => {
    setMatchedTrainer(t);
    setTrainerName(t.name);
    setTrainerEmail(t.email || "");
    setTrainerSpecialization(t.specialization || "");
    setTrainerMeetUrl(t.meetUrl || "");
    setErrorMsg("");

    const now = new Date();
    const clientMins = getISTMinutesOfDay(now);
    const clientDate = getLocalDateString(now);

    let candidateSlots: Slot[] = [];
    try {
      const supabaseSlots = await loadSlotsFromSupabase(clientDate);
      candidateSlots = supabaseSlots.filter((s) => s.trainerId === t.id);
    } catch {}

    const fullDaySlots = generateDaySlotsForTrainer(t, clientDate);
    const slotMap = new Map<string, Slot>();
    fullDaySlots.forEach((s) => slotMap.set(s.startTime, s));
    candidateSlots.forEach((s) => slotMap.set(s.startTime, s));
    const allDaySlots = Array.from(slotMap.values()).sort(
      (a, b) => parseMins(a.startTime) - parseMins(b.startTime)
    );

    const resolvedSlot = findBestSmartJoinSlot(allDaySlots, clientMins);

    if (resolvedSlot) {
      const finalMeet = resolvedSlot.meetUrl || t.meetUrl || "";
      setSlot({ ...resolvedSlot, meetUrl: finalMeet });
      if (finalMeet) setTrainerMeetUrl(finalMeet);
    }
  };

  const handleJoin = async () => {
    const activeEmail = role === "mentor" ? mentorEmail.trim() : studentEmail.trim();

    if (!activeEmail) {
      setErrorMsg(
        role === "mentor"
          ? "Please enter your mentor email to continue."
          : "Please enter your email address to continue."
      );
      return;
    }
    if (role === "student" && !studentName.trim()) {
      setErrorMsg("Please enter your name to continue.");
      return;
    }

    if (role === "mentor") {
      const cleanEmail = activeEmail.toLowerCase();
      const cleanTrainerEmail = (trainerEmail || matchedTrainer?.email || "").trim().toLowerCase();

      // STRICT MENTOR AUTHORIZATION:
      // 1. By default, the official externalmentors@be10x.com is allowed.
      const isDefaultExternal = cleanEmail === "externalmentors@be10x.com";

      // 2. The email filled in when creating or adding this mentor's details.
      const isAssignedTrainerEmail = Boolean(cleanTrainerEmail && cleanEmail === cleanTrainerEmail);

      // 3. Any other registered mentor's email address in the database.
      const isRegisteredMentor = availableTrainers.some(
        (t) => t.email && t.email.trim().toLowerCase() === cleanEmail
      );

      if (!isDefaultExternal && !isAssignedTrainerEmail && !isRegisteredMentor) {
        setErrorMsg(
          "Access Denied: Unrecognized mentor email address. Please enter your registered mentor email, or switch to 'Student / Learner' if you are attending as a student."
        );
        return;
      }
    }

    // Resolve target Google Meet URL with 100% guarantee that it never redirects to home
    let effectiveMeetUrl =
      slot?.meetUrl ||
      trainerMeetUrl ||
      matchedTrainer?.meetUrl ||
      "";

    if (
      !effectiveMeetUrl ||
      effectiveMeetUrl === "https://meet.google.com" ||
      effectiveMeetUrl === "https://meet.google.com/" ||
      effectiveMeetUrl.endsWith("/home")
    ) {
      setErrorMsg("This mentor has not assigned their dedicated Google Meet link yet. Please contact the administrator.");
      return;
    }

    setErrorMsg("");
    setJoining(true);

    // Save profile locally for future joins
    if (role === "student") {
      if (studentEmail.trim()) localStorage.setItem("meettrack_student_email", studentEmail.trim());
      if (studentName.trim()) localStorage.setItem("meettrack_student_name", studentName.trim());
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const clientMins = getISTMinutesOfDay(now);
    const clientDate = getLocalDateString(now);
    const targetTrainerId = matchedTrainer?.id || trainerId || slot?.trainerId || "";
    const resolvedSlotId = slot?.id || slotId || "";

    // Punctuality delay calculation relative to scheduled slot start
    let rawDelayMins = 0;
    if (slot?.startTime) {
      const schedMins = parseMins(slot.startTime);
      rawDelayMins = clientMins - schedMins;
    }
    const delayMins = rawDelayMins;

    try {
      // 1. Check existing local logs so we update the SAME slot log rather than duplicating
      let existingLog: AttendanceLog | undefined;
      const effectiveSlotId = resolvedSlotId;

      try {
        const rawLocal = localStorage.getItem("meettrack_attendance_logs") || "[]";
        let localLogs: AttendanceLog[] = [];
        try { localLogs = JSON.parse(rawLocal); } catch {}
        const allKnownLogs = localLogs;

        // Strictly search for existing log for the EXACT target slot (prevents hijacking to past expired slots)
        existingLog =
          allKnownLogs.find((l) => effectiveSlotId && l.slotId === effectiveSlotId) ||
          allKnownLogs.find(
            (l) =>
              (l.trainerId === targetTrainerId || (l.trainerName && trainerName && l.trainerName.toLowerCase().trim() === trainerName.toLowerCase().trim())) &&
              l.date === clientDate &&
              l.scheduledStartTime === slot?.startTime
          );

        if (existingLog && existingLog.meetUrl) {
          effectiveMeetUrl = existingLog.meetUrl;
        }
      } catch (err) {
        console.warn("Notice checking existing logs:", err);
      }

      const canonicalLogId = (effectiveSlotId ? `log-${effectiveSlotId}` : existingLog?.id) || `log-${Date.now()}`;

      // If student is rejoining, preserve their initial joined time & delay!
      const initialStudentJoinedAt = role === "student"
        ? (existingLog?.studentJoinedAt || nowIso)
        : (existingLog?.studentJoinedAt || null);

      const initialStudentAskTime = role === "student"
        ? (existingLog?.askToJoinTime || nowIso)
        : (existingLog?.askToJoinTime || null);

      const studentDelay = role === "student"
        ? (existingLog?.studentJoinDelayMinutes !== null && existingLog?.studentJoinDelayMinutes !== undefined
            ? existingLog.studentJoinDelayMinutes
            : Math.max(0, rawDelayMins))
        : (existingLog?.studentJoinDelayMinutes ?? 0);

      // User Rule 1: If the smart join link is filled by mentor, record that exact time as mentor in-time!
      // If mentor submitted early (e.g. 7:58 AM for 8:00 AM slot), record 2m early (rawDelayMins = -2).
      // If mentor submitted late (e.g. 8:04 AM for 8:00 AM slot), record +4m late (rawDelayMins = 4).
      const initialMentorJoinedAt = role === "mentor" ? nowIso : (existingLog?.mentorJoinedAt || null);
      const initialMentorDelay = role === "mentor"
        ? rawDelayMins
        : (existingLog?.mentorJoinDelayMinutes ?? 0);

      const updatedLog: AttendanceLog = {
        id: canonicalLogId,
        slotId: effectiveSlotId,
        trainerId: targetTrainerId,
        trainerName: trainerName || slot?.trainerName || "Mentor",
        studentName: role === "student" ? (studentName.trim() || "Student") : (existingLog?.studentName || "Student"),
        studentEmail: role === "student" ? activeEmail : (existingLog?.studentEmail || ""),
        date: clientDate,
        scheduledStartTime: slot?.startTime || existingLog?.scheduledStartTime || "",
        scheduledEndTime: slot?.endTime || existingLog?.scheduledEndTime || "",
        meetUrl: effectiveMeetUrl,
        mentorJoinedAt: initialMentorJoinedAt,
        mentorLeftAt: role === "mentor" ? null : (existingLog?.mentorLeftAt || null),
        studentJoinedAt: initialStudentJoinedAt,
        askToJoinTime: initialStudentAskTime,
        studentLeftAt: role === "student" ? null : (existingLog?.studentLeftAt || null),
        mentorJoinDelayMinutes: initialMentorDelay,
        studentJoinDelayMinutes: studentDelay,
        totalOverlapMinutes: existingLog?.totalOverlapMinutes || null,
        totalMeetDurationMinutes: existingLog?.totalMeetDurationMinutes || null,
        status: role === "mentor" && rawDelayMins > 0 ? "mentor_late" : "in_progress",
        notes: role === "mentor"
          ? (rawDelayMins < 0
              ? `Mentor joined ${Math.abs(rawDelayMins)}m early via Smart Join Link`
              : rawDelayMins > 0
              ? `Mentor joined ${rawDelayMins} min${rawDelayMins > 1 ? "s" : ""} late via Smart Join Link`
              : "Mentor joined on time via Smart Join Link")
          : (existingLog?.notes
              ? `${existingLog.notes} | Student joined via Smart Join Link`
              : "Student joined via Smart Join Link"),
        joinedViaSmartLink: true,
        lastUpdated: nowIso,
      };

      // 1. Instant Local Cross-Tab Sync via localStorage and BroadcastChannel
      try {
        const rawLocal = localStorage.getItem("meettrack_attendance_logs") || "[]";
        let localList = [];
        try { localList = JSON.parse(rawLocal); } catch {}
        const exIdx = localList.findIndex((l: any) => l.slotId === effectiveSlotId);
        if (exIdx >= 0) {
          localList[exIdx] = { ...localList[exIdx], ...updatedLog };
        } else {
          localList.unshift(updatedLog);
        }
        localStorage.setItem("meettrack_attendance_logs", JSON.stringify(localList));
        localStorage.setItem("meettrack_realtime_event", JSON.stringify({ log: updatedLog, timestamp: Date.now() }));

        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("meettrack_realtime");
          bc.postMessage({ type: "LOG_ATTENDANCE", log: updatedLog });
          bc.close();
        }
      } catch (e) {
        console.warn("Local broadcast notice:", e);
      }

      // 2. Dispatch to Dedicated Smart Join Backend & Telemetry in Background (Non-blocking)
      const slotParam = effectiveSlotId ? `&slotId=${encodeURIComponent(effectiveSlotId)}` : "";
      const mentorJoinParam = role === "mentor" && initialMentorJoinedAt
        ? `&mentorJoinedAt=${encodeURIComponent(initialMentorJoinedAt)}&mentorJoinDelayMinutes=${initialMentorDelay}`
        : "";
      const apiEndpoint = `${window.location.origin}/api/join-trainer/${encodeURIComponent(
        targetTrainerId
      )}?format=json&email=${encodeURIComponent(activeEmail)}&role=${role}${
        role === "student" && studentName ? `&name=${encodeURIComponent(studentName.trim())}` : ""
      }${slotParam}${mentorJoinParam}&clientMins=${clientMins}&clientDate=${clientDate}&_t=${Date.now()}`;

      // Fire and forget so slow networks or API hiccups NEVER stall the redirect
      Promise.allSettled([
        fetch("/api/smart-join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slotId: effectiveSlotId,
            trainerId: targetTrainerId,
            role,
            name: role === "student" ? (studentName.trim() || "Student") : (slot?.trainerName || trainerName || "Mentor"),
            email: activeEmail,
            meetUrl: effectiveMeetUrl,
            clientDate,
            clientMins,
            mentorJoinedAt: role === "mentor" ? initialMentorJoinedAt : undefined,
            mentorJoinDelayMinutes: role === "mentor" ? initialMentorDelay : undefined,
            source: "smart_join_link",
            viaSmartJoin: true,
          }),
          keepalive: true,
        }),
        fetch("/api/events/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slotId: effectiveSlotId,
            trainerId: targetTrainerId,
            meetUrl: effectiveMeetUrl,
            role: role,
            action: role === "mentor" ? "mentor_join" : "student_join",
            source: "smart_join_link",
            viaSmartJoin: true,
            portalRedirect: true,
            joinedViaSmartLink: true,
            participantName:
              role === "mentor" ? (slot?.trainerName || trainerName || "Mentor") : (studentName.trim() || "Student"),
            participantEmail: activeEmail,
            timestamp: nowIso,
            mentorJoinedAt: role === "mentor" ? initialMentorJoinedAt : undefined,
          }),
          keepalive: true,
        }),
        fetch(apiEndpoint, { keepalive: true }),
        saveAttendanceLogToSupabase(updatedLog),
        slot && effectiveSlotId === slot.id ? saveSlotToSupabase({
          ...slot,
          studentName: role === "student" ? studentName.trim() : slot.studentName,
          studentEmail: role === "student" ? activeEmail : slot.studentEmail,
          askToJoinTime: role === "student" ? nowIso : slot.askToJoinTime,
          status: slot.status === "scheduled" ? "live" : slot.status,
        }) : Promise.resolve(),
      ]).catch((err) => {
        console.warn("Background telemetry notice:", err);
      });
    } catch (err) {
      console.warn("Join telemetry notice:", err);
    }

    setJoinedSuccess(true);

    // 3. Immediate, Smooth Redirect to Dedicated Google Meet Room
    const doRedirect = () => {
      let redirectUrl = effectiveMeetUrl.trim();
      if (!redirectUrl.startsWith("http://") && !redirectUrl.startsWith("https://")) {
        redirectUrl = "https://" + redirectUrl;
      }
      const sep = redirectUrl.includes("?") ? "&" : "?";
      redirectUrl += `${sep}meettrack_role=${encodeURIComponent(role)}&meettrack_name=${encodeURIComponent(
        role === "student" ? studentName.trim() || "Student" : slot?.trainerName || trainerName || "Mentor"
      )}&meettrack_email=${encodeURIComponent(activeEmail)}`;
      try {
        window.location.replace(redirectUrl);
      } catch {
        window.location.href = redirectUrl;
      }
    };

    setTimeout(doRedirect, 150);
  };

  const formatDisplayTime = (timeStr?: string) => {
    if (!timeStr) return "";
    const clean = timeStr.trim().toUpperCase();
    if (clean.includes("AM") || clean.includes("PM")) return clean;
    const parts = clean.split(":");
    if (parts.length < 2) return clean;
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  };

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return "Today";
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060b18] text-white flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/15 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-indigo-600/15 rounded-full blur-[160px]" />
        </div>
        <div className="relative z-10 p-8 rounded-3xl border border-white/15 bg-slate-900/90 backdrop-blur-3xl shadow-2xl flex items-center space-x-4">
          <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-200 font-medium text-sm">Preparing session link & attendance verification...</span>
        </div>
      </div>
    );
  }

  const effectiveMeetUrl = slot?.meetUrl || trainerMeetUrl || matchedTrainer?.meetUrl || "";

  return (
    <div className="min-h-screen bg-[#060b18] text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden select-none">
      {/* Dynamic Cosmic Ambient Glowing Halos matching Login & Dashboard */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Sky/Blue Core Flare */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] bg-sky-500/20 rounded-full blur-[140px] animate-pulse pointer-events-none" />
        {/* Violet / Indigo Ambient Halo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[46rem] h-[46rem] bg-indigo-600/18 rounded-full blur-[160px] pointer-events-none" />
        {/* Subtle Tech Grid Texture */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(56,189,248,0.1)_1px,transparent_1px)] [background-size:28px_28px] opacity-25" />
      </div>

      {/* Main Glassmorphic Portal Card */}
      <div className="relative z-10 max-w-lg w-full rounded-3xl p-6 sm:p-8 bg-slate-900/90 backdrop-blur-3xl border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_50px_rgba(56,189,248,0.12)] overflow-hidden">
        {/* Subtle Luxury Top Rim Sheen */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" />
        <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-sky-400/[0.04] to-transparent pointer-events-none" />

        {/* Portal Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-sky-500/20 to-indigo-600/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.25)]">
              <Video className="w-6 h-6 drop-shadow-sm" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                MeetTrack Smart Join
              </h1>
              <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-400/25 text-[11px] font-medium text-sky-300">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Verified Attendance Portal</span>
              </span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              Back
            </button>
          )}
        </div>

        {/* Session Info Glass Banner */}
        <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-5 mb-6 space-y-3.5 relative overflow-hidden backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-400/25 text-[11px] font-bold text-sky-300 uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>Mentorship Session</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono font-medium text-slate-300">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{slot ? formatDisplayDate(slot.date) : "Today"}</span>
            </span>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {trainerSpecialization || slot?.topic || "1:1 Mentorship Class"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-normal">
              {matchedTrainer ? `Dedicated room with ${trainerName}` : "Join your scheduled 1-on-1 session"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs">
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Mentor</span>
              <span className="font-semibold text-white truncate block text-xs">
                {trainerName || slot?.trainerName || "Assigned Mentor"}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Scheduled Time</span>
              <span className="font-semibold text-sky-300 flex items-center gap-1.5 font-mono text-xs truncate">
                <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>
                  {slot
                    ? `${formatDisplayTime(slot.startTime)} - ${formatDisplayTime(slot.endTime)}`
                    : "Active Slot"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Joined Success State */}
        {joinedSuccess ? (
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-3.5 backdrop-blur-2xl shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-fade-in">
            <div className="w-13 h-13 bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Attendance Logged & Verified!</h3>
              <p className="text-xs text-slate-300 leading-relaxed mt-1 max-w-sm mx-auto">
                Your exact arrival timestamp has been recorded in the attendance logs. Launching{" "}
                <span className="font-semibold text-white">{trainerName ? `${trainerName}'s Meet` : "Google Meet"}</span>...
              </p>
            </div>
            <div className="pt-2">
              <a
                href={effectiveMeetUrl}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sky-300 border border-white/10 text-xs font-semibold font-mono transition-all"
              >
                <span>Click if Meet does not launch automatically</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          /* Interactive Join Form */
          <div className="space-y-4">
            {/* Role Switcher */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                I am joining as:
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    setRole("student");
                    if (errorMsg) setErrorMsg("");
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                    role === "student"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_4px_16px_rgba(37,99,235,0.35)] border border-white/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <User className={`w-4 h-4 ${role === "student" ? "text-sky-300" : "text-slate-400"}`} />
                  <span>Student / Learner</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole("mentor");
                    if (errorMsg) setErrorMsg("");
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                    role === "mentor"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_4px_16px_rgba(37,99,235,0.35)] border border-white/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <Sparkles className={`w-4 h-4 ${role === "mentor" ? "text-sky-300" : "text-slate-400"}`} />
                  <span>Mentor / Trainer</span>
                </button>
              </div>
            </div>

            {/* Student Name Input */}
            {role === "student" && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Your Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => {
                      setStudentName(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="Enter your full name (e.g., Rezaul)"
                    className="w-full bg-slate-950/60 border border-white/12 focus:border-sky-400/80 focus:ring-2 focus:ring-sky-400/20 rounded-xl py-3 pl-10 pr-3.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all shadow-inner"
                  />
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                {role === "mentor" ? "Mentor Email Address" : "Your Email Address"}{" "}
                <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={role === "mentor" ? mentorEmail : studentEmail}
                  onChange={(e) => {
                    if (role === "mentor") setMentorEmail(e.target.value);
                    else setStudentEmail(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  placeholder={role === "mentor" ? "mentor@gmail.com" : "student@example.com"}
                  className="w-full bg-slate-950/60 border border-white/12 focus:border-sky-400/80 focus:ring-2 focus:ring-sky-400/20 rounded-xl py-3 pl-10 pr-3.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Error Message Notice */}
            {errorMsg && (
              <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2.5 shadow-sm">
                <span className="font-bold text-sm">⚠️</span>
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            {/* Submit / Join Button */}
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-500 text-white rounded-2xl py-3.5 px-6 text-sm font-bold shadow-[0_10px_30px_rgba(37,99,235,0.35)] hover:shadow-[0_15px_40px_rgba(37,99,235,0.5)] flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98] transition-all duration-300 border border-white/15 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              {joining ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Recording Attendance & Entering Meet...</span>
                </>
              ) : (
                <>
                  <Video className="w-5 h-5 drop-shadow-sm" />
                  <span>Enter Google Meet & Log Attendance</span>
                  <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
