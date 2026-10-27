import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  EXPIRY_TYPES,
  UNITS,
  createItemSchema,
  effectiveExpiry,
  type CreateItemInput,
  type ExpiryType,
  type Item,
} from '@vt/shared';
import { useCategories, useSpaces } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { spacing, useTheme } from '@/lib/theme';
import { formatDate } from '@/lib/format';
import { api } from '@/lib/api';
import { Button, Chip, Input, Label, Row } from './ui';
import { DateField } from './date-field';

const TYPE_LABELS: Record<ExpiryType, { label: string; hint: string }> = {
  fixed: { label: 'Expiry date', hint: 'Best-before, use-by, document or warranty end date.' },
  period: { label: 'Valid from–to', hint: 'Offers, coupons, subscriptions, insurance.' },
  after_opening: { label: 'After opening', hint: 'Cosmetics with a "12M" jar symbol: months after opening.' },
  review: { label: 'Review date', hint: 'No hard expiry, just remind me to check.' },
};

export type ItemFormValues = Omit<CreateItemInput, 'spaceId'> & { spaceId: string };

function fromItem(item: Item): ItemFormValues {
  return {
    spaceId: item.spaceId,
    name: item.name,
    brand: item.brand,
    categoryId: item.categoryId,
    barcode: item.barcode,
    quantity: item.quantity,
    unit: (item.unit as ItemFormValues['unit']) ?? null,
    location: item.location,
    expiryType: item.expiryType,
    startDate: item.startDate,
    expiryDate: item.expiryDate,
    openedAt: item.openedAt,
    paoMonths: item.paoMonths,
    reviewDate: item.reviewDate,
    reminderLeadDays: item.reminderLeadDays,
    notes: item.notes,
  };
}

