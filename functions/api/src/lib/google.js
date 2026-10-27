import { OAuth2Client } from 'google-auth-library';
import { unauthorized } from '@vt/fn-common';

let client;

/**
 * Verifies a Google ID token and returns the identity we care about.
 * In dev with DEV_FAKE_GOOGLE=1, accepts `dev:<email>[:<name>]`.
 * @returns {Promise<{sub: string, email: string, name: string, picture: string|null}>}
 */
export async function verifyGoogleIdToken(idToken, config) {
  if (config.allowFakeGoogle && idToken.startsWith('dev:')) {
    const [, email, name] = idToken.split(':');
    if (!email || !email.includes('@')) throw unauthorized('Bad dev token');
    return { sub: `dev-${email}`, email: email.toLowerCase(), name: name || email.split('@')[0], picture: null };
  }
  if (!config.googleClientIds.length) throw unauthorized('Google sign-in is not configured');
  client ??= new OAuth2Client();
  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience: config.googleClientIds });
  } catch (/** @type {any} */ err) {
    throw unauthorized(`Google token rejected: ${err?.message ?? 'unknown error'}`);
  }
  const p = ticket.getPayload();
  if (!p?.sub || !p.email || !p.email_verified) throw unauthorized('Google account email is not verified');
  return {
    sub: p.sub,
    email: p.email.toLowerCase(),
    name: p.name || p.email.split('@')[0],
    picture: p.picture ?? null,
  };
}
