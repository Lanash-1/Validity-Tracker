import type {
  AuthResponse,
  AuthTokens,
  CalendarQuery,
  CalendarResponse,
  Category,
  ConsumeItemInput,
  CreateCategoryInput,
  CreateItemInput,
  CreateSpaceInput,
  Device,
  Item,
  JoinSpaceInput,
  ListItemsQuery,
  Paginated,
  ProductLookup,
  RegisterDeviceInput,
  Space,
  SpaceMember,
  UpdateCategoryInput,
  UpdateItemInput,
  UpdateMeInput,
  UpdateSpaceInput,
  User,
} from '../schemas/index.js';
import type { Platform } from '../constants.js';

/** Where the client keeps its tokens: SecureStore, localStorage, chrome.storage... */
export interface TokenStore {
  get(): Promise<AuthTokens | null>;
  set(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  fetch?: typeof fetch;
  /** Called when the refresh token is rejected and the user must sign in again. */
  onSignedOut?: () => void;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildQuery(q?: Query): string {
  if (!q) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Typed HTTP client for the Validity Tracker API. Framework-agnostic so the
 * Expo app, the web build and the browser extension share one implementation.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly tokens: TokenStore;
  private readonly fetchImpl: typeof fetch;
  private readonly onSignedOut: (() => void) | undefined;
  private refreshing: Promise<AuthTokens | null> | null = null;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.tokens = opts.tokenStore;
    this.fetchImpl = opts.fetch ?? ((...args) => fetch(...args));
    this.onSignedOut = opts.onSignedOut;
  }

  // ---- auth -------------------------------------------------------------

  async signInWithGoogle(
    idToken: string,
    platform: Platform,
    extra?: { deviceLabel?: string; timezone?: string },
  ): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('POST', '/auth/google', {
      body: { idToken, platform, ...extra },
      auth: false,
    });
    await this.tokens.set({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      expiresIn: res.expiresIn,
    });
    return res;
  }

  /** Store tokens obtained elsewhere (e.g. handed to the extension by the web app). */
  async adoptTokens(tokens: AuthTokens): Promise<void> {
    await this.tokens.set(tokens);
  }

  async signOut(): Promise<void> {
    const t = await this.tokens.get();
    if (t) {
      try {
        await this.request('POST', '/auth/logout', {
          body: { refreshToken: t.refreshToken },
          auth: true,
          retryOn401: false,
        });
      } catch {
        // Best effort; local sign-out always proceeds.
      }
    }
    await this.tokens.clear();
  }

  async isSignedIn(): Promise<boolean> {
    return (await this.tokens.get()) !== null;
  }

