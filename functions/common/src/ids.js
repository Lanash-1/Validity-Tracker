import { randomBytes, createHash } from 'node:crypto';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function newInviteCode(length = 8) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  return out;
}

export function newOpaqueToken(bytes = 48) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** Monotonic-ish ids for the in-memory repo. */
let counter = 1000;
export function nextMemoryId() {
  counter += 1;
  return String(counter);
}
