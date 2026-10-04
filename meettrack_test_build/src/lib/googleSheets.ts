import { AttendanceLog, Trainer } from '../types';
import { parseTimeToMinutes } from './supabaseService';

export interface GoogleSheetSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowsCount: number;
  sheetTitle: string;
}

const STORAGE_KEY_SPREADSHEET_ID = 'meettrack_google_sheet_id';
const STORAGE_KEY_SPREADSHEET_URL = 'meettrack_google_sheet_url';
const STORAGE_KEY_AUTO_SYNC = 'meettrack_google_sheet_autosync';

export const getSavedSpreadsheetInfo = () => {
  return {
    spreadsheetId: localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID),
    spreadsheetUrl: localStorage.getItem(STORAGE_KEY_SPREADSHEET_URL),
    autoSync: localStorage.getItem(STORAGE_KEY_AUTO_SYNC) === 'true',
  };
};

export const setAutoSyncPreference = (enabled: boolean) => {
  localStorage.setItem(STORAGE_KEY_AUTO_SYNC, enabled ? 'true' : 'false');
};

const formatTimeOnly = (isoString: string | null | undefined): string => {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--';
  }
};

const calculateJoinDelay = (
  scheduledStartTimeStr?: string,
  actualIsoTimestamp?: string | null,
  dateStr?: string
): number => {
  if (!actualIsoTimestamp || !scheduledStartTimeStr) return 0;
  const actualDate = new Date(actualIsoTimestamp);
  if (isNaN(actualDate.getTime())) return 0;

  const timeClean = scheduledStartTimeStr.trim().toUpperCase();
  const isPm = timeClean.includes('PM');
  const isAm = timeClean.includes('AM');
  const rawParts = timeClean.replace(/(AM|PM)/g, '').trim().split(':');
  if (rawParts.length < 2) return 0;

  let schedHour = parseInt(rawParts[0], 10) || 0;
  const schedMinute = parseInt(rawParts[1], 10) || 0;

  if (isPm && schedHour < 12) schedHour += 12;
  if (isAm && schedHour === 12) schedHour = 0;

  if (dateStr && dateStr.length === 10) {
    const schedDate = new Date(
      `${dateStr}T${schedHour.toString().padStart(2, '0')}:${schedMinute.toString().padStart(2, '0')}:00`
    );
    if (!isNaN(schedDate.getTime())) {
      const diffMs = actualDate.getTime() - schedDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (Math.abs(diffMins) < 180) {
        return Math.max(0, diffMins);
      }
    }
  }

  const actualMinutesOfDay = actualDate.getHours() * 60 + actualDate.getMinutes();
  const schedMinutesOfDay = schedHour * 60 + schedMinute;
  let delay = actualMinutesOfDay - schedMinutesOfDay;
  if (delay > 720) delay -= 1440;
  if (delay < -720) delay += 1440;

  return Math.max(0, delay);
};

