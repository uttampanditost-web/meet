import React, { useState, useEffect, useRef, useMemo } from "react";
import { User } from "firebase/auth";
import {
  Trainer,
  Slot,
  AttendanceLog,
  AttendanceSummaryStats,
  AIAnalysisReport,
} from "./types";
import { Header } from "./components/Header";
import { OverviewStats } from "./components/OverviewStats";
import { TrainersGrid } from "./components/TrainersGrid";
import { SlotScheduler } from "./components/SlotScheduler";
import { AttendanceLogsTable } from "./components/AttendanceLogsTable";
import { AIInsightsModal } from "./components/AIInsightsModal";
import { ExtensionGuideModal } from "./components/ExtensionGuideModal";
import { OAuthErrorModal } from "./components/OAuthErrorModal";
import { ManualAttendanceModal } from "./components/ManualAttendanceModal";
import { AdminManagementModal } from "./components/AdminManagementModal";
import { AccessManagementTab } from "./components/AccessManagementTab";
import { StudentsTab } from "./components/StudentsTab";
import { SmartJoinPortal } from "./components/SmartJoinPortal";
import { LoginPage } from "./components/LoginPage";
import { initAuth, googleSignIn, logout as googleLogout } from "./lib/googleAuth";
import {
  AppUser,
  getActiveUserSession,
  clearUserSession,
  initUserDatabase,
  SUPERADMIN_EMAILS,
} from "./lib/userService";

