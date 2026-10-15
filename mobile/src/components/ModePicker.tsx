import { Pressable, Text, View } from 'react-native';
import type { PermissionMode } from '../../../shared/types';
import { useTheme } from '@/lib/theme';
import { Icon, type IconName } from './ui';

export const MODES: { id: PermissionMode; label: string; long: string; icon: IconName }[] = [
  { id: 'default', label: 'Ask', long: 'Ask before acting', icon: 'shield' },
  { id: 'acceptEdits', label: 'Auto-edit', long: 'Auto-accept edits', icon: 'edit-3' },
  { id: 'plan', label: 'Plan', long: 'Plan mode', icon: 'map' },
];

export function ModePicker({ mode, onChange }: { mode: PermissionMode; onChange: (m: PermissionMode) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: 12, padding: 3, gap: 2 }} accessibilityRole="radiogroup">
      {MODES.map((m) => {
        const on = mode === m.id;
        return (
          <Pressable
            key={m.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(m.id)}
            style={{ flex: 1, height: 36, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: on ? t.bgElev : 'transparent', elevation: on ? 2 : 0 }}
          >
            <Icon name={m.icon} size={14} color={on ? t.text : t.text2} />
            <Text style={{ color: on ? t.text : t.text2, fontWeight: '600', fontSize: 13.5 }}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
