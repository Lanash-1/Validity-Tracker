import { defineBackground } from 'wxt/utils/define-background';
import { addDays, todayInTimeZone } from '@vt/shared';
import { getApi, isSignedIn } from '@/src/lib/api';
import { getSettings } from '@/src/lib/settings';
import { tokenStore } from '@/src/lib/token-store';
import { PENDING_CAPTURE_KEY, type BackgroundRequest, type PendingCapture } from '@/src/lib/messages';

// Minimal service-worker globals (the DOM lib and the WebWorker lib cannot be combined).
interface SwPushEvent extends Event {
  data: { json(): unknown; text(): string } | null;
  waitUntil(p: Promise<unknown>): void;
}
interface SwNotificationEvent extends Event {
  notification: Notification;
  waitUntil(p: Promise<unknown>): void;
}
declare const self: {
  registration: ServiceWorkerRegistration;
  addEventListener(type: 'push', listener: (e: SwPushEvent) => void): void;
  addEventListener(type: 'notificationclick', listener: (e: SwNotificationEvent) => void): void;
};

const MENU_ID = 'vt-track-selection';
const BADGE_ALARM = 'vt-badge';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: 'Track validity of “%s”', contexts: ['selection'] });
    chrome.contextMenus.create({ id: `${MENU_ID}-page`, title: 'Track validity from this page', contexts: ['page'] });
    chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 360 });
    void refreshBadge();
  });
  chrome.runtime.onStartup.addListener(() => void refreshBadge());
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === BADGE_ALARM) void refreshBadge();
  });

  // The web app hands the session to us from /extension-auth.
  chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
    (async () => {
      const { apiUrl } = await getSettings();
      const allowed = isAllowedOrigin(sender.origin ?? sender.url ?? '', apiUrl);
      if (!allowed) return sendResponse({ ok: false, error: 'origin not allowed' });
      if (msg?.type === 'vt:tokens' && msg.tokens?.accessToken && msg.tokens?.refreshToken) {
        await tokenStore.set(msg.tokens);
        sendResponse({ ok: true });
        await refreshBadge();
        await ensurePushSubscription();
        return;
      }
      sendResponse({ ok: false, error: 'unknown message' });
    })().catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  });

  chrome.runtime.onMessage.addListener((msg: BackgroundRequest, _sender, sendResponse) => {
    if (msg?.type === 'vt:refreshBadge') refreshBadge().then(() => sendResponse({ ok: true }));
    else if (msg?.type === 'vt:signedOut') chrome.action.setBadgeText({ text: '' }).then(() => sendResponse({ ok: true }));
    else return false;
    return true;
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const capture: PendingCapture = {
      text: info.selectionText ?? '',
      title: tab?.title ?? '',
      url: info.pageUrl ?? tab?.url ?? '',
      createdAt: Date.now(),
    };
    void (async () => {
      await chrome.storage.session.set({ [PENDING_CAPTURE_KEY]: capture });
      try {
        await chrome.action.openPopup();
      } catch {
        await chrome.windows.create({ url: chrome.runtime.getURL('/popup.html?capture=1'), type: 'popup', width: 400, height: 640 });
      }
    })();
  });

  // Web Push delivered to the extension's service worker.
  self.addEventListener('push', (event) => {
    let payload: { title?: string; body?: string; data?: { itemId?: string } } = {};
    try {
      payload = (event.data?.json() as typeof payload) ?? {};
    } catch {
      payload = { body: event.data?.text() };
    }
    event.waitUntil(
      self.registration.showNotification(payload.title ?? 'Validity Tracker', {
        body: payload.body ?? 'You have an expiry reminder.',
        icon: chrome.runtime.getURL('/icon/128.png'),
        data: payload.data ?? {},
      }),
    );
  });
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
      (async () => {
        const { apiUrl } = await getSettings();
        const itemId = (event.notification.data as { itemId?: string } | undefined)?.itemId;
        await chrome.tabs.create({ url: itemId ? `${apiUrl}/items/${itemId}` : apiUrl });
      })(),
    );
  });
});

function isAllowedOrigin(origin: string, apiUrl: string): boolean {
  try {
    const o = new URL(origin).origin;
    if (o === new URL(apiUrl).origin) return true;
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  } catch {
    return false;
  }
}

/** Badge = number of active items expiring within 3 days (or already expired). */
async function refreshBadge(): Promise<void> {
  try {
    if (!(await isSignedIn())) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }
    const api = await getApi();
    const today = todayInTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const res = await api.listItems({ status: 'active', to: addDays(today, 3), sort: 'expiry', limit: 100 });
    const n = res.items.length;
    await chrome.action.setBadgeBackgroundColor({ color: n ? '#DC2626' : '#0F766E' });
    await chrome.action.setBadgeText({ text: n ? String(n) : '' });
  } catch (err) {
    console.warn('badge refresh failed', err);
  }
}

/** Subscribe this service worker to Web Push and register it as an `extension` device. */
async function ensurePushSubscription(): Promise<void> {
  try {
    const api = await getApi();
    const { publicKey } = await api.getVapidPublicKey();
    if (!publicKey || !self.registration?.pushManager) return;
    let sub = await self.registration.pushManager.getSubscription();
    if (!sub) {
      sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number | null };
    await api.registerDevice({
      platform: 'extension',
      subscription: { endpoint: json.endpoint, keys: json.keys, expirationTime: json.expirationTime ?? null },
      label: 'Chrome extension',
    });
  } catch (err) {
    console.warn('push subscription failed', err);
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
