// Web push registration using the standard Push API + our service worker.
import { api } from './api';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function registerForPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission === 'denied') return false;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return false;
  }
  const { publicKey } = await api.getVapidPublicKey();
  if (!publicKey) return false;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number | null };
  await api.registerDevice({
    platform: 'web',
    subscription: { endpoint: json.endpoint, keys: json.keys, expirationTime: json.expirationTime ?? null },
    label: navigator.userAgent.slice(0, 100),
  });
  return true;
}

export async function unregisterPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
}

export async function sendTestNotification(): Promise<number> {
  const res = await api.sendTestNotification();
  return res.sent;
}

export function itemIdFromNotification(): string | null {
  return null;
}