const resolveDisplayName = (name?: string | null, email?: string | null): string => {
  if (name && name !== "Customer" && name !== "Customer / Student" && name !== "Student" && name !== "Guest" && name !== "Open Slot" && name.trim().length > 1) {
    return name.trim();
  }
  if (email && email.includes("@")) {
    const prefix = email.split("@")[0].trim().replace(/[._-]+/g, " ");
    const words = prefix.split(/\s+/).map((w) => {
      const match = w.match(/^([a-zA-Z]+)(\d+)?$/);
      if (match) {
        const letters = match[1];
        const digits = match[2] ? ` ${match[2]}` : "";
        return letters.charAt(0).toUpperCase() + letters.slice(1) + digits;
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
    const derived = words.join(" ").trim();
    if (derived) return derived;
  }
  return name && name.trim() ? name.trim() : "Student";
};

export const hasSlotParticipation = (log: AttendanceLog): boolean => {
  const hasMentor = Boolean(log.mentorJoinedAt && typeof log.mentorJoinedAt === 'string' && log.mentorJoinedAt.trim() !== '');
  const hasStudent = Boolean(
    (log.studentJoinedAt && typeof log.studentJoinedAt === 'string' && log.studentJoinedAt.trim() !== '') ||
    (log.askToJoinTime && typeof log.askToJoinTime === 'string' && log.askToJoinTime.trim() !== '') ||
    (log.joinRequests && Array.isArray(log.joinRequests) && log.joinRequests.length > 0)
  );
  const hasDuration = Boolean(
    (log.trackedDurationSeconds !== undefined && log.trackedDurationSeconds !== null && log.trackedDurationSeconds > 0) ||
    (log.totalOverlapMinutes !== null && log.totalOverlapMinutes !== undefined && log.totalOverlapMinutes > 0)
  );
  return hasMentor || hasStudent || hasDuration;
};

export class GoogleSheetsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleSheetsAuthError";
  }
}

export const syncToGoogleSheets = async (
  accessToken: string,
  logs: AttendanceLog[],
  trainers: Trainer[],
  customSpreadsheetId?: string
): Promise<GoogleSheetSyncResult> => {
  if (!accessToken) {
    throw new GoogleSheetsAuthError('Google OAuth access token is required. Please sign in with Google.');
  }

  let spreadsheetId = customSpreadsheetId || localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID);
  let isNewSheet = false;

  // Verify existing spreadsheet if present
  if (spreadsheetId) {
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!checkRes.ok) {
        if (checkRes.status === 401 || checkRes.status === 403) {
          const errData = await checkRes.json().catch(() => ({}));
          throw new GoogleSheetsAuthError(
            errData.error?.message || 'Request had invalid or expired authentication credentials. Please re-connect your Google Account.'
          );
        }
        if (checkRes.status === 404) {
          // Not found, recreate
          spreadsheetId = null;
        }
      }
    } catch (e) {
      if (e instanceof GoogleSheetsAuthError) {
        throw e;
      }
      // Network or other error
      spreadsheetId = null;
    }
  }

  // Create new spreadsheet if needed
  if (!spreadsheetId) {
    isNewSheet = true;
    const now = new Date();
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `MeetTrack Attendance Master (${now.toLocaleDateString()})`,
        },
        sheets: [
          {
            properties: {
              title: 'Attendance Records',
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      if (createRes.status === 401 || createRes.status === 403) {
        throw new GoogleSheetsAuthError(
          err.error?.message || 'Request had invalid or expired authentication credentials. Please sign in with Google again.'
        );
      }
      throw new Error(err.error?.message || 'Failed to create Google Spreadsheet.');
    }

    const createdData = await createRes.json();
    spreadsheetId = createdData.spreadsheetId;
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, spreadsheetId!);
  localStorage.setItem(STORAGE_KEY_SPREADSHEET_URL, spreadsheetUrl);

  // Headers
  const headers = [
    'Date',
    'Scheduled Slot',
    'Mentor Name',
    'Student Name',
    'Student Email',
    'Mentor Joined At',
    'Mentor Left At',
    'Mentor Delay (Mins)',
    'Student Joined At',
    'Student Left At',
    'Student Delay (Mins)',
    'Total Duration of Session (Mins)',
    'Status',
    'Meet Room URL',
    'Remark',
    'Last Synchronized',
  ];

  // Map rows - strictly include ONLY slots where mentor joined OR student joined
  const nowIso = new Date().toISOString();
  const attendedLogs = [...logs].filter(hasSlotParticipation).sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    const timeA = parseTimeToMinutes(a.scheduledStartTime);
    const timeB = parseTimeToMinutes(b.scheduledStartTime);
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return (a.trainerName || "").localeCompare(b.trainerName || "");
  });
  const rows = attendedLogs.map((l) => {
    const mentorDelay =
      calculateJoinDelay(l.scheduledStartTime, l.mentorJoinedAt, l.date) ||
      (l.mentorJoinDelayMinutes ?? 0);
    const studentDelay =
      calculateJoinDelay(l.scheduledStartTime, l.askToJoinTime || l.studentJoinedAt, l.date) ||
      (l.studentJoinDelayMinutes ?? 0);

    const hasStudentJoined = Boolean(
      (l.studentJoinedAt && l.studentJoinedAt.trim() !== '') ||
      (l.askToJoinTime && l.askToJoinTime.trim() !== '')
    );
    const hasMentorJoined = Boolean(l.mentorJoinedAt && l.mentorJoinedAt.trim() !== '');

    const hasAttended =
      Boolean((l.trackedDurationSeconds && l.trackedDurationSeconds > 30) || (l.totalOverlapMinutes && l.totalOverlapMinutes > 0));
    const isNoShow = !hasAttended && (l.status === 'no_show' || (hasMentorJoined && !hasStudentJoined));
    const isMentorLate = Boolean((typeof mentorDelay === 'number' && mentorDelay > 0) || (l.mentorJoinDelayMinutes && l.mentorJoinDelayMinutes > 0));
    const statusLabel = isNoShow
      ? (isMentorLate ? '🚫 No Show & Mentor Late' : '🚫 No Show')
      : l.status === 'completed' || hasAttended
      ? '✅ Completed'
      : l.status === 'mentor_late' || isMentorLate
      ? '⚠️ Mentor Late'
      : l.status === 'student_late'
      ? '⚠️ Student Late'
      : l.trackingActive || l.status === 'in_progress'
      ? '🔴 Live In Call'
      : 'Scheduled';

    // Requirement: If no student joined, session could not take place -> strictly 0 duration!
    const totalDurationMins = (!hasStudentJoined || !hasMentorJoined || isNoShow)
      ? 0
      : l.totalOverlapMinutes !== null && l.totalOverlapMinutes !== undefined && l.totalOverlapMinutes > 0
      ? l.totalOverlapMinutes
      : l.trackedDurationSeconds && l.trackedDurationSeconds > 0
      ? Math.max(1, Math.round(l.trackedDurationSeconds / 60))
      : 0;

    let remarkText = "Both On-Time";
    if (!hasMentorJoined && !hasStudentJoined) {
      remarkText = "Neither Joined (Unattended)";
    } else if (!hasMentorJoined && hasStudentJoined) {
      remarkText = "Mentor Did Not Join";
    } else if (hasMentorJoined && !hasStudentJoined) {
      remarkText = isMentorLate ? `Student No Show (Mentor joined ${mentorDelay}m late)` : "Student No Show";
    } else {
      const isStudentLate = Boolean(studentDelay && studentDelay > 0);
      if (isMentorLate && isStudentLate) {
        remarkText = `Both Late (Mentor joined ${mentorDelay}m late, Student joined ${studentDelay}m late)`;
      } else if (isMentorLate) {
        remarkText = `Mentor Late (Mentor joined ${mentorDelay}m late)`;
      } else if (isStudentLate) {
        remarkText = `Student Late (Student joined ${studentDelay}m late)`;
      } else {
        remarkText = "Both On-Time";
      }
    }

    return [
      l.date,
      `${l.scheduledStartTime} - ${l.scheduledEndTime}`,
      l.trainerName || 'Mentor',
      resolveDisplayName(l.studentName, l.studentEmail),
      l.studentEmail || '',
      l.mentorJoinedAt ? formatTimeOnly(l.mentorJoinedAt) : 'Not Joined',
      l.mentorLeftAt
        ? formatTimeOnly(l.mentorLeftAt)
        : l.status === 'completed' || isNoShow
        ? 'Ended'
        : l.mentorJoinedAt
        ? 'In Call'
        : 'Pending',
      mentorDelay,
      isNoShow
        ? 'Did Not Join (No Show)'
        : l.studentJoinedAt || l.askToJoinTime
        ? formatTimeOnly(l.studentJoinedAt || l.askToJoinTime)
        : 'Not Joined',
      isNoShow
        ? 'No Show'
        : l.studentLeftAt
        ? formatTimeOnly(l.studentLeftAt)
        : l.status === 'completed'
        ? 'Ended'
        : l.studentJoinedAt
        ? 'In Call'
        : 'Pending',
      studentDelay,
      totalDurationMins,
      statusLabel,
      l.meetUrl || '',
      remarkText,
      formatTimeOnly(nowIso),
    ];
  });

  const valuesPayload = [headers, ...rows];

  // Write values to Sheet
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:P${valuesPayload.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: valuesPayload,
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    if (updateRes.status === 401 || updateRes.status === 403) {
      throw new GoogleSheetsAuthError(
        err.error?.message || 'Request had invalid or expired authentication credentials. Please sign in with Google again.'
      );
    }
    throw new Error(err.error?.message || 'Failed to update Google Sheet data.');
  }

  // Format header row style if new sheet
  if (isNewSheet) {
    try {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.1, green: 0.12, blue: 0.28 },
                    textFormat: {
                      foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                      fontSize: 10,
                      bold: true,
                    },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: 0,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 16,
                },
              },
            },
          ],
        }),
      });
    } catch (e) {
      console.warn('Could not apply advanced formatting to sheet:', e);
    }
  }

  return {
    spreadsheetId: spreadsheetId!,
    spreadsheetUrl,
    rowsCount: rows.length,
    sheetTitle: `MeetTrack Attendance Master`,
  };
};
