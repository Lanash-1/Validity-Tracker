import jwt from 'jsonwebtoken';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from '@vt/shared';
import { newOpaqueToken, sha256 } from '@vt/fn-common';

export function signAccessToken(user, secret, ttl = ACCESS_TOKEN_TTL_SECONDS) {
  return jwt.sign({ email: user.email }, secret, {
    subject: String(user.ROWID),
    expiresIn: ttl,
    issuer: 'validity-tracker',
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token, secret) {
  return /** @type {import('jsonwebtoken').JwtPayload} */ (
    jwt.verify(token, secret, { issuer: 'validity-tracker', algorithms: ['HS256'] })
  );
}

/**
 * Creates a refresh token, stores only its hash, and returns the plaintext.
 * @param {import('@vt/fn-common/src/repo/types.js').Repo} repo
 * @param {string} userId
 * @param {{platform?: string|null, deviceLabel?: string|null}} [meta]
 */
export async function issueRefreshToken(repo, userId, meta = {}) {
  const { platform, deviceLabel } = meta;
  const plain = newOpaqueToken();
  await repo.refreshTokens.insert({
    user_id: String(userId),
    token_hash: sha256(plain),
    expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
    revoked_at: null,
    device_label: deviceLabel ?? null,
    platform: platform ?? null,
  });
  return plain;
}

export async function issueTokenPair(repo, user, secret, meta) {
  const refreshToken = await issueRefreshToken(repo, user.ROWID, meta);
  return {
    accessToken: signAccessToken(user, secret),
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}
