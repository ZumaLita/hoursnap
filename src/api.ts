import { BUCKET_ID, DB_ID, KEEP_HOURS, PROFILES_TABLE, SNAPS_TABLE, loginEmail, loginPassword } from './config';
import { ID, Permission, Query, Role, account, imageDataUri, storage, tables, uploadImage } from './sdk';
import { DEFAULT_SCHEDULE, decodeWindow, encodeWindow, type Schedule } from './schedule';

export type Me = { id: string; name: string; admin: boolean };
export type Member = { id: string; name: string; schedule: Schedule; banned: boolean };
export type Snap = {
  $id: string;
  $createdAt: string;
  authorId: string;
  authorName: string;
  backId: string;
  frontId: string;
  caption?: string | null;
  hour: number;
  day: string;
  onTime: boolean;
  keptBy: string[];
  reactions: string[];
  reportedBy?: string[] | null;
  style?: string | null;
  /** View once: others can open it a single time, it never shows in the feed or memories. */
  viewOnce?: boolean | null;
  viewedBy?: string[] | null;
};

const everyone = Role.users();
const admin = Role.label('admin');
const keepMs = KEEP_HOURS * 3600e3;

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const code = (e: unknown) => (e as { type?: string; code?: number })?.type ?? '';
export function niceError(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/invalid credentials|user_invalid_credentials/i.test(msg)) return 'Wrong PIN for that name.';
  if (/user_count_exceeded|limit/i.test(msg) && /user/i.test(msg)) return 'HourSnap is full. Ask Storm to make room.';
  if (/network|fetch/i.test(msg)) return "Couldn't reach the server. Check your internet.";
  return msg;
}

// ---------- account ----------
export async function currentUser(): Promise<Me | null> {
  try {
    const u = await account.get();
    return { id: u.$id, name: u.name || 'Me', admin: (u.labels ?? []).includes('admin') };
  } catch {
    return null;
  }
}

async function clearSession() {
  try {
    await account.deleteSession({ sessionId: 'current' });
  } catch {}
}

/**
 * Tries to log in. Returns 'ok' when it worked, or 'unknown' when the name+PIN didn't match:
 * that's either a brand-new name or a wrong PIN, so the screen asks to confirm the PIN to sign up.
 */
export async function login(name: string, pin: string): Promise<'ok' | 'unknown'> {
  await clearSession();
  try {
    await account.createEmailPasswordSession({ email: loginEmail(name), password: loginPassword(name, pin) });
    return 'ok';
  } catch (e) {
    if (/invalid credentials|user_invalid_credentials/i.test(String((e as Error).message) + code(e))) return 'unknown';
    throw e;
  }
}

/** Creates a new account for this name with the chosen PIN and logs in. */
export async function signup(name: string, pin: string): Promise<Me> {
  await clearSession();
  try {
    await account.create({ userId: ID.unique(), email: loginEmail(name), password: loginPassword(name, pin), name: name.trim() });
  } catch (e) {
    if (/user_already_exists|already exists/i.test(String((e as Error).message) + code(e)))
      throw new Error('That name is already taken. Wrong PIN, or add your last initial (like "Lena V").');
    throw e;
  }
  await account.createEmailPasswordSession({ email: loginEmail(name), password: loginPassword(name, pin) });
  const me = await currentUser();
  if (!me) throw new Error('Could not log in');
  await saveProfile(me, DEFAULT_SCHEDULE);
  return me;
}

export async function logout() {
  await clearSession();
}

export async function changePin(name: string, oldPin: string, newPin: string) {
  await account.updatePassword({ password: loginPassword(name, newPin), oldPassword: loginPassword(name, oldPin) });
}

// ---------- people ----------
type ProfileRow = { $id: string; name: string; weekday?: string; weekend?: string; holiday?: string; onHoliday?: boolean; banned?: boolean };
const toMember = (r: ProfileRow): Member => ({
  id: r.$id,
  name: r.name,
  banned: !!r.banned,
  schedule: {
    weekday: decodeWindow(r.weekday, DEFAULT_SCHEDULE.weekday),
    weekend: decodeWindow(r.weekend, DEFAULT_SCHEDULE.weekend),
    holiday: decodeWindow(r.holiday, DEFAULT_SCHEDULE.holiday),
    onHoliday: !!r.onHoliday,
  },
});

