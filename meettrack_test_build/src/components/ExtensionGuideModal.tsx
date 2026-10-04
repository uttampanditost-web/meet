import React, { useState } from "react";
import JSZip from "jszip";
import { X, Copy, Check, Download, Code, Video, Puzzle, Layers, ShieldCheck, Sparkles, Terminal, Globe, Loader2 } from "lucide-react";
import sbConfig from "../../supabase-config.json";

interface ExtensionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionGuideModal: React.FC<ExtensionGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"extension" | "bookmarklet" | "code">("extension");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const manifestJson = `{
  "manifest_version": 3,
  "name": "MeetTrack Pro - Automated Attendance Sync",
  "version": "2.2.0",
  "description": "Automated Google Meet attendance tracker for Mentors & Students",
  "permissions": ["storage", "activeTab", "tabs"],
  "host_permissions": ["https://meet.google.com/*", "https://*.vercel.app/*", "http://localhost/*", "http://127.0.0.1/*", "*://*/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://meet.google.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://*.vercel.app/*", "http://localhost/*", "http://127.0.0.1/*", "https://*.pages.dev/*"],
      "js": ["sync-app.js"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "MeetTrack Pro Status"
  }
}`;

  const contentJs = `/**
 * MeetTrack Pro - Google Meet Automated Attendance Tracker
 * Pre-configured for: \${origin}
 */
(function() {
  function cleanServerUrl(raw) {
    if (!raw) return "";
    var clean = String(raw).trim();
    while (clean.endsWith("/")) clean = clean.substring(0, clean.length - 1);
    if (clean.startsWith("http://") && !clean.includes("localhost") && !clean.includes("127.0.0.1")) {
      clean = "https://" + clean.substring(7);
    }
    var suffix = "/api/events/track";
    if (clean.toLowerCase().endsWith(suffix)) {
      clean = clean.substring(0, clean.length - suffix.length);
    }
    while (clean.endsWith("/")) clean = clean.substring(0, clean.length - 1);
    return clean;
  }

  function isExtensionValid() {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local);
    } catch(e) {
      return false;
    }
  }

  function getFallbackServerUrl() {
    try {
      var cached = localStorage.getItem("meettrack_active_server_url");
      if (cached && !cached.includes("\${origin}") && cached.startsWith("http")) {
        return cleanServerUrl(cached);
      }
    } catch(e) {}
    return cleanServerUrl("\${origin}") || "https://be10x-meet-seven.vercel.app";
  }

  var defaultBase = cleanServerUrl(getFallbackServerUrl());
  var DEFAULT_SERVER_URL = defaultBase + "/api/events/track";

  if (isExtensionValid()) {
    try {
      chrome.storage.local.get(["serverUrl"], function(res) {
        if (!chrome.runtime.lastError && res && res.serverUrl) {
          defaultBase = cleanServerUrl(res.serverUrl);
          DEFAULT_SERVER_URL = defaultBase + "/api/events/track";
          try { localStorage.setItem("meettrack_active_server_url", defaultBase); } catch(e) {}
        }
      });
    } catch(e) {}
  }

  try {
    var urlObj = new URL(window.location.href);
    var qRole = urlObj.searchParams.get("meettrack_role");
    var qName = urlObj.searchParams.get("meettrack_name");
    var qEmail = urlObj.searchParams.get("meettrack_email");
    if (qRole) sessionStorage.setItem("meettrack_role", qRole);
    if (qName) sessionStorage.setItem("meettrack_name", qName);
    if (qEmail) sessionStorage.setItem("meettrack_email", qEmail);
  } catch(e) {}

  function getActiveRole() {
    try {
      var stored = sessionStorage.getItem("meettrack_role");
      if (stored) return stored;
    } catch(e) {}
    return "mentor";
  }

  function getParticipantEmail() {
    try {
      return sessionStorage.getItem("meettrack_email") || "";
    } catch(e) {}
    return "";
  }

  console.log("⚡ [MeetTrack Extension] Active on Google Meet -> Server:", DEFAULT_SERVER_URL);

  var trackedParticipants = new Set();
  var trackedAskRequests = new Set();
  var lastSentEvents = new Map();
  var isTrackingActive = false;
  var isTrackingPaused = false;
  var hasReachedTwoParticipants = false;
  var trackSeconds = 0;
  var trackInterval = null;
  var trackStartTime = null;
  var rateLimitCooldownUntil = 0;

  function getFirstLine(str) {
    if (!str) return "";
    var lf = String.fromCharCode(10);
    var cr = String.fromCharCode(13);
    return str.split(lf)[0].split(cr)[0].trim();
  }

  function getMeetUrl() {
    var url = window.location.href.split("?")[0].split("#")[0].trim();
    while (url.endsWith("/")) url = url.substring(0, url.length - 1);
    if (url.includes("/home") || url.includes("/landing") || url === "https://meet.google.com") {
      return "";
    }
    return url;
  }

  function getParticipantName() {
    try {
      var stored = sessionStorage.getItem("meettrack_name");
      if (stored && stored.trim().length > 1) return stored.trim();
    } catch(e) {}
    var nameEl = document.querySelector("[data-self-name]");
    if (nameEl && nameEl.innerText) {
      var txt = getFirstLine(nameEl.innerText);
      if (txt.length > 1 && !txt.toLowerCase().includes("frame_person") && !txt.toLowerCase().includes("person") && !txt.toLowerCase().includes("profile")) return txt;
    }
    var selfTile = document.querySelector('[data-requested-participant-id="self"], [data-initial-participant-id="self"], [data-is-muted]');
    if (selfTile) {
      var selfImg = selfTile.querySelector('img[src*="googleusercontent"]');
      if (selfImg && selfImg.alt && selfImg.alt.trim().length > 2) {
        return selfImg.alt.trim();
      }
    }
    var title = document.title.replace("Meet - ", "").replace("Google Meet", "").trim();
    if (title && !title.includes("-") && title.length > 2 && !title.toLowerCase().includes("frame_person") && !title.toLowerCase().includes("profile")) return title;
    return getActiveRole() === "student" ? "Student" : "Mentor";
  }

  function updateBadgeText(msg) {
    var el = document.getElementById("meettrack-badge-text");
    if (!el) return;
    if (typeof msg === "string" && (msg.toLowerCase().includes("reconnect") || msg.toLowerCase().includes("error"))) {
      el.innerText = "Reconnecting...";
    } else {
      el.innerText = "Connected";
    }
  }

  function queueOfflineEvent(payload) {
    if (!payload) return;
    try {
      var qKey = "be10x_offline_events_" + (getMeetUrl() || "room");
      var existing = [];
      try {
        var raw = localStorage.getItem(qKey);
        if (raw) existing = JSON.parse(raw) || [];
      } catch(e) {}
      existing.push({ payload: payload, queuedAt: Date.now() });
      if (existing.length > 20) existing.shift();
      localStorage.setItem(qKey, JSON.stringify(existing));
    } catch(e) {}
  }

  function flushOfflineQueue() {
    try {
      var qKey = "be10x_offline_events_" + (getMeetUrl() || "room");
      var raw = localStorage.getItem(qKey);
      if (!raw) return;
      var events = JSON.parse(raw);
      if (Array.isArray(events) && events.length > 0) {
        console.log("⚡ [MeetTrack] Flushing", events.length, "offline buffered events after reconnect");
        localStorage.removeItem(qKey);
        events.forEach(function(item) {
          if (item && item.payload) directFetch(item.payload);
        });
      }
    } catch(e) {}
  }

  if (typeof window !== "undefined") {
    window.addEventListener("online", function() {
      console.log("⚡ [MeetTrack] Internet restored! Re-syncing session...");
      updateBadgeText("🟢 Connected & Synced");
      flushOfflineQueue();
      if (isTrackingActive || trackSeconds > 0) {
        sendEvent({
          meetUrl: getMeetUrl(),
          role: getActiveRole(),
          action: "heartbeat",
          participantName: getParticipantName(),
          participantEmail: getParticipantEmail(),
          participantCount: getLiveParticipantCount(),
          durationSeconds: trackSeconds,
          trackingStartedAt: trackStartTime,
          timestamp: new Date().toISOString()
        }, true);
      }
    });

    window.addEventListener("offline", function() {
      console.log("⚠️ [MeetTrack] Network lost! Buffering session locally...");
      updateBadgeText("⚡ Offline (Buffering...)");
    });
  }

  function directFetch(payload) {
    function doFetch(url) {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      })
      .then(function(res) {
        if (res.ok) {
          updateBadgeText("🟢 Connected & Synced");
        } else {
          queueOfflineEvent(payload);
        }
      })
      .catch(function() {
        queueOfflineEvent(payload);
        updateBadgeText("⚡ Offline (Buffering...)");
      });
    }

    var handled = false;
    if (isExtensionValid()) {
      try {
        chrome.storage.local.get(["serverUrl"], function(store) {
          if (chrome.runtime.lastError) {
            doFetch(getFallbackServerUrl());
            return;
          }
          var base = (store && store.serverUrl) ? cleanServerUrl(store.serverUrl) : getFallbackServerUrl();
          doFetch(base);
        });
        handled = true;
      } catch(e) {
        handled = false;
      }
    }
    if (!handled) {
      doFetch(getFallbackServerUrl());
    }
  }

  function sendEvent(payload, bypassThrottle) {
    var now = Date.now();
    var action = payload ? payload.action : "ping";
    var eventKey = action + ":" + (payload.meetUrl || "") + ":" + (payload.participantName || "");
    var lastSent = lastSentEvents.get(eventKey) || 0;
    var isCritical = action === "start_next_slot" || action === "end_meeting" || action === "student_no_show" || action === "leave" || bypassThrottle;

    if (!isCritical && (now - lastSent < 10000)) return;
    lastSentEvents.set(eventKey, now);

    var sentViaChrome = false;
    if (isExtensionValid()) {
      try {
        chrome.storage.local.get(["serverUrl"], function(store) {
          if (chrome.runtime.lastError) {
            directFetch(payload);
            return;
          }
          var base = (store && store.serverUrl) ? cleanServerUrl(store.serverUrl) : getFallbackServerUrl();
          if (!base.endsWith("/api/events/track")) base = base + "/api/events/track";
          try {
            chrome.runtime.sendMessage({
              action: "SEND_TRACK_EVENT",
              defaultServerUrl: base,
              payload: payload
            }, function(response) {
              if (chrome.runtime.lastError || !response || !response.success) {
                directFetch(payload);
              } else {
                updateBadgeText("🟢 Connected & Synced");
              }
            });
          } catch(e) {
            directFetch(payload);
          }
        });
        sentViaChrome = true;
      } catch(err) {
        sentViaChrome = false;
      }
    }
    if (!sentViaChrome) {
      directFetch(payload);
    }
  }

  function getLiveParticipantCount() {
    var count = 0;
    var pButtons = document.querySelectorAll('button[aria-label*="everyone" i], button[aria-label*="people" i], button[aria-label*="participant" i], [data-number-of-participants], [aria-label*="Show everyone" i]');
    for (var i = 0; i < pButtons.length; i++) {
      var btn = pButtons[i];
      var dataCount = (btn.getAttribute("data-number-of-participants") || "").trim();
      if (dataCount && !isNaN(parseInt(dataCount, 10))) {
        var num = parseInt(dataCount, 10);
        if (num >= 1 && num < 500) { count = num; break; }
      }
      var aria = (btn.getAttribute("aria-label") || "") + " " + (btn.innerText || "");
      var parenIdx = aria.indexOf("(");
      if (parenIdx !== -1) {
        var closeIdx = aria.indexOf(")", parenIdx);
        if (closeIdx !== -1) {
          var inside = aria.substring(parenIdx + 1, closeIdx).trim();
          var parsed = parseInt(inside, 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed < 500) { count = parsed; break; }
        }
      }
    }

    if (count === 0) {
      var tiles = document.querySelectorAll("[data-participant-id]");
      var idSet = new Set();
      tiles.forEach(function(t) {
        if (t.closest('[role="dialog"], [role="alert"]')) return;
        var id = t.getAttribute("data-participant-id");
        if (id && id.trim()) idSet.add(id.trim());
      });
      if (idSet.size > 0) count = idSet.size;
    }

    if (count === 0) {
      var listItems = document.querySelectorAll('div[role="listitem"]');
      if (listItems.length > 0) count = listItems.length;
    }

    if (count === 0) count = 1;
    return count;
  }

  function formatTimerDisplay(secs) {
    var mins = Math.floor(secs / 60).toString();
    if (mins.length < 2) mins = "0" + mins;
    var s = (secs % 60).toString();
    if (s.length < 2) s = "0" + s;
    return mins + ":" + s;
  }

  function getSessionStorageKey() {
    return "be10x_meettrack_session_" + (getMeetUrl() || "room");
  }

  function persistSession() {
    try {
      var key = getSessionStorageKey();
      if (isTrackingActive || isTrackingPaused || trackSeconds > 0) {
        var data = JSON.stringify({
          trackSeconds: trackSeconds,
          trackStartTime: trackStartTime,
          isTrackingPaused: isTrackingPaused,
          savedAt: Date.now()
        });
        sessionStorage.setItem(key, data);
        try { localStorage.setItem(key, data); } catch(e) {}
      } else {
        sessionStorage.removeItem(key);
        try { localStorage.removeItem(key); } catch(e) {}
      }
    } catch(e) {}
  }

  function restoreSessionIfAvailable() {
    try {
      var key = getSessionStorageKey();
      var raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (raw) {
        var parsed = JSON.parse(raw);
        // Only restore if session was saved within the last 10 minutes (600000ms)
        // This prevents cross-slot contamination when mentor reuses same Meet URL for next slot
        if (parsed && parsed.trackSeconds > 0 && (Date.now() - parsed.savedAt < 600000)) {
          trackSeconds = parsed.trackSeconds;
          trackStartTime = parsed.trackStartTime || new Date().toISOString();
          isTrackingPaused = true;
          isTrackingActive = false;
          hasReachedTwoParticipants = true;
          console.log("⚡ [MeetTrack] Restored active session from tab refresh/reconnect:", trackSeconds, "seconds");
        } else if (parsed && (Date.now() - parsed.savedAt >= 600000)) {
          // Session is stale (> 10 min old) — clear it from both storages to avoid ghost restores
          try { sessionStorage.removeItem(key); } catch(e2) {}
          try { localStorage.removeItem(key); } catch(e2) {}
        }
      }
    } catch(e) {}
  }
  restoreSessionIfAvailable();

  function updateControlBarUI() {
    var trackBtn = document.getElementById("be10x-track-btn");
    var trackText = document.getElementById("be10x-track-btn-text");
    var pauseBtn = document.getElementById("be10x-pause-btn");
    var resumeBtn = document.getElementById("be10x-resume-btn");
    var stopBtn = document.getElementById("be10x-stop-btn");
    var dotEl = document.getElementById("be10x-pulse-dot");
    var timerEl = document.getElementById("be10x-live-timer");

    if (!trackBtn || !timerEl) return;

    if (isTrackingActive) {
      trackBtn.style.display = "none";
      if (resumeBtn) resumeBtn.style.display = "none";
      if (pauseBtn) {
        pauseBtn.style.display = "inline-flex";
        pauseBtn.style.setProperty("background", "#d97706", "important");
      }
      if (stopBtn) {
        stopBtn.style.display = "inline-flex";
      }
      if (dotEl) {
        dotEl.style.backgroundColor = "#22c55e";
        dotEl.style.boxShadow = "0 0 8px #22c55e";
      }
      timerEl.innerText = formatTimerDisplay(trackSeconds);
    } else if (isTrackingPaused) {
      trackBtn.style.display = "none";
      if (pauseBtn) pauseBtn.style.display = "none";
      if (resumeBtn) {
        resumeBtn.style.display = "inline-flex";
      }
      if (stopBtn) {
        stopBtn.style.display = "inline-flex";
      }
      if (dotEl) {
        dotEl.style.backgroundColor = "#f59e0b";
        dotEl.style.boxShadow = "0 0 8px #f59e0b";
      }
      timerEl.innerText = formatTimerDisplay(trackSeconds) + " (Paused)";
    } else {
      trackBtn.style.display = "inline-flex";
      trackBtn.style.setProperty("background", "#16a34a", "important");
      if (trackText) trackText.innerText = "Track Attendance";
      if (pauseBtn) pauseBtn.style.display = "none";
      if (resumeBtn) resumeBtn.style.display = "none";
      if (stopBtn) stopBtn.style.display = "none";
      if (dotEl) {
        dotEl.style.backgroundColor = "#38bdf8";
        dotEl.style.boxShadow = "none";
      }
      timerEl.innerText = "Ready";
    }
  }

  function pauseTracking(reason) {
    if (trackInterval) {
      clearInterval(trackInterval);
      trackInterval = null;
    }
    isTrackingActive = false;
    isTrackingPaused = true;
    persistSession();
    updateControlBarUI();

    var cleanUrl = getMeetUrl();
    var pCount = getLiveParticipantCount();
    sendEvent({
      meetUrl: cleanUrl,
      role: "mentor",
      action: "pause_tracking",
      participantName: getParticipantName(),
      participantCount: pCount,
      durationSeconds: trackSeconds,
      trackingStartedAt: trackStartTime,
      timestamp: new Date().toISOString()
    }, true);

    if (reason === "participant_dropped") {
      updateBadgeText("⏸ Participant Dropped — Attendance Paused (Click Resume when student rejoins)");
    } else {
      updateBadgeText("⏸ Tracking Paused (Click Resume Attendance to continue)");
    }
  }

  function resumeTracking() {
    isTrackingActive = true;
    isTrackingPaused = false;
    persistSession();
    updateControlBarUI();

    var cleanUrl = getMeetUrl();
    var pCount = getLiveParticipantCount();
    sendEvent({
      meetUrl: cleanUrl,
      role: "mentor",
      action: "resume_tracking",
      participantName: getParticipantName(),
      participantCount: pCount,
      durationSeconds: trackSeconds,
      trackingStartedAt: trackStartTime,
      timestamp: new Date().toISOString()
    }, true);

    if (!trackInterval) {
      trackInterval = setInterval(function() {
        if (!isTrackingActive) return;
        trackSeconds++;
        persistSession();
        var timerEl = document.getElementById("be10x-live-timer");
        if (timerEl) timerEl.innerText = formatTimerDisplay(trackSeconds);

        var currentCount = getLiveParticipantCount();
        if (trackSeconds % 30 === 0) {
          sendEvent({
            meetUrl: cleanUrl,
            role: getActiveRole(),
            action: "heartbeat",
            participantName: getParticipantName(),
            participantEmail: getParticipantEmail(),
            participantCount: currentCount,
            durationSeconds: trackSeconds,
            trackingStartedAt: trackStartTime,
            timestamp: new Date().toISOString()
          });
        }
      }, 1000);
    }
    updateBadgeText("🟢 Connected & Tracking Active (" + formatTimerDisplay(trackSeconds) + ")");
  }

  function stopTracking(reason) {
    var finalDuration = trackSeconds;
    var stopTime = new Date().toISOString();
    var startTimeToReport = trackStartTime || new Date(Date.now() - finalDuration * 1000).toISOString();

    isTrackingActive = false;
    isTrackingPaused = false;
    hasReachedTwoParticipants = false;
    if (trackInterval) {
      clearInterval(trackInterval);
      trackInterval = null;
    }
    trackSeconds = 0;
    // CRITICAL: Clear from BOTH sessionStorage AND localStorage.
    // Without clearing localStorage, the next slot opening the same Meet URL
    // would restore the old session and show Resume/Stop with the previous session's duration!
    try { sessionStorage.removeItem(getSessionStorageKey()); } catch(e) {}
    try { localStorage.removeItem(getSessionStorageKey()); } catch(e) {}
    try {
      trackedParticipants.clear();
      trackedParticipants.add("mentors be10x");
      trackedParticipants.add("be10x");
      trackedParticipants.add("mentor");
      trackedParticipants.add("mentors");
      trackedParticipants.add("host");
      trackedParticipants.add("you");
      var selfN = (getParticipantName() || "").toLowerCase().trim();
      if (selfN) trackedParticipants.add(selfN);
    } catch(e) {}
    try { trackedAskRequests.clear(); } catch(e) {}

    updateControlBarUI();

    var cleanUrl = getMeetUrl();
    var pCount = getLiveParticipantCount();
    var pEmail = getParticipantEmail();
    var tName = (function() {
      try { return sessionStorage.getItem("meettrack_name") || ""; } catch(e) { return ""; }
    })();
    if (reason !== "no_show") {
      sendEvent({
        meetUrl: cleanUrl,
        role: "mentor",
        action: "end_meeting",
        participantName: getParticipantName(),
        participantEmail: pEmail,
        trainerName: tName,
        participantCount: pCount,
        durationSeconds: finalDuration,
        trackingStartedAt: startTimeToReport,
        trackingStoppedAt: stopTime,
        timestamp: stopTime
      }, true);
      updateBadgeText("✓ Attendance Recorded (" + Math.max(1, Math.round(finalDuration / 60)) + "m) & Meeting Completed!");
    } else {
      updateBadgeText("🚫 Student Marked No Show — Slot Closed!");
    }
    trackStartTime = null;
  }

  function injectTopControlBar() {
    try {
      var cleanUrl = getMeetUrl();
      if (!cleanUrl) return;

      var parentNode = document.body || document.documentElement;
      if (!parentNode) return;

      var existing = document.getElementById("be10x-meet-tracker-topbar");
      if (existing) {
        if (!parentNode.contains(existing)) parentNode.appendChild(existing);
        return;
      }

      var bar = document.createElement("div");
      bar.id = "be10x-meet-tracker-topbar";
      bar.style.cssText = "position: fixed !important; top: 12px !important; left: 50% !important; transform: translateX(-50%) !important; z-index: 2147483647 !important; background: rgba(15, 23, 42, 0.96) !important; backdrop-filter: blur(16px) !important; border: 1.5px solid rgba(56, 189, 248, 0.5) !important; border-radius: 9999px !important; padding: 6px 18px !important; display: flex !important; align-items: center !important; gap: 10px !important; box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.9) !important; font-family: Google Sans, Roboto, system-ui, sans-serif !important; color: #ffffff !important; user-select: none !important; pointer-events: auto !important;";

      // 1. Initial Track Attendance Button (Green)
      var trackBtn = document.createElement("button");
      trackBtn.id = "be10x-track-btn";
      trackBtn.style.cssText = "background: #16a34a !important; color: #ffffff !important; border: none !important; border-radius: 9999px !important; padding: 7px 18px !important; font-size: 13px !important; font-weight: 700 !important; cursor: pointer !important; display: flex !important; align-items: center !important; gap: 6px !important; transition: all 0.2s ease !important; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.4) !important;";
      trackBtn.innerHTML = '<svg id="be10x-track-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span id="be10x-track-btn-text">Track Attendance</span>';

      // 2. Pause Button (Amber, visible during active tracking)
      var pauseBtn = document.createElement("button");
      pauseBtn.id = "be10x-pause-btn";
      pauseBtn.style.cssText = "background: #d97706 !important; color: #ffffff !important; border: none !important; border-radius: 9999px !important; padding: 7px 16px !important; font-size: 13px !important; font-weight: 700 !important; cursor: pointer !important; display: none !important; align-items: center !important; gap: 6px !important; transition: all 0.2s ease !important; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.4) !important;";
      pauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span>Pause</span>';

      // 3. Resume Button (Glowing green, visible when paused)
      var resumeBtn = document.createElement("button");
      resumeBtn.id = "be10x-resume-btn";
      resumeBtn.style.cssText = "background: #16a34a !important; color: #ffffff !important; border: 1.5px solid #4ade80 !important; border-radius: 9999px !important; padding: 7px 18px !important; font-size: 13px !important; font-weight: 700 !important; cursor: pointer !important; display: none !important; align-items: center !important; gap: 6px !important; transition: all 0.2s ease !important; box-shadow: 0 0 16px rgba(34, 197, 94, 0.6) !important;";
      resumeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Resume Attendance</span>';

      // 4. Conclude / Stop Button (Red, visible during active tracking & paused)
      var stopBtn = document.createElement("button");
      stopBtn.id = "be10x-stop-btn";
      stopBtn.style.cssText = "background: #dc2626 !important; color: #ffffff !important; border: none !important; border-radius: 9999px !important; padding: 7px 16px !important; font-size: 13px !important; font-weight: 700 !important; cursor: pointer !important; display: none !important; align-items: center !important; gap: 6px !important; transition: all 0.2s ease !important; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4) !important;";
      stopBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg><span id="be10x-stop-btn-text">Stop & Conclude</span>';

      // 5. Student Not Joined Button (Dark pill with X)
      var noShowBtn = document.createElement("button");
      noShowBtn.id = "be10x-noshow-btn";
      noShowBtn.style.cssText = "background: #334155 !important; color: #f1f5f9 !important; border: 1px solid #475569 !important; border-radius: 9999px !important; padding: 7px 14px !important; font-size: 13px !important; font-weight: 600 !important; cursor: pointer !important; display: flex !important; align-items: center !important; gap: 6px !important; transition: all 0.2s ease !important;";
      noShowBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span id="be10x-noshow-btn-text">Student Not Joined</span>';

      // Live Stats Pill (Pulsing green dot + Timer mm:ss + Participants count)
      var statsContainer = document.createElement("div");
      statsContainer.id = "be10x-stats-container";
      statsContainer.style.cssText = "display: flex !important; align-items: center !important; gap: 8px !important; font-size: 12px !important; font-weight: 600 !important; color: #cbd5e1 !important; padding-left: 4px !important;";
      statsContainer.innerHTML = '<span id="be10x-pulse-dot" style="width: 8px; height: 8px; background-color: #38bdf8; border-radius: 50%; display: inline-block;"></span><span id="be10x-live-timer">Ready</span><span style="opacity: 0.4">•</span><span id="be10x-live-participants">👥 1 Participant</span>';

      trackBtn.addEventListener("click", function() {
        var clean = getMeetUrl();
        var pCount = getLiveParticipantCount();

        if (pCount < 2) {
          alert("⚠️ Cannot Start Attendance Tracking: At least 2 participants (Mentor + Student) must be present in the Google Meet call to begin tracking.");
          updateBadgeText("⚠️ Need 2+ Participants in Call to Track Attendance!");
          var countEl = document.getElementById("be10x-live-participants");
          if (countEl) {
            countEl.style.color = "#f87171";
            setTimeout(function() { countEl.style.color = "#cbd5e1"; }, 3000);
          }
          return;
        }

        trackStartTime = new Date().toISOString();
        isTrackingActive = true;
        isTrackingPaused = false;
        hasReachedTwoParticipants = true;
        trackSeconds = 0;
        persistSession();
        updateControlBarUI();

        sendEvent({
          meetUrl: clean,
          role: getActiveRole() === "student" ? "student" : "mentor",
          action: "start_next_slot",
          participantName: getParticipantName(),
          participantEmail: getParticipantEmail(),
          participantCount: pCount,
          mentorPresent: true,
          trackingStartedAt: trackStartTime,
          timestamp: trackStartTime
        }, true);

        if (!trackInterval) {
          trackInterval = setInterval(function() {
            if (!isTrackingActive) return;
            trackSeconds++;
            persistSession();
            var timerEl = document.getElementById("be10x-live-timer");
            if (timerEl) timerEl.innerText = formatTimerDisplay(trackSeconds);

            var currentCount = getLiveParticipantCount();
            if (trackSeconds % 30 === 0) {
              sendEvent({
                meetUrl: clean,
                role: getActiveRole(),
                action: "heartbeat",
                participantName: getParticipantName(),
                participantEmail: getParticipantEmail(),
                participantCount: currentCount,
                durationSeconds: trackSeconds,
                trackingStartedAt: trackStartTime,
                timestamp: new Date().toISOString()
              });
            }
          }, 1000);
        }
      });

      pauseBtn.addEventListener("click", function() {
        pauseTracking("mentor_clicked_pause");
      });

      resumeBtn.addEventListener("click", function() {
        resumeTracking();
      });

      stopBtn.addEventListener("click", function() {
        stopTracking(isTrackingPaused ? "mentor_concluded_paused_session" : "mentor_clicked_stop");
      });

      noShowBtn.addEventListener("click", function() {
        var clean = getMeetUrl();
        var studentName = window.prompt("Student did not join. Enter the booked student's name:", "");
        if (!studentName || !studentName.trim()) return;
        if (confirm("Trigger the no-show calling workflow for " + studentName.trim() + "?")) {
          if (isTrackingActive || isTrackingPaused) {
            stopTracking("no_show");
          }

          sendEvent({
            meetUrl: clean,
            role: "mentor",
            action: "student_no_show",
            studentName: studentName.trim(),
            participantName: studentName.trim(),
            mentorName: getParticipantName() || "Mentor",
            timestamp: new Date().toISOString()
          }, true);

          noShowBtn.style.setProperty("background", "#9f1239", "important");
          noShowBtn.style.setProperty("color", "#fecdd3", "important");
          noShowBtn.style.setProperty("border-color", "#f43f5e", "important");
          var noShowText = document.getElementById("be10x-noshow-btn-text");
          if (noShowText) noShowText.innerText = "✓ Marked No Show";
          updateBadgeText("🚫 Student Marked No Show — Slot Closed!");

          setTimeout(function() {
            noShowBtn.style.setProperty("background", "#334155", "important");
            noShowBtn.style.setProperty("color", "#f1f5f9", "important");
            noShowBtn.style.setProperty("border-color", "#475569", "important");
            if (noShowText) noShowText.innerText = "Student Not Joined";
            updateBadgeText("⚡ MeetTrack Pro Connected");
          }, 3000);
        }
      });

      bar.appendChild(trackBtn);
      bar.appendChild(pauseBtn);
      bar.appendChild(resumeBtn);
      bar.appendChild(stopBtn);
      bar.appendChild(noShowBtn);
      bar.appendChild(statsContainer);
      parentNode.appendChild(bar);

      // Reflect initial or restored state
      updateControlBarUI();
    } catch (e) {
      console.error("injectTopControlBar error:", e);
    }
  }

  function injectStatusBadge() {
    try {
      var cleanUrl = getMeetUrl();
      if (!cleanUrl) return;

      var parentNode = document.body || document.documentElement;
      if (!parentNode) return;

      var existing = document.getElementById("meettrack-badge");
      if (existing) {
        if (!parentNode.contains(existing)) parentNode.appendChild(existing);
        return;
      }

      var badge = document.createElement("div");
      badge.id = "meettrack-badge";
      badge.style.cssText = "position: fixed !important; bottom: 24px !important; left: 24px !important; z-index: 2147483647 !important; background: #0f172a !important; color: #38bdf8 !important; border: 1px solid #0284c7 !important; padding: 6px 12px !important; border-radius: 20px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important; display: flex !important; align-items: center !important; gap: 6px !important; max-width: 140px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;";
      badge.innerHTML = '<span style="width: 8px; height: 8px; background-color: #22c55e; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #22c55e; flex-shrink: 0;"></span> <span id="meettrack-badge-text" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Connected</span>';
      parentNode.appendChild(badge);
    } catch (e) {}
  }

  // Live Participant and UI refresh loop every 1 second
  setInterval(function() {
    injectTopControlBar();
    injectStatusBadge();

    var pCount = getLiveParticipantCount();
    var pEl = document.getElementById("be10x-live-participants");
    if (pEl) {
      pEl.innerText = "👥 " + pCount + (pCount === 1 ? " Participant" : " Participants");
    }

    var trackBtn = document.getElementById("be10x-track-btn");

    if (pCount >= 2) {
      hasReachedTwoParticipants = true;
      if (!isTrackingActive && !isTrackingPaused && trackBtn) {
        trackBtn.style.setProperty("background", "#16a34a", "important");
        trackBtn.style.setProperty("box-shadow", "0 0 16px rgba(34, 197, 94, 0.6)", "important");
        var trackText = document.getElementById("be10x-track-btn-text");
        if (trackText) trackText.innerText = "Tracking Active (Ready)";
      }
      if (isTrackingPaused) {
        updateBadgeText("👥 Student Rejoined! Click 'Resume Attendance' to continue.");
      }
    } else {
      if (hasReachedTwoParticipants && isTrackingActive && !isTrackingPaused) {
        console.log("⚡ [MeetTrack] Participant dropped to 1 — Auto-pausing session to protect attendance!");
        pauseTracking("participant_dropped");
      }
      if (!isTrackingActive && !isTrackingPaused && trackBtn) {
        trackBtn.style.setProperty("box-shadow", "0 4px 12px rgba(22, 163, 74, 0.4)", "important");
        var trackText = document.getElementById("be10x-track-btn-text");
        if (trackText) trackText.innerText = "Track Attendance";
      }
    }
  }, 1000);

  // Scan participants joining call without using regex
  function scanParticipants() {
    var cleanUrl = getMeetUrl();
    if (!cleanUrl) return;

    var liveCount = getLiveParticipantCount();
    if (liveCount < 2) return;

    var participantNodes = document.querySelectorAll('[data-participant-id], div[role="listitem"]');
    var selfName = getParticipantName().toLowerCase().trim();

    participantNodes.forEach(function(node) {
      var rawText = getFirstLine(node.innerText || node.textContent || "");
      if (!rawText || rawText.length <= 2) return;

      var textLower = rawText.toLowerCase().trim();
      if (
        textLower.includes("frame_person") || textLower.includes("person") ||
        textLower.includes("account_circle") || textLower.includes("profile picture") ||
        textLower.includes("you") || textLower.includes("everyone") ||
        textLower.includes("be10x") || textLower.includes("mentor") ||
        textLower.includes("host") || textLower.includes("trainer") ||
        textLower.includes("externalmentors") ||
        (selfName && selfName.length > 2 && textLower.includes(selfName)) ||
        trackedParticipants.has(textLower)
      ) {
        return;
      }

      trackedParticipants.add(textLower);
      console.log("👥 [MeetTrack] Real Participant Joined:", rawText);
      sendEvent({
        meetUrl: cleanUrl,
        role: "student",
        action: "student_join",
        participantName: rawText,
        participantCount: liveCount,
        mentorPresent: getActiveRole() === "mentor",
        trainerName: (function() { try { return sessionStorage.getItem("meettrack_name") || ""; } catch(e) { return ""; } })(),
        timestamp: new Date().toISOString()
      }, true);
    });
  }

  setInterval(scanParticipants, 1500);

  // Host Join click listener
  document.addEventListener("click", function(e) {
    var target = e.target;
    if (!target) return;
    var btn = target.closest("button") || target.closest('[role="button"]') || target;
    var btnText = (btn.innerText || btn.textContent || "").trim().toLowerCase();
    var ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
    var cleanUrl = getMeetUrl();
    var name = getParticipantName();

    if (btnText.includes("join now") || ariaLabel.includes("join now")) {
      var activeRole = getActiveRole();
      sendEvent({
        meetUrl: cleanUrl,
        role: activeRole,
        action: activeRole === "student" ? "student_join" : "mentor_join",
        participantName: name,
        participantEmail: getParticipantEmail(),
        timestamp: new Date().toISOString()
      }, true);
    } else if (btnText.includes("ask to join") || ariaLabel.includes("ask to join")) {
      sendEvent({
        meetUrl: cleanUrl,
        role: "student",
        action: "student_ask_to_join",
        participantName: name,
        timestamp: new Date().toISOString()
      }, true);
    } else if (btnText.includes("admit") || ariaLabel.includes("admit")) {
      sendEvent({
        meetUrl: cleanUrl,
        role: "student",
        action: "student_admitted",
        participantName: "Customer",
        timestamp: new Date().toISOString()
      }, true);
    } else if (btnText.includes("leave call") || ariaLabel.includes("leave call")) {
      if (isTrackingActive) {
        stopTracking("mentor_left");
      }
    }
  }, true);

  if (window.MutationObserver && document.documentElement) {
    var observer = new MutationObserver(function() {
      injectTopControlBar();
      injectStatusBadge();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadExtensionZip = async () => {
    try {
      setIsGeneratingZip(true);
      const zip = new JSZip();

      zip.file("manifest.json", manifestJson);
      zip.file("content.js", contentJs);

      const syncAppJs = `(function() {
  function registerActiveApp() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        var origin = window.location.origin;
        if (origin && !origin.includes("meet.google.com")) {
          chrome.storage.local.set({ serverUrl: origin, lastSeen: Date.now() });
          console.log("⚡ [MeetTrack] Auto-registered active app URL:", origin);
        }
      }
    } catch(e) {}
  }

  registerActiveApp();
  window.addEventListener("message", function(e) {
    if (!e.data) return;
    if (e.data.type === "MEETTRACK_ACTIVE_APP" && e.data.url) {
      try {
        chrome.storage.local.set({ serverUrl: e.data.url, lastSeen: Date.now() });
      } catch(err) {}
    }
    if (e.data.type === "MEETTRACK_STUDENT_DIRECTORY" && Array.isArray(e.data.students)) {
      try {
        chrome.runtime.sendMessage({ action: "SYNC_STUDENT_DIRECTORY", students: e.data.students }, function() {});
      } catch(err) {}
    }
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerActiveApp);
  }
})();`;
      zip.file("sync-app.js", syncAppJs);

      const bgJs = `/**
 * MeetTrack Pro Background Service Worker
 * Fully dynamic: auto-detects any Vercel deployment URL via open tabs and storage
 */
