import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUi } from '@/lib/store';
import { spacing } from '@/lib/theme';
import { ItemList } from '@/components/item-list';
import { SpaceSwitcher } from '@/components/space-switcher';
import { FilterBar } from '@/components/filter-bar';
import { Fab } from '@/components/fab';
import { Screen } from '@/components/ui';

export default function ExpiringScreen() {
  const router = useRouter();
  const { spaceId, status, categoryId, location } = useUi();
  const filter = {
    spaceId: spaceId === 'all' ? undefined : spaceId,
    status,
    categoryId: categoryId ?? undefined,
    location: location ?? undefined,
    sort: 'expiry' as const,
  };
  return (
    <Screen>
      <View style={{ paddingTop: spacing(3), gap: spacing(2) }}>
        <SpaceSwitcher />
        <FilterBar />
      </View>
      <ItemList
        filter={filter}
        grouped={status === 'active' || status === 'all'}
        emptyTitle={status === 'active' ? 'Nothing tracked yet' : 'Nothing here'}
        emptyHint={status === 'active' ? 'Tap + to add a product, a document or an offer and we will remind you before it expires.' : undefined}
      />
      <Fab onPress={() => router.push('/items/new')} onScan={() => router.push('/scan')} />
    </Screen>
  );
}
