import { Pressable, Text } from 'react-native';
import { forgetServer, signIn, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { PinPad } from '@/components/PinPad';

export function Login() {
  const t = useTheme();
  const host = useStore((s) => s.host);
  return (
    <PinPad
      title="Pocket Claude"
      subtitle={`Enter your PIN for ${host || 'your computer'}`}
      onSubmit={async (pin) => {
        try {
          await signIn('/api/login', { pin });
        } catch (e: any) {
          if (e.status === 429) return `Too many attempts. Try again in ${Math.ceil((e.body?.retryAfterMs ?? 60000) / 60000)} min.`;
          if (e.status === 0) return 'Can’t reach your computer.';
          return 'Wrong PIN';
        }
      }}
      footer={
        <Pressable onPress={() => void forgetServer()} hitSlop={10}>
          <Text style={{ color: t.text2, fontWeight: '500' }}>Use a different computer</Text>
        </Pressable>
      }
    />
  );
}
