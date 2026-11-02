import { BUCKET_ID, DB_ID, KEEP_HOURS, PROFILES_TABLE, SNAPS_TABLE, loginEmail, loginPassword, phoneFromEmail } from './config';
import { ID, Permission, Query, Role, account, functions, imageDataUri, storage, tables, uploadImage } from './sdk';
import { DEFAULT_SCHEDULE, decodeWindow, encodeWindow, type Schedule } from './schedule';

export type Me = { id: string; name: string; admin: boolean };
export type Member = { id: string; name: string; username: string; avatarId: string | null; lab: boolean; schedule: Schedule; banned: boolean };
export type Group = { $id: string; name: string; kind: 'lab' | 'room'; ownerId?: string | null; members: string[] };
export const LAB_ID = 'lab';
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
  groups?: string[] | null;
};

const everyone = Role.users();
const keepMs = KEEP_HOURS * 3600e3;

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const code = (e: unknown) => (e as { type?: string; code?: number })?.type ?? '';
export function niceError(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/invalid credentials|user_invalid_credentials/i.test(msg)) return 'Wrong PIN for this number.';
  if (/user_count_exceeded|limit/i.test(msg) && /user/i.test(msg)) return 'HourSnap is full. Ask Storm to make room.';
  if (/network|fetch/i.test(msg)) return "Couldn't reach the server. Check your internet.";
  return msg;
}

// ---------- server function (sharing with other people happens there) ----------
async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const ex = await functions.createExecution({ functionId: 'api', body: JSON.stringify({ action, ...payload }), async: false });
  let out: { error?: string } & Record<string, unknown> = {};
  try {
    out = JSON.parse(ex.responseBody || '{}');
  } catch {}
  if (ex.responseStatusCode >= 400 || out.error) throw new Error(out.error || 'Something went wrong. Try again.');
  return out as T;
}

// ---------- account ----------
export async function currentUser(): Promise<Me | null> {
  try {
    const u = await account.get();
    return { id: u.$id, name: u.name || '', admin: (u.labels ?? []).includes('admin') };
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
 * Tries to log in. Returns 'ok' when it worked, or 'unknown' when the number+PIN didn't match:
 * that's either a new number or a wrong PIN, so the screen asks to type the PIN again to sign up.
 */
export async function login(phone: string, pin: string): Promise<'ok' | 'unknown'> {
  await clearSession();
  try {
    await account.createEmailPasswordSession({ email: loginEmail(phone), password: loginPassword(phone, pin) });
    return 'ok';
  } catch (e) {
    if (/invalid credentials|user_invalid_credentials/i.test(String((e as Error).message) + code(e))) return 'unknown';
    throw e;
  }
}

/** Thrown by signup when the number already has an account, so the PIN they typed was wrong. */
export class NumberTaken extends Error {}

/** Makes a new account for this phone number with the chosen PIN and logs in. The name comes next. */
export async function signup(phone: string, pin: string): Promise<Me> {
  await clearSession();
  try {
    await account.create({ userId: ID.unique(), email: loginEmail(phone), password: loginPassword(phone, pin) });
  } catch (e) {
    if (/user_already_exists|already exists/i.test(String((e as Error).message) + code(e))) throw new NumberTaken('This number already has an account.');
    throw e;
  }
  await account.createEmailPasswordSession({ email: loginEmail(phone), password: loginPassword(phone, pin) });
  const me = await currentUser();
  if (!me) throw new Error('Could not log in');
  return me;
}

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
export const cleanUsername = (t: string) => t.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._]/g, '').slice(0, 20);

/** Picks the unique @username everyone sees, and makes the profile row. */
export async function setUsername(me: Me, username: string, schedule: Schedule = DEFAULT_SCHEDULE): Promise<Me> {
  const u = cleanUsername(username);
  if (!USERNAME_RE.test(u)) throw new Error('3 to 20 letters, numbers, dots or _');
  const taken = await tables.listRows({ databaseId: DB_ID, tableId: PROFILES_TABLE, queries: [Query.equal('username', u), Query.limit(1)] });
  if (taken.rows.some((r) => r.$id !== me.id)) throw new Error(`@${u} is already taken. Try another one.`);
  try {
    await saveProfile({ ...me, name: u }, schedule, { username: u });
  } catch (e) {
    if (/unique|already exists|duplicate/i.test(String((e as Error).message))) throw new Error(`@${u} is already taken. Try another one.`);
    throw e;
  }
  await account.updateName({ name: u });
  return { ...me, name: u };
}

