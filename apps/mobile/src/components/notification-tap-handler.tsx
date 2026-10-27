import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { itemIdFromNotification } from '@/lib/notifications';

/** Navigates to the item when the user taps a reminder (native only). */
export function NotificationTapHandler({ onItem }: { onItem: (id: string) => void }) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (resp: Notifications.NotificationResponse | null) => {
      if (!resp) return;
      const id = itemIdFromNotification(resp.notification);
      if (id) onItem(id);
    };
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [onItem]);
  return null;
}
