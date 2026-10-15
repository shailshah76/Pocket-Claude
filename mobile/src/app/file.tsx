import { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, useStore } from '@/lib/store';
import { fonts, useTheme } from '@/lib/theme';
import { bytes, tildify } from '@/lib/util';
import { IconButton, Skeleton } from '@/components/ui';

interface FileData {
  path: string;
  text?: string;
  binary?: boolean;
  truncated?: boolean;
  size: number;
}

export default function FileViewer() {
  const { path } = useLocalSearchParams<{ path: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const home = useStore((s) => s.me?.home);
  const [data, setData] = useState<FileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrap, setWrap] = useState(false);

  useEffect(() => {
    api<FileData>(`/api/fs/read?path=${encodeURIComponent(path)}`).then(setData, (e) => setError(e.message));
  }, [path]);

  const lines = useMemo(() => data?.text?.split('\n') ?? [], [data]);
  const mono = { fontFamily: fonts.mono, fontSize: 12.5, lineHeight: 20 };
  const gutter = String(lines.length).length * 8 + 18;

  const body = (
    <FlatList
      data={lines}
      keyExtractor={(_, i) => String(i)}
      initialNumToRender={60}
      windowSize={11}
      contentContainerStyle={{ paddingVertical: 8, paddingBottom: insets.bottom + 24 }}
      renderItem={({ item, index }) => (
        <View style={{ flexDirection: 'row' }}>
          <Text style={[mono, { width: gutter, textAlign: 'right', paddingRight: 12, color: t.text3, opacity: 0.6 }]}>{index + 1}</Text>
          <Text selectable style={[mono, { color: t.text, paddingRight: 16, flexShrink: wrap ? 1 : 0 }]}>{item || ' '}</Text>
        </View>
      )}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: t.border, paddingBottom: 6 }}>
        <IconButton name="chevron-left" label="Back" size={26} onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontFamily: fonts.mono, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{path.split('/').pop()}</Text>
          <Text style={{ color: t.text3, fontSize: 12 }} numberOfLines={1}>
            {tildify(data?.path ?? path, home)}{data ? ` · ${bytes(data.size)}` : ''}{data?.text !== undefined ? ` · ${lines.length} lines` : ''}
          </Text>
        </View>
        <IconButton name="align-left" label="Wrap lines" color={wrap ? t.accent : undefined} onPress={() => setWrap(!wrap)} />
      </View>
      {error && <Text style={{ margin: 16, padding: 12, borderRadius: 12, backgroundColor: t.redSoft, color: t.red }}>{error}</Text>}
      {!data && !error && <View style={{ paddingTop: 12 }}><Skeleton /></View>}
      {data?.binary && <Text style={{ color: t.text3, textAlign: 'center', padding: 40 }}>Binary file, can’t preview.</Text>}
      {data?.text !== undefined && (wrap ? body : <ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }}>{body}</ScrollView>)}
      {data?.truncated && <Text style={{ color: t.text3, textAlign: 'center', padding: 8 }}>Truncated at 1 MB</Text>}
    </View>
  );
}
