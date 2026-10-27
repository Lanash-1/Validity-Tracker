import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addMonths } from '@vt/shared';
import { useCategories, useConsumeItem, useDeleteItem, useItem, useRemovePhoto, useRestoreItem, useSpaces, useUploadPhoto } from '@/lib/queries';
import { photoUrl } from '@/lib/api';
import { expiryLabel, formatDate, itemBucket, quantityLabel } from '@/lib/format';
import { bucketColor, spacing, useTheme } from '@/lib/theme';
import { useAuthHeaders } from '@/components/use-auth-headers';
import { Badge, Button, Card, Divider, ErrorBox, Input, Label, Loading, Row, Screen } from '@/components/ui';

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes', style: 'destructive', onPress: onYes }]);
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const item = useItem(id);
  const cats = useCategories();
  const spaces = useSpaces();
  const consume = useConsumeItem();
  const restore = useRestoreItem();
  const del = useDeleteItem();
  const upload = useUploadPhoto(id);
  const removePhoto = useRemovePhoto(id);
  const headers = useAuthHeaders();
  const [partial, setPartial] = useState('');

  if (item.isPending) return <Loading />;
  if (item.isError) return <ErrorBox message={item.error.message} onRetry={() => item.refetch()} />;
  const it = item.data;
  const cat = cats.data?.find((c) => c.id === it.categoryId);
  const space = spaces.data?.find((s) => s.id === it.spaceId);
  const bucket = itemBucket(it);
  const color = it.status === 'active' ? bucketColor(bucket, t) : t.muted;
  const uri = photoUrl(it.photoUrl);

  const pickPhoto = async (fromCamera: boolean) => {
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, mediaTypes: ['images'] });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (Platform.OS === 'web') {
      const blob = await (await fetch(a.uri)).blob();
      await upload.mutateAsync(blob);
    } else {
      await upload.mutateAsync({ uri: a.uri, name: a.fileName ?? 'photo.jpg', type: a.mimeType ?? 'image/jpeg' });
    }
  };

  const details: [string, string | null][] = [
    ['Brand', it.brand],
    ['Category', cat ? `${cat.icon ?? ''} ${cat.name}`.trim() : null],
    ['Space', space ? `${space.icon ?? ''} ${space.name}`.trim() : null],
    ['Location', it.location],
    ['Quantity', quantityLabel(it)],
    ['Barcode', it.barcode],
    it.expiryType === 'period' ? ['Valid from', formatDate(it.startDate)] : ['', null],
    it.expiryType === 'after_opening' ? ['Opened on', it.openedAt ? formatDate(it.openedAt) : 'Not yet opened'] : ['', null],
    it.expiryType === 'after_opening' ? ['Period after opening', it.paoMonths ? `${it.paoMonths} months${it.openedAt ? ` → ${formatDate(addMonths(it.openedAt, it.paoMonths))}` : ''}` : null] : ['', null],
    it.expiryType === 'after_opening' ? ['Printed expiry', it.expiryDate ? formatDate(it.expiryDate) : null] : ['', null],
    ['Reminder', `${it.reminderLeadDays ?? cat?.defaultLeadDays ?? 3} days before`],
    ['Added', formatDate(it.createdAt.slice(0, 10))],
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: it.name, headerRight: () => <Button title="Edit" variant="ghost" onPress={() => router.push(`/items/${id}/edit`)} /> }} />
      <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4), paddingBottom: spacing(16) }}>
        <Card style={{ alignItems: 'center', gap: spacing(3) }}>
          {uri ? (
            <Image source={{ uri, headers }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={[styles.photo, { backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 56 }}>{cat?.icon ?? '📦'}</Text>
            </View>
          )}
          <Row>
            <Button title={uri ? 'Replace photo' : 'Add photo'} variant="secondary" onPress={() => pickPhoto(false)} loading={upload.isPending} icon={<Ionicons name="image-outline" size={16} color={t.primary} />} />
            {Platform.OS !== 'web' ? <Button title="Camera" variant="secondary" onPress={() => pickPhoto(true)} icon={<Ionicons name="camera-outline" size={16} color={t.primary} />} /> : null}
            {uri ? <Button title="Remove" variant="ghost" onPress={() => removePhoto.mutate()} /> : null}
          </Row>
        </Card>

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color, fontSize: 20, fontWeight: '800' }}>{expiryLabel(it)}</Text>
            <Badge text={it.status === 'active' ? (bucket === 'expired' ? 'expired' : 'active') : it.status} color={color} />
          </Row>
          <Text style={{ color: t.muted }}>
            {it.effectiveExpiry ? `${it.expiryType === 'review' ? 'Review on' : 'Effective date'}: ${formatDate(it.effectiveExpiry)}` : 'No effective date yet'}
          </Text>
          {it.notes ? (
            <>
              <Divider />
              <Text style={{ color: t.text, lineHeight: 20 }}>{it.notes}</Text>
            </>
          ) : null}
        </Card>

        <Card>
          <Label>Actions</Label>
          {it.status === 'active' ? (
            <>
              <Row style={{ flexWrap: 'wrap' }}>
                <Button title={it.quantity != null && it.quantity > 1 ? 'Used up all' : 'Mark as used up'} onPress={() => consume.mutate({ id })} loading={consume.isPending} icon={<Ionicons name="checkmark-done" size={16} color="#fff" />} />
                {it.expiryType === 'after_opening' && !it.openedAt ? (
                  <Button title="Opened today" variant="secondary" onPress={() => router.push({ pathname: `/items/${id}/edit` })} />
                ) : null}
              </Row>
              {it.quantity != null && it.quantity > 1 ? (
                <Row>
                  <View style={{ flex: 1 }}>
                    <Input value={partial} onChangeText={setPartial} keyboardType="decimal-pad" placeholder={`Use some (of ${it.quantity})`} />
                  </View>
                  <Button title="Use" variant="secondary" disabled={!partial || Number(partial) <= 0} onPress={() => { consume.mutate({ id, quantity: Number(partial) }); setPartial(''); }} />
                </Row>
              ) : null}
            </>
          ) : (
            <Button title="Restore to active" variant="secondary" onPress={() => restore.mutate(id)} loading={restore.isPending} />
          )}
          <Button
            title="Delete item"
            variant="danger"
            onPress={() => confirm('Delete item?', `“${it.name}” will be removed for everyone in this space.`, async () => { await del.mutateAsync(id); router.back(); })}
            loading={del.isPending}
            icon={<Ionicons name="trash-outline" size={16} color="#fff" />}
          />
        </Card>

        <Card>
          <Label>Details</Label>
          {details.filter(([k, v]) => k && v).map(([k, v]) => (
            <Row key={k} style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: t.muted }}>{k}</Text>
              <Text style={{ color: t.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{v}</Text>
            </Row>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ photo: { width: '100%', height: 220, borderRadius: 12 } });
