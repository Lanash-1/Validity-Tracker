import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { Category, Item } from '@vt/shared';
import { bucketColor, spacing, useTheme } from '@/lib/theme';
import { expiryLabel, itemBucket, quantityLabel } from '@/lib/format';
import { photoUrl } from '@/lib/api';
import { useAuthHeaders } from './use-auth-headers';

export function ItemRow({ item, category, spaceName }: { item: Item; category?: Category; spaceName?: string }) {
  const t = useTheme();
  const router = useRouter();
  const headers = useAuthHeaders();
  const bucket = itemBucket(item);
  const color = item.status === 'active' ? bucketColor(bucket, t) : t.muted;
  const qty = quantityLabel(item);
  const uri = photoUrl(item.photoUrl);
  return (
    <Pressable
      onPress={() => router.push(`/items/${item.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.primarySoft : t.card, borderColor: t.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: t.primarySoft }]}>
        {uri ? (
          <Image source={{ uri, headers }} style={styles.thumbImg} contentFit="cover" />
        ) : (
          <Text style={{ fontSize: 22 }}>{category?.icon ?? '📦'}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[styles.name, { color: t.text, textDecorationLine: item.status === 'consumed' ? 'line-through' : 'none' }]}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13 }}>
          {[item.brand, category?.name, spaceName, item.location, qty].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{expiryLabel(item)}</Text>
        {item.status !== 'active' ? <Text style={{ color: t.muted, fontSize: 12 }}>{item.status}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3),
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 44, height: 44 },
  name: { fontSize: 16, fontWeight: '600' },
});
