import { Router } from 'express';
import {
  createCategorySchema,
  createSpaceSchema,
  joinSpaceSchema,
  updateCategorySchema,
  updateSpaceSchema,
} from '@vt/shared';
import {
  badRequest,
  categoryFromRow,
  forbidden,
  newInviteCode,
  notFound,
  spaceFromRow,
} from '@vt/fn-common';
import { validate } from '../middleware/validate.js';
import { requireOwner, requireSpace } from '../lib/access.js';

export const spacesRouter = Router();

async function withCounts(repo, spaces) {
  const counts = await repo.members.countBySpace(spaces.map((s) => String(s.ROWID)));
  return spaces.map((s) => spaceFromRow(s, { memberCount: counts[String(s.ROWID)] ?? 1 }));
}

spacesRouter.get('/spaces', async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const spaces = await repo.spaces.listForUser(req.auth.userId);
    spaces.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'personal' ? -1 : 1));
    res.json(await withCounts(repo, spaces));
  } catch (err) {
    next(err);
  }
});

spacesRouter.post('/spaces', validate(createSpaceSchema), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    let code = newInviteCode();
    while (await repo.spaces.findByInviteCode(code)) code = newInviteCode();
    const space = await repo.spaces.insert({
      name: req.valid.body.name,
      type: 'shared',
      icon: req.valid.body.icon ?? '👥',
      owner_user_id: req.auth.userId,
      invite_code: code,
    });
    await repo.members.add(String(space.ROWID), req.auth.userId);
    res.status(201).json(spaceFromRow(space, { memberCount: 1 }));
  } catch (err) {
    next(err);
  }
});

spacesRouter.post('/spaces/join', validate(joinSpaceSchema), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const space = await repo.spaces.findByInviteCode(req.valid.body.inviteCode);
    if (!space || space.type !== 'shared') throw notFound('Invite');
    await repo.members.add(String(space.ROWID), req.auth.userId);
    const [dto] = await withCounts(repo, [space]);
    res.json(dto);
  } catch (err) {
    next(err);
  }
});

spacesRouter.get('/spaces/:id', async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const space = await requireSpace(repo, req.params.id, req.auth.userId);
    const [dto] = await withCounts(repo, [space]);
    res.json(dto);
  } catch (err) {
    next(err);
  }
});

spacesRouter.patch('/spaces/:id', validate(updateSpaceSchema), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    await requireSpace(repo, req.params.id, req.auth.userId);
    const patch = {};
    if (req.valid.body.name !== undefined) patch.name = req.valid.body.name;
    if (req.valid.body.icon !== undefined) patch.icon = req.valid.body.icon;
    const space = await repo.spaces.update(req.params.id, patch);
    const [dto] = await withCounts(repo, [space]);
    res.json(dto);
  } catch (err) {
    next(err);
  }
});

spacesRouter.delete('/spaces/:id', async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const space = await requireSpace(repo, req.params.id, req.auth.userId);
    if (space.type === 'personal') throw badRequest('The personal space cannot be deleted');
    requireOwner(space, req.auth.userId);
    await repo.items.archiveBySpace(req.params.id);
    await repo.spaces.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

spacesRouter.post('/spaces/:id/invite/rotate', async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const space = await requireSpace(repo, req.params.id, req.auth.userId);
    if (space.type !== 'shared') throw badRequest('Personal spaces have no invite code');
    let code = newInviteCode();
    while (await repo.spaces.findByInviteCode(code)) code = newInviteCode();
    const updated = await repo.spaces.update(req.params.id, { invite_code: code });
    const [dto] = await withCounts(repo, [updated]);
    res.json(dto);
  } catch (err) {
    next(err);
  }
});

spacesRouter.get('/spaces/:id/members', async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    await requireSpace(repo, req.params.id, req.auth.userId);
    const ids = await repo.members.listUserIds(req.params.id);
    const users = await repo.users.getMany(ids);
    const byId = new Map(users.map((u) => [String(u.ROWID), u]));
    res.json(
      ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((u) => ({
          userId: String(u.ROWID),
          name: u.name,
          email: u.email,
          avatarUrl: u.avatar_url ?? null,
          joinedAt: u.CREATEDTIME,
        })),
    );
  } catch (err) {
    next(err);
  }
});

spacesRouter.delete('/spaces/:id/members/:userId', async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const space = await requireSpace(repo, req.params.id, req.auth.userId);
    if (space.type === 'personal') throw badRequest('You cannot leave your personal space');
    const target = String(req.params.userId);
    const isSelf = target === req.auth.userId;
    if (!isSelf) throw forbidden('Members can only remove themselves');

    await repo.members.remove(req.params.id, target);
    const remaining = await repo.members.listUserIds(req.params.id);
    if (remaining.length === 0) {
      await repo.items.archiveBySpace(req.params.id);
      await repo.spaces.remove(req.params.id);
    } else if (String(space.owner_user_id) === target) {
      // Ownership passes to the longest-standing remaining member.
      await repo.spaces.update(req.params.id, { owner_user_id: remaining[0] });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---- categories ----------------------------------------------------------

spacesRouter.get('/categories', async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const spaceId = typeof req.query.spaceId === 'string' ? req.query.spaceId : null;
    const builtIn = await repo.categories.listBuiltIn();
    let custom = [];
    if (spaceId) {
      await requireSpace(repo, spaceId, req.auth.userId);
      custom = await repo.categories.listForSpace(spaceId);
    } else {
      const spaceIds = await repo.members.listSpaceIds(req.auth.userId);
      for (const sid of spaceIds) custom.push(...(await repo.categories.listForSpace(sid)));
    }
    const all = [...builtIn, ...custom].map(categoryFromRow);
    all.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    res.json(all);
  } catch (err) {
    next(err);
  }
});

spacesRouter.post('/spaces/:id/categories', validate(createCategorySchema), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    await requireSpace(repo, req.params.id, req.auth.userId);
    const existing = await repo.categories.listForSpace(req.params.id);
    const row = await repo.categories.insert({
      space_id: req.params.id,
      key: null,
      name: req.valid.body.name,
      icon: req.valid.body.icon ?? '🏷️',
      default_lead_days: req.valid.body.defaultLeadDays,
      sort_order: 1000 + existing.length,
    });
    res.status(201).json(categoryFromRow(row));
  } catch (err) {
    next(err);
  }
});

spacesRouter.patch('/spaces/:id/categories/:cid', validate(updateCategorySchema), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    await requireSpace(repo, req.params.id, req.auth.userId);
    const cat = await repo.categories.get(req.params.cid);
    if (!cat || String(cat.space_id) !== String(req.params.id)) throw notFound('Category');
    const patch = {};
    if (req.valid.body.name !== undefined) patch.name = req.valid.body.name;
    if (req.valid.body.icon !== undefined) patch.icon = req.valid.body.icon;
    if (req.valid.body.defaultLeadDays !== undefined) patch.default_lead_days = req.valid.body.defaultLeadDays;
    res.json(categoryFromRow(await repo.categories.update(req.params.cid, patch)));
  } catch (err) {
    next(err);
  }
});

spacesRouter.delete('/spaces/:id/categories/:cid', async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    await requireSpace(repo, req.params.id, req.auth.userId);
    const cat = await repo.categories.get(req.params.cid);
    if (!cat || String(cat.space_id) !== String(req.params.id)) throw notFound('Category');
    await repo.categories.remove(req.params.cid);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