export async function listMembers(): Promise<Member[]> {
  const r = await tables.listRows({ databaseId: DB_ID, tableId: PROFILES_TABLE, queries: [Query.orderAsc('name'), Query.limit(500)] });
  return (r.rows as unknown as ProfileRow[]).map(toMember);
}

export async function saveProfile(me: Me, s: Schedule) {
  const data = {
    name: me.name,
    weekday: encodeWindow(s.weekday),
    weekend: encodeWindow(s.weekend),
    holiday: encodeWindow(s.holiday),
    onHoliday: s.onHoliday,
  };
  try {
    await tables.updateRow({ databaseId: DB_ID, tableId: PROFILES_TABLE, rowId: me.id, data });
  } catch {
    await tables.createRow({
      databaseId: DB_ID,
      tableId: PROFILES_TABLE,
      rowId: me.id,
      data: { ...data, banned: false },
      permissions: [Permission.read(everyone), Permission.update(Role.user(me.id)), Permission.update(admin), Permission.delete(admin)],
    });
  }
}

/** Admin only: hide someone from HourSnap (or let them back in). */
export async function setBanned(memberId: string, banned: boolean) {
  await tables.updateRow({ databaseId: DB_ID, tableId: PROFILES_TABLE, rowId: memberId, data: { banned } });
}

// ---------- snaps ----------
export const EXPIRED = 'expired';

export async function listRecentSnaps(): Promise<Snap[]> {
  const since = new Date(Date.now() - keepMs).toISOString();
  const r = await tables.listRows({
    databaseId: DB_ID,
    tableId: SNAPS_TABLE,
    queries: [Query.greaterThan('$createdAt', since), Query.orderDesc('$createdAt'), Query.limit(300)],
  });
  return (r.rows as unknown as Snap[]).filter((x) => x.backId !== EXPIRED);
}

