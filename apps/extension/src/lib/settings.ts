export interface Settings {
  /** Base URL of the API and web app (same Catalyst domain). */
  apiUrl: string;
  /** Preferred space id for quick-add, or '' for the personal space. */
  defaultSpaceId: string;
}

const KEY = 'vt.settings';
const DEFAULTS: Settings = {
  apiUrl: (import.meta.env.WXT_API_URL as string | undefined) ?? 'http://localhost:3000',
  defaultSpaceId: '',
};

export async function getSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...((r[KEY] as Partial<Settings> | undefined) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  next.apiUrl = next.apiUrl.replace(/\/+$/, '');
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
