import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { isDateString, toDateString, addDays } from '@vt/shared';
import { spacing, useTheme } from '@/lib/theme';
import { formatDate } from '@/lib/format';
import { today } from '@/lib/today';
import { Label } from './ui';

/**
 * Date-only field. Native: taps open the platform picker. Web: a native
 * <input type="date"> via a TextInput-free DOM element. Also offers quick
 * "+N days" shortcuts because many expiry labels are relative.
 */
export function DateField({ label, value, onChange, error, allowClear, quick }: {
  label: string;
  value: string | null | undefined;
  onChange: (d: string | null) => void;
  error?: string | null;
  allowClear?: boolean;
  quick?: number[];
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const base = value && isDateString(value) ? value : today();

  const toJs = (d: string) => {
    const [y, m, day] = d.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, day);
  };

  return (
    <View style={{ gap: spacing(1) }}>
      <Label>{label}</Label>
      {Platform.OS === 'web' ? (
        <WebDateInput value={value ?? ''} onChange={(v) => onChange(v || null)} color={t.text} bg={t.inputBg} border={error ? t.danger : t.border} />
      ) : (
        <Pressable onPress={() => setOpen(true)} style={[styles.box, { backgroundColor: t.inputBg, borderColor: error ? t.danger : t.border }]}>
          <Text style={{ color: value ? t.text : t.muted, fontSize: 15 }}>{value ? formatDate(value) : 'Pick a date'}</Text>
        </Pressable>
      )}
      {open && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={toJs(base)}
          mode="date"
          display="default"
          onChange={(ev, d) => {
            setOpen(false);
            if (ev.type === 'set' && d) onChange(toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate()));
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) }}>
        {(quick ?? []).map((n) => (
          <Pressable key={n} onPress={() => onChange(addDays(today(), n))} style={[styles.quick, { borderColor: t.border, backgroundColor: t.card }]}>
            <Text style={{ color: t.primary, fontSize: 12, fontWeight: '700' }}>{n === 0 ? 'Today' : n % 30 === 0 ? `+${n / 30} mo` : n % 7 === 0 ? `+${n / 7} wk` : `+${n} d`}</Text>
          </Pressable>
        ))}
        {allowClear && value ? (
          <Pressable onPress={() => onChange(null)} style={[styles.quick, { borderColor: t.border, backgroundColor: t.card }]}>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700' }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={{ color: t.danger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

function WebDateInput({ value, onChange, color, bg, border }: { value: string; onChange: (v: string) => void; color: string; bg: string; border: string }) {
  // react-native-web renders unknown host components via createElement; we
  // reach for the DOM directly for a proper date picker.
  const { unstable_createElement } = require('react-native-web') as { unstable_createElement: (type: string, props: Record<string, unknown>) => React.ReactElement };
  return unstable_createElement('input', {
    type: 'date',
    value,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    style: { color, backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px', fontSize: 15, minHeight: 46, fontFamily: 'inherit' },
  });
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing(3), minHeight: 46, justifyContent: 'center' },
  quick: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
});
