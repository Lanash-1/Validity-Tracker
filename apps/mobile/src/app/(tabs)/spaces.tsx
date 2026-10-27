import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSpaceMutations, useSpaces } from '@/lib/queries';
import { spacing, useTheme } from '@/lib/theme';
import { Button, Card, ErrorBox, Input, Label, Loading, Row, Screen } from '@/components/ui';

export default function SpacesScreen() {
  const t = useTheme();
  const router = useRouter();
  const spaces = useSpaces();
  const m = useSpaceMutations();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);

  if (spaces.isPending) return <Loading />;
  if (spaces.isError) return <ErrorBox message={spaces.error.message} onRetry={() => spaces.refetch()} />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4), paddingBottom: spacing(16) }}>
        <View style={{ gap: spacing(2) }}>
          {spaces.data.map((s) => (
            <Pressable key={s.id} onPress={() => router.push(`/spaces/${s.id}`)} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.primarySoft : t.card, borderColor: t.border }]}>
              <Text style={{ fontSize: 26 }}>{s.icon ?? (s.type === 'personal' ? '🏠' : '👥')}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{s.name}</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>{s.type === 'personal' ? 'Only you' : `${s.memberCount} member${s.memberCount === 1 ? '' : 's'} · invite ${s.inviteCode ?? ''}`}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.muted} />
            </Pressable>
          ))}
        </View>

        <Card>
          <Label>Create a shared space</Label>
          <Text style={{ color: t.muted, fontSize: 13 }}>For your home, office or anyone you share a fridge with. Everyone in it can add and edit items.</Text>
          <Row>
            <View style={{ flex: 1 }}>
              <Input value={name} onChangeText={setName} placeholder="e.g. Home" />
            </View>
            <Button title="Create" disabled={!name.trim()} loading={m.create.isPending} onPress={async () => { try { const s = await m.create.mutateAsync(name.trim()); setName(''); router.push(`/spaces/${s.id}`); } catch (e) { setErr((e as Error).message); } }} />
          </Row>
        </Card>

        <Card>
          <Label>Join with an invite code</Label>
          <Row>
            <View style={{ flex: 1 }}>
              <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="8-character code" autoCapitalize="characters" autoCorrect={false} maxLength={8} />
            </View>
            <Button title="Join" variant="secondary" disabled={code.trim().length !== 8} loading={m.join.isPending} onPress={async () => { try { setErr(null); const s = await m.join.mutateAsync(code.trim()); setCode(''); router.push(`/spaces/${s.id}`); } catch (e) { setErr((e as Error).message); } }} />
          </Row>
          {err ? <Text style={{ color: t.danger }}>{err}</Text> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), padding: spacing(4), borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});
