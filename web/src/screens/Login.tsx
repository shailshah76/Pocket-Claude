import { api } from '../store';
import { PinPad } from '../components/PinPad';

export function Login({ onDone }: { onDone: () => void }) {
  return (
    <PinPad
      title="Pocket Claude"
      subtitle="Enter your PIN"
      onSubmit={async (pin) => {
        try {
          await api('/api/login', { body: { pin } });
          onDone();
        } catch (e: any) {
          if (e.status === 429) return `Too many attempts. Try again in ${Math.ceil((e.body?.retryAfterMs ?? 60000) / 60000)} min.`;
          if (e.status === 0) return 'Can’t reach your computer. Is it awake and on Tailscale?';
          return 'Wrong PIN';
        }
      }}
    />
  );
}
