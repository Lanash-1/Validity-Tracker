// Android push registration via expo-notifications. Web has its own file.
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let lastToken: string | null = null;

export async function registerForPush(): Promise<boolean> {
  if (!Device.isDevice) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('expiry-reminders', {
      name: 'Expiry reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F766E',
    });
  }
  const perm = await Notifications.getPermissionsAsync();
  let granted = perm.granted;
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  lastToken = token;
  await api.registerDevice({ platform: 'android', token, label: Device.modelName ?? undefined });
  return true;
}

export async function unregisterPush(): Promise<void> {
  if (!lastToken) return;
  const devices = await api.listDevices().catch(() => []);
  // The API does not expose tokens, so remove every android device of this user
  // whose label matches this device; good enough for sign-out hygiene.
  for (const d of devices) {
    if (d.platform === 'android' && d.label === (Device.modelName ?? null)) await api.deleteDevice(d.id).catch(() => {});
  }
  lastToken = null;
}

export async function sendTestNotification(): Promise<number> {
  const res = await api.sendTestNotification();
  return res.sent;
}

/** Returns the item id a tapped notification points at, if any. */
export function itemIdFromNotification(n: Notifications.Notification): string | null {
  const data = n.request.content.data as { itemId?: string } | undefined;
  return data?.itemId ?? null;
}
