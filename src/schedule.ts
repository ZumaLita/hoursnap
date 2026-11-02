// Each person sets when they can snap: school days, weekends and holidays.
export type Window = { on: boolean; start: number; end: number };
export type Schedule = { weekday: Window; weekend: Window; holiday: Window; onHoliday: boolean };

export const DEFAULT_SCHEDULE: Schedule = {
  weekday: { on: true, start: 16, end: 21 },
  weekend: { on: true, start: 10, end: 21 },
  holiday: { on: true, start: 10, end: 21 },
  onHoliday: false,
};

export const encodeWindow = (w: Window) => (w.on ? `${w.start}-${w.end}` : 'off');
export function decodeWindow(s: string | null | undefined, fallback: Window): Window {
  if (!s) return fallback;
  if (s === 'off') return { ...fallback, on: false };
  const [a, b] = s.split('-').map(Number);
  if (Number.isFinite(a) && Number.isFinite(b) && a <= b) return { on: true, start: a, end: b };
  return fallback;
}

/** Which hours count on a given date for this person (null = no snapping that day). */
export function windowFor(s: Schedule, date: Date): { start: number; end: number } | null {
  const day = date.getDay(); // 0 = Sunday
  const w = s.onHoliday ? s.holiday : day === 0 || day === 6 ? s.weekend : s.weekday;
  return w.on ? { start: w.start, end: w.end } : null;
}

export const describe = (w: Window) => (w.on ? `${w.start}u – ${w.end}u` : 'No snaps');
