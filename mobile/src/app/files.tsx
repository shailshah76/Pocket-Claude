import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, loadMe, toast, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { tildify } from '@/lib/util';
import { Browser } from '@/components/Browser';
import { Button, IconButton, s } from '@/components/ui';

/** Browse files (tap to view), or with `pick=default` choose the default folder for new sessions. */
export default function Files() {
  const { start, pick } = useLocalSearchParams<{ start?: string; pick?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const me = useStore((st) => st.me);
  const [path, setPath] = useState('');
  const picking = pick === 'default';

  return (
    <View style={{ flex: 1, backgroundColor: t.bgElev }}>
      <View style={{ paddingTop: insets.top + 8, paddingLeft: 20, paddingRight: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[s.sheetTitle, { color: t.text }]}>{picking ? 'Default folder' : 'Files'}</Text>
        <IconButton name="x" label="Close" onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, paddingTop: 8 }}>
        <Browser
          start={start || me?.defaultDir || '~'}
          onPath={setPath}
          onFile={picking ? undefined : (p) => router.push({ pathname: '/file', params: { path: p } })}
        />
      </View>
      {picking && (
        <View style={{ padding: 16, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: t.border }}>
          <Button
            label={`Use ${tildify(path, me?.home) || 'this folder'}`}
            icon="check"
            variant="primary"
            onPress={async () => {
              try {
                await api('/api/settings', { body: { defaultDir: path } });
                await loadMe();
                toast('Default folder updated');
                router.back();
              } catch (e: any) {
                toast(e.message);
              }
            }}
          />
        </View>
      )}
    </View>
  );
}
