// Streak rules (each person's own hours, set in onboarding):
// - Every hour inside your snap hours where you post at least one snap keeps your 🔥 streak going.
// - Extra snaps earn a bonus 🛡️: a 2nd snap in the same hour, or a snap outside your hours. Max 3.
// - Forget an hour? A bonus springs in and saves your streak. No bonus left: back to 0.
// - Days with no snap hours (for example school days you set to "off") don't count at all.
import type { Ionicons } from '@expo/vector-icons';

export const MAX_BONUS = 3;

export type StreakRow = { authorId: string; day: string; hour: number };
export type SlotState = 'snap' | 'saved' | 'missed' | 'now' | 'future';
export type Hours = { start: number; end: number } | null;

export type StreakStats = {
  current: number;
  best: number;
  bonus: number;
  total: number;
  today: Record<number, SlotState>;
  todayHours: Hours;
  todaySnaps: number;
  earlyBird: boolean;
  nightOwl: boolean;
  fullDay: boolean;
  usedBonus: boolean;
  maxedBonus: boolean;
};

const parseDay = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd);
};
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function computeStreak(rows: StreakRow[], hoursFor: (date: Date) => Hours, now = new Date()): StreakStats {
  const today = fmt(now);
  const nowH = now.getHours();
  const counts = new Map<string, number>();
  const days = new Set<string>();
  let earlyBird = false;
  let nightOwl = false;
  rows.forEach((r) => {
    const k = `${r.day}|${r.hour}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    days.add(r.day);
    if (r.hour < 8) earlyBird = true;
    if (r.hour >= 22) nightOwl = true;
  });

  const todayHours = hoursFor(now);
  const todayMap: Record<number, SlotState> = {};
  if (todayHours)
    for (let h = todayHours.start; h <= todayHours.end; h++) {
      const c = counts.get(`${today}|${h}`) ?? 0;
      todayMap[h] = c > 0 ? 'snap' : h > nowH ? 'future' : h === nowH ? 'now' : 'missed';
    }

  const base: StreakStats = {
    current: 0,
    best: 0,
    bonus: 0,
    total: rows.length,
    today: todayMap,
    todayHours,
    todaySnaps: rows.filter((r) => r.day === today).length,
    earlyBird,
    nightOwl,
    fullDay: false,
    usedBonus: false,
    maxedBonus: false,
  };
  if (!rows.length) return base;

  const first = [...days].sort()[0];
  const firstHour = Math.min(...rows.filter((r) => r.day === first).map((r) => r.hour));
  let streak = 0;
  let best = 0;
  let bonus = 0;
  let usedBonus = false;
  let maxedBonus = false;
  let fullDay = false;
  const addBonus = (n: number) => {
    bonus = Math.min(MAX_BONUS, bonus + n);
    if (bonus === MAX_BONUS) maxedBonus = true;
  };

  for (let d = parseDay(first); fmt(d) <= today; d.setDate(d.getDate() + 1)) {
    const day = fmt(d);
    const isToday = day === today;
    const hours = hoursFor(d);
    if (!hours) {
      for (let h = 0; h < 24; h++) addBonus(counts.get(`${day}|${h}`) ?? 0);
      continue;
    }
    let snapped = 0;
    for (let h = 0; h < hours.start; h++) addBonus(counts.get(`${day}|${h}`) ?? 0);
    const startH = day === first ? Math.max(hours.start, firstHour) : hours.start;
    for (let h = startH; h <= hours.end; h++) {
      if (isToday && h > nowH) break;
      const c = counts.get(`${day}|${h}`) ?? 0;
      if (isToday && h === nowH && c === 0) break;
      if (c > 0) {
        streak++;
        snapped++;
        if (c > 1) addBonus(c - 1);
      } else if (bonus > 0) {
        bonus--;
        usedBonus = true;
        streak++;
        if (isToday) todayMap[h] = 'saved';
      } else streak = 0;
      best = Math.max(best, streak);
    }
    if (snapped === hours.end - hours.start + 1) fullDay = true;
    for (let h = hours.end + 1; h < 24; h++) addBonus(counts.get(`${day}|${h}`) ?? 0);
  }
  return { ...base, current: streak, best, bonus, usedBonus, maxedBonus, fullDay };
}

export type Badge = {
  key: string;
  title: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  unlocked: (s: StreakStats) => boolean;
};

export const BADGES: Badge[] = [
  { key: 'spark', title: 'Vonk', hint: '3 uur op rij', icon: 'flame-outline', color: '#FFB020', unlocked: (s) => s.best >= 3 },
  { key: 'flame', title: 'Vlam', hint: '7 uur op rij', icon: 'flame', color: '#FF8A1F', unlocked: (s) => s.best >= 7 },
  { key: 'blaze', title: 'Gloed', hint: '14 uur op rij', icon: 'flame', color: '#FF5A1F', unlocked: (s) => s.best >= 14 },
  { key: 'inferno', title: 'Inferno', hint: '30 uur op rij', icon: 'bonfire', color: '#F03A2E', unlocked: (s) => s.best >= 30 },
  { key: 'wildfire', title: 'Bosbrand', hint: '60 uur op rij', icon: 'bonfire', color: '#D61F69', unlocked: (s) => s.best >= 60 },
  { key: 'legend', title: 'Legende', hint: '100 uur op rij', icon: 'trophy', color: '#F5B700', unlocked: (s) => s.best >= 100 },
  { key: 'fullday', title: 'Volle dag', hint: 'Snap al je uren', icon: 'calendar', color: '#3FA9F5', unlocked: (s) => s.fullDay },
  { key: 'early', title: 'Vroege vogel', hint: 'Snap voor 8u', icon: 'sunny', color: '#F5B700', unlocked: (s) => s.earlyBird },
  { key: 'owl', title: 'Nachtuil', hint: 'Snap na 22u', icon: 'moon', color: '#8C6CF0', unlocked: (s) => s.nightOwl },
  { key: 'saved', title: 'Gered!', hint: 'Een bonus redde je', icon: 'shield-checkmark', color: '#3FA9F5', unlocked: (s) => s.usedBonus },
  { key: 'collector', title: 'Verzamelaar', hint: 'Heb 3 bonussen', icon: 'shield-half', color: '#2BB673', unlocked: (s) => s.maxedBonus },
  { key: 'hundred', title: '100 snaps', hint: 'Post 100 snaps', icon: 'camera', color: '#E2668F', unlocked: (s) => s.total >= 100 },
];
