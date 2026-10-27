import { nextMemoryId } from '../ids.js';
import { decodeCursor, encodeCursor, sortDesc, sortKeyOf } from './cursor.js';

/**
 * In-memory implementation of the Repo interface (see types.js). Mirrors the
 * Catalyst row conventions: every row has ROWID, CREATEDTIME, MODIFIEDTIME.
 */
export function createMemoryRepo(options = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const tables = {
    users: [],
    spaces: [],
    space_members: [],
    categories: [],
    items: [],
    devices: [],
    refresh_tokens: [],
    product_cache: [],
    reminder_log: [],
  };

  const clone = (r) => (r ? { ...r } : null);
  const insert = (t, row) => {
    const ts = now();
    const full = { ...row, ROWID: nextMemoryId(), CREATEDTIME: ts, MODIFIEDTIME: ts };
    tables[t].push(full);
    return clone(full);
  };
  const update = (t, id, patch) => {
    const row = tables[t].find((r) => r.ROWID === String(id));
    if (!row) return null;
    Object.assign(row, patch, { MODIFIEDTIME: now() });
    return clone(row);
  };
  const remove = (t, pred) => {
    tables[t] = tables[t].filter((r) => !pred(r));
  };
  const get = (t, id) => clone(tables[t].find((r) => r.ROWID === String(id)));

  const ilike = (hay, needle) =>
    hay != null && String(hay).toLowerCase().includes(String(needle).toLowerCase());

  /** @type {import('./types.js').Repo} */
  const repo = {
    users: {
      async findByGoogleSub(sub) {
        return clone(tables.users.find((u) => u.google_sub === sub));
      },
      async findByEmail(email) {
        return clone(tables.users.find((u) => u.email.toLowerCase() === email.toLowerCase()));
      },
      async get(id) {
        return get('users', id);
      },
      async getMany(ids) {
        const set = new Set(ids.map(String));
        return tables.users.filter((u) => set.has(u.ROWID)).map(clone);
      },
      async insert(row) {
        return insert('users', row);
      },
      async update(id, patch) {
        return update('users', id, patch);
      },
    },
    spaces: {
      async get(id) {
        return get('spaces', id);
      },
      async insert(row) {
        return insert('spaces', row);
      },
      async update(id, patch) {
        return update('spaces', id, patch);
      },
      async remove(id) {
        remove('spaces', (r) => r.ROWID === String(id));
        remove('space_members', (r) => r.space_id === String(id));
      },
      async findByInviteCode(code) {
        return clone(tables.spaces.find((s) => s.invite_code === code));
      },
      async listForUser(userId) {
        const ids = new Set(
          tables.space_members.filter((m) => m.user_id === String(userId)).map((m) => m.space_id),
        );
        return tables.spaces.filter((s) => ids.has(s.ROWID)).map(clone);
      },
    },
    members: {
      async add(spaceId, userId) {
        if (tables.space_members.some((m) => m.space_id === spaceId && m.user_id === userId)) return;
        insert('space_members', { space_id: String(spaceId), user_id: String(userId), joined_at: now() });
      },
      async remove(spaceId, userId) {
        remove('space_members', (m) => m.space_id === String(spaceId) && m.user_id === String(userId));
      },
      async isMember(spaceId, userId) {
        return tables.space_members.some(
          (m) => m.space_id === String(spaceId) && m.user_id === String(userId),
        );
      },
      async listUserIds(spaceId) {
        return tables.space_members
          .filter((m) => m.space_id === String(spaceId))
          .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
          .map((m) => m.user_id);
      },
      async listSpaceIds(userId) {
        return tables.space_members.filter((m) => m.user_id === String(userId)).map((m) => m.space_id);
      },
      async countBySpace(spaceIds) {
        /** @type {Record<string, number>} */
        const out = {};
        for (const id of spaceIds) out[id] = 0;
        for (const m of tables.space_members) if (m.space_id in out) out[m.space_id] += 1;
        return out;
      },
    },
    categories: {
      async listBuiltIn() {
        return tables.categories.filter((c) => c.space_id == null).map(clone);
      },
      async listForSpace(spaceId) {
        return tables.categories.filter((c) => c.space_id === String(spaceId)).map(clone);
      },
      async get(id) {
        return get('categories', id);
      },
      async insert(row) {
        return insert('categories', row);
      },
      async update(id, patch) {
        return update('categories', id, patch);
      },
      async remove(id) {
        remove('categories', (c) => c.ROWID === String(id));
        for (const it of tables.items) if (it.category_id === String(id)) it.category_id = null;
      },
    },
    items: {
      async get(id) {
        return get('items', id);
      },
      async insert(row) {
        return insert('items', row);
      },
      async update(id, patch) {
        return update('items', id, patch);
      },
      async remove(id) {
        remove('items', (i) => i.ROWID === String(id));
      },
      async list(p) {
        const spaceSet = new Set(p.spaceIds.map(String));
        let rows = tables.items.filter((i) => spaceSet.has(i.space_id));
        switch (p.status) {
          case 'active':
            rows = rows.filter((i) => i.status === 'active');
            break;
          case 'expired':
            rows = rows.filter(
              (i) => i.status === 'active' && i.effective_expiry && i.effective_expiry < p.today,
            );
            break;
          case 'all':
            break;
          default:
            rows = rows.filter((i) => i.status === p.status);
        }
        if (p.categoryId) rows = rows.filter((i) => i.category_id === String(p.categoryId));
        if (p.location) rows = rows.filter((i) => i.location === p.location);
        if (p.q)
          rows = rows.filter(
            (i) => ilike(i.name, p.q) || ilike(i.brand, p.q) || ilike(i.notes, p.q) || i.barcode === p.q,
          );
        if (p.from) rows = rows.filter((i) => i.effective_expiry && i.effective_expiry >= p.from);
        if (p.to) rows = rows.filter((i) => i.effective_expiry && i.effective_expiry <= p.to);

        const desc = sortDesc(p.sort);
        rows.sort((a, b) => {
          const ka = sortKeyOf(p.sort, a);
          const kb = sortKeyOf(p.sort, b);
          if (ka < kb) return desc ? 1 : -1;
          if (ka > kb) return desc ? -1 : 1;
          return desc ? Number(b.ROWID) - Number(a.ROWID) : Number(a.ROWID) - Number(b.ROWID);
        });

        const cur = decodeCursor(p.cursor);
        if (cur) {
          rows = rows.filter((r) => {
            const k = sortKeyOf(p.sort, r);
            if (k === cur.k) return desc ? Number(r.ROWID) < Number(cur.id) : Number(r.ROWID) > Number(cur.id);
            return desc ? k < cur.k : k > cur.k;
          });
        }
        const page = rows.slice(0, p.limit).map(clone);
        const last = page[page.length - 1];
        const nextCursor =
          rows.length > p.limit && last ? encodeCursor({ k: sortKeyOf(p.sort, last), id: last.ROWID }) : null;
        return { rows: page, nextCursor };
      },
      async listBetween(spaceIds, from, to) {
        const set = new Set(spaceIds.map(String));
        return tables.items
          .filter(
            (i) =>
              set.has(i.space_id) &&
              i.status === 'active' &&
              i.effective_expiry &&
              i.effective_expiry >= from &&
              i.effective_expiry <= to,
          )
          .map(clone);
      },
      async listActiveExpiringBetween(from, to) {
        return tables.items
          .filter(
            (i) =>
              i.status === 'active' &&
              i.effective_expiry &&
              i.effective_expiry >= from &&
              i.effective_expiry <= to,
          )
          .map(clone);
      },
      async archiveBySpace(spaceId) {
        for (const i of tables.items)
          if (i.space_id === String(spaceId) && i.status === 'active') i.status = 'archived';
      },
    },
    devices: {
      async upsert(row) {
        const existing = tables.devices.find(
          (d) => d.user_id === row.user_id && d.token_key === row.token_key,
        );
        if (existing) return update('devices', existing.ROWID, { ...row, last_seen_at: now() });
        return insert('devices', { ...row, last_seen_at: now() });
      },
      async listForUser(userId) {
        return tables.devices.filter((d) => d.user_id === String(userId)).map(clone);
      },
      async listForUsers(userIds) {
        const set = new Set(userIds.map(String));
        return tables.devices.filter((d) => set.has(d.user_id)).map(clone);
      },
      async get(id) {
        return get('devices', id);
      },
      async remove(id) {
        remove('devices', (d) => d.ROWID === String(id));
      },
      async touch(id) {
        update('devices', id, { last_seen_at: now() });
      },
    },
    refreshTokens: {
      async insert(row) {
        return insert('refresh_tokens', row);
      },
      async findByHash(hash) {
        return clone(tables.refresh_tokens.find((t) => t.token_hash === hash));
      },
      async revoke(id) {
        update('refresh_tokens', id, { revoked_at: now() });
      },
      async revokeAllForUser(userId) {
        for (const t of tables.refresh_tokens)
          if (t.user_id === String(userId) && !t.revoked_at) t.revoked_at = now();
      },
    },
    productCache: {
      async get(barcode) {
        return clone(tables.product_cache.find((p) => p.barcode === barcode));
      },
      async upsert(row) {
        const existing = tables.product_cache.find((p) => p.barcode === row.barcode);
        if (existing) return update('product_cache', existing.ROWID, row);
        return insert('product_cache', row);
      },
    },
    reminderLog: {
      async existingKeys(keys) {
        const set = new Set(keys);
        return new Set(tables.reminder_log.map((r) => r.dedupe_key).filter((k) => set.has(k)));
      },
      async insertMany(rows) {
        for (const r of rows) insert('reminder_log', r);
      },
    },
  };

  return Object.assign(repo, { _tables: tables });
}
