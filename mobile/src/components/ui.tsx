import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '@/lib/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Feather name={name} size={size} color={color ?? t.text2} style={style} />;
}

type Variant = 'primary' | 'default' | 'ghost' | 'danger';

export function Button({
  label, icon, onPress, variant = 'default', disabled, loading, small, block, style,
}: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : variant === 'ghost' ? 'transparent' : t.surface;
  const fg = variant === 'primary' ? t.onAccent : variant === 'danger' ? t.red : variant === 'ghost' ? t.text2 : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height: small ? 38 : 50,
          paddingHorizontal: small ? 14 : 18,
          borderRadius: small ? 11 : 14,
          backgroundColor: pressed && variant === 'primary' ? t.accentPress : bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          alignSelf: block ? 'stretch' : 'auto',
        },
        block && { flex: 0 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Feather name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 14 : 16 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, color, size = 22 }: { name: IconName; onPress: () => void; label: string; color?: string; size?: number }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.surface : 'transparent' })}
    >
      <Feather name={name} size={size} color={color ?? t.text2} />
    </Pressable>
  );
}

export function Chip({ children, icon, onPress, tone }: { children: ReactNode; icon?: IconName; onPress?: () => void; tone?: 'accent' }) {
  const t = useTheme();
  const fg = tone === 'accent' ? t.accent : t.text2;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
        backgroundColor: tone === 'accent' ? t.accentSoft : pressed ? t.surface2 : t.surface, alignSelf: 'flex-start',
      })}
    >
      {icon && <Feather name={icon} size={13} color={fg} />}
      {typeof children === 'string' ? <Text style={{ color: fg, fontSize: 13, fontWeight: '500' }}>{children}</Text> : children}
    </Pressable>
  );
}

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!pulse) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.3, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [pulse, v]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: v }} />;
}

/** Bottom sheet built on Modal: slides up, tap scrim or back to close. */
export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: t.scrim }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: t.bgElev, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 8, maxHeight: '88%' }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.borderStrong, alignSelf: 'center', marginTop: 8, marginBottom: 4 }} />
        {title !== undefined && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 10, paddingVertical: 6 }}>
            <Text style={[s.sheetTitle, { color: t.text }]} numberOfLines={2}>{title}</Text>
            <IconButton name="x" label="Close" onPress={onClose} />
          </View>
        )}
        {children}
        {footer}
      </View>
    </Modal>
  );
}

export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: t.text3, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

export function Skeleton({ height = 64 }: { height?: number }) {
  const t = useTheme();
  const [v] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.5, duration: 650, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={{ height, borderRadius: 14, backgroundColor: t.surface, marginHorizontal: 12, marginVertical: 5, opacity: v }} />;
}

export function Toast({ text }: { text: string | null }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, alignItems: 'center', zIndex: 100 }}>
      <View style={{ backgroundColor: t.text, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13, elevation: 6 }}>
        <Text style={{ color: t.bg, fontWeight: '500', fontSize: 14 }}>{text}</Text>
      </View>
    </View>
  );
}

export const s = StyleSheet.create({
  sheetTitle: { flex: 1, fontFamily: fonts.serif, fontSize: 21, fontWeight: '500' },
  h1: { fontFamily: fonts.serif, fontSize: 31, fontWeight: '500', letterSpacing: -0.3 },
  mono: { fontFamily: fonts.mono },
});
