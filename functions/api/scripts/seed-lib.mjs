import { BUILT_IN_CATEGORIES } from '@vt/shared';

/** Inserts the built-in categories that are missing. Idempotent by `key`. */
export async function seedBuiltInCategories(repo) {
  const existing = await repo.categories.listBuiltIn();
  const have = new Set(existing.map((c) => c.key));
  let inserted = 0;
  for (const c of BUILT_IN_CATEGORIES) {
    if (have.has(c.key)) continue;
    await repo.categories.insert({
      space_id: null,
      key: c.key,
      name: c.name,
      icon: c.icon,
      default_lead_days: c.defaultLeadDays,
      sort_order: c.sortOrder,
    });
    inserted += 1;
  }
  return inserted;
}
