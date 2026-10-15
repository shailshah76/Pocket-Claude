import { useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '@/lib/theme';
import { connectTo } from '@/screens/Connect';
import { Button, IconButton } from '@/components/ui';

export default function Scan() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  const onScan = async (data: string) => {
    if (handled.current) return;
    handled.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBusy(true);
    const e = await connectTo(data);
    setBusy(false);
    if (e) {
      setErr(e);
      setTimeout(() => (handled.current = false), 2500);
    } else {
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {perm?.granted ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(r) => void onScan(r.data)}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, backgroundColor: t.bg }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: t.text, textAlign: 'center' }}>Scan the QR code</Text>
          <Text style={{ color: t.text2, textAlign: 'center' }}>Pocket Claude needs the camera to read the code shown on your computer.</Text>
          {perm && <Button label={perm.canAskAgain ? 'Allow camera' : 'Camera blocked in Settings'} icon="camera" variant="primary" disabled={!perm.canAskAgain} onPress={requestPerm} />}
        </View>
      )}
      {perm?.granted && (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 250, height: 250, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' }} />
          <Text style={{ color: '#fff', marginTop: 20, fontSize: 15, fontWeight: '500' }}>
            {busy ? 'Connecting…' : 'Point at the QR code from npm run onboard'}
          </Text>
          {busy && <ActivityIndicator color="#fff" style={{ marginTop: 10 }} />}
          {!!err && (
            <Text style={{ color: '#fff', backgroundColor: 'rgba(214,69,53,0.9)', padding: 12, borderRadius: 12, marginTop: 16, marginHorizontal: 24, textAlign: 'center' }}>{err}</Text>
          )}
        </View>
      )}
      <View style={{ position: 'absolute', top: insets.top + 6, left: 8 }}>
        <IconButton name="x" label="Close" color={perm?.granted ? '#fff' : t.text2} onPress={() => router.back()} />
      </View>
    </View>
  );
}
