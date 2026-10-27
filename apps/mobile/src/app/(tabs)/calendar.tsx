import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addMonths, daysInMonth, monthKey, toDateString, weekdayIndex } from '@vt/shared';
import { useCalendar, useCategories } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { today } from '@/lib/today';
import { spacing, useTheme } from '@/lib/theme';
import { ItemRow } from '@/components/item-row';
import { SpaceSwitcher } from '@/components/space-switcher';
import { Button, Empty, ErrorBox, Loading, Row, Screen } from '@/components/ui';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export default function CalendarScreen() {
  const t = useTheme();
  const { spaceId } = useUi();
  const [month, setMonth] = useState(() => monthKey(today()));
  const [selected, setSelected] = useState<string | null>(today());
  const cal = useCalendar(spaceId === 'all' ? undefined : spaceId, month);
  const cats = useCategories();
  const catById = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c])), [cats.data]);

  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = toDateString(y, m, 1);
  const offset = weekdayIndex(first);
  const count = daysInMonth(y, m);
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => toDateString(y, m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const todayStr = today();
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const dayItems = (cal.data?.items ?? []).filter((i) => i.effectiveExpiry === selected);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingVertical: spacing(3), gap: spacing(3), paddingBottom: spacing(12) }}>
        <SpaceSwitcher />
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: spacing(4) }}>
          <Button title="‹" variant="ghost" onPress={() => setMonth(monthKey(addMonths(first, -1)))} accessibilityLabel="Previous month" />
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{label}</Text>
          <Button title="›" variant="ghost" onPress={() => setMonth(monthKey(addMonths(first, 1)))} accessibilityLabel="Next month" />
        </Row>
        <View style={{ paddingHorizontal: spacing(4) }}>
          <View style={styles.grid}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={[styles.cell, { color: t.muted, fontSize: 12, fontWeight: '700' }]}>{w}</Text>
            ))}
            {cells.map((d, i) => {
              const n = d ? cal.data?.days[d] ?? 0 : 0;
              const isSel = d === selected;
              const isToday = d === todayStr;
              return (
                <Pressable
                  key={i}
                  disabled={!d}
                  onPress={() => setSelected(d)}
                  style={[styles.cell, styles.day, isSel && { backgroundColor: t.primary }, isToday && !isSel && { borderColor: t.primary, borderWidth: 1 }]}
                >
                  {d ? <Text style={{ color: isSel ? '#fff' : t.text, fontWeight: isToday ? '800' : '500' }}>{Number(d.slice(8))}</Text> : null}
                  {n > 0 ? (
                    <View style={[styles.badge, { backgroundColor: isSel ? '#fff' : d && d < todayStr ? t.danger : t.warn }]}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: isSel ? t.primary : '#fff' }}>{n}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ paddingHorizontal: spacing(4), gap: spacing(2) }}>
          <Text style={{ color: t.muted, fontWeight: '700', textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.5 }}>
            {selected ? `Expiring on ${selected}` : 'Pick a day'}
          </Text>
          {cal.isPending ? <Loading /> : cal.isError ? <ErrorBox message={cal.error.message} onRetry={() => cal.refetch()} /> : null}
          {cal.data && selected && dayItems.length === 0 ? <Empty title="Nothing expires this day" /> : null}
          {dayItems.map((it) => (
            <ItemRow key={it.id} item={it} category={it.categoryId ? catById.get(it.categoryId) : undefined} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 6 },
  day: { alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 10 },
  badge: { position: 'absolute', top: 3, right: 6, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
});
