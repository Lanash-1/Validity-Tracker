import { decodeCursor, encodeCursor, sortDesc, sortKeyOf } from './cursor.js';

/**
 * Catalyst Data Store implementation of the Repo interface (see types.js).
 *
 * Writes and primary-key reads use the Table API; filtered reads use ZCQL.
 * ZCQL returns rows as `[{ <table>: { col: value } }]`, which `unwrap`
 * flattens. All values are interpolated through `lit()` which escapes quotes;
 * identifiers are never user-controlled.
 *
 * @param {any} app  CatalystApp from `catalyst.initialize(req)`
 */
export function createCatalystRepo(app) {
  const ds = app.datastore();
  const zcql = app.zcql();

  const lit = (v) => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
  };
  const inList = (vals) => (vals.length ? vals.map(lit).join(', ') : lit('__none__'));
  const unwrap = (rows, table) => rows.map((r) => r[table] ?? Object.values(r)[0] ?? {});
  const query = async (sql, table) => unwrap(await zcql.executeZCQLQuery(sql), table);
  const one = async (sql, table) => (await query(sql, table))[0] ?? null;
  const table = (name) => ds.table(name);
  const nowIso = () => new Date().toISOString();

  const get = async (t, id) => {
    try {
      return await table(t).getRow(id);
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  };
  const insert = (t, row) => table(t).insertRow(row);
  const update = (t, id, patch) => table(t).updateRow({ ...patch, ROWID: id });
  const remove = async (t, id) => {
    await table(t).deleteRow(id);
  };

  /** @type {import('./types.js').Repo} */
  const repo = {
    users: {
      findByGoogleSub: (sub) => one(`SELECT * FROM users WHERE google_sub = ${lit(sub)}`, 'users'),
      findByEmail: (email) => one(`SELECT * FROM users WHERE email = ${lit(email)}`, 'users'),
      get: (id) => get('users', id),
      getMany: (ids) =>
        ids.length ? query(`SELECT * FROM users WHERE ROWID IN (${inList(ids)})`, 'users') : Promise.resolve([]),
      insert: (row) => insert('users', row),
      update: (id, patch) => update('users', id, patch),
    },
    spaces: {
      get: (id) => get('spaces', id),
      insert: (row) => insert('spaces', row),
      update: (id, patch) => update('spaces', id, patch),
      async remove(id) {
        const members = await query(
          `SELECT ROWID FROM space_members WHERE space_id = ${lit(id)}`,
          'space_members',
        );
        if (members.length) await table('space_members').deleteRows(members.map((m) => m.ROWID));
        await remove('spaces', id);
      },
      findByInviteCode: (code) =>
        one(`SELECT * FROM spaces WHERE invite_code = ${lit(code)}`, 'spaces'),
      async listForUser(userId) {
        const ids = await repo.members.listSpaceIds(userId);
        if (!ids.length) return [];
        return query(`SELECT * FROM spaces WHERE ROWID IN (${inList(ids)})`, 'spaces');
      },
    },
    members: {
      async add(spaceId, userId) {
        if (await repo.members.isMember(spaceId, userId)) return;
        await insert('space_members', { space_id: spaceId, user_id: userId, joined_at: nowIso() });
      },
      async remove(spaceId, userId) {
        const rows = await query(
          `SELECT ROWID FROM space_members WHERE space_id = ${lit(spaceId)} AND user_id = ${lit(userId)}`,
          'space_members',
        );
        if (rows.length) await table('space_members').deleteRows(rows.map((r) => r.ROWID));
      },
      async isMember(spaceId, userId) {
        const row = await one(
          `SELECT ROWID FROM space_members WHERE space_id = ${lit(spaceId)} AND user_id = ${lit(userId)}`,
          'space_members',
        );
        return row !== null;
      },
      async listUserIds(spaceId) {
        const rows = await query(
          `SELECT user_id, joined_at FROM space_members WHERE space_id = ${lit(spaceId)} ORDER BY joined_at ASC`,
          'space_members',
        );
        return rows.map((r) => String(r.user_id));
      },
      async listSpaceIds(userId) {
        const rows = await query(
          `SELECT space_id FROM space_members WHERE user_id = ${lit(userId)}`,
          'space_members',
        );
        return rows.map((r) => String(r.space_id));
      },
      async countBySpace(spaceIds) {
        /** @type {Record<string, number>} */
        const out = {};
        for (const id of spaceIds) out[id] = 0;
        if (!spaceIds.length) return out;
        const rows = await query(
          `SELECT space_id FROM space_members WHERE space_id IN (${inList(spaceIds)})`,
          'space_members',
        );
        for (const r of rows) if (String(r.space_id) in out) out[String(r.space_id)] += 1;
        return out;
      },
    },
    categories: {
      listBuiltIn: () =>
        query(`SELECT * FROM categories WHERE space_id IS NULL ORDER BY sort_order ASC`, 'categories'),
      listForSpace: (spaceId) =>
        query(
          `SELECT * FROM categories WHERE space_id = ${lit(spaceId)} ORDER BY sort_order ASC, name ASC`,
          'categories',
        ),
      get: (id) => get('categories', id),
      insert: (row) => insert('categories', row),
      update: (id, patch) => update('categories', id, patch),
      async remove(id) {
        const items = await query(`SELECT ROWID FROM items WHERE category_id = ${lit(id)}`, 'items');
        if (items.length)
          await table('items').updateRows(items.map((i) => ({ ROWID: i.ROWID, category_id: null })));
        await remove('categories', id);
      },
    },
    items: {
      get: (id) => get('items', id),
      insert: (row) => insert('items', row),
      update: (id, patch) => update('items', id, patch),
      remove: (id) => remove('items', id),
      async list(p) {
        const where = [`space_id IN (${inList(p.spaceIds)})`];
        switch (p.status) {
          case 'active':
            where.push(`status = 'active'`);
            break;
          case 'expired':
            where.push(`status = 'active'`, `effective_expiry IS NOT NULL`, `effective_expiry < ${lit(p.today)}`);
            break;
          case 'all':
            break;
          default:
            where.push(`status = ${lit(p.status)}`);
        }
        if (p.categoryId) where.push(`category_id = ${lit(p.categoryId)}`);
        if (p.location) where.push(`location = ${lit(p.location)}`);
        if (p.q) {
          const like = lit(`%${p.q}%`);
          where.push(`(name LIKE ${like} OR brand LIKE ${like} OR notes LIKE ${like} OR barcode = ${lit(p.q)})`);
        }
        if (p.from) where.push(`effective_expiry >= ${lit(p.from)}`);
        if (p.to) where.push(`effective_expiry <= ${lit(p.to)}`);

        const desc = sortDesc(p.sort);
        const col = p.sort === 'created' ? 'CREATEDTIME' : p.sort === 'name' ? 'name' : 'expiry_sort';
        const dir = desc ? 'DESC' : 'ASC';
        const cur = decodeCursor(p.cursor);
        if (cur) {
          const gt = desc ? '<' : '>';
          where.push(`((${col} ${gt} ${lit(cur.k)}) OR (${col} = ${lit(cur.k)} AND ROWID ${gt} ${lit(cur.id)}))`);
        }
        const sql = `SELECT * FROM items WHERE ${where.join(' AND ')} ORDER BY ${col} ${dir}, ROWID ${dir} LIMIT ${p.limit + 1}`;
        const rows = await query(sql, 'items');
        const page = rows.slice(0, p.limit);
        const last = page[page.length - 1];
        const nextCursor =
          rows.length > p.limit && last ? encodeCursor({ k: sortKeyOf(p.sort, last), id: last.ROWID }) : null;
        return { rows: page, nextCursor };
      },
      listBetween: (spaceIds, from, to) =>
        spaceIds.length
          ? query(
              `SELECT * FROM items WHERE space_id IN (${inList(spaceIds)}) AND status = 'active' AND effective_expiry >= ${lit(from)} AND effective_expiry <= ${lit(to)} ORDER BY expiry_sort ASC LIMIT 1000`,
              'items',
            )
          : Promise.resolve([]),
      listActiveExpiringBetween: (from, to) =>
        pagedQuery(
          `SELECT * FROM items WHERE status = 'active' AND effective_expiry >= ${lit(from)} AND effective_expiry <= ${lit(to)} ORDER BY ROWID ASC`,
          'items',
        ),
      async archiveBySpace(spaceId) {
        const rows = await query(
          `SELECT ROWID FROM items WHERE space_id = ${lit(spaceId)} AND status = 'active'`,
          'items',
        );
        for (let i = 0; i < rows.length; i += 200) {
          await table('items').updateRows(
            rows.slice(i, i + 200).map((r) => ({ ROWID: r.ROWID, status: 'archived' })),
          );
        }
      },
    },
    devices: {
      async upsert(row) {
        const existing = await one(
          `SELECT ROWID FROM devices WHERE user_id = ${lit(row.user_id)} AND token_key = ${lit(row.token_key)}`,
          'devices',
        );
        const full = { ...row, last_seen_at: nowIso() };
        return existing ? update('devices', existing.ROWID, full) : insert('devices', full);
      },
      listForUser: (userId) => query(`SELECT * FROM devices WHERE user_id = ${lit(userId)}`, 'devices'),
      listForUsers: (userIds) =>
        userIds.length
          ? query(`SELECT * FROM devices WHERE user_id IN (${inList(userIds)})`, 'devices')
          : Promise.resolve([]),
      get: (id) => get('devices', id),
      remove: (id) => remove('devices', id),
      async touch(id) {
        await update('devices', id, { last_seen_at: nowIso() });
      },
    },
    refreshTokens: {
      insert: (row) => insert('refresh_tokens', row),
      findByHash: (hash) =>
        one(`SELECT * FROM refresh_tokens WHERE token_hash = ${lit(hash)}`, 'refresh_tokens'),
      async revoke(id) {
        await update('refresh_tokens', id, { revoked_at: nowIso() });
      },
      async revokeAllForUser(userId) {
        const rows = await query(
          `SELECT ROWID FROM refresh_tokens WHERE user_id = ${lit(userId)} AND revoked_at IS NULL`,
          'refresh_tokens',
        );
        const ts = nowIso();
        for (let i = 0; i < rows.length; i += 200) {
          await table('refresh_tokens').updateRows(
            rows.slice(i, i + 200).map((r) => ({ ROWID: r.ROWID, revoked_at: ts })),
          );
        }
      },
    },
    productCache: {
      get: (barcode) => one(`SELECT * FROM product_cache WHERE barcode = ${lit(barcode)}`, 'product_cache'),
      async upsert(row) {
        const existing = await repo.productCache.get(row.barcode);
        return existing ? update('product_cache', existing.ROWID, row) : insert('product_cache', row);
      },
    },
    reminderLog: {
      async existingKeys(keys) {
        const found = new Set();
        for (let i = 0; i < keys.length; i += 100) {
          const rows = await query(
            `SELECT dedupe_key FROM reminder_log WHERE dedupe_key IN (${inList(keys.slice(i, i + 100))})`,
            'reminder_log',
          );
          for (const r of rows) found.add(r.dedupe_key);
        }
        return found;
      },
      async insertMany(rows) {
        for (let i = 0; i < rows.length; i += 200) {
          await table('reminder_log').insertRows(rows.slice(i, i + 200));
        }
      },
    },
  };

  /** Walks a ZCQL result set in pages of 300 using ROWID keyset pagination. */
  async function pagedQuery(baseSql, t) {
    const out = [];
    let lastId = null;
    for (;;) {
      const sql = lastId
        ? baseSql.replace(' ORDER BY', ` AND ROWID > ${lit(lastId)} ORDER BY`)
        : baseSql;
      const rows = await query(`${sql} LIMIT 300`, t);
      out.push(...rows);
      if (rows.length < 300) break;
      lastId = rows[rows.length - 1].ROWID;
    }
    return out;
  }

  return repo;
}

function isNotFound(err) {
  const msg = String(err?.message ?? '').toLowerCase();
  return err?.statusCode === 404 || msg.includes('not found') || msg.includes('no such row');
}
