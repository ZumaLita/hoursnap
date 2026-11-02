// HourSnap server function. Phones can only share things with roles they have themselves,
// so anything that gives OTHER people access (posting to a group, rooms, admin) runs here.
import { Client, Permission, Query, Role, Storage, TablesDB, Users } from 'node-appwrite';

const DB = 'hoursnap';
const KEEP_MS = 24 * 3600e3;
const MAX_ROOM = 5;
const LAB = 'lab';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const db = new TablesDB(client);
  const storage = new Storage(client);
  const users = new Users(client);

  // Hourly clean-up: photos older than 24h that nobody kept are deleted.
  if (req.headers['x-appwrite-trigger'] === 'schedule') {
    const before = new Date(Date.now() - KEEP_MS).toISOString();
    const r = await db.listRows({ databaseId: DB, tableId: 'snaps', queries: [Query.lessThan('$createdAt', before), Query.notEqual('backId', 'expired'), Query.limit(200)] });
    let n = 0;
    for (const s of r.rows) {
      if (s.keptBy?.length && !s.viewOnce) continue;
      await Promise.allSettled([storage.deleteFile({ bucketId: 'photos', fileId: s.backId }), storage.deleteFile({ bucketId: 'photos', fileId: s.frontId })]);
      await db.updateRow({ databaseId: DB, tableId: 'snaps', rowId: s.$id, data: { backId: 'expired', frontId: 'expired', caption: null } });
      n++;
    }
    log(`cleaned ${n}`);
    return res.json({ ok: true, cleaned: n });
  }

  const me = req.headers['x-appwrite-user-id'];
  if (!me) return res.json({ error: 'Log in first.' }, 401);
  let body = {};
  try {
    body = typeof req.bodyJson === 'object' && req.bodyJson ? req.bodyJson : JSON.parse(req.bodyText || '{}');
  } catch {}
  const fail = (msg, code = 400) => res.json({ error: msg }, code);

  const getRoom = async (id) => {
    try {
      const r = await db.getRow({ databaseId: DB, tableId: 'groups', rowId: id });
      return r.kind === 'room' ? r : null;
    } catch {
      return null;
    }
  };
  const roomPerms = (members) => members.map((m) => Permission.read(Role.user(m)));
  const isAdmin = async () => (await users.get({ userId: me })).labels?.includes('admin');
  const cleanMembers = async (ids) => {
    const uniq = [...new Set([me, ...(Array.isArray(ids) ? ids : [])].filter((x) => typeof x === 'string' && x))];
    const ok = [];
    for (const id of uniq) {
      try {
        const p = await db.getRow({ databaseId: DB, tableId: 'profiles', rowId: id });
        if (!p.banned) ok.push(id);
      } catch {}
    }
    return ok;
  };

  try {
    switch (body.action) {
      case 'post': {
        const { backId, frontId, caption, onTime, style, viewOnce, hour, day } = body;
        const groupIds = [...new Set(Array.isArray(body.groupIds) ? body.groupIds : [])];
        if (!groupIds.length) return fail('Pick where to post.');
        for (const f of [backId, frontId]) {
          const file = await storage.getFile({ bucketId: 'photos', fileId: f });
          if (!file.$permissions.some((p) => p.includes(`user:${me}`))) return fail('That photo is not yours.', 403);
        }
        let everyone = false;
        const readers = new Set([me]);
        for (const g of groupIds) {
          if (g === LAB) {
            everyone = true;
            continue;
          }
          const room = await getRoom(g);
          if (!room || !room.members.includes(me)) return fail('You are not in that room.', 403);
          room.members.forEach((m) => readers.add(m));
        }
        const roles = everyone ? [Role.users()] : [...readers].map((m) => Role.user(m));
        const filePerms = [...roles.map((r) => Permission.read(r)), Permission.delete(Role.user(me)), Permission.delete(Role.label('admin'))];
        await Promise.all([backId, frontId].map((f) => storage.updateFile({ bucketId: 'photos', fileId: f, permissions: filePerms })));
        const profile = await db.getRow({ databaseId: DB, tableId: 'profiles', rowId: me });
        const row = await db.createRow({
          databaseId: DB,
          tableId: 'snaps',
          rowId: 'unique()',
          data: {
            authorId: me,
            authorName: profile.username || profile.name,
            backId,
            frontId,
            caption: (caption || '').toString().slice(0, 140).trim() || null,
            hour: Number(hour) || 0,
            day: String(day || ''),
            onTime: !!onTime,
            keptBy: [],
            reactions: [],
            reportedBy: [],
            viewedBy: [],
            style: String(style || 'tape'),
            viewOnce: !!viewOnce,
            groups: groupIds,
          },
          permissions: [...roles.map((r) => Permission.read(r)), ...roles.map((r) => Permission.update(r)), Permission.delete(Role.user(me)), Permission.delete(Role.label('admin'))],
        });
        return res.json({ snap: row });
      }

      case 'room.create': {
        const name = String(body.name || '').trim().slice(0, 40);
        if (name.length < 2) return fail('Give the room a name.');
        const owned = await db.listRows({ databaseId: DB, tableId: 'groups', queries: [Query.equal('ownerId', me), Query.limit(50)] });
        if (owned.total >= 20) return fail('You already made 20 rooms.');
        const members = await cleanMembers(body.memberIds);
        if (members.length > MAX_ROOM) return fail(`A room has at most ${MAX_ROOM} people.`);
        const row = await db.createRow({ databaseId: DB, tableId: 'groups', rowId: 'unique()', data: { name, kind: 'room', ownerId: me, members }, permissions: roomPerms(members) });
        return res.json({ room: row });
      }

      case 'room.update': {
        const room = await getRoom(body.roomId);
        if (!room) return fail('Room not found.', 404);
        if (room.ownerId !== me) return fail('Only the person who made the room can change it.', 403);
        const name = body.name !== undefined ? String(body.name).trim().slice(0, 40) : room.name;
        const members = body.memberIds ? await cleanMembers(body.memberIds) : room.members;
        if (members.length > MAX_ROOM) return fail(`A room has at most ${MAX_ROOM} people.`);
        const row = await db.updateRow({ databaseId: DB, tableId: 'groups', rowId: room.$id, data: { name, members }, permissions: roomPerms(members) });
        return res.json({ room: row });
      }

      case 'room.leave': {
        const room = await getRoom(body.roomId);
        if (!room || !room.members.includes(me)) return fail('Room not found.', 404);
        const members = room.members.filter((m) => m !== me);
        if (!members.length) {
          await db.deleteRow({ databaseId: DB, tableId: 'groups', rowId: room.$id });
          return res.json({ ok: true });
        }
        const ownerId = room.ownerId === me ? members[0] : room.ownerId;
        await db.updateRow({ databaseId: DB, tableId: 'groups', rowId: room.$id, data: { members, ownerId }, permissions: roomPerms(members) });
        return res.json({ ok: true });
      }

      case 'admin.ban': {
        if (!(await isAdmin())) return fail('Only Storm can do that.', 403);
        if (body.userId === me) return fail("You can't remove yourself.");
        const banned = !!body.banned;
        await users.updateStatus({ userId: body.userId, status: !banned });
        await db.updateRow({ databaseId: DB, tableId: 'profiles', rowId: body.userId, data: { banned } });
        return res.json({ ok: true });
      }

      default:
        return fail('Unknown action.');
    }
  } catch (e) {
    error(String(e?.message || e));
    return fail(e?.message || 'Something went wrong.', 500);
  }
};
