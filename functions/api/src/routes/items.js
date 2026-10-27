import { Router } from 'express';
import multer from 'multer';
import {
  calendarQuerySchema,
  consumeItemSchema,
  createItemSchema,
  effectiveExpiry,
  endOfMonth,
  expiryFieldsSchema,
  listItemsQuerySchema,
  todayInTimeZone,
  updateItemSchema,
} from '@vt/shared';
import { badRequest, itemFromRow, itemToRow, notFound } from '@vt/fn-common';
import { validate } from '../middleware/validate.js';
import { requireItem, requireSpace } from '../lib/access.js';

export const itemsRouter = Router();

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function visibleSpaceIds(repo, userId, spaceId) {
  if (spaceId) {
    await requireSpace(repo, spaceId, userId);
    return [String(spaceId)];
  }
  return repo.members.listSpaceIds(userId);
}

async function validateCategory(repo, categoryId, spaceId) {
  if (!categoryId) return;
  const cat = await repo.categories.get(categoryId);
  if (!cat) throw badRequest('Unknown category');
  if (cat.space_id != null && String(cat.space_id) !== String(spaceId))
    throw badRequest('Category belongs to another space');
}

itemsRouter.get('/items', validate(listItemsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const q = req.valid.query;
    const spaceIds = await visibleSpaceIds(repo, req.auth.userId, q.spaceId);
    if (spaceIds.length === 0) return res.json({ items: [], nextCursor: null });
    const today = typeof req.query.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.today)
      ? req.query.today
      : todayInTimeZone('UTC');
    const { rows, nextCursor } = await repo.items.list({
      spaceIds,
      status: q.status,
      today,
      categoryId: q.categoryId,
      location: q.location,
      q: q.q,
      from: q.from,
      to: q.to,
      sort: q.sort,
      limit: q.limit,
      cursor: q.cursor,
    });
    res.json({ items: rows.map(itemFromRow), nextCursor });
  } catch (err) {
    next(err);
  }
});

itemsRouter.get('/items/calendar', validate(calendarQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const { month, spaceId } = req.valid.query;
    const spaceIds = await visibleSpaceIds(repo, req.auth.userId, spaceId);
    const from = `${month}-01`;
    const to = endOfMonth(from);
    const rows = spaceIds.length ? await repo.items.listBetween(spaceIds, from, to) : [];
    const days = {};
    for (const r of rows) days[r.effective_expiry] = (days[r.effective_expiry] ?? 0) + 1;
    rows.sort((a, b) => a.expiry_sort.localeCompare(b.expiry_sort) || a.name.localeCompare(b.name));
    res.json({ month, days, items: rows.map(itemFromRow) });
  } catch (err) {
    next(err);
  }
});

itemsRouter.post('/items', validate(createItemSchema), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const input = req.valid.body;
    await requireSpace(repo, input.spaceId, req.auth.userId);
    await validateCategory(repo, input.categoryId, input.spaceId);
    const row = await repo.items.insert({
      ...itemToRow(input),
      photo_file_id: null,
      photo_url: null,
      created_by: req.auth.userId,
      updated_by: req.auth.userId,
    });
    res.status(201).json(itemFromRow(row));
  } catch (err) {
    next(err);
  }
});

itemsRouter.get('/items/:id', async (req, res, next) => {
  try {
    const item = await requireItem(req.ctx.repo, req.params.id, req.auth.userId);
    res.json(itemFromRow(item));
  } catch (err) {
    next(err);
  }
});

itemsRouter.patch('/items/:id', validate(updateItemSchema), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const existing = await requireItem(repo, req.params.id, req.auth.userId);
    const current = itemFromRow(existing);
    const merged = { ...current, ...req.valid.body };
    // Re-validate the expiry fields as a whole after the merge.
    expiryFieldsSchema.parse(merged);
    await validateCategory(repo, merged.categoryId, current.spaceId);
    const row = itemToRow(merged);
    const updated = await repo.items.update(req.params.id, { ...row, updated_by: req.auth.userId });
    res.json(itemFromRow(updated));
  } catch (err) {
    next(err);
  }
});

itemsRouter.delete('/items/:id', async (req, res, next) => {
  try {
    const { repo, photos } = req.ctx;
    const item = await requireItem(repo, req.params.id, req.auth.userId);
    if (item.photo_file_id) await photos.remove(item.photo_file_id).catch(() => {});
    await repo.items.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

itemsRouter.post('/items/:id/consume', validate(consumeItemSchema), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const item = await requireItem(repo, req.params.id, req.auth.userId);
    const amount = req.valid.body.quantity;
    const current = item.quantity == null ? null : Number(item.quantity);
    let patch;
    if (amount != null && current != null && current - amount > 0) {
      patch = { quantity: Math.round((current - amount) * 1000) / 1000 };
    } else {
      patch = { status: 'consumed', quantity: current == null ? null : 0 };
    }
    const updated = await repo.items.update(req.params.id, { ...patch, updated_by: req.auth.userId });
    res.json(itemFromRow(updated));
  } catch (err) {
    next(err);
  }
});

itemsRouter.post('/items/:id/restore', async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const item = await requireItem(repo, req.params.id, req.auth.userId);
    const patch = { status: 'active', updated_by: req.auth.userId };
    if (item.quantity != null && Number(item.quantity) === 0) patch.quantity = 1;
    const updated = await repo.items.update(req.params.id, patch);
    res.json(itemFromRow(updated));
  } catch (err) {
    next(err);
  }
});

// ---- photos --------------------------------------------------------------

function uploadFor(req) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: req.ctx.config.maxPhotoBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_PHOTO_TYPES.has(file.mimetype)) cb(null, true);
      else cb(badRequest('Only JPEG, PNG or WebP images are accepted'));
    },
  }).single('photo');
}

itemsRouter.post('/items/:id/photo', (req, res, next) => uploadFor(req)(req, res, next), async (req, res, next) => {
  try {
    const { repo, photos } = req.ctx;
    const item = await requireItem(repo, req.params.id, req.auth.userId);
    if (!req.file) throw badRequest('Attach the image as multipart field "photo"');
    if (item.photo_file_id) await photos.remove(item.photo_file_id).catch(() => {});
    const { fileId } = await photos.put(req.file.buffer, req.file.mimetype);
    const updated = await repo.items.update(req.params.id, {
      photo_file_id: fileId,
      photo_url: `/api/v1/items/${req.params.id}/photo?v=${encodeURIComponent(fileId)}`,
      updated_by: req.auth.userId,
    });
    res.json(itemFromRow(updated));
  } catch (err) {
    next(err);
  }
});

itemsRouter.get('/items/:id/photo', async (req, res, next) => {
  try {
    const { repo, photos } = req.ctx;
    const item = await requireItem(repo, req.params.id, req.auth.userId);
    if (!item.photo_file_id) throw notFound('Photo');
    const file = await photos.get(item.photo_file_id);
    if (!file) throw notFound('Photo');
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    file.stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

itemsRouter.delete('/items/:id/photo', async (req, res, next) => {
  try {
    const { repo, photos } = req.ctx;
    const item = await requireItem(repo, req.params.id, req.auth.userId);
    if (item.photo_file_id) await photos.remove(item.photo_file_id).catch(() => {});
    const updated = await repo.items.update(req.params.id, {
      photo_file_id: null,
      photo_url: null,
      updated_by: req.auth.userId,
    });
    res.json(itemFromRow(updated));
  } catch (err) {
    next(err);
  }
});

// Keep effectiveExpiry referenced for tooling that tree-shakes unused imports.
void effectiveExpiry;