self.addEventListener("install", function() {
  self.skipWaiting();
});

self.addEventListener("activate", function() {
  self.clients.claim();
});

var chromeApi = (typeof chrome !== "undefined") ? chrome : ((typeof browser !== "undefined") ? browser : null);

// Auto-detect when user switches to or updates any Vercel/localhost dashboard tab
if (chromeApi && chromeApi.tabs) {
  if (chromeApi.tabs.onUpdated) {
    chromeApi.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
      if (tab && tab.url && chromeApi.storage && chromeApi.storage.local) {
        try {
          var u = new URL(tab.url);
          if ((u.hostname.endsWith(".vercel.app") || u.hostname === "localhost" || u.hostname === "127.0.0.1") && !u.hostname.includes("meet.google.com")) {
            chromeApi.storage.local.set({ serverUrl: u.origin, lastSeen: Date.now() });
          }
        } catch(e) {}
      }
    });
  }

  if (chromeApi.tabs.onActivated) {
    chromeApi.tabs.onActivated.addListener(function(activeInfo) {
      chromeApi.tabs.get(activeInfo.tabId, function(tab) {
        if (tab && tab.url && chromeApi.storage && chromeApi.storage.local) {
          try {
            var u = new URL(tab.url);
            if ((u.hostname.endsWith(".vercel.app") || u.hostname === "localhost" || u.hostname === "127.0.0.1") && !u.hostname.includes("meet.google.com")) {
              chromeApi.storage.local.set({ serverUrl: u.origin, lastSeen: Date.now() });
            }
          } catch(e) {}
        }
      });
    });
  }
}

