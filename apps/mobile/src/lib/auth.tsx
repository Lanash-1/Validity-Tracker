import type { User } from '@vt/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setSignedOutHandler } from './api';
import { getGoogleIdToken, googleSignOut } from './google-signin';
import { deviceTimeZone } from './today';
import { registerForPush, unregisterPush } from './notifications';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signInDev: (email: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<User | null>(null);
  const qc = useQueryClient();

  const platform = Platform.OS === 'web' ? 'web' : 'android';

  const loadUser = useCallback(async () => {
    const me = await api.getMe();
    setUser(me);
    setStatus('signedIn');
    void registerForPush().catch(() => {});
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => {
      setUser(null);
      setStatus('signedOut');
      qc.clear();
    });
    (async () => {
      if (await api.isSignedIn()) {
        try {
          await loadUser();
          return;
        } catch {
          // Token may be stale; fall through to signed out.
        }
      }
      setStatus('signedOut');
    })();
  }, [loadUser, qc]);

  const signInWithGoogle = useCallback(async () => {
    const idToken = await getGoogleIdToken();
    if (!idToken) return;
    const res = await api.signInWithGoogle(idToken, platform, { timezone: deviceTimeZone() });
    setUser(res.user);
    setStatus('signedIn');
    void registerForPush().catch(() => {});
  }, [platform]);

  const signInDev = useCallback(
    async (email: string, name?: string) => {
      const res = await api.signInWithGoogle(`dev:${email}${name ? `:${name}` : ''}`, platform, {
        timezone: deviceTimeZone(),
      });
      setUser(res.user);
      setStatus('signedIn');
    },
    [platform],
  );

  const signOut = useCallback(async () => {
    await unregisterPush().catch(() => {});
    await api.signOut();
    await googleSignOut();
    qc.clear();
    setUser(null);
    setStatus('signedOut');
  }, [qc]);

  const value = useMemo<AuthState>(
    () => ({ status, user, signInWithGoogle, signInDev, signOut, refreshUser: loadUser }),
    [status, user, signInWithGoogle, signInDev, signOut, loadUser],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
