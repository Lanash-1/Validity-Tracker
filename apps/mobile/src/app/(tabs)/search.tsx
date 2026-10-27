import React, { useState } from 'react';
import { View } from 'react-native';
import { useUi } from '@/lib/store';
import { spacing } from '@/lib/theme';
import { ItemList } from '@/components/item-list';
import { Input, Label, Screen } from '@/components/ui';

export default function SearchScreen() {
  const [q, setQ] = useState('');
  const { spaceId } = useUi();
  const spaceFilter = spaceId === 'all' ? undefined : spaceId;
  const trimmed = q.trim();
  return (
    <Screen>
      <View style={{ padding: spacing(4), gap: spacing(2) }}>
        <Input value={q} onChangeText={setQ} placeholder="Search name, brand, notes or barcode" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />
        <Label>{trimmed ? `Results for “${trimmed}”` : 'Recently added'}</Label>
      </View>
      {trimmed ? (
        <ItemList key="search" filter={{ spaceId: spaceFilter, status: 'all', q: trimmed, sort: 'expiry' }} grouped={false} emptyTitle="No matches" />
      ) : (
        <ItemList key="recent" filter={{ spaceId: spaceFilter, status: 'all', sort: 'created' }} grouped={false} emptyTitle="Nothing added yet" />
      )}
    </Screen>
  );
}
