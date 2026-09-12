/**
 * Display formatting for distances and durations. Shared by the summary bar and the
 * inter-card leg rows so the two can never disagree about the same number.
 */

/** 5_400 → "5.4 km", 52_000 → "52 km", 800 → "800 m". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Long form for totals: 15_600 → "4h 20m". */
export function formatDurationLong(seconds: number): string {
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Short form for a single leg: 960 → "16 min", 5_400 → "1h 30m". */
export function formatDurationShort(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 90) return `${mins} min`;
  return formatDurationLong(seconds);
}

/**
 * Spoken form for screen readers — "4 hours 20 minutes", not "4h 20m", which
 * VoiceOver reads as "four h twenty m".
 */
export function formatDurationSpoken(seconds: number): string {
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m > 0) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 minutes';
}

export function formatDistanceSpoken(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} metres`;
  const km = metres / 1000;
  const v = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${v} kilometres`;
}

/** A leg's durationS is undefined when it has no road route (RouteLeg.mode
 * 'direct') — there's no real travel time to show. Never render that as "0 min",
 * which formatDurationShort would happily do for a literal 0; say so instead. */
export function formatLegDuration(seconds: number | undefined): string {
  return seconds == null ? 'no driving time' : formatDurationShort(seconds);
}
