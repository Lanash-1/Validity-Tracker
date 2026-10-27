import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { spacing, useTheme } from '@/lib/theme';
import { Button, Screen } from '@/components/ui';

export default function ScanScreen() {
  const router = useRouter();
  const t = useTheme();
  const [perm, requestPerm] = useCameraPermissions();
  const [done, setDone] = useState(false);
  const lock = useRef(false);

  if (!perm) return null;
  if (!perm.granted) {
    return (
      <Screen style={styles.center}>
        <Text style={{ color: t.text, textAlign: 'center', marginBottom: spacing(4) }}>Camera access is needed to scan barcodes.</Text>
        <Button title="Allow camera" onPress={requestPerm} />
        <Button title="Enter barcode manually" variant="ghost" onPress={() => router.replace('/items/new')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr', 'itf14', 'datamatrix'] }}
        onBarcodeScanned={(r) => {
          if (lock.current || !r.data) return;
          lock.current = true;
          setDone(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.replace({ pathname: '/items/new', params: { barcode: r.data } });
        }}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.frame, { borderColor: done ? t.ok : '#fff' }]} />
        <Text style={styles.hint}>Point the camera at the product barcode</Text>
        <Button title="Type it instead" variant="secondary" onPress={() => router.replace('/items/new')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing(6), gap: spacing(2) },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(4), padding: spacing(6) },
  frame: { width: 260, height: 160, borderWidth: 3, borderRadius: 16 },
  hint: { color: '#fff', fontWeight: '700', textShadowColor: '#000', textShadowRadius: 6 },
});
