import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Image, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { biometricKind, unlockWithBiometrics, unlockWithPin, type BiometricKind } from '@/lib/lock';
import { usePrefs } from '@/lib/prefs';
import { useStore } from '@/lib/store';
import { fonts, useTheme } from '@/lib/theme';
import { PinPad } from './PinPad';
import { Button } from './ui';

const icon = require('../../assets/icon.png');
const LABEL: Record<BiometricKind, string> = { fingerprint: 'fingerprint', face: 'face', biometrics: 'fingerprint or face' };

/** Covers the whole app (including open sheets) while `locked` is set. */
export function LockScreen() {
  const locked = useStore((s) => s.locked);
  return (
    <Modal visible={locked} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => BackHandler.exitApp()}>
      {locked && <LockBody />}
    </Modal>
  );
}

function LockBody() {
  const t = useTheme();
  const host = useStore((s) => s.host);
  const prefs = usePrefs();
  const [kind, setKind] = useState<BiometricKind | null | undefined>(undefined);
  const [mode, setMode] = useState<'bio' | 'pin'>('bio');
  const prompting = useRef(false);

  const tryBio = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    await unlockWithBiometrics();
    prompting.current = false;
  }, []);

  useEffect(() => {
    void (async () => {
      const k = prefs.biometrics ? await biometricKind() : null;
      setKind(k);
      if (k) void tryBio();
      else setMode('pin');
    })();
    // Run once per lock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coming back from another app while locked: prompt again. Ignore 'inactive' (iOS shows that during Face ID itself).
  useEffect(() => {
    let prev = AppState.currentState;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && prev === 'background' && mode === 'bio' && kind) void tryBio();
      prev = s;
    });
    return () => sub.remove();
  }, [mode, kind, tryBio]);

  if (kind === undefined) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  if (mode === 'pin') {
    return (
      <PinPad
        title="Unlock"
        subtitle={`Enter your PIN for ${host || 'your computer'}`}
        submitLabel="Unlock"
        onSubmit={unlockWithPin}
        footer={
          kind ? (
            <Pressable onPress={() => (setMode('bio'), void tryBio())} hitSlop={10}>
              <Text style={{ color: t.text2, fontWeight: '500' }}>Use {LABEL[kind]} instead</Text>
            </Pressable>
          ) : null
        }
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
      <Image source={icon} style={{ width: 72, height: 72, borderRadius: 20 }} />
      <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: t.text }}>Pocket Claude is locked</Text>
      {!!host && <Text style={{ color: t.text3 }}>Connected to {host}</Text>}
      <Pressable
        onPress={() => void tryBio()}
        accessibilityRole="button"
        accessibilityLabel={`Unlock with ${LABEL[kind!]}`}
        style={({ pressed }) => ({ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginVertical: 12,
          backgroundColor: pressed ? t.surface2 : t.accentSoft })}
      >
        <MaterialCommunityIcons name={kind === 'face' ? 'face-recognition' : 'fingerprint'} size={48} color={t.accent} />
      </Pressable>
      <Button label={`Unlock with ${LABEL[kind!]}`} variant="primary" onPress={() => void tryBio()} style={{ alignSelf: 'stretch' }} />
      <Button label="Use PIN instead" variant="ghost" onPress={() => setMode('pin')} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
