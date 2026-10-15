import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme, type Theme } from '@/lib/theme';
import { Icon } from './ui';

const MAX = 12;
const icon = require('../../assets/icon.png');

/** Full-screen keypad. `onSubmit` returns an error to shake + clear, or nothing on success. */
export function PinPad({ title, subtitle, submitLabel = 'Enter', onSubmit, footer }: {
  title: string;
  subtitle: ReactNode;
  submitLabel?: string;
  onSubmit: (pin: string) => Promise<string | void>;
  footer?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake] = useState(() => new Animated.Value(0));

  const submit = async () => {
    if (pin.length < 6 || busy) return;
    setBusy(true);
    const error = await onSubmit(pin);
    setBusy(false);
    if (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErr(error);
      Animated.sequence(
        [10, -10, 8, -8, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true })),
      ).start(() => setPin(''));
    } else {
      setPin('');
    }
  };

  const press = (d: string) => {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErr('');
    setPin((p) => (p.length < MAX ? p + d : p));
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom + 12, gap: 22 }}>
      <Image source={icon} style={{ width: 70, height: 70, borderRadius: 20 }} />
      <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 29, color: t.text, fontWeight: '500' }}>{title}</Text>
        <Text style={{ color: t.text3, fontSize: 15, marginTop: 6, textAlign: 'center' }}>{subtitle}</Text>
      </View>
      <Animated.View style={{ flexDirection: 'row', gap: 14, height: 18, alignItems: 'center', transform: [{ translateX: shake }] }} accessibilityLabel={`${pin.length} digits entered`}>
        {Array.from({ length: Math.max(6, pin.length) }, (_, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5,
            borderColor: i < pin.length ? (err ? t.red : t.text) : t.borderStrong, backgroundColor: i < pin.length ? (err ? t.red : t.text) : 'transparent' }} />
        ))}
      </Animated.View>
      <Text style={{ color: t.red, minHeight: 20, fontSize: 14 }} accessibilityLiveRegion="polite">{err}</Text>
      <View style={{ width: 80 * 3 + 22 * 2, flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 14 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} t={t} label={d} onPress={() => press(d)}><Text style={{ fontSize: 30, color: t.text }}>{d}</Text></Key>
        ))}
        <Key fn t={t} label="Delete" onPress={() => setPin((p) => p.slice(0, -1))}><Icon name="delete" size={26} /></Key>
        <Key t={t} label="0" onPress={() => press('0')}><Text style={{ fontSize: 30, color: t.text }}>0</Text></Key>
        <Key fn t={t} label={submitLabel} onPress={submit}>
          {busy ? <ActivityIndicator color={t.accent} /> : (
            <Text style={{ fontSize: 16, fontWeight: '700', color: pin.length >= 6 ? t.accent : t.text3 }}>{submitLabel}</Text>
          )}
        </Key>
      </View>
      {footer}
    </View>
  );
}

function Key({ children, onPress, label, fn, t }: { children: ReactNode; onPress: () => void; label: string; fn?: boolean; t: Theme }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
        backgroundColor: fn ? 'transparent' : pressed ? t.surface2 : t.surface, transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}
