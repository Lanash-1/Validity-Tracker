import {
  REMINDER_HOUR,
  addDays,
  describeDays,
  diffDays,
  hourInTimeZone,
  isReminderDue,
  reminderSchedule,
  resolveLeadDays,
  todayInTimeZone,
} from '@vt/shared';
import { sendToDevices } from './push.js';

/**
 * The reminder engine shared by the cron function and tests.
 *
 * One run:
 *   1. Load active items whose effective expiry falls in a window around now
 *      (wide enough to cover the longest lead time plus the grace period).
 *   2. For each item, for each member of its space, compute which reminders
 *      (lead / day_of / expired) are due in that member's time zone.
 *   3. Drop anything already recorded in reminder_log.
 *   4. Group per user, send one notification per item (or a digest when a
 *      user has more than `digestThreshold` due), log, and clean dead devices.
 */

export const MAX_LEAD_DAYS = 365;

/**
 * @param {import('./repo/types.js').Repo} repo
 * @param {object} cfg
 * @param {{vapid: any, expoAccessToken?: string}} cfg.push
 * @param {Date} [cfg.now]
 * @param {typeof fetch} [cfg.fetch]
 * @param {any} [cfg.webSend]
 * @param {number} [cfg.digestThreshold]
 */
export async function runReminderSweep(repo, cfg) {
  const now = cfg.now ?? new Date();
  const digestThreshold = cfg.digestThreshold ?? 3;
  const utcToday = todayInTimeZone('UTC', now);
  // Items whose expiry is up to MAX_LEAD_DAYS ahead (lead reminders) or a
  // couple of days behind (expired reminders + grace + zone skew).
  const from = addDays(utcToday, -3);
  const to = addDays(utcToday, MAX_LEAD_DAYS + 1);
  const items = await repo.items.listActiveExpiringBetween(from, to);
  if (items.length === 0) return { users: 0, notifications: 0, reminders: 0 };

  const builtIn = await repo.categories.listBuiltIn();
  const categoryLead = new Map(builtIn.map((c) => [String(c.ROWID), Number(c.default_lead_days)]));

  // Collect members per space and users.
  const spaceIds = [...new Set(items.map((i) => String(i.space_id)))];
  const membersBySpace = new Map();
  for (const sid of spaceIds) membersBySpace.set(sid, await repo.members.listUserIds(sid));
  const userIds = [...new Set([...membersBySpace.values()].flat())];
  const users = new Map((await repo.users.getMany(userIds)).map((u) => [String(u.ROWID), u]));

  /** @type {Map<string, Array<{item: any, kind: string, date: string, key: string, days: number}>>} */
  const dueByUser = new Map();
  const candidateKeys = [];

  for (const item of items) {
    let catLead = null;
    if (item.category_id) {
      catLead = categoryLead.has(String(item.category_id))
        ? categoryLead.get(String(item.category_id))
        : ((await repo.categories.get(String(item.category_id)))?.default_lead_days ?? null);
    }
    const lead = resolveLeadDays(item.reminder_lead_days, catLead);
    const schedule = reminderSchedule(rowToExpiryFields(item), lead);
    for (const uid of membersBySpace.get(String(item.space_id)) ?? []) {
      const user = users.get(uid);
      if (!user) continue;
      const tz = user.timezone || 'UTC';
      const localToday = todayInTimeZone(tz, now);
      const localHour = hourInTimeZone(tz, now);
      for (const s of schedule) {
        if (!isReminderDue(s.date, localToday, localHour, REMINDER_HOUR)) continue;
        const key = `${item.ROWID}:${uid}:${s.kind}:${s.date}`;
        candidateKeys.push(key);
        if (!dueByUser.has(uid)) dueByUser.set(uid, []);
        dueByUser.get(uid).push({
          item,
          kind: s.kind,
          date: s.date,
          key,
          days: diffDays(localToday, item.effective_expiry),
        });
      }
    }
  }

  if (candidateKeys.length === 0) return { users: 0, notifications: 0, reminders: 0 };
  const already = await repo.reminderLog.existingKeys(candidateKeys);

  let notifications = 0;
  let reminders = 0;
  const logRows = [];
  const deadDevices = new Set();
  const sentAt = now.toISOString();

  for (const [uid, list] of dueByUser) {
    const fresh = list.filter((r) => !already.has(r.key));
    if (fresh.length === 0) continue;
    // One entry per item: prefer the most urgent kind if several are due at once.
    const perItem = new Map();
    for (const r of fresh) {
      const prev = perItem.get(r.item.ROWID);
      if (!prev || rank(r.kind) > rank(prev.kind)) perItem.set(r.item.ROWID, r);
    }
    const entries = [...perItem.values()];
    const devices = await repo.devices.listForUser(uid);
    const messages =
      entries.length > digestThreshold ? [digestMessage(entries)] : entries.map(singleMessage);

    for (const m of messages) {
      const res = await sendToDevices(devices, m, {
        vapid: cfg.push.vapid,
        expoAccessToken: cfg.push.expoAccessToken,
        fetch: cfg.fetch,
        webSend: cfg.webSend,
      });
      notifications += res.sent;
      res.dead.forEach((d) => deadDevices.add(d));
    }
    for (const r of fresh) {
      reminders += 1;
      logRows.push({
        item_id: String(r.item.ROWID),
        user_id: String(uid),
        kind: r.kind,
        scheduled_for: r.date,
        sent_at: sentAt,
        channel: devices.length ? 'push' : 'none',
        dedupe_key: r.key,
      });
    }
  }

  if (logRows.length) await repo.reminderLog.insertMany(logRows);
  for (const id of deadDevices) await repo.devices.remove(id);

  return { users: dueByUser.size, notifications, reminders };
}

function rank(kind) {
  return kind === 'expired' ? 3 : kind === 'day_of' ? 2 : 1;
}

export function rowToExpiryFields(row) {
  return {
    expiryType: row.expiry_type,
    startDate: row.start_date,
    expiryDate: row.expiry_date,
    openedAt: row.opened_at,
    paoMonths: row.pao_months == null ? null : Number(row.pao_months),
    reviewDate: row.review_date,
  };
}

export function singleMessage({ item, kind, days }) {
  const name = item.name;
  let title;
  let body;
  if (kind === 'expired') {
    title = `${name} has expired`;
    body = item.expiry_type === 'period' ? 'The validity period has ended.' : 'Time to check or discard it.';
  } else if (kind === 'day_of') {
    title = item.expiry_type === 'review' ? `Review ${name} today` : `${name} expires today`;
    body = item.expiry_type === 'period' ? 'Last day of validity.' : 'Use it or lose it.';
  } else {
    title = item.expiry_type === 'review' ? `Review ${name} ${describeDays(days)}` : `${name} expires ${describeDays(days)}`;
    body = item.location ? `In ${item.location}.` : 'Tap to see details.';
  }
  return { title, body, data: { itemId: String(item.ROWID), kind } };
}

export function digestMessage(entries) {
  const expired = entries.filter((e) => e.kind === 'expired').length;
  const soon = entries.length - expired;
  const parts = [];
  if (soon) parts.push(`${soon} item${soon === 1 ? '' : 's'} expiring soon`);
  if (expired) parts.push(`${expired} expired`);
  const names = entries
    .slice(0, 3)
    .map((e) => e.item.name)
    .join(', ');
  return {
    title: parts.join(', '),
    body: entries.length > 3 ? `${names} and ${entries.length - 3} more` : names,
    data: { kind: 'digest' },
  };
}
