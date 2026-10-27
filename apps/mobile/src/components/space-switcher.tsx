import React from 'react';
import { ScrollView } from 'react-native';
import { useSpaces } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { spacing } from '@/lib/theme';
import { Chip } from './ui';

export function SpaceSwitcher() {
  const spaces = useSpaces();
  const { spaceId, setSpace } = useUi();
  const list = spaces.data ?? [];
  if (list.length <= 1) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(2), paddingHorizontal: spacing(4) }}>
      <Chip label="All spaces" active={spaceId === 'all'} onPress={() => setSpace('all')} />
      {list.map((s) => (
        <Chip key={s.id} label={`${s.icon ?? ''} ${s.name}`.trim()} active={spaceId === s.id} onPress={() => setSpace(s.id)} />
      ))}
    </ScrollView>
  );
}
