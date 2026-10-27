import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from '../src/repo/memory.js';
import { itemToRow } from '../src/mappers.js';

async function seed(repo) {
  const u = await repo.users.insert({ email: 'a@x.io', name: 'A', google_sub: 'g1', timezone: 'UTC' });
  const s = await repo.spaces.insert({ name: 'Personal', type: 'personal', owner_user_id: u.ROWID });
  await repo.members.add(s.ROWID, u.ROWID);
  const mk = (name, expiryDate, extra = {}) =>
    repo.items.insert({
      ...itemToRow({ spaceId: s.ROWID, name, expiryType: 'fixed', expiryDate, ...extra }),
      created_by: u.ROWID,
      updated_by: u.ROWID,
    });
  await mk('Milk', '2026-10-28');
  await mk('Yogurt', '2026-10-26');
  await mk('Rice', '2027-03-01', { brand: 'Daawat' });
  await mk('Coupon', null, { expiryType: 'review', reviewDate: null, expiryDate: null });
  await mk('Old', '2026-10-01', { status: 'consumed' });
  return { u, s };
}

describe('memory repo items.list', () => {
  it('sorts by effective expiry with no-date last and paginates with a cursor', async () => {
    const repo = createMemoryRepo();
    const { s } = await seed(repo);
    const base = { spaceIds: [s.ROWID], status: 'active', today: '2026-10-27', sort: 'expiry' };
    const p1 = await repo.items.list({ ...base, limit: 2 });
    expect(p1.rows.map((r) => r.name)).toEqual(['Yogurt', 'Milk']);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = await repo.items.list({ ...base, limit: 2, cursor: p1.nextCursor });
    expect(p2.rows.map((r) => r.name)).toEqual(['Rice', 'Coupon']);
    expect(p2.nextCursor).toBeNull();
  });

  it('filters expired, consumed, search and date ranges', async () => {
    const repo = createMemoryRepo();
    const { s } = await seed(repo);
    const base = { spaceIds: [s.ROWID], today: '2026-10-27', sort: 'expiry', limit: 50 };
    expect((await repo.items.list({ ...base, status: 'expired' })).rows.map((r) => r.name)).toEqual([
      'Yogurt',
    ]);
    expect((await repo.items.list({ ...base, status: 'consumed' })).rows.map((r) => r.name)).toEqual([
      'Old',
    ]);
    expect((await repo.items.list({ ...base, status: 'all' })).rows).toHaveLength(5);
    expect((await repo.items.list({ ...base, status: 'active', q: 'daaw' })).rows.map((r) => r.name)).toEqual([
      'Rice',
    ]);
    expect(
      (await repo.items.list({ ...base, status: 'active', from: '2026-10-27', to: '2026-10-31' })).rows.map(
        (r) => r.name,
      ),
    ).toEqual(['Milk']);
  });

  it('sorts newest first for created', async () => {
    const repo = createMemoryRepo();
    const { s } = await seed(repo);
    const res = await repo.items.list({
      spaceIds: [s.ROWID],
      status: 'all',
      today: '2026-10-27',
      sort: 'created',
      limit: 2,
    });
    expect(res.rows.map((r) => r.name)).toEqual(['Old', 'Coupon']);
  });
});

describe('memory repo spaces & members', () => {
  it('tracks membership and counts', async () => {
    const repo = createMemoryRepo();
    const { u, s } = await seed(repo);
    const u2 = await repo.users.insert({ email: 'b@x.io', name: 'B', google_sub: 'g2', timezone: 'UTC' });
    const shared = await repo.spaces.insert({
      name: 'Home',
      type: 'shared',
      owner_user_id: u.ROWID,
      invite_code: 'ABCDEFGH',
    });
    await repo.members.add(shared.ROWID, u.ROWID);
    await repo.members.add(shared.ROWID, u2.ROWID);
    await repo.members.add(shared.ROWID, u2.ROWID); // idempotent
    expect(await repo.members.countBySpace([s.ROWID, shared.ROWID])).toEqual({
      [s.ROWID]: 1,
      [shared.ROWID]: 2,
    });
    expect((await repo.spaces.listForUser(u2.ROWID)).map((x) => x.name)).toEqual(['Home']);
    expect((await repo.spaces.findByInviteCode('ABCDEFGH'))?.name).toBe('Home');
    await repo.members.remove(shared.ROWID, u2.ROWID);
    expect(await repo.members.isMember(shared.ROWID, u2.ROWID)).toBe(false);
  });
});
