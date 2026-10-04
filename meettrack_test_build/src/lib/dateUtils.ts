/**
 * Get Date in Indian Standard Time (IST, UTC+5:30).
 * Prevents UTC offset shifts when running on Vercel, Node servers, or foreign browsers.
 */
export function getISTDate(d: Date = new Date()): Date {
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (330 * 60000));
}

/**
 * Get minutes of day in Indian Standard Time (0 - 1439).
 */
export function getISTMinutesOfDay(d: Date = new Date()): number {
  const ist = getISTDate(d);
  return ist.getHours() * 60 + ist.getMinutes();
}

/**
 * Format a Date object into IST YYYY-MM-DD string.
 */
export function getLocalDateString(d: Date = new Date()): string {
  const ist = getISTDate(d);
  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, "0");
  const day = String(ist.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayString(): string {
  return getLocalDateString(new Date());
}

export function getTomorrowString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return getLocalDateString(d);
}

export function getOffsetDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return getLocalDateString(d);
}

export function parseISTDateTime(dateStr?: string, startTimeStr?: string): Date {
  const dStr = typeof dateStr === "string" && dateStr.trim() ? dateStr.trim() : getTodayString();
  if (!startTimeStr || typeof startTimeStr !== "string") return new Date();
  const timeClean = startTimeStr.split("-")[0].trim().toUpperCase();
  const isPm = timeClean.includes("PM");
  const isAm = timeClean.includes("AM");
  const rawParts = timeClean.replace(/(AM|PM)/g, "").trim().split(":");
  let h = parseInt(rawParts[0], 10) || 0;
  const m = parseInt(rawParts[1], 10) || 0;
  if (isPm && h < 12) h += 12;
  if (isAm && h === 12) h = 0;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  
  const d = new Date(`${dStr}T${hh}:${mm}:00+05:30`);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr || typeof timeStr !== "string") return 9999;
  const clean = timeStr.trim().toUpperCase();
  const isPm = clean.includes("PM");
  const isAm = clean.includes("AM");
  const parts = clean.replace(/(AM|PM)/g, "").trim().split(":");
  if (parts.length < 2) return 9999;
  let hour = parseInt(parts[0], 10) || 0;
  const minute = parseInt(parts[1], 10) || 0;
  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function isSlotDurationEnded(dateStr?: string, endTimeStr?: string): boolean {
  if (!endTimeStr) return false;
  const todayStr = getTodayString();
  const dStr = dateStr || todayStr;

  if (dStr < todayStr) return true;
  if (dStr > todayStr) return false;

  const endMinutes = parseTimeToMinutes(endTimeStr);
  if (endMinutes === 9999) return false;
  const currentMinutes = getISTMinutesOfDay(new Date());

  return currentMinutes >= endMinutes;
}