  private async refresh(): Promise<AuthTokens | null> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const current = await this.tokens.get();
      if (!current) return null;
      try {
        const next = await this.request<AuthTokens>('POST', '/auth/refresh', {
          body: { refreshToken: current.refreshToken },
          auth: false,
        });
        await this.tokens.set(next);
        return next;
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 401 || e.status === 403)) {
          await this.tokens.clear();
          this.onSignedOut?.();
          return null;
        }
        throw e;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  // ---- me ---------------------------------------------------------------

  getMe(): Promise<User> {
    return this.request('GET', '/me');
  }

  updateMe(input: UpdateMeInput): Promise<User> {
    return this.request('PATCH', '/me', { body: input });
  }

  // ---- spaces -----------------------------------------------------------

  listSpaces(): Promise<Space[]> {
    return this.request('GET', '/spaces');
  }

  createSpace(input: CreateSpaceInput): Promise<Space> {
    return this.request('POST', '/spaces', { body: input });
  }

  updateSpace(id: string, input: UpdateSpaceInput): Promise<Space> {
    return this.request('PATCH', `/spaces/${enc(id)}`, { body: input });
  }

  deleteSpace(id: string): Promise<void> {
    return this.request('DELETE', `/spaces/${enc(id)}`);
  }

  rotateInvite(id: string): Promise<Space> {
    return this.request('POST', `/spaces/${enc(id)}/invite/rotate`);
  }

  joinSpace(input: JoinSpaceInput): Promise<Space> {
    return this.request('POST', '/spaces/join', { body: input });
  }

  listMembers(id: string): Promise<SpaceMember[]> {
    return this.request('GET', `/spaces/${enc(id)}/members`);
  }

  leaveSpace(id: string, userId: string): Promise<void> {
    return this.request('DELETE', `/spaces/${enc(id)}/members/${enc(userId)}`);
  }

  // ---- categories -------------------------------------------------------

  listCategories(spaceId?: string): Promise<Category[]> {
    return this.request('GET', `/categories${buildQuery({ spaceId })}`);
  }

  createCategory(spaceId: string, input: CreateCategoryInput): Promise<Category> {
    return this.request('POST', `/spaces/${enc(spaceId)}/categories`, { body: input });
  }

  updateCategory(spaceId: string, id: string, input: UpdateCategoryInput): Promise<Category> {
    return this.request('PATCH', `/spaces/${enc(spaceId)}/categories/${enc(id)}`, { body: input });
  }

  deleteCategory(spaceId: string, id: string): Promise<void> {
    return this.request('DELETE', `/spaces/${enc(spaceId)}/categories/${enc(id)}`);
  }

  // ---- items ------------------------------------------------------------

  listItems(query: Partial<ListItemsQuery> = {}): Promise<Paginated<Item>> {
    return this.request('GET', `/items${buildQuery(query as Query)}`);
  }

  getItem(id: string): Promise<Item> {
    return this.request('GET', `/items/${enc(id)}`);
  }

  createItem(input: CreateItemInput): Promise<Item> {
    return this.request('POST', '/items', { body: input });
  }

  updateItem(id: string, input: UpdateItemInput): Promise<Item> {
    return this.request('PATCH', `/items/${enc(id)}`, { body: input });
  }

  deleteItem(id: string): Promise<void> {
    return this.request('DELETE', `/items/${enc(id)}`);
  }

  consumeItem(id: string, input: ConsumeItemInput = {}): Promise<Item> {
    return this.request('POST', `/items/${enc(id)}/consume`, { body: input });
  }

  restoreItem(id: string): Promise<Item> {
    return this.request('POST', `/items/${enc(id)}/restore`);
  }

  calendar(query: CalendarQuery): Promise<CalendarResponse> {
    return this.request('GET', `/items/calendar${buildQuery(query)}`);
  }

  /**
   * Upload a photo. `file` is a Blob on web/extension; on React Native pass
   * `{ uri, name, type }` which fetch's FormData understands.
   */
  uploadItemPhoto(
    id: string,
    file: Blob | { uri: string; name: string; type: string },
  ): Promise<Item> {
    const form = new FormData();
    // React Native's FormData accepts the {uri,name,type} shape at runtime.
    form.append('photo', file as Blob, 'name' in file ? file.name : 'photo.jpg');
    return this.request('POST', `/items/${enc(id)}/photo`, { body: form });
  }

  deleteItemPhoto(id: string): Promise<Item> {
    return this.request('DELETE', `/items/${enc(id)}/photo`);
  }

  // ---- products ---------------------------------------------------------

  lookupProduct(barcode: string): Promise<ProductLookup> {
    return this.request('GET', `/products/${enc(barcode)}`);
  }

  // ---- devices / notifications -----------------------------------------

  registerDevice(input: RegisterDeviceInput): Promise<Device> {
    return this.request('POST', '/devices', { body: input });
  }

  listDevices(): Promise<Device[]> {
    return this.request('GET', '/devices');
  }

  deleteDevice(id: string): Promise<void> {
    return this.request('DELETE', `/devices/${enc(id)}`);
  }

  sendTestNotification(): Promise<{ sent: number }> {
    return this.request('POST', '/notifications/test');
  }

  getVapidPublicKey(): Promise<{ publicKey: string }> {
    return this.request('GET', '/notifications/vapid-public-key', { auth: false });
  }

  // ---- core -------------------------------------------------------------

  async request<T = void>(
    method: string,
    path: string,
    opts: { body?: unknown; auth?: boolean; retryOn401?: boolean } = {},
  ): Promise<T> {
    const { body, auth = true, retryOn401 = true } = opts;
    const headers: Record<string, string> = { Accept: 'application/json' };
    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (auth) {
      const t = await this.tokens.get();
      if (!t) throw new ApiClientError(401, 'not_signed_in', 'Not signed in');
      headers.Authorization = `Bearer ${t.accessToken}`;
    }

    const res = await this.fetchImpl(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: payload,
    });

    if (res.status === 401 && auth && retryOn401) {
      const next = await this.refresh();
      if (next) return this.request<T>(method, path, { ...opts, retryOn401: false });
      throw new ApiClientError(401, 'session_expired', 'Session expired, please sign in again');
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!res.ok) {
      const err = (json as { error?: { code?: string; message?: string; details?: unknown } })
        ?.error;
      throw new ApiClientError(
        res.status,
        err?.code ?? `http_${res.status}`,
        err?.message ?? res.statusText ?? 'Request failed',
        err?.details,
      );
    }
    return json as T;
  }
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

/** Simple in-memory token store, handy for tests and server-side scripts. */
export class MemoryTokenStore implements TokenStore {
  private value: AuthTokens | null = null;
  async get() {
    return this.value;
  }
  async set(t: AuthTokens) {
    this.value = t;
  }
  async clear() {
    this.value = null;
  }
}
