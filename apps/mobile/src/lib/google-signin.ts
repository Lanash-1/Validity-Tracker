// Native (Android) Google sign-in. Web has its own implementation in
// google-signin.web.ts which Metro picks automatically.
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { config } from './config';

let configured = false;

export function isGoogleConfigured(): boolean {
  return Boolean(config.googleWebClientId);
}

/** Returns a Google ID token for the signed-in account, or null if cancelled. */
export async function getGoogleIdToken(): Promise<string | null> {
  if (!configured) {
    GoogleSignin.configure({ webClientId: config.googleWebClientId, offlineAccess: false });
    configured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return null;
  return res.data.idToken ?? null;
}

export async function googleSignOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore
  }
}
