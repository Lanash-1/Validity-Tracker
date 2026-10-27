import webpush from 'web-push';

/**
 * Push delivery. Android devices hold Expo push tokens and are reached through
 * the Expo Push Service; web and extension devices hold Web Push
 * subscriptions and are reached through VAPID web push.
 *
 * Both senders return the device ids whose token is dead so callers can
 * delete them.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * @param {Array<{id: string, token: string}>} devices
 * @param {{title: string, body: string, data?: object}} message
 * @param {{accessToken?: string, fetch?: typeof fetch}} [opts]
 * @returns {Promise<{sent: number, dead: string[]}>}
 */
export async function sendExpoPush(devices, message, opts = {}) {
  const fetchImpl = opts.fetch ?? fetch;
  const dead = [];
  let sent = 0;
  for (let i = 0; i < devices.length; i += 100) {
    const batch = devices.slice(i, i + 100);
    const payload = batch.map((d) => ({
      to: d.token,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: 'default',
      channelId: 'expiry-reminders',
      priority: 'high',
    }));
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;
    const res = await fetchImpl(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('expo push failed', res.status, await res.text().catch(() => ''));
      continue;
    }
    const json = /** @type {any} */ (await res.json());
    const tickets = Array.isArray(json?.data) ? json.data : [];
    tickets.forEach((t, idx) => {
      if (t.status === 'ok') sent += 1;
      else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[idx].id);
      else console.warn('expo push ticket error', t.message, t.details);
    });
  }
  return { sent, dead };
}

let vapidConfigured = false;
function ensureVapid(vapid) {
  if (vapidConfigured) return true;
  if (!vapid.publicKey || !vapid.privateKey) return false;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * @param {Array<{id: string, subscription: object}>} devices
 * @param {{title: string, body: string, data?: object}} message
 * @param {{publicKey: string, privateKey: string, subject: string}} vapid
 * @param {{send?: typeof webpush.sendNotification}} [opts]
 * @returns {Promise<{sent: number, dead: string[]}>}
 */
export async function sendWebPush(devices, message, vapid, opts = {}) {
  const dead = [];
  let sent = 0;
  if (devices.length === 0) return { sent, dead };
  if (!opts.send && !ensureVapid(vapid)) {
    console.warn('web push skipped: VAPID keys not configured');
    return { sent, dead };
  }
  const send = opts.send ?? webpush.sendNotification.bind(webpush);
  const body = JSON.stringify({
    title: message.title,
    body: message.body,
    data: message.data ?? {},
  });
  await Promise.all(
    devices.map(async (d) => {
      try {
        await send(d.subscription, body, { TTL: 60 * 60 * 24 });
        sent += 1;
      } catch (/** @type {any} */ err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) dead.push(d.id);
        else console.warn('web push error', status, err?.message);
      }
    }),
  );
  return { sent, dead };
}

/**
 * Fan a message out to a user's devices (rows from the devices table).
 * @param {any[]} deviceRows
 * @param {{title: string, body: string, data?: object}} message
 * @param {{vapid: {publicKey: string, privateKey: string, subject: string}, expoAccessToken?: string, fetch?: typeof fetch, webSend?: any}} cfg
 */
export async function sendToDevices(deviceRows, message, cfg) {
  const expo = [];
  const web = [];
  for (const d of deviceRows) {
    if (d.platform === 'android') expo.push({ id: d.ROWID, token: d.token });
    else {
      try {
        web.push({ id: d.ROWID, subscription: JSON.parse(d.token) });
      } catch {
        web.push({ id: d.ROWID, subscription: null });
      }
    }
  }
  const [a, b] = await Promise.all([
    sendExpoPush(expo, message, { accessToken: cfg.expoAccessToken, fetch: cfg.fetch }),
    sendWebPush(
      web.filter((w) => w.subscription),
      message,
      cfg.vapid,
      cfg.webSend ? { send: cfg.webSend } : {},
    ),
  ]);
  return { sent: a.sent + b.sent, dead: [...a.dead, ...b.dead] };
}
