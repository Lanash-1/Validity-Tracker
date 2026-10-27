import { forbidden, notFound } from '@vt/fn-common';

/** Throws 404 unless the user is a member of the space. Returns the space row. */
export async function requireSpace(repo, spaceId, userId) {
  const space = await repo.spaces.get(spaceId);
  if (!space) throw notFound('Space');
  if (!(await repo.members.isMember(spaceId, userId))) throw notFound('Space');
  return space;
}

/** Throws 404 unless the user may see the item. Returns the item row. */
export async function requireItem(repo, itemId, userId) {
  const item = await repo.items.get(itemId);
  if (!item) throw notFound('Item');
  if (!(await repo.members.isMember(String(item.space_id), userId))) throw notFound('Item');
  return item;
}

export function requireOwner(space, userId) {
  if (String(space.owner_user_id) !== String(userId)) throw forbidden('Only the space owner can do that');
}
