const fs = require('fs');
const path = require('path');

const targetPaths = [
  'C:\\Users\\Admin\\Downloads\\MeetTrack-Pro-Extension (1)\\content.js',
  'C:\\Users\\Admin\\Downloads\\project\\content.js'
];

targetPaths.forEach((filePath) => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Helper functions
  const helperCode = `
  function isExtensionValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local);
    } catch(e) {
      return false;
    }
  }

  function getFallbackServerUrl() {
    try {
      var cached = localStorage.getItem('meettrack_active_server_url');
      if (cached && !cached.includes('\${origin}') && cached.startsWith('http')) {
        return cleanServerUrl(cached);
      }
    } catch(e) {}
    return 'https://be10x-meet-seven.vercel.app';
  }
`;

  if (!content.includes('function isExtensionValid()')) {
    content = content.replace('var defaultBase = cleanServerUrl("${origin}");', helperCode + '\n  var defaultBase = cleanServerUrl(getFallbackServerUrl());');
  }

  // Wrap the initial chrome.storage.local.get safely
  const targetInitialStorage = `  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["serverUrl"], function(res) {
      if (res && res.serverUrl) {
        defaultBase = cleanServerUrl(res.serverUrl);
        DEFAULT_SERVER_URL = defaultBase + "/api/events/track";
      }
    });
  }`;

  const replacementInitialStorage = `  if (isExtensionValid()) {
    try {
      chrome.storage.local.get(["serverUrl"], function(res) {
        if (!chrome.runtime.lastError && res && res.serverUrl) {
          defaultBase = cleanServerUrl(res.serverUrl);
          DEFAULT_SERVER_URL = defaultBase + "/api/events/track";
          try { localStorage.setItem('meettrack_active_server_url', defaultBase); } catch(e) {}
        }
      });
    } catch(e) {}
  }`;

  if (content.includes(targetInitialStorage)) {
    content = content.replace(targetInitialStorage, replacementInitialStorage);
  }

  // Replace directFetch and sendEvent
  const directIdx = content.indexOf('  function directFetch(payload) {');
  const countIdx = content.indexOf('  function getLiveParticipantCount() {');

  if (directIdx !== -1 && countIdx !== -1 && countIdx > directIdx) {
    const targetDirectFetchAndSend = content.substring(directIdx, countIdx);

    const newDirectFetchAndSend = `  function directFetch(payload) {
    function doFetch(url) {
      var target = url;
      if (!target || target.includes('\${origin}') || !target.startsWith('http')) {
        target = getFallbackServerUrl();
      }
      if (!target.endsWith('/api/events/track')) target = target + '/api/events/track';
      try {
        localStorage.setItem('meettrack_active_server_url', target.replace('/api/events/track', ''));
      } catch(e) {}

      fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      })
      .then(function(res) {
        if (res.ok) {
          updateBadgeText('🟢 Connected & Synced');
        } else {
          queueOfflineEvent(payload);
        }
      })
      .catch(function() {
        queueOfflineEvent(payload);
        updateBadgeText('⚡ Offline (Buffering...)');
      });
    }

    var handled = false;
    if (isExtensionValid()) {
      try {
        chrome.storage.local.get(['serverUrl'], function(store) {
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
    var action = payload ? payload.action : 'ping';
    var eventKey = action + ':' + (payload.meetUrl || '') + ':' + (payload.participantName || '');
    var lastSent = lastSentEvents.get(eventKey) || 0;
    var isCritical = action === 'start_next_slot' || action === 'end_meeting' || action === 'student_no_show' || action === 'leave' || bypassThrottle;

    if (!isCritical && (now - lastSent < 10000)) return;
    lastSentEvents.set(eventKey, now);

    var sentViaChrome = false;
    if (isExtensionValid()) {
      try {
        chrome.storage.local.get(['serverUrl'], function(store) {
          if (chrome.runtime.lastError) {
            directFetch(payload);
            return;
          }
          var base = (store && store.serverUrl) ? cleanServerUrl(store.serverUrl) : getFallbackServerUrl();
          if (!base.endsWith('/api/events/track')) base = base + '/api/events/track';
          try {
            chrome.runtime.sendMessage({
              action: 'SEND_TRACK_EVENT',
              defaultServerUrl: base,
              payload: payload
            }, function(response) {
              if (chrome.runtime.lastError || !response || !response.success) {
                directFetch(payload);
              } else {
                updateBadgeText('🟢 Connected & Synced');
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

`;

    content = content.replace(targetDirectFetchAndSend, newDirectFetchAndSend);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${filePath} successfully`);
  }
});
