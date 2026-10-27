import React from 'react';
import { ScrollView, View } from 'react-native';
import { useCategories } from '@/lib/queries';
import { useUi, type StatusFilter } from '@/lib/store';
import { spacing, useTheme } from '@/lib/theme';
import { Chip } from './ui';

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'expired', label: 'Expired' },
  { key: 'consumed', label: 'Used up' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'Everything' },
];

export function FilterBar() {
  const t = useTheme();
  const { status, setStatus, categoryId, setCategory, spaceId } = useUi();
  const cats = useCategories(spaceId === 'all' ? undefined : spaceId);
  return (
    <View style={{ gap: spacing(2) }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(2), paddingHorizontal: spacing(4) }}>
        {STATUSES.map((s) => (
          <Chip key={s.key} label={s.label} active={status === s.key} onPress={() => setStatus(s.key)} color={s.key === 'expired' ? t.danger : undefined} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(2), paddingHorizontal: spacing(4) }}>
        <Chip label="All categories" active={categoryId === null} onPress={() => setCategory(null)} />
        {(cats.data ?? []).map((c) => (
          <Chip key={c.id} label={`${c.icon ?? ''} ${c.name}`.trim()} active={categoryId === c.id} onPress={() => setCategory(categoryId === c.id ? null : c.id)} />
        ))}
      </ScrollView>
    </View>
  );
}
