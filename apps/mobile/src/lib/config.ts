import Constants from 'expo-constants';
import { Platform } from 'react-native';

function envApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  // On web the API is served from the same Catalyst domain as the client.
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  // Android emulator → host machine.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : 'http://10.0.2.2:3000';
}

export const config = {
  apiUrl: envApiUrl(),
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  devSignIn: process.env.EXPO_PUBLIC_DEV_SIGNIN === '1',
};
