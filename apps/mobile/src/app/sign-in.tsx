import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { isGoogleConfigured } from '@/lib/google-signin';
import { spacing, useTheme } from '@/lib/theme';
import { Button, Input, Screen } from '@/components/ui';

export default function SignInScreen() {
  const t = useTheme();
  const { signInWithGoogle, signInDev } = useAuth();
  const [busy, setBusy] = useState(false);
  const [devEmail, setDevEmail] = useState('you@example.com');
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed';
      setError(msg);
      if (Platform.OS !== 'web') Alert.alert('Sign-in failed', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
        <Text style={[styles.h1, { color: t.text }]}>Validity Tracker</Text>
        <Text style={{ color: t.muted, textAlign: 'center', lineHeight: 20 }}>
          Know what expires first. Food, cosmetics, medicines, documents, offers: anything with a date.
        </Text>
        <View style={{ height: spacing(4) }} />
        <Button
          title="Continue with Google"
          onPress={() => run(signInWithGoogle)}
          loading={busy}
          disabled={!isGoogleConfigured()}
          icon={<Text style={{ color: '#fff', fontWeight: '800' }}>G</Text>}
        />
        {!isGoogleConfigured() ? (
          <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>
            Google sign-in is not configured yet (set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
          </Text>
        ) : null}
        {config.devSignIn ? (
          <View style={{ gap: spacing(2), marginTop: spacing(4) }}>
            <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>Developer sign-in (local API only)</Text>
            <Input value={devEmail} onChangeText={setDevEmail} autoCapitalize="none" keyboardType="email-address" placeholder="email" />
            <Button title="Sign in as developer" variant="secondary" onPress={() => run(() => signInDev(devEmail))} loading={busy} />
          </View>
        ) : null}
        {error ? <Text style={{ color: t.danger, textAlign: 'center' }}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: spacing(6) },
  card: { width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: spacing(6), gap: spacing(3), alignItems: 'stretch' },
  logo: { width: 72, height: 72, borderRadius: 18, alignSelf: 'center' },
  h1: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
});
