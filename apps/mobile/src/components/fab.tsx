import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, useTheme } from '@/lib/theme';

export function Fab({ onPress, onScan }: { onPress: () => void; onScan?: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {onScan ? (
        <Pressable accessibilityLabel="Scan barcode" onPress={onScan} style={({ pressed }) => [styles.small, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.8 : 1 }]}>
          <Ionicons name="barcode-outline" size={22} color={t.primary} />
        </Pressable>
      ) : null}
      <Pressable accessibilityLabel="Add item" onPress={onPress} style={({ pressed }) => [styles.fab, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: spacing(5), bottom: spacing(5), alignItems: 'center', gap: spacing(3) },
  fab: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  small: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, elevation: 2 },
});
