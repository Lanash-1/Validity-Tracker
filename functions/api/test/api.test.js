import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createMemoryApp } from '../src/app.js';
import { seedBuiltInCategories } from '../scripts/seed-lib.mjs';

let app;
let tokens;

async function signIn(email = 'alice@example.com', name = 'Alice') {
  const res = await request(app)
    .post('/api/v1/auth/google')
    .send({ idToken: `dev:${email}:${name}`, platform: 'web', timezone: 'Asia/Kolkata' })
    .expect(200);
  return res.body;
}

const auth = (t = tokens) => ({ Authorization: `Bearer ${t.accessToken}` });

beforeEach(async () => {
  app = createMemoryApp();
  await seedBuiltInCategories(app.ctx.repo);
  tokens = await signIn();
});

describe('auth', () => {
  it('creates a user with a personal space on first sign-in and refreshes tokens', async () => {
    expect(tokens.user.email).toBe('alice@example.com');
    expect(tokens.user.timezone).toBe('Asia/Kolkata');
    const spaces = (await request(app).get('/api/v1/spaces').set(auth()).expect(200)).body;
    expect(spaces).toHaveLength(1);
    expect(spaces[0]).toMatchObject({ type: 'personal', memberCount: 1, inviteCode: null });

    const refreshed = (
      await request(app).post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(200)
    ).body;
    expect(refreshed.accessToken).toBeTruthy();
    // Old refresh token is rotated out.
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    // New one works and the access token is accepted.
    await request(app).get('/api/v1/me').set(auth(refreshed)).expect(200);
  });

  it('rejects missing or garbage tokens', async () => {
    await request(app).get('/api/v1/me').expect(401);
    await request(app).get('/api/v1/me').set({ Authorization: 'Bearer nope' }).expect(401);
    await request(app).post('/api/v1/auth/google').send({ idToken: 'short', platform: 'web' }).expect(400);
  });

  it('logs out by revoking the refresh token', async () => {
    await request(app)
      .post('/api/v1/auth/logout')
      .set(auth())
      .send({ refreshToken: tokens.refreshToken })
      .expect(204);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
  });
});

