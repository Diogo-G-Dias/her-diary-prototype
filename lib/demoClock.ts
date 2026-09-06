// A fictional calendar for the demo so the seeds line up:
// day 0 is Wed 6 Sep, the presentation is Thu 7 Sep, "Come back in 2 days" lands on Fri 8 Sep.
const BASE = new Date(Date.UTC(2026, 8, 6)); // 6 Sep 2026
const WEEKDAYS = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function dateAt(offsetDays: number): Date {
  const d = new Date(BASE);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

export function shortDate(offsetDays: number): string {
  return fmt(dateAt(offsetDays));
}

export function weekday(offsetDays: number): string {
  return WEEKDAYS[((offsetDays % 7) + 7) % 7];
}

export function isoAt(offsetDays: number): string {
  return dateAt(offsetDays).toISOString().slice(0, 10);
}

export function isExpired(expiresAt: string | undefined, offsetDays: number): boolean {
  if (!expiresAt) return false;
  return isoAt(offsetDays) > expiresAt;
}

export function shortIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return fmt(new Date(Date.UTC(y, m - 1, d)));
}
