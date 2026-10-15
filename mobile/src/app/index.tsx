import { View } from 'react-native';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { Connect, Unreachable } from '@/screens/Connect';
import { Setup } from '@/screens/Setup';
import { Login } from '@/screens/Login';
import { Home } from '@/screens/Home';

/** One route that swaps by connection phase, so sign-in states never pile up in the back stack. */
export default function Index() {
  const t = useTheme();
  const phase = useStore((s) => s.phase);
  switch (phase) {
    case 'boot':
      return <View style={{ flex: 1, backgroundColor: t.bg }} />;
    case 'connect':
      return <Connect />;
    case 'unreachable':
      return <Unreachable />;
    case 'setup':
      return <Setup />;
    case 'login':
      return <Login />;
    default:
      return <Home />;
  }
}
