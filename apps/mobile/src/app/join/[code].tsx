import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSpaceMutations } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { spacing, useTheme } from '@/lib/theme';
import { Button, Loading, Screen } from '@/components/ui';

/** Deep link target: vt://join/CODE or https://<host>/join/CODE */
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const t = useTheme();
  const m = useSpaceMutations();
  const { setSpace } = useUi();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    m.join
      .mutateAsync(code.toUpperCase())
      .then((s) => { setSpace(s.id); router.replace(`/spaces/${s.id}`); })
      .catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (error)
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center', padding: spacing(6), gap: spacing(3) }}>
        <Text style={{ color: t.danger, textAlign: 'center' }}>{error}</Text>
        <Button title="Go home" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  return <Loading />;
}
