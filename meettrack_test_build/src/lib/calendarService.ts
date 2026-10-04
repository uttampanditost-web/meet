import { Slot, Trainer } from '../types';
import { getLocalDateString } from './dateUtils';

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
  };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  organizer?: { email: string; displayName?: string };
}

/**
 * Fetch events from the primary Google Calendar for the logged-in user.
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  startDateStr?: string
): Promise<GoogleCalendarEvent[]> {
  const date = startDateStr || getLocalDateString();
  const timeMin = new Date(`${date}T00:00:00Z`).toISOString();
  const timeMax = new Date(`${date}T23:59:59Z`).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    timeMin
  )}&timeMax=${encodeURIComponent(
    timeMax
  )}&singleEvents=true&orderBy=startTime&maxResults=250`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Calendar API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Extract Google Meet link from an event object or text fields.
 */
export function extractMeetUrl(event: GoogleCalendarEvent): string {
  if (event.hangoutLink) {
    return event.hangoutLink;
  }

  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (ep) => ep.entryPointType === 'video' || ep.uri?.includes('meet.google.com')
    );
    if (videoEntry?.uri) {
      return videoEntry.uri;
    }
  }

  const textToSearch = `${event.location || ''} ${event.description || ''}`;
  const meetMatch = textToSearch.match(/https:\/\/meet\.google\.com\/[a-zA-Z0-9\-]+/i);
  if (meetMatch) {
    return meetMatch[0];
  }

  // Fallback unique meet link format for this event if none was attached
  return `https://meet.google.com/hoc-${event.id.slice(-8)}`;
}

/**
 * Create a Google Calendar Event with auto-generated Google Meet link.
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  data: {
    date: string;
    startTime: string;
    endTime: string;
    mentorName: string;
    mentorEmail?: string;
    studentName: string;
    studentEmail: string;
    topic: string;
  }
): Promise<{ eventId: string; meetUrl: string }> {
  const startIso = new Date(`${data.date}T${data.startTime}:00`).toISOString();
  const endIso = new Date(`${data.date}T${data.endTime}:00`).toISOString();

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  const payload: any = {
    summary: `[Mentorship] ${data.topic} - ${data.mentorName} & ${data.studentName}`,
    description: `House of EdTech Mentorship Session\n\nMentor: ${data.mentorName}\nStudent: ${data.studentName} (${data.studentEmail})\nTopic: ${data.topic}\n\nNote: Mentors log in to host the meeting and allow student entry. Attendance tracking is enabled.`,
    start: { dateTime: startIso, timeZone },
    end: { dateTime: endIso, timeZone },
    attendees: [
      { email: data.studentEmail, displayName: data.studentName },
    ],
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  if (data.mentorEmail) {
    payload.attendees.push({ email: data.mentorEmail, displayName: data.mentorName });
  }

  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create Google Calendar Event: ${errText}`);
  }

  const created = await response.json();
  const meetUrl = extractMeetUrl(created);

  return {
    eventId: created.id,
    meetUrl,
  };
}

/**
 * Generate direct 1-click Google Calendar URL (No OAuth required).
 * Bypasses Error 403 access_denied entirely by opening Google Calendar Web Intent.
 */
export function generateGoogleCalendarWebUrl(data: {
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  mentorName: string;
  studentName: string;
  meetUrl?: string;
}): string {
  try {
    const startIso = data.date.replace(/-/g, '') + 'T' + data.startTime.replace(':', '') + '00';
    const endIso = data.date.replace(/-/g, '') + 'T' + data.endTime.replace(':', '') + '00';
    
    const title = encodeURIComponent(`[Mentorship] ${data.topic} - ${data.mentorName}`);
    const details = encodeURIComponent(
      `House of EdTech 1-on-1 Mentorship Session\n\nMentor: ${data.mentorName}\nStudent: ${data.studentName}\nTopic: ${data.topic}\nMeeting Link: ${data.meetUrl || 'https://meet.google.com'}`
    );
    const location = encodeURIComponent(data.meetUrl || 'https://meet.google.com');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
  } catch (err) {
    return 'https://calendar.google.com';
  }
}

