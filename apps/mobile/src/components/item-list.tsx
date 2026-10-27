import React, { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { BUCKET_LABELS, EXPIRY_BUCKETS, type Item } from '@vt/shared';
import { useCategories, useItems, useSpaces, type ItemsFilter } from '@/lib/queries';
import { itemBucket } from '@/lib/format';
import { bucketColor, spacing, useTheme } from '@/lib/theme';
import { ItemRow } from './item-row';
import { Empty, ErrorBox, Loading } from './ui';

/**
 * Items grouped into expiry buckets (Expired / Today / This week / ...).
 * When `grouped` is false it renders a flat list in the API's order.
 */
export function ItemList({ filter, grouped = true, emptyTitle, emptyHint, header }: {
  filter: ItemsFilter;
  grouped?: boolean;
  emptyTitle: string;
  emptyHint?: string;
  header?: React.ReactElement;
}) {
  const t = useTheme();
  const q = useItems(filter);
  const cats = useCategories();
  const spaces = useSpaces();
  const catById = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c])), [cats.data]);
  const spaceById = useMemo(() => new Map((spaces.data ?? []).map((s) => [s.id, s])), [spaces.data]);
  const showSpace = !filter.spaceId && (spaces.data?.length ?? 0) > 1;

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const sections = useMemo(() => {
    if (!grouped) return [{ key: 'all', title: '', data: items }];
    const by = new Map<string, Item[]>();
    for (const it of items) {
      const b = it.status === 'active' ? itemBucket(it) : 'none';
      if (!by.has(b)) by.set(b, []);
      by.get(b)!.push(it);
    }
    return EXPIRY_BUCKETS.filter((b) => by.has(b)).map((b) => ({ key: b, title: BUCKET_LABELS[b], data: by.get(b)! }));
  }, [items, grouped]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox message={q.error.message} onRetry={() => q.refetch()} />;

  return (
    <SectionList
      sections={sections}
      keyExtractor={(it) => it.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(2), paddingBottom: spacing(24) }}
      ListHeaderComponent={header}
      renderSectionHeader={({ section }) =>
        section.title ? (
          <View style={styles.sectionHeader}>
            <View style={[styles.dot, { backgroundColor: bucketColor(section.key as never, t) }]} />
            <Text style={{ color: t.muted, fontWeight: '700', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {section.title} · {section.data.length}
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <ItemRow
          item={item}
          category={item.categoryId ? catById.get(item.categoryId) : undefined}
          spaceName={showSpace ? spaceById.get(item.spaceId)?.name : undefined}
        />
      )}
      ListEmptyComponent={<Empty title={emptyTitle} hint={emptyHint} />}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} tintColor={t.primary} />}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing(3), marginBottom: spacing(1) },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
