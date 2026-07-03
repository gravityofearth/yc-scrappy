/**
 * Parses a "last seen" string (e.g. "3 days ago", "1 week ago") into the number of days ago.
 * Used for filtering profiles by "last seen before N days" (show profiles last seen >= N days ago).
 */
export function lastSeenToDaysAgo(lastSeen: string): number | null {
  if (!lastSeen || typeof lastSeen !== "string") return null;
  const s = lastSeen.trim().toLowerCase();
  if (!s) return null;

  // "today" -> 0
  if (/^today$/i.test(s)) return 0;
  // "yesterday" -> 1
  if (/^yesterday$/i.test(s)) return 1;

  // "X hour(s) ago"
  const hoursMatch = s.match(/^(\d+)\s*hour(s)?\s*ago$/);
  if (hoursMatch) {
    const h = parseInt(hoursMatch[1], 10);
    return Math.max(0, Math.ceil(h / 24));
  }

  // "X day(s) ago" or "a day ago"
  const dayMatch = s.match(/^(?:a\s+)?(\d+)\s*day(s)?\s*ago$/);
  if (dayMatch) return parseInt(dayMatch[1], 10);
  if (/^a day ago$/i.test(s)) return 1;

  // "X week(s) ago" or "a week ago"
  const weekMatch = s.match(/^(?:a\s+)?(\d+)\s*week(s)?\s*ago$/);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7;
  if (/^a week ago$/i.test(s)) return 7;

  // "X month(s) ago" or "a month ago"
  const monthMatch = s.match(/^(?:a\s+)?(\d+)\s*month(s)?\s*ago$/);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 30;
  if (/^a month ago$/i.test(s)) return 30;

  // "X year(s) ago" or "a year ago"
  const yearMatch = s.match(/^(?:a\s+)?(\d+)\s*year(s)?\s*ago$/);
  if (yearMatch) return parseInt(yearMatch[1], 10) * 365;
  if (/^a year ago$/i.test(s)) return 365;

  return null;
}
