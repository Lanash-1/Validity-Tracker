import type { AuthTokens, TokenStore } from '@vt/shared';

const KEY = 'vt.auth.tokens';

export const tokenStore: TokenStore = {
  async get() {
    const r = await chrome.storage.local.get(KEY);
    return (r[KEY] as AuthTokens | undefined) ?? null;
  },
  async set(tokens) {
    await chrome.storage.local.set({ [KEY]: tokens });
  },
  async clear() {
    await chrome.storage.local.remove(KEY);
  },
};