import {
  saveTrainersToSupabase,
  saveTrainerToSupabase,
  loadTrainersFromSupabase,
  deleteTrainerFromSupabase,
  saveSlotsToSupabase,
  saveSlotToSupabase,
  loadSlotsFromSupabase,
  deleteSlotFromSupabase,
  saveAttendanceLogToSupabase,
  loadAttendanceLogsFromSupabase,
  collapseSlotAttendanceLogs,
  subscribeToSupabaseSlots,
  subscribeToSupabaseAttendanceLogs,
  subscribeToSupabaseTrainers,
} from "./lib/supabaseService";
import { fetchGoogleCalendarEvents, createGoogleCalendarEvent } from "./lib/calendarService";
import { getLocalDateString } from "./lib/dateUtils";
import { calculateAttendanceStats } from "./lib/statsUtils";
import { generateDaySlotsForTrainer, ensureSlotsForTrainers } from "./lib/slotGenerator";
import { Video, Users, RefreshCw } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getActiveUserSession());
  const [activeTab, setActiveTab] = useState<"dashboard" | "trainers" | "slots" | "students" | "logs" | "access">("dashboard");
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());

  // Smart Join Portal URL handler (Direct 1-Click Join without extension)
  const [smartJoinTarget, setSmartJoinTarget] = useState<{ slotId?: string; trainerId?: string } | null>(() => {
    const pathname = window.location.pathname;
    if (pathname.includes("/join/")) {
      const parts = pathname.split("/join/");
      if (parts[1]) {
        const cleanId = decodeURIComponent(parts[1].split(/[?#]/)[0].replace(/\/+$/, "")).trim();
        if (cleanId) return { trainerId: cleanId };
      }
    }
    const urlParams = new URLSearchParams(window.location.search);
    const slotId = urlParams.get("joinSlot") || urlParams.get("slot") || undefined;
    const trainerId = urlParams.get("trainer") || urlParams.get("trainerId") || undefined;
    if (slotId || trainerId) return { slotId, trainerId };
    return null;
  });

  // Google OAuth & Auth States
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "viewer">("viewer");
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);

  // Core Data States
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [stats, setStats] = useState<AttendanceSummaryStats>({
    totalSlotsToday: 0,
    completedSlots: 0,
    liveSlots: 0,
    upcomingSlots: 0,
    mentorOnTimeRate: null,
    studentOnTimeRate: null,
    avgMentorDelayMinutes: 0,
    avgStudentDelayMinutes: 0,
    flaggedAlertsCount: 0,
  });

  // Derived real-time statistics calculated specifically for the selected date
  const computedStats = useMemo(() => {
    return calculateAttendanceStats(slots, logs, selectedDate, trainers.length);
  }, [slots, logs, selectedDate, trainers.length]);

  // Auto-rollover selectedDate at midnight local time
  useEffect(() => {
    let lastDate = getLocalDateString();
    const interval = setInterval(() => {
      const currentDate = getLocalDateString();
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        setSelectedDate(currentDate);
        fetchData(user?.email || "");
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [user?.email]);


  // Modal States
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiReportData, setAIReportData] = useState<AIAnalysisReport | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);

  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isOAuthErrorModalOpen, setIsOAuthErrorModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);

  const fetchUserRole = async (email?: string) => {
    if (!email) {
      setUserRole("viewer");
      return;
    }
    const clean = email.trim().toLowerCase();

    // Built-in Superadmins & accounts from your meet-7622a database:
    const superAdmins = [
      "uttam.pandit.ost@houseofedtech.in",
      "ukumar339@gmail.com",
      "externalmentors@be10x.com",
      "koabhi3@gmail.com",
    ];

    if (superAdmins.includes(clean)) {
      setUserRole("admin");
      return;
    }

    // Fetch role from server /api/auth/role
    try {
      const emailParam = `?email=${encodeURIComponent(clean)}`;
      const res = await fetch(`/api/auth/role${emailParam}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.hasAccess === false) {
          clearUserSession();
          setCurrentUser(null);
          setUser(null);
          return;
        }
        setUserRole(data.role === "admin" ? "admin" : "viewer");
      }
    } catch (e) {
      console.warn("Failed to fetch user role:", e);
    }
  };

  // Continuous active session validation: verify currently logged-in user still has access
  useEffect(() => {
    if (!currentUser?.email) return;
    const clean = currentUser.email.trim().toLowerCase();
    if (SUPERADMIN_EMAILS.some((e) => e.toLowerCase() === clean)) return;

    const verifyAccess = async () => {
      try {
        const res = await fetch(`/api/auth/role?email=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.hasAccess === false) {
            console.warn(`[Access Revoked] User ${clean} has been removed by an admin.`);
            clearUserSession();
            setCurrentUser(null);
            setUser(null);
          }
        }
      } catch {}
    };

    verifyAccess();
    const interval = setInterval(verifyAccess, 60000);
    return () => clearInterval(interval);
  }, [currentUser?.email]);

  // Listen to cross-tab user revocation broadcast events
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("meettrack_realtime");
        bc.onmessage = (event) => {
          if (event.data?.type === "USER_ACCESS_REVOKED" && currentUser?.email) {
            const revokedEmail = String(event.data.email || "").trim().toLowerCase();
            if (currentUser.email.trim().toLowerCase() === revokedEmail) {
              clearUserSession();
              setCurrentUser(null);
              setUser(null);
            }
          }
        };
      }
    } catch {}
    return () => {
      try {
        bc?.close();
      } catch {}
    };
  }, [currentUser?.email]);

  // Initialize User Database on Mount
  useEffect(() => {
    initUserDatabase();
  }, []);

  // Initialize Auth
  useEffect(() => {
    initAuth(
      (u, token) => {
        setUser(u);
        setGoogleToken(token);
        setIsAuthInitializing(false);
        fetchUserRole(u?.email || "");
        fetchData(u?.email || "");
      },
      () => {
        setGoogleToken(null);
        setIsAuthInitializing(false);
        fetchUserRole("");
        fetchData("");
      }
    );
  }, []);

  // Auto-announce active deployment URL for Chrome Extension dynamic auto-detection
  useEffect(() => {
    if (typeof window !== "undefined") {
      const activeOrigin = window.location.origin;
      window.postMessage({ type: "MEETTRACK_ACTIVE_APP", url: activeOrigin }, "*");
      document.documentElement.setAttribute("data-meettrack-origin", activeOrigin);
    }
  }, []);

  // ⚡ INSTANT BOOTSTRAP: Load from Supabase directly on mount, before auth resolves.
  // This eliminates the 5-min delay caused by waiting for Firebase auth + cold Vercel starts.
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Sanitize any legacy mock/synthetic cache from localStorage
        try {
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith("meettrack_logs_")) {
              const raw = localStorage.getItem(k);
              if (raw && (raw.includes("student@example.com") || raw.includes("Student (Test Session)"))) {
                localStorage.removeItem(k);
              }
            }
          });
        } catch {}

        // Show cached data immediately from localStorage (zero latency)
        const cachedTrainers = localStorage.getItem("meettrack_trainers_all");
        if (cachedTrainers) {
          try {
            const parsed = JSON.parse(cachedTrainers);
            if (Array.isArray(parsed) && parsed.length > 0) setTrainers(parsed);
          } catch {}
        }
        const cachedLogs = localStorage.getItem(`meettrack_logs_${selectedDate}`);
        if (cachedLogs) {
          try {
            const parsed = JSON.parse(cachedLogs);
            if (Array.isArray(parsed)) {
              const clean = parsed.filter((l: any) => 
                l && 
                l.studentEmail !== "student@example.com" && 
                l.studentName !== "Student (Test Session)" &&
                (l.mentorJoinedAt || l.studentJoinedAt || (l.trackedDurationSeconds && l.trackedDurationSeconds > 0))
              );
              setLogs(clean);
            }
          } catch {}
        } else {
          // Clean state when changing dates to prevent showing old date data
          setLogs([]);
        }
        const cachedSlots = localStorage.getItem(`meettrack_slots_${selectedDate}`);
        if (cachedSlots) {
          try {
            const parsed = JSON.parse(cachedSlots);
            if (Array.isArray(parsed) && parsed.length > 0) setSlots(parsed);
          } catch {}
        }

        // Then fetch fresh data from Supabase in parallel (fast, always-warm)
        const [freshTrainers, freshLogs, freshSlots] = await Promise.all([
          loadTrainersFromSupabase().catch(() => [] as Trainer[]),
          loadAttendanceLogsFromSupabase(selectedDate).catch(() => [] as AttendanceLog[]),
          loadSlotsFromSupabase(selectedDate).catch(() => [] as Slot[]),
        ]);

        if (freshTrainers.length > 0) {
          setTrainers(freshTrainers);
          localStorage.setItem("meettrack_trainers_all", JSON.stringify(freshTrainers));
        }
        
        // Strictly set live database logs (even if 0 records)
        setLogs(freshLogs);
        localStorage.setItem(`meettrack_logs_${selectedDate}`, JSON.stringify(freshLogs));

        if (freshSlots.length > 0) {
          setSlots(freshSlots);
          localStorage.setItem(`meettrack_slots_${selectedDate}`, JSON.stringify(freshSlots));
        }

        // Also trigger background fetchData to ensure /api/attendance logs and stats are synced
        fetchData(currentUser?.email || user?.email || "");
      } catch (e) {
        console.warn("[Bootstrap] Initial Supabase load error:", e);
      }
    };
    bootstrap();
  }, [selectedDate]);


  // Direct Real-Time Supabase Synchronization (Single Source of Truth)
  useEffect(() => {
    // 1. Subscribe to Trainers
    const unsubTrainers = subscribeToSupabaseTrainers((supabaseTrainers) => {
      if (supabaseTrainers && supabaseTrainers.length > 0) {
        setTrainers(supabaseTrainers);
        localStorage.setItem("meettrack_trainers_all", JSON.stringify(supabaseTrainers));
      }
    });

    // 2. Subscribe to Slots for selected date
    const unsubSlots = subscribeToSupabaseSlots(selectedDate, (supabaseSlots) => {
      if (supabaseSlots && supabaseSlots.length > 0) {
        setSlots(supabaseSlots);
      }
    });

    // 3. Subscribe to Attendance Logs for selected date
    const unsubLogs = subscribeToSupabaseAttendanceLogs(selectedDate, (supabaseLogs) => {
      if (supabaseLogs && supabaseLogs.length > 0) {
        setLogs((prev) => {
          const currentMatching = prev.filter(
            (l) => (l.date === selectedDate || (l.slotId && l.slotId.includes(selectedDate)) || (l.id && l.id.includes(selectedDate)))
          );
          return collapseSlotAttendanceLogs([...supabaseLogs, ...currentMatching]);
        });
      }
    });

    return () => {
      unsubTrainers();
      unsubSlots();
      unsubLogs();
    };
  }, [selectedDate]);


  // Real-time Instant Cross-Tab Sync (BroadcastChannel + LocalStorage)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("meettrack_realtime");
      channel.onmessage = (event) => {
        if (event.data?.type === "LOG_ATTENDANCE" && event.data.log) {
          const incoming = event.data.log as AttendanceLog;
          setLogs((prev) => collapseSlotAttendanceLogs([incoming, ...prev]));
          if (user?.email) {
            saveAttendanceLogToSupabase(incoming).catch(() => {});
          }
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "meettrack_realtime_event" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data && data.log) {
            const incoming = data.log as AttendanceLog;
            setLogs((prev) => collapseSlotAttendanceLogs([incoming, ...prev]));
            if (user?.email) {
              saveAttendanceLogToSupabase(incoming).catch(() => {});
            }
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [user?.email]);

  // Real-time protocol state (SSE, Long Polling, WebRTC, MQTT)
  const [realtimeMode, setRealtimeMode] = useState<"SSE" | "LongPolling" | "WebRTC" | "MQTT">("SSE");
  const [mqttMessages, setMqttMessages] = useState<any[]>([]);

  // Real-Time Protocol Engine (SSE with Long-Polling Fallback + MQTT + WebRTC)
  useEffect(() => {
    fetchData(user?.email || "");

    let eventSource: EventSource | null = null;
    let longPollActive = true;
    let lastTimestamp = 0;

    const safeMergeTrainers = (incomingTrainers: Trainer[]) => {
      if (!Array.isArray(incomingTrainers) || incomingTrainers.length === 0) return;
      setTrainers((prev) => {
        const map = new Map<string, Trainer>();
        prev.forEach((t) => {
          if (t?.id) map.set(t.id, t);
          if (t?.name) map.set(t.name.trim().toLowerCase(), t);
        });
        incomingTrainers.forEach((t) => {
          if (t && t.name && t.name.trim()) {
            const nameKey = t.name.trim().toLowerCase();
            const existing = (t.id ? map.get(t.id) : null) || map.get(nameKey);
            const merged = existing ? { ...existing, ...t, id: existing.id || t.id } : t;
            if (merged.id) map.set(merged.id, merged);
            map.set(nameKey, merged);
          }
        });
        const mergedList = Array.from(new Set(map.values())).filter(
          (t, idx, arr) => arr.findIndex((x) => x.id === t.id) === idx
        );
        if (mergedList.length >= prev.length) {
          localStorage.setItem("meettrack_trainers_all", JSON.stringify(mergedList));
          return mergedList;
        }
        return prev;
      });
    };

    const safeMergeSlots = (incomingSlots: Slot[]) => {
      if (!Array.isArray(incomingSlots) || incomingSlots.length === 0) return;
      setSlots((prev) => {
        const map = new Map<string, Slot>();
        prev.forEach((s) => { if (s?.id) map.set(s.id, s); });
        incomingSlots.forEach((s) => {
          if (s?.id) {
            const existing = map.get(s.id);
            map.set(s.id, existing ? { ...existing, ...s } : s);
          }
        });
        return Array.from(map.values());
      });
    };

    const safeMergeLogs = (incomingLogs: AttendanceLog[]) => {
      if (!Array.isArray(incomingLogs) || incomingLogs.length === 0) return;
      setLogs((prev) => {
        const map = new Map<string, AttendanceLog>();
        prev.forEach((l) => { if (l?.slotId) map.set(l.slotId, l); });
        incomingLogs.forEach((l) => {
          if (l?.slotId) {
            const existing = map.get(l.slotId);
            map.set(l.slotId, existing ? { ...existing, ...l } : l);
          }
        });
        return Array.from(map.values());
      });
    };

    // A. Attempt Server-Sent Events (SSE) streaming connection
    try {
      const sseUrl = `/api/sse${user?.email ? `?userEmail=${encodeURIComponent(user?.email)}` : ""}`;
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener("connected", () => {
        setRealtimeMode("SSE");
      });

      eventSource.addEventListener("state_sync", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (Array.isArray(payload.trainers) && payload.trainers.length > 0) safeMergeTrainers(payload.trainers);
          if (Array.isArray(payload.slots) && payload.slots.length > 0) safeMergeSlots(payload.slots);
          if (Array.isArray(payload.attendanceLogs) && payload.attendanceLogs.length > 0) safeMergeLogs(payload.attendanceLogs);
        } catch {}
      });

      eventSource.addEventListener("data_updated", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (Array.isArray(payload.trainers) && payload.trainers.length > 0) safeMergeTrainers(payload.trainers);
          if (Array.isArray(payload.slots) && payload.slots.length > 0) safeMergeSlots(payload.slots);
          if (Array.isArray(payload.attendanceLogs) && payload.attendanceLogs.length > 0) safeMergeLogs(payload.attendanceLogs);
        } catch {
          fetchData(user?.email || "");
        }
      });

      eventSource.addEventListener("mqtt_message", (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          setMqttMessages((prev) => [msg, ...prev].slice(0, 50));
        } catch {}
      });

      eventSource.onerror = () => {
        // Fallback to HTTP Long Polling if SSE is disconnected
        setRealtimeMode("LongPolling");
      };
    } catch (e) {
      setRealtimeMode("LongPolling");
    }

    // B. HTTP Long Polling Engine (Fallback & Compatibility)
    const runLongPollLoop = async () => {
      while (longPollActive) {
        try {
          const res = await fetch(`/api/long-poll?since=${lastTimestamp}`);
          if (res.ok) {
            const data = await res.json();
            if (data.timestamp) lastTimestamp = data.timestamp;
            if (data.changed && data.data) {
              if (Array.isArray(data.data.trainers) && data.data.trainers.length > 0) safeMergeTrainers(data.data.trainers);
              if (Array.isArray(data.data.slots) && data.data.slots.length > 0) safeMergeSlots(data.data.slots);
              if (Array.isArray(data.data.attendanceLogs) && data.data.attendanceLogs.length > 0) {
                setLogs((prev) => {
                  const map = new Map<string, AttendanceLog>();
                  prev.forEach((l) => { if (l?.slotId) map.set(l.slotId, l); });
                  (data.data.attendanceLogs as AttendanceLog[]).forEach((l) => {
                    if (l?.slotId) {
                      const existing = map.get(l.slotId);
                      map.set(l.slotId, existing ? { ...existing, ...l } : l);
                    }
                  });
                  return Array.from(map.values());
                });
              }
            }
          }
        } catch (err) {
          // Pause brief moment on network error
        }
        // Throttle polling to prevent rapid-fire server loops
        await new Promise((r) => setTimeout(r, 4000));
      }
    };

    runLongPollLoop();

    // C. Periodic background poll fallback (every 30 seconds when visible)
    const fastPollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchData(user?.email || "").catch(() => {});
      }
    }, 30000);

    return () => {
      longPollActive = false;
      clearInterval(fastPollInterval);
      if (eventSource) eventSource.close();
    };
  }, [selectedDate, user?.email]);

  const trainersRef = useRef<Trainer[]>(trainers);
  trainersRef.current = trainers;
  const slotsRef = useRef<Slot[]>(slots);
  slotsRef.current = slots;
  const logsRef = useRef<AttendanceLog[]>(logs);
  logsRef.current = logs;

  // 100% Automated Google Meet Attendance Engine (Pre-Start Window Activation & Auto OUT Tracking)
  useEffect(() => {
    let isTracking = false;
    const autoTrackLoop = async () => {
      if (isTracking) return;
      isTracking = true;
      try {
        const now = new Date();
        const currentSlots = slotsRef.current;
        const currentLogs = logsRef.current;
        let needsRefresh = false;

        for (let i = 0; i < currentSlots.length; i++) {
          const slot = currentSlots[i];
          if (!slot.startTime || !slot.endTime || slot.status === "cancelled" || !slot.date) continue;

          const dateParts = slot.date.split("-").map(Number);
          const startParts = slot.startTime.split(":").map(Number);
          const endParts = slot.endTime.split(":").map(Number);

          if (dateParts.length !== 3 || startParts.length < 2 || endParts.length < 2) continue;

          const slotStart = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], startParts[0], startParts[1], 0);
          let slotEnd = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], endParts[0], endParts[1], 0);
          if (slotEnd < slotStart) {
            slotEnd.setDate(slotEnd.getDate() + 1);
          }

          // Pre-start window begins 10 minutes before slot start time
          const preStartWindow = new Date(slotStart.getTime() - 10 * 60 * 1000);

          // 1. Auto-activate tracking status 10 minutes before slot start time
          if ((now >= preStartWindow || now >= slotStart) && now < slotEnd && slot.status === "scheduled") {
            try {
              await fetch("/api/session/control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slotId: slot.id, action: "activate_tracking" }),
              });
              needsRefresh = true;
            } catch (err) {}
          }

          // 2. Auto OUT tracking & Session completion when slot duration passes
          const log = currentLogs.find((l) => l.slotId === slot.id);
          const mentorJoined = Boolean(log?.mentorJoinedAt);

          // GUARD: Never auto-complete if the extension is actively tracking this slot!
          const isActivelyTracking = Boolean(
            log?.trackingActive ||
            (log as any)?.trackingStartedAt && !(log as any)?.trackingStoppedAt
          );
          if (isActivelyTracking) continue;

          // If slot duration (e.g. 30m) has passed:
          // A) Mentor did NOT join at all -> auto-complete
          // B) Mentor joined but student NEVER joined -> auto-complete (server automatically marks no_show)
          const studentJoined = Boolean(log?.studentJoinedAt || log?.askToJoinTime);
          if (now >= slotEnd && slot.status !== "completed" && slot.status !== "no_show" && (!mentorJoined || !studentJoined)) {
            try {
              await fetch("/api/session/auto-complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slotId: slot.id }),
              });
              needsRefresh = true;
            } catch (err) {}
          } else {
            // Grace period of 30 mins for active mentor sessions
            const graceEndTime = new Date(slotEnd.getTime() + 30 * 60 * 1000);
            if (now >= graceEndTime && slot.status === "live") {
              if (log?.mentorLeftAt || now.getTime() > slotEnd.getTime() + 60 * 60 * 1000) {
                try {
                  await fetch("/api/session/auto-complete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slotId: slot.id }),
                  });
                  needsRefresh = true;
                } catch (err) {}
              }
            }
          }
        }

        if (needsRefresh) {
          fetchData(user?.email || "");
        }
      } finally {
        isTracking = false;
      }
    };

    const interval = setInterval(autoTrackLoop, 30000);
    return () => clearInterval(interval);
  }, [user?.email]);

  // MQTT Topic Publisher Helper
  const publishMQTTMessage = async (topic: string, payload: any) => {
    try {
      await fetch("/api/mqtt/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          payload,
          sender: user?.displayName || user?.email || "MeetTrack System",
        }),
      });
    } catch (err) {
      console.error("Error publishing MQTT message:", err);
    }
  };

  const fetchData = async (overrideEmail?: string) => {
    const userEmail = overrideEmail !== undefined ? overrideEmail : (user?.email || "");

    // Run all 3 data sources IN PARALLEL — eliminates 5-min sequential load bottleneck
    const [trainersResult, slotsResult, logsResult] = await Promise.allSettled([
      // 1. TRAINERS
      (async () => {
        const supabaseTrainers = await loadTrainersFromSupabase(userEmail).catch(() => [] as Trainer[]);
        let serverTrainers: Trainer[] = [];
        try {
          const resT = await fetch(`/api/trainers${userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ""}`);
          if (resT.ok) {
            const dataT = await resT.json();
            serverTrainers = dataT.trainers || [];
          }
        } catch {}
        const trainersMap = new Map<string, Trainer>();
        (trainersRef.current || []).forEach((t) => {
          if (t && t.name && t.name.trim()) {
            trainersMap.set(t.name.trim().toLowerCase(), t);
          }
        });
        [...supabaseTrainers, ...serverTrainers].forEach((t) => {
          if (t && t.name && t.name.trim()) {
            const key = t.name.trim().toLowerCase();
            const existing = trainersMap.get(key);
            if (!existing) {
              trainersMap.set(key, { ...t, userEmail: t.userEmail || userEmail });
            } else {
              trainersMap.set(key, {
                ...existing, ...t,
                id: existing.id || t.id,
                email: existing.email || t.email,
                meetUrl: existing.meetUrl || t.meetUrl,
                userEmail: existing.userEmail || t.userEmail || userEmail,
              });
            }
          }
        });
        return Array.from(trainersMap.values());
      })(),

      // 2. SLOTS
      (async () => {
        const supabaseSlots = await loadSlotsFromSupabase(selectedDate, userEmail).catch(() => [] as Slot[]);
        let serverSlots: Slot[] = [];
        try {
          const resS = await fetch(`/api/slots?date=${selectedDate}${userEmail ? `&userEmail=${encodeURIComponent(userEmail)}` : ""}`);
          if (resS.ok) {
            const dataS = await resS.json();
            serverSlots = dataS.slots || [];
          }
        } catch {}
        const slotMap = new Map<string, Slot>();
        (slotsRef.current || []).forEach((s) => { if (s && s.id) slotMap.set(s.id, s); });
        [...supabaseSlots, ...serverSlots].forEach((s) => { if (s && s.id) slotMap.set(s.id, s); });
        return Array.from(slotMap.values());
      })(),

      // 3. ATTENDANCE LOGS
      (async () => {
        const [supabaseLogs, serverLogsResult] = await Promise.allSettled([
          loadAttendanceLogsFromSupabase(selectedDate, userEmail),
          fetch(`/api/attendance?date=${selectedDate}&statsDate=${selectedDate}${userEmail ? `&userEmail=${encodeURIComponent(userEmail)}` : ""}`)
            .then(r => r.ok ? r.json() : { logs: [] })
            .catch(() => ({ logs: [] })),
        ]);
        const sLogs = supabaseLogs.status === "fulfilled" ? supabaseLogs.value : [];
        const apiData = serverLogsResult.status === "fulfilled" ? serverLogsResult.value : { logs: [] };
        if (apiData.stats) setStats(apiData.stats);
        return collapseSlotAttendanceLogs([...sLogs, ...(apiData.logs || [])]);
      })(),
    ]);

    // Apply trainer results
    if (trainersResult.status === "fulfilled" && trainersResult.value.length > 0) {
      const mergedTrainers = trainersResult.value;
      setTrainers(mergedTrainers);
      localStorage.setItem("meettrack_trainers_all", JSON.stringify(mergedTrainers));
      if (userEmail) {
        localStorage.setItem(`meettrack_trainers_${userEmail.toLowerCase()}`, JSON.stringify(mergedTrainers));
      }
      saveTrainersToSupabase(mergedTrainers).catch(() => {});

      // Apply slot results after trainers are known (needed for slot generation)
      const activeTrainers = mergedTrainers;
      if (slotsResult.status === "fulfilled") {
        const { updatedSlots, newSlotsGenerated } = ensureSlotsForTrainers(
          activeTrainers,
          slotsResult.value,
          selectedDate,
          userEmail
        );
        const todayStr = getLocalDateString();
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        const sanitizedSlots = updatedSlots.map((s) => {
          if (s.status === "live") {
            const [endH, endM] = (s.endTime || "").split(":").map(Number);
            const endMin = (endH || 0) * 60 + (endM || 0);
            if (s.date < todayStr || (s.date === todayStr && nowMin > endMin + 15)) {
              return { ...s, status: "completed" as const };
            }
          }
          return s;
        });
        setSlots(sanitizedSlots);
        localStorage.setItem(`meettrack_slots_${selectedDate}`, JSON.stringify(sanitizedSlots));
        localStorage.setItem("meettrack_slots_all", JSON.stringify(sanitizedSlots));
        if (newSlotsGenerated.length > 0) {
          saveSlotsToSupabase(newSlotsGenerated).catch(() => {});
        }
      }
    }

    // Apply log results (strictly from database/api query)
    if (logsResult.status === "fulfilled") {
      const mergedLogs = (logsResult.value || []).filter((l: any) =>
        l &&
        l.studentEmail !== "student@example.com" &&
        l.studentName !== "Student (Test Session)" &&
        (l.mentorJoinedAt || l.studentJoinedAt || (l.trackedDurationSeconds && l.trackedDurationSeconds > 0))
      );
      setLogs(mergedLogs);
      localStorage.setItem(`meettrack_logs_${selectedDate}`, JSON.stringify(mergedLogs));
    }
  };


  // Google Account Auth Handlers
  const handleConnectGoogle = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setGoogleToken(res.accessToken);
        const userEmail = res.user.email;
        const userName = res.user.displayName || userEmail?.split("@")[0];

        if (userEmail) {
          await fetchUserRole(userEmail);
          await fetchData(userEmail);
          await handleSyncCalendar(res.accessToken, userEmail, userName);
        }
        return res;
      }
    } catch (err: any) {
      console.error("Failed to connect Google Account:", err);
      setIsOAuthErrorModalOpen(true);
      throw err;
    }
    return null;
  };

  const handleDisconnectGoogle = async () => {
    await googleLogout();
    setUser(null);
    setGoogleToken(null);
    setIsGuestMode(false);
    setUserRole("viewer");
    await fetchUserRole("");
  };

  const handleSyncCalendar = async (overrideToken?: string, uEmail?: string | null, uName?: string | null) => {
    const token = overrideToken || googleToken;
    const currentEmail = uEmail || user?.email || undefined;
    if (!token || !currentEmail) {
      handleConnectGoogle();
      return;
    }

    const currentName = uName || user?.displayName || currentEmail.split("@")[0];

    setIsSyncingCalendar(true);
    try {
      const events = await fetchGoogleCalendarEvents(token, selectedDate);
      const res = await fetch("/api/calendar-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events,
          date: selectedDate,
          userEmail: currentEmail,
          userName: currentName,
        }),
      });
      if (res.ok) {
        await fetchData(currentEmail);
      }
    } catch (err) {
      console.error("Error syncing Google Calendar events:", err);
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  // Trainer Management
  const handleSaveTrainer = async (trainerData: Partial<Trainer>) => {
    try {
      const userEmail = user?.email || "";
      const existing = trainers.find((t) => t.id === trainerData.id);
      const cleanName = (trainerData.name || existing?.name || "").trim();

      if (!cleanName) {
        alert("Please provide the Mentor Full Name.");
        return;
      }

      const mergedPayload: Trainer = {
        id: trainerData.id || existing?.id || `tr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: cleanName,
        email: trainerData.email !== undefined ? (trainerData.email || "") : (existing?.email || ""),
        avatar: trainerData.avatar !== undefined ? (trainerData.avatar || "") : (existing?.avatar || ""),
        meetUrl: trainerData.meetUrl !== undefined ? (trainerData.meetUrl || "") : (existing?.meetUrl || ""),
        specialization: trainerData.specialization !== undefined ? (trainerData.specialization || "General Mentor") : (existing?.specialization || "General Mentor"),
        phone: trainerData.phone !== undefined ? (trainerData.phone || "") : (existing?.phone || ""),
        slotDuration: (trainerData.slotDuration || existing?.slotDuration === 45 || existing?.slotDuration === 60) ? (trainerData.slotDuration || existing?.slotDuration || 30) : 30,
        status: trainerData.status || existing?.status || "active",
        userEmail: userEmail || existing?.userEmail || "",
      };

      // 1. Optimistically update React state and local storage immediately
      const updatedList = existing
        ? trainers.map((t) => (t.id === mergedPayload.id ? mergedPayload : t))
        : [...trainers, mergedPayload];

      setTrainers(updatedList);
      localStorage.setItem("meettrack_trainers_all", JSON.stringify(updatedList));
      if (userEmail) {
        localStorage.setItem(`meettrack_trainers_${userEmail.toLowerCase()}`, JSON.stringify(updatedList));
      }

      // 2. Direct Supabase Persistence (Primary Cloud Database on Vercel)
      try {
        await saveTrainerToSupabase(mergedPayload);
        await saveTrainersToSupabase(updatedList);
      } catch (fErr) {
        console.warn("Supabase trainer save notice:", fErr);
      }

      // 3. Immediately Auto-Generate All 31 Slots (8:00 AM - 11:00 PM) for this Mentor
      const targetDates = Array.from(new Set([selectedDate, getLocalDateString()].filter(Boolean)));
      const autoSlots: Slot[] = [];

      targetDates.forEach((d) => {
        const slotsForDate = generateDaySlotsForTrainer(mergedPayload, d, userEmail);
        autoSlots.push(...slotsForDate);
      });

      // Optimistically push all 31 slots to React state and localStorage
      setSlots((prev) => {
        const slotMap = new Map<string, Slot>();
        prev.forEach((s) => {
          if (s && s.id) slotMap.set(s.id, s);
        });
        autoSlots.forEach((s) => slotMap.set(s.id, s));
        const combined = Array.from(slotMap.values());
        localStorage.setItem(`meettrack_slots_${selectedDate}`, JSON.stringify(combined.filter((s) => s.date === selectedDate)));
        localStorage.setItem("meettrack_slots_all", JSON.stringify(combined));
        return combined;
      });

      // Save the 31 slots directly into Supabase so they persist permanently
      saveSlotsToSupabase(autoSlots).catch((err) => {
        console.warn("Supabase auto-slots save notice:", err);
      });

      // 3. Sync to server API
      try {
        const res = await fetch("/api/trainers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mergedPayload),
        });

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.trainers && Array.isArray(data.trainers)) {
            setTrainers(data.trainers);
            localStorage.setItem("meettrack_trainers_all", JSON.stringify(data.trainers));
          }
        }
      } catch (sErr) {
        console.warn("Server trainer sync notice:", sErr);
      }

      await fetchData(userEmail);
    } catch (err) {
      console.error("Failed to save trainer:", err);
      alert("Failed to save mentor. Please try again.");
    }
  };

  const handleDeleteTrainer = async (id: string) => {
    try {
      const userEmail = user?.email || "";
      
      // Optimistic update
      const filtered = trainers.filter((t) => t.id !== id);
      setTrainers(filtered);
      localStorage.setItem("meettrack_trainers_all", JSON.stringify(filtered));
      if (userEmail) {
        localStorage.setItem(`meettrack_trainers_${userEmail.toLowerCase()}`, JSON.stringify(filtered));
      }

      // Delete from Supabase
      deleteTrainerFromSupabase(id).catch((err) => {
        console.warn("Supabase delete trainer notice:", err);
      });

      // Delete from server
      const res = await fetch(`/api/trainers/${id}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data.trainers && Array.isArray(data.trainers)) {
          setTrainers(data.trainers);
          localStorage.setItem("meettrack_trainers_all", JSON.stringify(data.trainers));
        }
        await fetchData(userEmail);
      }
    } catch (err) {
      console.error("Failed to delete trainer:", err);
    }
  };

  // Slot Management with Automatic Google Calendar Integration & Direct Firestore Sync
  const handleSaveSlot = async (slotData: Partial<Slot>) => {
    try {
      const userEmail = user?.email || "";
      const activeToken = googleToken;

      let finalSlot: Partial<Slot> = {
        ...slotData,
        userEmail: userEmail || slotData.userEmail,
        status: slotData.status || "scheduled",
      };

      if (!finalSlot.id) {
        finalSlot.id = `slot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      }

      // If connected to Google Account, create Google Calendar Event with Meet Link automatically
      if (activeToken && slotData.date && slotData.startTime && slotData.endTime) {
        const trainer = trainers.find((t) => t.id === slotData.trainerId);
        try {
          const calResult = await createGoogleCalendarEvent(activeToken, {
            date: slotData.date,
            startTime: slotData.startTime,
            endTime: slotData.endTime,
            mentorName: trainer?.name || slotData.trainerName || "Mentor",
            mentorEmail: trainer?.email,
            studentName: slotData.studentName || "Student",
            studentEmail: slotData.studentEmail || "",
            topic: slotData.topic || "1-on-1 Mentorship Session",
          });

          if (calResult.meetUrl || calResult.eventId) {
            finalSlot = {
              ...finalSlot,
              gcalEventId: calResult.eventId,
              meetUrl: calResult.meetUrl,
              calendarSynced: true,
            };

            // Also associate the Meet link with the trainer if not already present
            if (trainer && calResult.meetUrl) {
              handleSaveTrainer({ id: trainer.id, meetUrl: calResult.meetUrl });
            }
          }
        } catch (calErr) {
          console.warn("Could not create event directly in Google Calendar:", calErr);
        }
      }

      // 1. Optimistic local state update
      setSlots((prev) => {
        const existingIdx = prev.findIndex((s) => s.id === finalSlot.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], ...finalSlot } as Slot;
          return updated;
        }
        return [...prev, finalSlot as Slot];
      });

      // 2. Direct Supabase Save
      saveSlotToSupabase(finalSlot as Slot).catch((err) => {
        console.warn("Supabase saveSlot notice:", err);
      });

      // 3. Sync to API endpoint
      try {
        await fetch("/api/slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalSlot),
        });
      } catch (e) {
        // Safe fallback on Vercel
      }
    } catch (err) {
      console.error("Failed to save slot:", err);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    try {
      const userEmail = user?.email || "";

      // 1. Optimistic local state update
      setSlots((prev) => prev.filter((s) => s.id !== id));

      // 2. Direct Supabase Delete
      deleteSlotFromSupabase(id).catch((err) => {
        console.warn("Supabase deleteSlot notice:", err);
      });

      // 3. Sync to API endpoint
      try {
        await fetch(`/api/slots/${id}`, { method: "DELETE" });
      } catch (e) {}
    } catch (err) {
      console.error("Failed to delete slot:", err);
    }
  };

  // Real-time Event Simulation
  const handleSimulateEvent = async (
    slotId: string,
    action: "join" | "leave" | "complete_session",
    participant: "mentor" | "student"
  ) => {
    try {
      const userEmail = user?.email || "";
      const res = await fetch("/api/simulate-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, action, participant }),
      });
      if (res.ok) {
        fetchData(userEmail);
        if (action === "complete_session") {
          setActiveTab("logs");
        }
      }
    } catch (err) {
      console.error("Simulation error:", err);
    }
  };

  // Dedicated Live Session Control Handler
  const handleSessionControl = async (
    slotId: string,
    action: "start" | "student_join" | "end_session" | "student_leave",
    studentName?: string,
    studentEmail?: string
  ) => {
    try {
      const userEmail = user?.email || "";
      const nowIso = new Date().toISOString();

      // 1. Optimistic Local State Update
      if (action === "end_session") {
        setSlots((prev) =>
          prev.map((s) => {
            if (s.id !== slotId) return s;
            const isNoShow = s.status === "no_show";
            return {
              ...s,
              status: isNoShow ? "no_show" : "completed",
              meetingStatus: "Meeting Ended",
            };
          })
        );
        setLogs((prev) =>
          prev.map((l) => {
            if (l.slotId !== slotId) return l;
            const isNoShow = l.status === "no_show";
            if (isNoShow) {
              return {
                ...l,
                status: "no_show",
                meetingStatus: "Meeting Ended",
                trackingActive: false,
                mentorLeftAt: l.mentorLeftAt || nowIso,
                studentJoinedAt: null,
                studentLeftAt: null,
                trackedDurationSeconds: 0,
                totalOverlapMinutes: 0,
                lastUpdated: nowIso,
              };
            }
            const hasStudent = Boolean(l.studentJoinedAt || l.askToJoinTime);
            let exitIso = l.mentorLeftAt || nowIso;
            const slotItem = slots.find((s) => s.id === l.slotId);
            if (slotItem && slotItem.date && slotItem.endTime) {
              const [endH, endM] = slotItem.endTime.split(":").map(Number);
              const slotEndDt = new Date(`${slotItem.date}T${String(endH || 0).padStart(2, '0')}:${String(endM || 0).padStart(2, '0')}:00+05:30`);
              if (!isNaN(slotEndDt.getTime()) && new Date(exitIso) > slotEndDt) {
                exitIso = slotEndDt.toISOString();
              }
            }
            const durSec = hasStudent
              ? (l.trackedDurationSeconds && l.trackedDurationSeconds > 0
                  ? l.trackedDurationSeconds
                  : l.mentorJoinedAt && l.studentJoinedAt
                  ? Math.max(1, Math.min(1800, Math.round((new Date(exitIso).getTime() - new Date(l.studentJoinedAt).getTime()) / 1000)))
                  : 0)
              : 0;
            return {
              ...l,
              status: "completed",
              meetingStatus: "Meeting Ended",
              trackingActive: false,
              mentorLeftAt: exitIso,
              studentLeftAt: hasStudent ? (l.studentLeftAt || exitIso) : null,
              trackedDurationSeconds: durSec,
              totalOverlapMinutes: durSec > 0 ? Math.max(1, Math.round(durSec / 60)) : 0,
              lastUpdated: nowIso,
            };
          })
        );

        // 2. Direct Supabase write
        const targetSlot = slots.find((s) => s.id === slotId);
        const targetLog = logs.find((l) => l.slotId === slotId);
        if (targetSlot) {
          const isNoShow = targetSlot.status === "no_show";
          saveSlotToSupabase({
            ...targetSlot,
            status: isNoShow ? "no_show" : "completed",
            meetingStatus: "Meeting Ended"
          }).catch(() => {});
        }
        if (targetLog) {
          const isNoShow = targetLog.status === "no_show";
          if (isNoShow) {
            saveAttendanceLogToSupabase({
              ...targetLog,
              status: "no_show",
              meetingStatus: "Meeting Ended",
              trackingActive: false,
              mentorLeftAt: targetLog.mentorLeftAt || nowIso,
              studentJoinedAt: null,
              studentLeftAt: null,
              trackedDurationSeconds: 0,
              totalOverlapMinutes: 0,
              lastUpdated: nowIso,
            }).catch(() => {});
          } else {
            const hasStudent = Boolean(targetLog.studentJoinedAt || targetLog.askToJoinTime);
            let exitIso = targetLog.mentorLeftAt || nowIso;
            if (targetSlot && targetSlot.date && targetSlot.endTime) {
              const [endH, endM] = targetSlot.endTime.split(":").map(Number);
              const slotEndDt = new Date(`${targetSlot.date}T${String(endH || 0).padStart(2, '0')}:${String(endM || 0).padStart(2, '0')}:00+05:30`);
              if (!isNaN(slotEndDt.getTime()) && new Date(exitIso) > slotEndDt) {
                exitIso = slotEndDt.toISOString();
              }
            }
            const durSec = hasStudent
              ? (targetLog.trackedDurationSeconds && targetLog.trackedDurationSeconds > 0
                  ? targetLog.trackedDurationSeconds
                  : targetLog.mentorJoinedAt && targetLog.studentJoinedAt
                  ? Math.max(1, Math.min(1800, Math.round((new Date(exitIso).getTime() - new Date(targetLog.studentJoinedAt).getTime()) / 1000)))
                  : 0)
              : 0;
            saveAttendanceLogToSupabase({
              ...targetLog,
              status: "completed",
              meetingStatus: "Meeting Ended",
              trackingActive: false,
              mentorLeftAt: exitIso,
              studentLeftAt: hasStudent ? (targetLog.studentLeftAt || exitIso) : null,
              trackedDurationSeconds: durSec,
              totalOverlapMinutes: durSec > 0 ? Math.max(1, Math.round(durSec / 60)) : 0,
              lastUpdated: nowIso,
            }).catch(() => {});
          }
        }
      }

      // 3. Post to Server API
      const res = await fetch("/api/session/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, action, studentName, studentEmail }),
      });
      if (res.ok) {
        await fetchData(userEmail);
        if (action === "end_session") {
          setActiveTab("logs");
        }
      }
    } catch (err) {
      console.error("Session control error:", err);
    }
  };

  // Generate AI Intelligence Audit
  const handleGenerateAIReport = async () => {
    setIsAIModalOpen(true);
    setIsAILoading(true);
    try {
      const res = await fetch("/api/ai-report", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.summary || data.keyInsights)) {
          setAIReportData(data);
        }
      }
    } catch (err) {
      console.error("AI Report generation error:", err);
    } finally {
      setIsAILoading(false);
    }
  };

  const liveSlotsCount = slots.filter((s) => s.status === "live").length;

  if (smartJoinTarget) {
    return (
      <SmartJoinPortal
        slotId={smartJoinTarget.slotId}
        trainerId={smartJoinTarget.trainerId}
        onClose={() => setSmartJoinTarget(null)}
      />
    );
  }

  // Auth gate: Show theme-matching login page with glowing logo when unauthenticated
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(authedUser) => {
          setCurrentUser(authedUser);
          setUserRole(authedUser.role);
          fetchData(authedUser.email);
        }}
      />
    );
  }

  const isUserAdmin = currentUser.role === "admin" || userRole === "admin";

  return (
    <div className="min-h-screen text-slate-100 font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        onOpenAIReport={handleGenerateAIReport}
        onOpenExtensionGuide={() => setIsExtensionModalOpen(true)}
        onAddTrainer={() => setActiveTab("trainers")}
        onAddSlot={() => setActiveTab("slots")}
        liveCount={liveSlotsCount}
        trainersCount={trainers.length}
        user={user}
        isAdmin={isUserAdmin}
        currentUserEmail={currentUser.email}
        onLogout={() => {
          clearUserSession();
          setCurrentUser(null);
          setUser(null);
        }}
        onOpenAdminManagement={() => setActiveTab("access")}
        googleToken={googleToken}
        onConnectGoogle={handleConnectGoogle}
        onDisconnectGoogle={() => {
          clearUserSession();
          setCurrentUser(null);
        }}
        onSyncCalendar={() => handleSyncCalendar()}
        isSyncingCalendar={isSyncingCalendar}
        isFirebaseSynced={true}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-28">
        {/* Top KPIs overview */}
        <OverviewStats
          stats={computedStats}
          trainers={trainers}
          slots={slots}
          logs={logs}
          selectedDate={selectedDate}
          onFilterFlagged={() => {
            setFilterFlaggedOnly(true);
            setActiveTab("logs");
          }}
          onNavigateToLogs={() => setActiveTab("logs")}
        />

        {/* Tab 1: Dashboard */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Main Dashboard Layout: 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Mentors Google Meet Links Quick Directory */}
              <div className="lg:col-span-1 ios-glass-card rounded-3xl p-5 shadow-xl border border-white/10">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.08]">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>{trainers.length === 1 ? "1 Mentor Meet Link" : `${trainers.length} Mentors Meet Links`}</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab("trainers")}
                    className="text-xs text-sky-400 hover:text-sky-300 hover:underline font-medium cursor-pointer"
                  >
                    View All →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {trainers.length > 0 ? (
                    trainers.slice(0, 6).map((trainer) => (
                      <div
                        key={trainer.id}
                        className="bg-white/[0.04] hover:bg-white/[0.07] p-3 rounded-2xl border border-white/10 hover:border-white/20 transition-all flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2.5">
                          {trainer.avatar ? (
                            <img
                              src={trainer.avatar}
                              alt={trainer.name}
                              className="w-8 h-8 rounded-full object-cover border border-white/20"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-sky-300 text-xs">
                              {trainer.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white">{trainer.name}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {trainer.specialization || "Mentor"}
                            </div>
                          </div>
                        </div>

                        {trainer.meetUrl && (
                          <a
                            href={trainer.meetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ios-glass-pill px-3 py-1 text-sky-300 hover:text-white rounded-full text-[11px] font-mono flex items-center gap-1 transition-all shrink-0 active:scale-95"
                          >
                            <Video className="w-3 h-3" />
                            <span>Meet</span>
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-white/[0.02] p-6 rounded-2xl border border-white/10 text-center">
                      <Users className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">No mentors registered yet.</p>
                      {!googleToken ? (
                        <button
                          onClick={handleConnectGoogle}
                          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ios-glass-primary text-white font-medium text-xs shadow-md transition-all cursor-pointer active:scale-95"
                        >
                          <span>Connect Google Account</span>
                        </button>
                      ) : userRole === "admin" ? (
                        <button
                          onClick={() => setActiveTab("trainers")}
                          className="mt-2 text-xs text-sky-400 hover:underline font-semibold cursor-pointer"
                        >
                          + Add Mentor
                        </button>
                      ) : (
                        <span className="mt-2 block text-xs text-slate-500">Mentors list is managed by admins</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Attendance Records Preview */}
              <div className="lg:col-span-2">
                <AttendanceLogsTable
                  logs={logs}
                  trainers={trainers}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  isAdmin={isUserAdmin}
                  onRefresh={() => fetchData(user?.email || "")}
                  onSessionControl={handleSessionControl}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Trainers & Google Meet Links */}
        {activeTab === "trainers" && (
          <TrainersGrid
            trainers={trainers}
            slots={slots}
            logs={logs}
            isAdmin={isUserAdmin}
            onSaveTrainer={handleSaveTrainer}
            onDeleteTrainer={handleDeleteTrainer}
            isConnected={!!googleToken && !!user}
            onConnectGoogle={handleConnectGoogle}
          />
        )}

        {/* Tab 3: Mentorship Slot Scheduler */}
        {activeTab === "slots" && (
          <SlotScheduler
            slots={slots}
            trainers={trainers}
            logs={logs}
            selectedDate={selectedDate}
            isAdmin={isUserAdmin}
            onDateChange={setSelectedDate}
            onSaveSlot={handleSaveSlot}
            onDeleteSlot={handleDeleteSlot}
            onSessionControl={handleSessionControl}
            isConnected={!!googleToken && !!user}
            onConnectGoogle={handleConnectGoogle}
          />
        )}

        {/* Tab 4: Student & Batch Directory */}
        {activeTab === "students" && (
          <StudentsTab
            currentUserEmail={currentUser.email}
            isAdmin={isUserAdmin}
          />
        )}

        {/* Tab 5: Full Attendance Records */}
        {activeTab === "logs" && (
          <AttendanceLogsTable
            logs={logs}
            trainers={trainers}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            isAdmin={isUserAdmin}
            onRefresh={() => fetchData(currentUser?.email || user?.email || "")}
            onSessionControl={handleSessionControl}
          />
        )}

        {/* Tab 5: Access & Role Management */}
        {activeTab === "access" && (
          <AccessManagementTab
            currentUser={currentUser}
            isAdmin={isUserAdmin}
          />
        )}
      </main>



      {/* AI Insights Audit Modal & Gemini Chatbot */}
      <AIInsightsModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        reportData={aiReportData}
        isLoading={isAILoading}
        onRefreshReport={handleGenerateAIReport}
        selectedDate={selectedDate}
      />

      {/* Extension & Integration Guide Modal */}
      <ExtensionGuideModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
      />

      {/* Manual Attendance Entry Modal */}
      <ManualAttendanceModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        trainers={trainers}
        userEmail={user?.email || undefined}
        onSuccess={fetchData}
      />

      {/* Google OAuth Verification Notice Modal */}
      <OAuthErrorModal
        isOpen={isOAuthErrorModalOpen}
        onClose={() => setIsOAuthErrorModalOpen(false)}
      />

      {/* Access & Role Management Modal */}
      <AdminManagementModal
        isOpen={isAdminModalOpen}
        onClose={() => {
          setIsAdminModalOpen(false);
          fetchUserRole(user?.email || "");
        }}
        currentUserEmail={user?.email || ""}
        onRefreshAdmins={async () => {
          await fetchUserRole(user?.email || "");
        }}
      />
    </div>
  );
}
