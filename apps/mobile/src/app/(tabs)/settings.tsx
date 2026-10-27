import React, { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isValidTimeZone } from '@vt/shared';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { useQueryClient } from '@tanstack/react-query';
import { registerForPush, sendTestNotification } from '@/lib/notifications';
import { deviceTimeZone } from '@/lib/today';
import { spacing, useTheme } from '@/lib/theme';
import { Button, Card, Input, Label, Row, Screen } from '@/components/ui';

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(user?.name ?? '');
  const [tz, setTz] = useState(user?.timezone ?? deviceTimeZone());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (!isValidTimeZone(tz)) throw new Error('Unknown time zone');
      await api.updateMe({ name: name.trim(), timezone: tz });
      await refreshUser();
      setMsg('Saved');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const enablePush = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const ok = await registerForPush();
      setMsg(ok ? 'Notifications enabled on this device' : 'Permission not granted (or unsupported here)');
      void qc.invalidateQueries({ queryKey: ['devices'] });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const n = await sendTestNotification();
      setMsg(n ? `Sent to ${n} device${n === 1 ? '' : 's'}` : 'No registered devices yet');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4), paddingBottom: spacing(16) }}>
        <Card>
          <Label>Profile</Label>
          <Text style={{ color: t.muted }}>{user?.email}</Text>
          <Input label="Name" value={name} onChangeText={setName} />
          <Input label="Time zone" value={tz} onChangeText={setTz} autoCapitalize="none" autoCorrect={false} placeholder="e.g. Asia/Kolkata" />
          <Row>
            <Button title="Save" onPress={save} loading={busy} />
            <Button title={`Use device zone (${deviceTimeZone()})`} variant="ghost" onPress={() => setTz(deviceTimeZone())} />
          </Row>
          <Text style={{ color: t.muted, fontSize: 12 }}>Reminders are delivered around 9:00 in this time zone.</Text>
        </Card>

        <Card>
          <Label>Reminders</Label>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            You get a reminder a few days before an item expires (per category or per item), on the day, and once it has expired.
          </Text>
          <Row style={{ flexWrap: 'wrap' }}>
            <Button title="Enable on this device" variant="secondary" onPress={enablePush} loading={busy} />
            <Button title="Send test" variant="ghost" onPress={test} loading={busy} />
          </Row>
        </Card>

        {Platform.OS === 'web' ? (
          <Card>
            <Label>Browser extension</Label>
            <Text style={{ color: t.muted, fontSize: 13 }}>Connect the Chrome extension to save offers and validity dates straight from web pages.</Text>
            <Button title="Connect extension" variant="secondary" onPress={() => router.push('/extension-auth')} />
          </Card>
        ) : null}

        <Card>
          <Label>Account</Label>
          <Button title="Sign out" variant="danger" onPress={signOut} />
          <View style={{ gap: 2 }}>
            <Text style={{ color: t.muted, fontSize: 12 }}>API: {config.apiUrl}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>Validity Tracker 0.1.0</Text>
          </View>
        </Card>
        {msg ? <Text style={{ color: t.primary, textAlign: 'center' }}>{msg}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