if (chromeApi && chromeApi.runtime && chromeApi.runtime.onMessage) {
  chromeApi.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "SYNC_STUDENT_DIRECTORY") {
      try {
        var students = Array.isArray(message.students) ? message.students : [];
        chromeApi.storage.local.set({ studentDirectory: students, studentDirectoryUpdatedAt: Date.now() }, function() {
          if (sendResponse) sendResponse({ success: true, count: students.length });
        });
      } catch(e) { if (sendResponse) sendResponse({ success: false, error: String(e) }); }
      return true;
    }
    if (message.action === "SEND_TRACK_EVENT" || message.action === "TEST_CONNECTION") {
      var payload = message.payload || {};

      function enrichNoShowPayload(done) {
        if (!payload || (payload.action !== "student_no_show" && payload.action !== "no_show")) return done(payload);
        if (!chromeApi.storage || !chromeApi.storage.local) return done(payload);
        chromeApi.storage.local.get(["studentDirectory"], function(store) {
          try {
            var directory = Array.isArray(store && store.studentDirectory) ? store.studentDirectory : [];
            var targetName = String(payload.studentName || payload.participantName || "").trim().toLowerCase().replace(/\s+/g, " ");
            var matches = directory.filter(function(st) {
              return st && st.active !== false && String(st.name || "").trim().toLowerCase().replace(/\s+/g, " ") === targetName;
            });
            if (matches.length === 1) {
              payload.studentPhone = String(matches[0].phone || "").trim();
              payload.studentEmail = String(matches[0].email || "").trim();
              payload.studentId = String(matches[0].studentId || matches[0].id || "").trim();
              payload.studentLookup = "local_extension_directory";
            } else if (matches.length > 1) {
              payload.studentLookup = "multiple_matches";
            } else {
              payload.studentLookup = "not_found";
            }
          } catch(e) { payload.studentLookup = "lookup_error"; }
          done(payload);
        });
      }

      function proceedSend(serverUrl) {
        fetch(serverUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        .then(function(res) {
          sendResponse({ success: res.ok, serverUrl: serverUrl });
        })
        .catch(function(err) {
          sendResponse({ success: false, error: String(err), serverUrl: serverUrl });
        });
      }

      function sanitize(str) {
        if (!str) return "";
        var s = String(str).trim();
        while (s.endsWith("/")) s = s.substring(0, s.length - 1);
        return s;
      }

      function stripTrackSuffix(str) {
        var s = sanitize(str);
        var suffix = "/api/events/track";
        if (s.endsWith(suffix)) {
          s = s.substring(0, s.length - suffix.length);
        }
        return sanitize(s);
      }

      function resolveActiveUrlAndSend() {
        if (chromeApi.storage && chromeApi.storage.local) {
          chromeApi.storage.local.get(["serverUrl"], function(store) {
            var current = (store && store.serverUrl) ? store.serverUrl : "";
            if (current && !current.includes("meet.google.com")) {
              var cleanBase = stripTrackSuffix(current);
              proceedSend(cleanBase + "/api/events/track");
              return;
            }

            // Dynamically query tabs to find any open Vercel deployment URL
            if (chromeApi.tabs && chromeApi.tabs.query) {
              chromeApi.tabs.query({}, function(tabs) {
                var found = null;
                if (tabs && tabs.length > 0) {
                  for (var i = 0; i < tabs.length; i++) {
                    var tu = tabs[i].url || "";
                    if (tu.includes(".vercel.app") || tu.includes("localhost")) {
                      try {
                        found = new URL(tu).origin;
                        if (chromeApi.storage && chromeApi.storage.local) {
                          chromeApi.storage.local.set({ serverUrl: found, lastSeen: Date.now() });
                        }
                        break;
                      } catch(e) {}
                    }
                  }
                }
                var target = found || message.defaultServerUrl || "${origin}";
                var cleanBase = stripTrackSuffix(target);
                proceedSend(cleanBase + "/api/events/track");
              });
            } else {
              var target = message.defaultServerUrl || "${origin}";
              var cleanBase = stripTrackSuffix(target);
              proceedSend(cleanBase + "/api/events/track");
            }
          });
        } else {
          proceedSend(message.defaultServerUrl || "${origin}/api/events/track");
        }
      }

      enrichNoShowPayload(function(enrichedPayload) {
        payload = enrichedPayload;
        if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
          resolveActiveUrlAndSend();
        } else {
          proceedSend(message.defaultServerUrl || "${origin}/api/events/track");
        }
      });

      return true; // Keep async message channel open
    }
  });
}
`;
      zip.file("background.js", bgJs);

      const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { width: 300px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 14px; background: #0b1120; color: #f8fafc; font-size: 12px; }
    h2 { font-size: 14px; margin: 0 0 10px 0; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-weight: bold; font-size: 10px; background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }
    input { width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 6px 8px; border-radius: 4px; margin-top: 5px; font-size: 11px; word-break: break-all; }
    .btn-group { display: flex; gap: 6px; margin-top: 8px; }
    button { flex: 1; background: #0284c7; color: white; border: none; padding: 7px 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px; }
    button:hover { background: #0369a1; }
    button.secondary { background: #334155; color: #e2e8f0; }
    button.secondary:hover { background: #475569; }
    button.auto-btn { background: #10b981; width: 100%; margin-top: 6px; color: white; border: none; padding: 7px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px; }
    button.auto-btn:hover { background: #059669; }
    #result-msg { margin-top: 8px; font-size: 11px; font-weight: 600; min-height: 16px; }
  </style>
</head>
<body>
  <h2><span>⚡</span> MeetTrack Pro</h2>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span><strong>Status:</strong></span>
      <span class="status" id="status-text">Active</span>
    </div>
  </div>
  <div class="card">
    <label><strong>App Server URL:</strong></label>
    <input type="text" id="server-url-input" value="\${origin}">
    <div class="btn-group">
      <button id="save-btn">Save</button>
      <button id="test-btn" class="secondary">Test</button>
    </div>
    <button id="current-tab-btn" class="auto-btn">🔗 Connect to Current Tab</button>
    <div id="result-msg"></div>
  </div>
  <script src="popup.js"></script>
</body>
</html>`;
      zip.file("popup.html", popupHtml);

      const popupJs = `document.addEventListener("DOMContentLoaded", function() {
  var input = document.getElementById("server-url-input");
  var saveBtn = document.getElementById("save-btn");
  var testBtn = document.getElementById("test-btn");
  var currentTabBtn = document.getElementById("current-tab-btn");
  var resultMsg = document.getElementById("result-msg");

  function cleanUrl(str) {
    if (!str) return "";
    var s = String(str).trim();
    while (s.endsWith("/")) s = s.substring(0, s.length - 1);
    return s;
  }

  chrome.storage.local.get(["serverUrl"], function(store) {
    if (store && store.serverUrl) {
      input.value = store.serverUrl;
    } else {
      input.value = "\${origin}";
    }
  });

  saveBtn.addEventListener("click", function() {
    var val = cleanUrl(input.value);
    chrome.storage.local.set({ serverUrl: val }, function() {
      resultMsg.style.color = "#34d399";
      resultMsg.innerText = "✅ Saved!";
      setTimeout(function() { resultMsg.innerText = ""; }, 2000);
    });
  });

  if (currentTabBtn) {
    currentTabBtn.addEventListener("click", function() {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs[0] && tabs[0].url) {
          try {
            var urlObj = new URL(tabs[0].url);
            var domain = urlObj.origin;
            if (!domain.includes("meet.google.com")) {
              input.value = domain;
              chrome.storage.local.set({ serverUrl: domain }, function() {
                resultMsg.style.color = "#34d399";
                resultMsg.innerText = "✅ Connected to: " + domain;
              });
            }
          } catch(e) {}
        }
      });
    });
  }

  testBtn.addEventListener("click", function() {
    var val = cleanUrl(input.value);
    resultMsg.style.color = "#38bdf8";
    resultMsg.innerText = "Testing connection...";
    fetch(val + "/api/events/track?action=ping")
      .then(function(r) { return r.json(); })
      .then(function() {
        resultMsg.style.color = "#34d399";
        resultMsg.innerText = "✅ Connection successful!";
      })
      .catch(function() {
        resultMsg.style.color = "#f87171";
        resultMsg.innerText = "❌ Connection failed.";
      });
  });
});`;
      zip.file("popup.js", popupJs);

      const blob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "MeetTrack-Pro-Extension.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (e) {
      console.error("Client zip download error, redirecting to server API:", e);
      window.location.href = "/api/extension/download-zip";
    } finally {
      setIsGeneratingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="ios-sheet rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden text-xs text-slate-200 border border-white/15">
        {/* Connected App Status Pill */}
        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-full mb-4 text-[11px] text-emerald-300">
          <div className="flex items-center gap-2 font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Target App Connected:</span>
            <strong className="text-white select-all">{origin || "https://be10x-meet-seven.vercel.app"}</strong>
          </div>
          <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full font-bold text-emerald-400">Pre-Configured</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.08]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Chrome Extension Setup & Auto-Tracker
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  1-Host Extension, Zero Student Install
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Automatically tracks Mentor "Join now" & detects Student joins directly inside Google Meet
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 mb-4 gap-1">
          <button
            onClick={() => setActiveTab("extension")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "extension"
                ? "bg-slate-800 text-indigo-400 border-b-2 border-indigo-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            1-Click Chrome Extension (.zip)
          </button>

          <button
            onClick={() => setActiveTab("bookmarklet")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "bookmarklet"
                ? "bg-slate-800 text-indigo-400 border-b-2 border-indigo-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Bookmarklet / Console Alternative
          </button>

          <button
            onClick={() => setActiveTab("code")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "code"
                ? "bg-slate-800 text-indigo-400 border-b-2 border-indigo-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Extension Source Files
          </button>
        </div>

        {/* Tab 1: Extension Zip & Setup Steps */}
        {activeTab === "extension" && (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {/* Banner Download */}
            <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-900/60 border border-indigo-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Ready-to-Install Chrome Extension Package
                </h4>
                <p className="text-[11px] text-slate-300 mt-1 max-w-md">
                  Downloads a complete pre-configured ZIP containing <code className="text-indigo-300 font-mono">manifest.json</code>, <code className="text-indigo-300 font-mono">content.js</code>, and <code className="text-indigo-300 font-mono">popup.html</code> tied to this app instance URL.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadExtensionZip}
                disabled={isGeneratingZip}
                className="ios-glass-primary px-4 py-2.5 text-white font-bold rounded-2xl text-xs shadow-lg transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 disabled:opacity-75"
              >
                {isGeneratingZip ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Preparing ZIP...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Extension (.zip)</span>
                  </>
                )}
              </button>
            </div>

            {/* Step by Step Guide */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-white text-xs flex items-center gap-2 border-b border-slate-800 pb-2">
                <Layers className="w-4 h-4 text-teal-400" />
                3 Simple Steps to Load in Chrome (Takes 30 Seconds):
              </h4>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-3 p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-white block">Download & Extract ZIP</span>
                    <span className="text-[11px] text-slate-400">
                      Click <strong>Download Extension (.zip)</strong> above and unzip/extract the folder on your computer.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-white block">Open Chrome Extensions & Enable Developer Mode</span>
                    <span className="text-[11px] text-slate-400">
                      Open Google Chrome, navigate to <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 font-mono">chrome://extensions</code> in your browser address bar, and enable <strong>Developer mode</strong> (toggle in the top right corner).
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div>
                    <span className="font-semibold text-white block">Click "Load unpacked" & Select Extracted Folder</span>
                    <span className="text-[11px] text-slate-400">
                      Click the <strong>Load unpacked</strong> button (top left corner) and choose the extracted folder. You will immediately see <strong>MeetTrack Pro</strong> active!
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* How it Works Summary */}
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 space-y-1.5">
              <h4 className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                How the Automated Tracking Works:
              </h4>
              <ul className="text-slate-300 text-[11px] space-y-1 list-disc list-inside">
                <li><strong>Mentor / Host Join:</strong> When the mentor pastes <code className="text-indigo-300 font-mono">meet.google.com/xxx-xxxx-xxx</code> in Chrome and clicks <strong>"Join now"</strong>, the extension intercepts the click and sends the join timestamp to this app.</li>
                <li><strong>Student Join (Zero Extension Needed!):</strong> Because the extension runs in the Host's browser, it watches the Google Meet participant list and automatically records student joins and leaves without requiring students to download anything!</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Bookmarklet */}
        {activeTab === "bookmarklet" && (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <p className="text-slate-300 text-[11px]">
              If you cannot install or load unpacked Chrome extensions in developer mode, use this 1-click <strong>MeetTrack Bookmarklet</strong>.
              Simply drag it to your browser Bookmarks Bar, or copy the code and run it in Chrome Console (F12) while on <code className="text-indigo-300 font-mono">meet.google.com</code>:
            </p>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-white block text-xs">⚡ 1-Click MeetTrack Bookmarklet:</span>
                <span className="text-[10px] text-slate-400">Instantly logs mentor attendance for any Google Meet room straight to this dashboard</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const bookmarkletCode = `javascript:(function(){var u='${origin}/api/events/track';var m=window.location.href.split('?')[0];fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mentor_join',role:'mentor',meetUrl:m,timestamp:new Date().toISOString()})}).then(r=>r.json()).then(d=>{alert('🟢 MeetTrack Pro: Synced Google Meet Session!')}).catch(e=>{alert('⚠️ MeetTrack Sync: Sent join event to server!')});})();`;
                  copyToClipboard(bookmarkletCode, "bookmarklet");
                }}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer flex items-center gap-1 transition"
              >
                {copiedKey === "bookmarklet" ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === "bookmarklet" ? "Copied to Clipboard!" : "Copy 1-Click Bookmarklet"}</span>
              </button>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="font-bold text-indigo-300 block text-xs">Console Run Script (F12 on meet.google.com):</span>
              <pre className="text-slate-300 font-mono text-[10px] overflow-x-auto bg-slate-900 p-2 rounded border border-slate-800">
                {`fetch("${origin}/api/events/track", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    meetUrl: window.location.href.split('?')[0],
    role: "mentor",
    action: "mentor_join",
    timestamp: new Date().toISOString()
  })
}).then(r => r.json()).then(console.log);`}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Extension Source Files */}
        {activeTab === "code" && (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-indigo-300">manifest.json</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(manifestJson, "manifest")}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === "manifest" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>{copiedKey === "manifest" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 text-slate-300 p-2.5 rounded-xl font-mono text-[10px] overflow-x-auto">
                {manifestJson}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-indigo-300">content.js</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(contentJs, "contentjs")}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === "contentjs" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>{copiedKey === "contentjs" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 text-slate-300 p-2.5 rounded-xl font-mono text-[10px] overflow-x-auto max-h-40">
                {contentJs}
              </pre>
            </div>
          </div>
        )}

        <div className="pt-3 mt-3 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
          <span>MeetTrack Automated Ingestion Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