/** Light rows (no photos) for every snap ever, used for streaks. */
export async function listStreakRows() {
  const out: { authorId: string; day: string; hour: number }[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 40; page++) {
    const queries = [Query.select(['$id', 'authorId', 'day', 'hour']), Query.orderAsc('$createdAt'), Query.limit(500)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const r = await tables.listRows({ databaseId: DB_ID, tableId: SNAPS_TABLE, queries });
    const rows = r.rows as unknown as { $id: string; authorId: string; day: string; hour: number }[];
    rows.forEach((x) => out.push({ authorId: x.authorId, day: x.day, hour: x.hour }));
    if (rows.length < 500) break;
    cursor = rows[rows.length - 1].$id;
  }
  return out;
}

export async function listKeptSnaps(userId: string): Promise<Snap[]> {
  const r = await tables.listRows({
    databaseId: DB_ID,
    tableId: SNAPS_TABLE,
    queries: [Query.contains('keptBy', [userId]), Query.orderDesc('$createdAt'), Query.limit(200)],
  });
  return (r.rows as unknown as Snap[]).filter((x) => x.backId !== EXPIRED);
}

export async function postSnap(me: Me, backUri: string, frontUri: string, caption: string, onTime: boolean, style = 'tape', viewOnce = false): Promise<Snap> {
  const filePerms = [Permission.read(everyone), Permission.delete(Role.user(me.id)), Permission.delete(admin)];
  const stamp = Date.now();
  const [backId, frontId] = await Promise.all([uploadImage(backUri, `back-${stamp}.jpg`, filePerms), uploadImage(frontUri, `front-${stamp}.jpg`, filePerms)]);
  const now = new Date();
  const row = await tables.createRow({
    databaseId: DB_ID,
    tableId: SNAPS_TABLE,
    rowId: ID.unique(),
    data: {
      authorId: me.id,
      authorName: me.name,
      backId,
      frontId,
      caption: caption.trim() || null,
      hour: now.getHours(),
      day: dayKey(now),
      onTime,
      keptBy: [],
      reactions: [],
      reportedBy: [],
      style,
      viewOnce,
      viewedBy: [],
    },
    permissions: [Permission.read(everyone), Permission.update(everyone), Permission.delete(Role.user(me.id)), Permission.delete(admin)],
  });
  return row as unknown as Snap;
}

async function patch(snap: Snap, data: Partial<Snap>) {
  const row = await tables.updateRow({ databaseId: DB_ID, tableId: SNAPS_TABLE, rowId: snap.$id, data });
  return row as unknown as Snap;
}

export function toggleKeep(snap: Snap, userId: string) {
  const kept = snap.keptBy.includes(userId);
  return patch(snap, { keptBy: kept ? snap.keptBy.filter((k) => k !== userId) : [...snap.keptBy, userId] });
}

export function react(snap: Snap, userId: string, emoji: string) {
  const mine = snap.reactions.find((r) => r.startsWith(userId + ':'));
  const others = snap.reactions.filter((r) => !r.startsWith(userId + ':'));
  const next = mine === `${userId}:${emoji}` ? others : [...others, `${userId}:${emoji}`];
  return patch(snap, { reactions: next });
}

/** Marks a view-once snap as opened by this person, so it can't be opened again. */
export function markViewed(snap: Snap, userId: string) {
  const list = snap.viewedBy ?? [];
  return patch(snap, { viewedBy: list.includes(userId) ? list : [...list, userId] });
}

/** Forget a view-once photo after it was shown, so it isn't kept in memory. */
export function forgetPhoto(fileId: string) {
  const p = cache.get(fileId);
  cache.delete(fileId);
  p?.then((u) => {
    if (u.startsWith('blob:') && typeof URL !== 'undefined') URL.revokeObjectURL(u);
  }).catch(() => {});
}

/** Reported snaps are hidden for everyone except Storm (admin) until he checks them. */
export function report(snap: Snap, userId: string) {
  const list = snap.reportedBy ?? [];
  return patch(snap, { reportedBy: list.includes(userId) ? list : [...list, userId] });
}
export function clearReports(snap: Snap) {
  return patch(snap, { reportedBy: [] });
}

export async function deleteSnap(snap: Snap) {
  await tables.deleteRow({ databaseId: DB_ID, tableId: SNAPS_TABLE, rowId: snap.$id });
  await Promise.allSettled([storage.deleteFile({ bucketId: BUCKET_ID, fileId: snap.backId }), storage.deleteFile({ bucketId: BUCKET_ID, fileId: snap.frontId })]);
}

/**
 * Deletes photos older than 24 hours that nobody kept. The tiny row stays (marked expired)
 * so streaks keep their history. Admin cleans up everyone's, others only their own.
 */
export async function cleanupOld(me: Me) {
  const before = new Date(Date.now() - keepMs).toISOString();
  try {
    const queries = [Query.lessThan('$createdAt', before), Query.notEqual('backId', EXPIRED), Query.limit(100)];
    if (!me.admin) queries.unshift(Query.equal('authorId', me.id));
    const r = await tables.listRows({ databaseId: DB_ID, tableId: SNAPS_TABLE, queries });
    for (const s of r.rows as unknown as Snap[]) {
      if (s.keptBy?.length) continue;
      await Promise.allSettled([storage.deleteFile({ bucketId: BUCKET_ID, fileId: s.backId }), storage.deleteFile({ bucketId: BUCKET_ID, fileId: s.frontId })]);
      await tables.updateRow({ databaseId: DB_ID, tableId: SNAPS_TABLE, rowId: s.$id, data: { backId: EXPIRED, frontId: EXPIRED, caption: null } });
    }
  } catch {}
}

// ---------- photos (cached) ----------
const cache = new Map<string, Promise<string>>();
export function photo(fileId: string) {
  let p = cache.get(fileId);
  if (!p) {
    p = imageDataUri(fileId);
    p.catch(() => cache.delete(fileId));
    cache.set(fileId, p);
  }
  return p;
}

// ---------- per-person settings ----------
export type Prefs = { onboarded?: boolean; style?: string; appearance?: string; accent?: string };
export async function getPrefs(): Promise<Prefs> {
  try {
    return (await account.getPrefs()) as Prefs;
  } catch {
    return {};
  }
}
export async function savePrefs(p: Prefs) {
  try {
    const cur = await getPrefs();
    await account.updatePrefs({ prefs: { ...cur, ...p } });
  } catch {}
}
