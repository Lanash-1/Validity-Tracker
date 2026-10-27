import { ApiClient } from '@vt/shared';
import { config } from './config';
import { tokenStore } from './token-store';

let onSignedOut: (() => void) | null = null;
export function setSignedOutHandler(fn: () => void) {
  onSignedOut = fn;
}

export const api = new ApiClient({
  baseUrl: config.apiUrl,
  tokenStore,
  onSignedOut: () => onSignedOut?.(),
});

/** Absolute URL for a photo path returned by the API (requires the auth header). */
export function photoUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${config.apiUrl}${path}`;
}

export async function authHeaders(): Promise<Record<string, string>> {
  const t = await tokenStore.get();
  return t ? { Authorization: `Bearer ${t.accessToken}` } : {};
}
