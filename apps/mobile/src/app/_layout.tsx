import 'react-native-gesture-handler';
import React, { useEffect, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { NotificationTapHandler } from '@/components/notification-tap-handler';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      retry: 1,
      // Lists stay readable offline from the persisted cache.
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'online' },
  },
});

const persister = createAsyncStoragePersister({
  storage: Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage : AsyncStorage,
  key: 'vt.query-cache',
  throttleTime: 1000,
});

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000, buster: 'v1' }}
    >
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

function Navigation() {
  const scheme = useColorScheme();
  const t = useTheme();
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: t.primary, background: t.bg, card: t.card, text: t.text, border: t.border } };
  }, [scheme, t]);

  if (status === 'loading') return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {status === 'signedIn' ? <NotificationTapHandler onItem={(id) => router.push(`/items/${id}`)} /> : null}
      <Stack screenOptions={{ headerTintColor: t.primary, headerTitleStyle: { color: t.text }, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="items/new" options={{ title: 'Add item', presentation: 'modal' }} />
          <Stack.Screen name="items/[id]/index" options={{ title: 'Item' }} />
          <Stack.Screen name="items/[id]/edit" options={{ title: 'Edit item', presentation: 'modal' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan barcode', presentation: 'fullScreenModal' }} />
          <Stack.Screen name="spaces/[id]" options={{ title: 'Space' }} />
          <Stack.Screen name="join/[code]" options={{ title: 'Join space' }} />
          <Stack.Screen name="extension-auth" options={{ title: 'Connect extension' }} />
        </Stack.Protected>
        <Stack.Protected guard={status !== 'signedIn'}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
