import React, { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { tokenStore } from '@/lib/token-store';
import { spacing, useTheme } from '@/lib/theme';
import { Button, Card, Screen } from '@/components/ui';

declare const chrome: { runtime?: { sendMessage?: (id: string, msg: unknown, cb?: (r: unknown) => void) => void; lastError?: unknown } } | undefined;

/**
 * Web-only hand-off page. The extension opens /extension-auth?ext=<id>;
 * once the user is signed in here we send the session tokens to it via
 * chrome.runtime.sendMessage (allowed through externally_connectable).
 */
export default function ExtensionAuthScreen() {
  const t = useTheme();
  const { ext } = useLocalSearchParams<{ ext?: string }>();
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    try {
      if (Platform.OS !== 'web' || typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) throw new Error('Open this page in Chrome with the extension installed.');
      if (!ext) throw new Error('Missing extension id. Start from the extension popup.');
      const tokens = await tokenStore.get();
      if (!tokens) throw new Error('Not signed in.');
      chrome.runtime.sendMessage(ext, { type: 'vt:tokens', tokens }, () => {
        if (chrome?.runtime?.lastError) {
          setErr('The extension did not answer. Is it installed and enabled?');
          setState('error');
        } else setState('sent');
      });
    } catch (e) {
      setErr((e as Error).message);
      setState('error');
    }
  };

  useEffect(() => {
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ext]);

  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center', padding: spacing(6) }}>
      <Card style={{ maxWidth: 420, width: '100%', alignItems: 'center' }}>
        <Text style={{ fontSize: 40 }}>{state === 'sent' ? '✅' : state === 'error' ? '⚠️' : '🔗'}</Text>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
          {state === 'sent' ? 'Extension connected' : state === 'error' ? 'Could not connect' : 'Connecting the extension…'}
        </Text>
        {state === 'sent' ? <Text style={{ color: t.muted, textAlign: 'center' }}>You can close this tab and use the extension popup.</Text> : null}
        {err ? <Text style={{ color: t.danger, textAlign: 'center' }}>{err}</Text> : null}
        {state === 'error' ? <Button title="Retry" onPress={send} /> : null}
      </Card>
    </Screen>
  );
}
