import type { AuthTokens, TokenStore } from '@vt/shared';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'vt.auth.tokens';

/** SecureStore on native, localStorage on web. */
export const tokenStore: TokenStore = {
  async get() {
    try {
      const raw =
        Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
      return raw ? (JSON.parse(raw) as AuthTokens) : null;
    } catch {
      return null;
    }
  },
  async set(tokens) {
    const raw = JSON.stringify(tokens);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, raw);
    else await SecureStore.setItemAsync(KEY, raw);
  },
  async clear() {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  },
};