export function ItemForm({ item, onSubmit, submitting, submitLabel }: {
  item?: Item;
  onSubmit: (values: ItemFormValues) => Promise<void>;
  submitting?: boolean;
  submitLabel: string;
}) {
  const t = useTheme();
  const params = useLocalSearchParams<{ barcode?: string; name?: string; brand?: string; url?: string; expiryDate?: string; startDate?: string; expiryType?: string; categoryKey?: string }>();
  const { spaceId: uiSpace } = useUi();
  const spaces = useSpaces();
  const [values, setValues] = useState<ItemFormValues>(() =>
    item
      ? fromItem(item)
      : {
          spaceId: uiSpace !== 'all' ? uiSpace : '',
          name: params.name ?? '',
          brand: params.brand ?? null,
          categoryId: null,
          barcode: params.barcode ?? null,
          quantity: null,
          unit: null,
          location: null,
          expiryType: (EXPIRY_TYPES as readonly string[]).includes(params.expiryType ?? '') ? (params.expiryType as ExpiryType) : 'fixed',
          startDate: params.startDate ?? null,
          expiryDate: params.expiryDate ?? null,
          openedAt: null,
          paoMonths: null,
          reviewDate: null,
          reminderLeadDays: null,
          notes: params.url ?? null,
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lookingUp, setLookingUp] = useState(false);
  const cats = useCategories(values.spaceId || undefined);

  // Default the space to the personal one once spaces load.
  const spaceList = spaces.data ?? [];
  const effectiveSpaceId = values.spaceId || spaceList.find((s) => s.type === 'personal')?.id || spaceList[0]?.id || '';
  const set = <K extends keyof ItemFormValues>(k: K, v: ItemFormValues[K]) => setValues((s) => ({ ...s, [k]: v }));

  // Pre-select a category when launched with a categoryKey (extension capture).
  React.useEffect(() => {
    if (!item && params.categoryKey && !values.categoryId && cats.data) {
      const c = cats.data.find((x) => x.key === params.categoryKey);
      if (c) set('categoryId', c.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.data]);

  const preview = useMemo(() => effectiveExpiry(values), [values]);
  const selectedCat = cats.data?.find((c) => c.id === values.categoryId);

  const lookupBarcode = async () => {
    if (!values.barcode) return;
    setLookingUp(true);
    try {
      const p = await api.lookupProduct(values.barcode);
      setValues((s) => ({ ...s, name: s.name || p.name || '', brand: s.brand || p.brand }));
    } catch {
      if (Platform.OS === 'web') window.alert('No product found for that barcode. You can still fill it in by hand.');
      else Alert.alert('Not found', 'No product found for that barcode. You can still fill it in by hand.');
    } finally {
      setLookingUp(false);
    }
  };

  const submit = async () => {
    const payload: ItemFormValues = { ...values, spaceId: effectiveSpaceId };
    const parsed = createItemSchema.safeParse(payload);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const issue of parsed.error.issues) e[issue.path.join('.') || 'form'] = issue.message;
      setErrors(e);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data as ItemFormValues);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4), paddingBottom: spacing(16) }} keyboardShouldPersistTaps="handled">
      <Row>
        <View style={{ flex: 1 }}>
          <Input label="Name" value={values.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Marie biscuits" error={errors.name} autoFocus={!item} />
        </View>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <Input label="Barcode" value={values.barcode ?? ''} onChangeText={(v) => set('barcode', v || null)} placeholder="Scan or type" keyboardType="number-pad" error={errors.barcode} />
        </View>
        <Button title="Look up" variant="secondary" onPress={lookupBarcode} loading={lookingUp} disabled={!values.barcode} style={{ marginTop: 22 }} icon={<Ionicons name="search" size={16} color={t.primary} />} />
      </Row>
      <Input label="Brand (optional)" value={values.brand ?? ''} onChangeText={(v) => set('brand', v || null)} placeholder="Brand" error={errors.brand} />

      {spaceList.length > 1 && !item ? (
        <View style={{ gap: spacing(2) }}>
          <Label>Space</Label>
          <Row style={{ flexWrap: 'wrap' }}>
            {spaceList.map((s) => (
              <Chip key={s.id} label={`${s.icon ?? ''} ${s.name}`.trim()} active={effectiveSpaceId === s.id} onPress={() => set('spaceId', s.id)} />
            ))}
          </Row>
        </View>
      ) : null}

      <View style={{ gap: spacing(2) }}>
        <Label>Category</Label>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="None" active={!values.categoryId} onPress={() => set('categoryId', null)} />
          {(cats.data ?? []).map((c) => (
            <Chip key={c.id} label={`${c.icon ?? ''} ${c.name}`.trim()} active={values.categoryId === c.id} onPress={() => set('categoryId', c.id)} />
          ))}
        </Row>
      </View>

      <View style={{ gap: spacing(2) }}>
        <Label>How does it expire?</Label>
        <Row style={{ flexWrap: 'wrap' }}>
          {EXPIRY_TYPES.map((ty) => (
            <Chip key={ty} label={TYPE_LABELS[ty].label} active={values.expiryType === ty} onPress={() => set('expiryType', ty)} />
          ))}
        </Row>
        <Text style={{ color: t.muted, fontSize: 13 }}>{TYPE_LABELS[values.expiryType].hint}</Text>
      </View>

      {values.expiryType === 'fixed' ? (
        <DateField label="Expiry date" value={values.expiryDate} onChange={(d) => set('expiryDate', d)} error={errors.expiryDate} quick={[7, 30, 90, 365]} />
      ) : null}
      {values.expiryType === 'period' ? (
        <>
          <DateField label="Valid from" value={values.startDate} onChange={(d) => set('startDate', d)} error={errors.startDate} quick={[0]} />
          <DateField label="Valid until" value={values.expiryDate} onChange={(d) => set('expiryDate', d)} error={errors.expiryDate} quick={[7, 14, 30]} />
        </>
      ) : null}
      {values.expiryType === 'after_opening' ? (
        <>
          <Input label="Months after opening (PAO)" value={values.paoMonths?.toString() ?? ''} onChangeText={(v) => set('paoMonths', v ? Number(v) : null)} keyboardType="number-pad" placeholder="e.g. 12" error={errors.paoMonths} />
          <DateField label="Opened on" value={values.openedAt} onChange={(d) => set('openedAt', d)} allowClear quick={[0]} error={errors.openedAt} />
          <DateField label="Printed expiry (optional)" value={values.expiryDate} onChange={(d) => set('expiryDate', d)} allowClear error={errors.expiryDate} />
        </>
      ) : null}
      {values.expiryType === 'review' ? (
        <DateField label="Review on" value={values.reviewDate} onChange={(d) => set('reviewDate', d)} error={errors.reviewDate} quick={[30, 90, 180, 365]} />
      ) : null}

      <View style={[styles.preview, { backgroundColor: t.primarySoft }]}>
        <Ionicons name="time-outline" size={18} color={t.primary} />
        <Text style={{ color: t.primary, fontWeight: '700' }}>
          {preview ? `Tracked until ${formatDate(preview)}` : 'No date yet'}
          {' · '}reminder {values.reminderLeadDays ?? selectedCat?.defaultLeadDays ?? 3} days before
        </Text>
      </View>

      <Row>
        <View style={{ flex: 1 }}>
          <Input label="Quantity" value={values.quantity?.toString() ?? ''} onChangeText={(v) => set('quantity', v ? Number(v) : null)} keyboardType="decimal-pad" placeholder="e.g. 2" error={errors.quantity} />
        </View>
        <View style={{ flex: 2, gap: spacing(1) }}>
          <Label>Unit</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(1), paddingVertical: 4 }}>
            {UNITS.map((u) => (
              <Chip key={u} label={u} active={values.unit === u} onPress={() => set('unit', values.unit === u ? null : u)} />
            ))}
          </ScrollView>
        </View>
      </Row>
      <Input label="Location (optional)" value={values.location ?? ''} onChangeText={(v) => set('location', v || null)} placeholder="Fridge, bathroom shelf, wallet…" error={errors.location} />
      <Input label="Remind me (days before, optional)" value={values.reminderLeadDays?.toString() ?? ''} onChangeText={(v) => set('reminderLeadDays', v ? Number(v) : null)} keyboardType="number-pad" placeholder={`Category default: ${selectedCat?.defaultLeadDays ?? 3}`} error={errors.reminderLeadDays} />
      <Input label="Notes" value={values.notes ?? ''} onChangeText={(v) => set('notes', v || null)} placeholder="Anything else" multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} error={errors.notes} />
      {errors.form ? <Text style={{ color: t.danger }}>{errors.form}</Text> : null}
      <Button title={submitLabel} onPress={submit} loading={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing(3), borderRadius: 10 },
});
