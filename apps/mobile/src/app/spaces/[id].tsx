import React, { useState } from 'react';
import { Alert, Platform, ScrollView, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { useMembers, useSpaceMutations, useSpaces } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { spacing, useTheme } from '@/lib/theme';
import { Button, Card, Divider, ErrorBox, Input, Label, Loading, Row, Screen } from '@/components/ui';

export default function SpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { user } = useAuth();
  const spaces = useSpaces();
  const members = useMembers(id);
  const m = useSpaceMutations();
  const { setSpace } = useUi();
  const [name, setName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const space = spaces.data?.find((s) => s.id === id);
  if (spaces.isPending) return <Loading />;
  if (!space) return <ErrorBox message="Space not found" />;
  const isOwner = space.ownerUserId === user?.id;
  const inviteUrl = `${config.apiUrl}/join/${space.inviteCode ?? ''}`;

  const ask = (title: string, msg: string, fn: () => void) => {
    if (Platform.OS === 'web') return window.confirm(`${title}\n\n${msg}`) && fn();
    Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', style: 'destructive', onPress: fn }]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: space.name }} />
      <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4), paddingBottom: spacing(16) }}>
        <Card>
          <Label>Name</Label>
          <Row>
            <View style={{ flex: 1 }}>
              <Input value={name ?? space.name} onChangeText={setName} />
            </View>
            <Button title="Save" variant="secondary" disabled={name === null || name.trim() === space.name} loading={m.rename.isPending} onPress={() => m.rename.mutate({ id, name: name!.trim() }, { onSuccess: () => setName(null) })} />
          </Row>
          <Button title="Show only this space" variant="ghost" onPress={() => { setSpace(id); router.navigate('/(tabs)'); }} icon={<Ionicons name="funnel-outline" size={16} color={t.primary} />} />
        </Card>

        {space.type === 'shared' ? (
          <Card>
            <Label>Invite people</Label>
            <Text style={{ color: t.text, fontSize: 28, fontWeight: '800', letterSpacing: 4, textAlign: 'center' }}>{space.inviteCode}</Text>
            <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center' }}>Anyone with this code can join and edit items. Rotate it if it leaks.</Text>
            <Row style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button title={copied ? 'Copied' : 'Copy code'} variant="secondary" onPress={async () => { await Clipboard.setStringAsync(space.inviteCode ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500); }} icon={<Ionicons name="copy-outline" size={16} color={t.primary} />} />
              <Button title="Share link" variant="secondary" onPress={() => Share.share({ message: `Join my "${space.name}" space on Validity Tracker: ${inviteUrl} (code ${space.inviteCode})` }).catch(() => {})} icon={<Ionicons name="share-social-outline" size={16} color={t.primary} />} />
              <Button title="Rotate" variant="ghost" loading={m.rotate.isPending} onPress={() => m.rotate.mutate(id)} />
            </Row>
          </Card>
        ) : null}

        <Card>
          <Label>Members</Label>
          {members.isPending ? <Loading /> : null}
          {(members.data ?? []).map((mem, i) => (
            <View key={mem.userId} style={{ gap: spacing(2) }}>
              {i > 0 ? <Divider /> : null}
              <Row>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '600' }}>{mem.name}{mem.userId === user?.id ? ' (you)' : ''}{mem.userId === space.ownerUserId ? ' · owner' : ''}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>{mem.email}</Text>
                </View>
              </Row>
            </View>
          ))}
        </Card>

        {space.type === 'shared' ? (
          <Card>
            <Button title="Leave space" variant="secondary" loading={m.leave.isPending} onPress={() => ask('Leave space?', 'You will stop seeing its items. If you are the last member the space is removed.', async () => { await m.leave.mutateAsync({ id, userId: user!.id }); setSpace('all'); router.back(); })} />
            {isOwner ? (
              <Button title="Delete space for everyone" variant="danger" loading={m.remove.isPending} onPress={() => ask('Delete space?', 'All members lose access and its items are archived.', async () => { await m.remove.mutateAsync(id); setSpace('all'); router.back(); })} />
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