export async function logout() {
  await clearSession();
}

export async function changePin(oldPin: string, newPin: string) {
  const phone = phoneFromEmail((await account.get()).email);
  await account.updatePassword({ password: loginPassword(phone, newPin), oldPassword: loginPassword(phone, oldPin) });
}

// ---------- people ----------
type ProfileRow = { $id: string; name: string; username?: string | null; avatarId?: string | null; lab?: boolean; weekday?: string; weekend?: string; holiday?: string; onHoliday?: boolean; banned?: boolean };
const toMember = (r: ProfileRow): Member => ({
  id: r.$id,
  name: r.username || r.name,
  username: r.username || r.name,
  avatarId: r.avatarId || null,
  lab: !!r.lab,
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

export async function saveProfile(me: Me, s: Schedule, extra: Record<string, unknown> = {}) {
  const data = {
    ...extra,
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
      permissions: [Permission.read(everyone), Permission.update(Role.user(me.id))],
    });
  }
}

/** Admin only: block someone from HourSnap (or let them back in). */
export async function setBanned(memberId: string, banned: boolean) {
  await call('admin.ban', { userId: memberId, banned });
}

export async function joinLab(me: Me) {
  await tables.updateRow({ databaseId: DB_ID, tableId: PROFILES_TABLE, rowId: me.id, data: { lab: true } });
}

/** Find people by @username to add to a room. */
export async function searchPeople(q: string, meId: string): Promise<Member[]> {
  const t = cleanUsername(q);
  if (!t) return [];
  const r = await tables.listRows({ databaseId: DB_ID, tableId: PROFILES_TABLE, queries: [Query.startsWith('username', t), Query.limit(12)] });
  return (r.rows as unknown as ProfileRow[]).map(toMember).filter((m) => m.id !== meId && !m.banned);
}

/** Profile photo: readable by everyone logged in. */
export async function setAvatar(me: Me, uri: string, old: string | null): Promise<string> {
  const id = await uploadImage(uri, `avatar-${Date.now()}.jpg`, [Permission.read(everyone), Permission.delete(Role.user(me.id))]);
  await tables.updateRow({ databaseId: DB_ID, tableId: PROFILES_TABLE, rowId: me.id, data: { avatarId: id } });
  if (old) storage.deleteFile({ bucketId: BUCKET_ID, fileId: old }).catch(() => {});
  return id;
}

// ---------- groups: LAB for everyone, private rooms of max 5 ----------
export const MAX_ROOM = 5;
export async function listGroups(): Promise<Group[]> {
  const r = await tables.listRows({ databaseId: DB_ID, tableId: 'groups', queries: [Query.limit(100)] });
  const rows = r.rows as unknown as Group[];
  return [...rows.filter((g) => g.kind === 'lab'), ...rows.filter((g) => g.kind === 'room').sort((a, b) => a.name.localeCompare(b.name))];
}
export async function createRoom(name: string, memberIds: string[]) {
  return (await call<{ room: Group }>('room.create', { name, memberIds })).room;
}
export async function updateRoom(roomId: string, change: { name?: string; memberIds?: string[] }) {
  return (await call<{ room: Group }>('room.update', { roomId, ...change })).room;
}
export async function leaveRoom(roomId: string) {
  await call('room.leave', { roomId });
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

export async function postSnap(
  me: Me,
  backUri: string,
  frontUri: string,
  caption: string,
  onTime: boolean,
  style = 'tape',
  viewOnce = false,
  groupIds: string[] = [LAB_ID],
): Promise<Snap> {
  // Photos start private to you; the server shares them with the groups you picked.
  const filePerms = [Permission.read(Role.user(me.id)), Permission.delete(Role.user(me.id))];
  const stamp = Date.now();
  const [backId, frontId] = await Promise.all([uploadImage(backUri, `back-${stamp}.jpg`, filePerms), uploadImage(frontUri, `front-${stamp}.jpg`, filePerms)]);
  const now = new Date();
  try {
    const r = await call<{ snap: Snap }>('post', { backId, frontId, caption, onTime, style, viewOnce, groupIds, hour: now.getHours(), day: dayKey(now) });
    return r.snap;
  } catch (e) {
    Promise.allSettled([storage.deleteFile({ bucketId: BUCKET_ID, fileId: backId }), storage.deleteFile({ bucketId: BUCKET_ID, fileId: frontId })]);
    throw e;
  }
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

/** Old photos are cleaned up by the server every hour now. */
export async function cleanupOld(_me: Me) {}

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
