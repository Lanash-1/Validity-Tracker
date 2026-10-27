/**
 * Reads configuration from environment variables. Catalyst exposes the
 * function's configured env variables through `process.env`.
 */
export function loadConfig(env = process.env) {
  const list = (v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const isDev = env.NODE_ENV !== 'production' && env.VT_DEV === '1';
  return {
    isDev,
    jwtSecret: env.JWT_SECRET || (isDev ? 'dev-secret-do-not-use-in-production' : ''),
    googleClientIds: list(env.GOOGLE_CLIENT_IDS),
    /** In dev, accept fake id tokens of the form `dev:<email>[:<name>]`. */
    allowFakeGoogle: isDev && env.DEV_FAKE_GOOGLE === '1',
    vapid: {
      publicKey: env.VAPID_PUBLIC_KEY || '',
      privateKey: env.VAPID_PRIVATE_KEY || '',
      subject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    },
    expoAccessToken: env.EXPO_ACCESS_TOKEN || '',
    photoFolderId: env.PHOTO_FOLDER_ID || '',
    corsOrigins: list(env.CORS_ORIGINS),
    /** Max photo upload size in bytes. */
    maxPhotoBytes: Number(env.MAX_PHOTO_BYTES || 5 * 1024 * 1024),
  };
}

/** @typedef {ReturnType<typeof loadConfig>} Config */
