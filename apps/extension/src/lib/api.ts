import { ApiClient } from '@vt/shared';
import { getSettings } from './settings';
import { tokenStore } from './token-store';

let client: ApiClient | null = null;
let clientBase = '';

/** API client bound to the configured base URL (rebuilt when settings change). */
export async function getApi(): Promise<ApiClient> {
  const { apiUrl } = await getSettings();
  if (!client || clientBase !== apiUrl) {
    client = new ApiClient({ baseUrl: apiUrl, tokenStore });
    clientBase = apiUrl;
  }
  return client;
}

export async function isSignedIn(): Promise<boolean> {
  return (await tokenStore.get()) !== null;
}

export async function extensionAuthUrl(): Promise<string> {
  const { apiUrl } = await getSettings();
  return `${apiUrl}/extension-auth?ext=${encodeURIComponent(chrome.runtime.id)}`;
}
