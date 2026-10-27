/**
 * @typedef {Object} ListItemsParams
 * @property {string[]} spaceIds   spaces the caller may see (already access-checked)
 * @property {'active'|'expired'|'consumed'|'archived'|'all'} status
 * @property {string} today        YYYY-MM-DD in the caller's zone, for `expired`
 * @property {string} [categoryId]
 * @property {string} [location]
 * @property {string} [q]
 * @property {string} [from]       effective_expiry >= from
 * @property {string} [to]         effective_expiry <= to
 * @property {'expiry'|'created'|'name'} sort
 * @property {number} limit
 * @property {string} [cursor]
 */

/**
 * @typedef {Object} Repo
 * @property {{
 *   findByGoogleSub(sub: string): Promise<any|null>,
 *   findByEmail(email: string): Promise<any|null>,
 *   get(id: string): Promise<any|null>,
 *   getMany(ids: string[]): Promise<any[]>,
 *   insert(row: any): Promise<any>,
 *   update(id: string, patch: any): Promise<any>,
 * }} users
 * @property {{
 *   get(id: string): Promise<any|null>,
 *   insert(row: any): Promise<any>,
 *   update(id: string, patch: any): Promise<any>,
 *   remove(id: string): Promise<void>,
 *   findByInviteCode(code: string): Promise<any|null>,
 *   listForUser(userId: string): Promise<any[]>,
 * }} spaces
 * @property {{
 *   add(spaceId: string, userId: string): Promise<void>,
 *   remove(spaceId: string, userId: string): Promise<void>,
 *   isMember(spaceId: string, userId: string): Promise<boolean>,
 *   listUserIds(spaceId: string): Promise<string[]>,
 *   listSpaceIds(userId: string): Promise<string[]>,
 *   countBySpace(spaceIds: string[]): Promise<Record<string, number>>,
 * }} members
 * @property {{
 *   listBuiltIn(): Promise<any[]>,
 *   listForSpace(spaceId: string): Promise<any[]>,
 *   get(id: string): Promise<any|null>,
 *   insert(row: any): Promise<any>,
 *   update(id: string, patch: any): Promise<any>,
 *   remove(id: string): Promise<void>,
 * }} categories
 * @property {{
 *   get(id: string): Promise<any|null>,
 *   insert(row: any): Promise<any>,
 *   update(id: string, patch: any): Promise<any>,
 *   remove(id: string): Promise<void>,
 *   list(params: ListItemsParams): Promise<{ rows: any[], nextCursor: string|null }>,
 *   listBetween(spaceIds: string[], from: string, to: string): Promise<any[]>,
 *   listActiveExpiringBetween(from: string, to: string): Promise<any[]>,
 *   archiveBySpace(spaceId: string): Promise<void>,
 * }} items
 * @property {{
 *   upsert(row: any): Promise<any>,
 *   listForUser(userId: string): Promise<any[]>,
 *   listForUsers(userIds: string[]): Promise<any[]>,
 *   get(id: string): Promise<any|null>,
 *   remove(id: string): Promise<void>,
 *   touch(id: string): Promise<void>,
 * }} devices
 * @property {{
 *   insert(row: any): Promise<any>,
 *   findByHash(hash: string): Promise<any|null>,
 *   revoke(id: string): Promise<void>,
 *   revokeAllForUser(userId: string): Promise<void>,
 * }} refreshTokens
 * @property {{
 *   get(barcode: string): Promise<any|null>,
 *   upsert(row: any): Promise<any>,
 * }} productCache
 * @property {{
 *   existingKeys(keys: string[]): Promise<Set<string>>,
 *   insertMany(rows: any[]): Promise<void>,
 * }} reminderLog
 */
export {};