describe('items', () => {
  let spaceId;
  beforeEach(async () => {
    spaceId = (await request(app).get('/api/v1/spaces').set(auth())).body[0].id;
  });

  it('creates items of every expiry type and lists them first-to-expire', async () => {
    const create = (body) => request(app).post('/api/v1/items').set(auth()).send({ spaceId, ...body }).expect(201);
    const a = (await create({ name: 'Biscuits', expiryType: 'fixed', expiryDate: '2026-11-15', quantity: 2, unit: 'pack' })).body;
    const b = (await create({ name: 'Diwali offer', expiryType: 'period', startDate: '2026-10-20', expiryDate: '2026-11-02' })).body;
    const c = (await create({ name: 'Shampoo', expiryType: 'after_opening', openedAt: '2026-10-01', paoMonths: 1, expiryDate: '2028-01-01' })).body;
    const d = (await create({ name: 'Insurance', expiryType: 'review', reviewDate: '2027-01-01' })).body;
    // after_opening needs the printed expiry, the opened date, or both.
    await request(app)
      .post('/api/v1/items')
      .set(auth())
      .send({ spaceId, name: 'Unknown', expiryType: 'after_opening', paoMonths: 12 })
      .expect(400);

    expect(a.effectiveExpiry).toBe('2026-11-15');
    expect(b.effectiveExpiry).toBe('2026-11-02');
    expect(c.effectiveExpiry).toBe('2026-11-01'); // opened + 1 month
    expect(d.effectiveExpiry).toBe('2027-01-01');

    const list = (await request(app).get('/api/v1/items').set(auth()).query({ today: '2026-10-27' }).expect(200)).body;
    expect(list.items.map((i) => i.name)).toEqual(['Shampoo', 'Diwali offer', 'Biscuits', 'Insurance']);
    expect(list.nextCursor).toBeNull();
  });

  it('validates per-type requirements and rejects unknown fields', async () => {
    const res = await request(app)
      .post('/api/v1/items')
      .set(auth())
      .send({ spaceId, name: 'X', expiryType: 'period', startDate: '2026-11-10', expiryDate: '2026-11-01' })
      .expect(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details[0].path).toBe('expiryDate');
    await request(app)
      .post('/api/v1/items')
      .set(auth())
      .send({ spaceId, name: 'X', expiryType: 'fixed', expiryDate: '2026-11-01', evil: 1 })
      .expect(400);
  });

  it('patches, consumes partially then fully, restores, and deletes', async () => {
    const item = (
      await request(app)
        .post('/api/v1/items')
        .set(auth())
        .send({ spaceId, name: 'Eggs', expiryType: 'fixed', expiryDate: '2026-11-05', quantity: 6, unit: 'pcs' })
        .expect(201)
    ).body;

    const patched = (
      await request(app).patch(`/api/v1/items/${item.id}`).set(auth()).send({ expiryDate: '2026-11-07', location: 'Fridge' }).expect(200)
    ).body;
    expect(patched.effectiveExpiry).toBe('2026-11-07');
    expect(patched.location).toBe('Fridge');

    // Switching type without the needed fields fails on the merged payload.
    await request(app).patch(`/api/v1/items/${item.id}`).set(auth()).send({ expiryType: 'review' }).expect(400);

    let r = (await request(app).post(`/api/v1/items/${item.id}/consume`).set(auth()).send({ quantity: 2 }).expect(200)).body;
    expect(r).toMatchObject({ quantity: 4, status: 'active' });
    r = (await request(app).post(`/api/v1/items/${item.id}/consume`).set(auth()).send({}).expect(200)).body;
    expect(r).toMatchObject({ quantity: 0, status: 'consumed' });

    const consumed = (await request(app).get('/api/v1/items').set(auth()).query({ status: 'consumed' })).body;
    expect(consumed.items.map((i) => i.id)).toEqual([item.id]);

    r = (await request(app).post(`/api/v1/items/${item.id}/restore`).set(auth()).expect(200)).body;
    expect(r).toMatchObject({ quantity: 1, status: 'active' });

    await request(app).delete(`/api/v1/items/${item.id}`).set(auth()).expect(204);
    await request(app).get(`/api/v1/items/${item.id}`).set(auth()).expect(404);
  });

  it('reports expired items and a calendar for a month', async () => {
    const mk = (name, expiryDate) =>
      request(app).post('/api/v1/items').set(auth()).send({ spaceId, name, expiryType: 'fixed', expiryDate }).expect(201);
    await mk('Old', '2026-10-20');
    await mk('Nov1', '2026-11-01');
    await mk('Nov1b', '2026-11-01');
    await mk('Nov20', '2026-11-20');

    const expired = (await request(app).get('/api/v1/items').set(auth()).query({ status: 'expired', today: '2026-10-27' })).body;
    expect(expired.items.map((i) => i.name)).toEqual(['Old']);

    const cal = (await request(app).get('/api/v1/items/calendar').set(auth()).query({ month: '2026-11' }).expect(200)).body;
    expect(cal.days).toEqual({ '2026-11-01': 2, '2026-11-20': 1 });
    expect(cal.items).toHaveLength(3);
  });

  it('uploads, serves and removes a photo', async () => {
    const item = (
      await request(app).post('/api/v1/items').set(auth()).send({ spaceId, name: 'Jam', expiryType: 'fixed', expiryDate: '2026-12-01' })
    ).body;
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const withPhoto = (
      await request(app).post(`/api/v1/items/${item.id}/photo`).set(auth()).attach('photo', png, { filename: 'a.png', contentType: 'image/png' }).expect(200)
    ).body;
    expect(withPhoto.photoUrl).toContain(`/api/v1/items/${item.id}/photo`);
    const got = await request(app).get(`/api/v1/items/${item.id}/photo`).set(auth()).expect(200);
    expect(got.headers['content-type']).toBe('image/png');
    await request(app).post(`/api/v1/items/${item.id}/photo`).set(auth()).attach('photo', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' }).expect(400);
    const cleared = (await request(app).delete(`/api/v1/items/${item.id}/photo`).set(auth()).expect(200)).body;
    expect(cleared.photoUrl).toBeNull();
  });
});

describe('spaces and sharing', () => {
  it('creates a shared space, lets another user join by code, isolates personal items', async () => {
    const bob = await signIn('bob@example.com', 'Bob');
    const home = (await request(app).post('/api/v1/spaces').set(auth()).send({ name: 'Home' }).expect(201)).body;
    expect(home.inviteCode).toMatch(/^[A-Z0-9]{8}$/);

    await request(app).post('/api/v1/spaces/join').set(auth(bob)).send({ inviteCode: 'ZZZZZZZZ' }).expect(404);
    const joined = (await request(app).post('/api/v1/spaces/join').set(auth(bob)).send({ inviteCode: home.inviteCode.toLowerCase() }).expect(200)).body;
    expect(joined.memberCount).toBe(2);

    const aliceSpaces = (await request(app).get('/api/v1/spaces').set(auth())).body;
    const personal = aliceSpaces.find((s) => s.type === 'personal');
    await request(app).post('/api/v1/items').set(auth()).send({ spaceId: personal.id, name: 'Private', expiryType: 'fixed', expiryDate: '2026-12-01' }).expect(201);
    await request(app).post('/api/v1/items').set(auth()).send({ spaceId: home.id, name: 'Shared milk', expiryType: 'fixed', expiryDate: '2026-12-02' }).expect(201);

    const bobItems = (await request(app).get('/api/v1/items').set(auth(bob))).body.items.map((i) => i.name);
    expect(bobItems).toEqual(['Shared milk']);
    // Bob cannot post into Alice's personal space or read her items.
    await request(app).post('/api/v1/items').set(auth(bob)).send({ spaceId: personal.id, name: 'Hack', expiryType: 'fixed', expiryDate: '2026-12-01' }).expect(404);

    const members = (await request(app).get(`/api/v1/spaces/${home.id}/members`).set(auth(bob)).expect(200)).body;
    expect(members.map((m) => m.email)).toEqual(['alice@example.com', 'bob@example.com']);

    // Rotating the invite invalidates the old code.
    const rotated = (await request(app).post(`/api/v1/spaces/${home.id}/invite/rotate`).set(auth(bob)).expect(200)).body;
    expect(rotated.inviteCode).not.toBe(home.inviteCode);

    // Owner leaves → ownership passes to Bob; Bob leaves → space is removed.
    await request(app).delete(`/api/v1/spaces/${home.id}/members/${tokens.user.id}`).set(auth()).expect(204);
    const after = (await request(app).get(`/api/v1/spaces/${home.id}`).set(auth(bob)).expect(200)).body;
    expect(after.ownerUserId).toBe(bob.user.id);
    await request(app).delete(`/api/v1/spaces/${home.id}/members/${bob.user.id}`).set(auth(bob)).expect(204);
    await request(app).get(`/api/v1/spaces/${home.id}`).set(auth(bob)).expect(404);
  });

  it('forbids deleting the personal space and lets only the owner delete shared ones', async () => {
    const personal = (await request(app).get('/api/v1/spaces').set(auth())).body[0];
    await request(app).delete(`/api/v1/spaces/${personal.id}`).set(auth()).expect(400);
    const bob = await signIn('bob@example.com', 'Bob');
    const home = (await request(app).post('/api/v1/spaces').set(auth()).send({ name: 'Home' })).body;
    await request(app).post('/api/v1/spaces/join').set(auth(bob)).send({ inviteCode: home.inviteCode });
    await request(app).delete(`/api/v1/spaces/${home.id}`).set(auth(bob)).expect(403);
    await request(app).delete(`/api/v1/spaces/${home.id}`).set(auth()).expect(204);
  });

  it('manages custom categories per space and lists them with built-ins', async () => {
    const personal = (await request(app).get('/api/v1/spaces').set(auth())).body[0];
    const cats = (await request(app).get('/api/v1/categories').set(auth()).expect(200)).body;
    expect(cats.length).toBe(10);
    const created = (
      await request(app).post(`/api/v1/spaces/${personal.id}/categories`).set(auth()).send({ name: 'Pet food', defaultLeadDays: 5 }).expect(201)
    ).body;
    expect(created.spaceId).toBe(personal.id);
    const all = (await request(app).get('/api/v1/categories').set(auth()).query({ spaceId: personal.id })).body;
    expect(all.map((c) => c.name)).toContain('Pet food');
    // Using a category from another space is rejected.
    const bob = await signIn('bob@example.com', 'Bob');
    const bobSpace = (await request(app).get('/api/v1/spaces').set(auth(bob))).body[0];
    await request(app)
      .post('/api/v1/items')
      .set(auth(bob))
      .send({ spaceId: bobSpace.id, name: 'Kibble', expiryType: 'fixed', expiryDate: '2026-12-01', categoryId: created.id })
      .expect(400);
    await request(app).delete(`/api/v1/spaces/${personal.id}/categories/${created.id}`).set(auth()).expect(204);
  });
});

describe('products, devices, notifications', () => {
  it('looks up a barcode via Open Food Facts with caching and 404 for unknowns', async () => {
    const calls = [];
    app = createMemoryApp({
      fetch: async (url) => {
        calls.push(url);
        if (url.includes('737628064502'))
          return { ok: true, status: 200, json: async () => ({ status: 1, product: { product_name: 'Rice Noodles', brands: 'Thai Kitchen, Other', image_front_url: 'https://img/x.jpg', quantity: '155 g' } }) };
        return { ok: false, status: 404, json: async () => ({}) };
      },
    });
    tokens = await signIn();
    const p = (await request(app).get('/api/v1/products/737628064502').set(auth()).expect(200)).body;
    expect(p).toMatchObject({ name: 'Rice Noodles', brand: 'Thai Kitchen', imageUrl: 'https://img/x.jpg', source: 'openfoodfacts' });
    await request(app).get('/api/v1/products/737628064502').set(auth()).expect(200);
    expect(calls.filter((u) => u.includes('737628064502'))).toHaveLength(1);
    await request(app).get('/api/v1/products/0000000000000').set(auth()).expect(404);
    expect(calls.filter((u) => u.includes('0000000000000'))).toHaveLength(2); // v2 then v3 fallback
    await request(app).get('/api/v1/products/bad%20code!').set(auth()).expect(400);
  });

  it('registers devices and sends a test push', async () => {
    const sent = [];
    app = createMemoryApp({
      fetch: async (_url, init) => {
        const body = JSON.parse(init.body);
        sent.push(...body);
        return { ok: true, json: async () => ({ data: body.map(() => ({ status: 'ok' })) }) };
      },
    });
    tokens = await signIn();
    const dev = (await request(app).post('/api/v1/devices').set(auth()).send({ platform: 'android', token: 'ExponentPushToken[abc]' }).expect(201)).body;
    // Re-registering the same token is an upsert.
    await request(app).post('/api/v1/devices').set(auth()).send({ platform: 'android', token: 'ExponentPushToken[abc]' }).expect(201);
    expect((await request(app).get('/api/v1/devices').set(auth())).body).toHaveLength(1);
    await request(app).post('/api/v1/devices').set(auth()).send({ platform: 'web', token: 'x' }).expect(400);

    const res = (await request(app).post('/api/v1/notifications/test').set(auth()).expect(200)).body;
    expect(res.sent).toBe(1);
    expect(sent[0]).toMatchObject({ to: 'ExponentPushToken[abc]', channelId: 'expiry-reminders' });
    await request(app).delete(`/api/v1/devices/${dev.id}`).set(auth()).expect(204);
  });

  it('exposes health and the VAPID public key without auth', async () => {
    await request(app).get('/api/v1/health').expect(200);
    await request(app).get('/api/v1/notifications/vapid-public-key').expect(200);
    // Catalyst-style prefixed path also works.
    await request(app).get('/server/api/api/v1/health').expect(200);
  });
});
