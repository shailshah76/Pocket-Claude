import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import type { FsEntry, FsListing } from '../../../shared/types';
import { api, useStore } from '@/lib/store';
import { fonts, useTheme } from '@/lib/theme';
import { ago, bytes, tildify } from '@/lib/util';
import { Icon } from './ui';

/** Folder navigator with a mini shell: `cd path`, `cd ..`, `ls`, or a pasted path. */
export function Browser({ start, onPath, onFile, header }: { start: string; onPath?: (p: string) => void; onFile?: (p: string) => void; header?: React.ReactNode }) {
  const t = useTheme();
  const home = useStore((s) => s.me?.home ?? '');
  const [listing, setListing] = useState<FsListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [cmd, setCmd] = useState('');
  const crumbsRef = useRef<ScrollView>(null);

  const go = useCallback(
    async (path: string, base?: string) => {
      try {
        const l = await api<FsListing>(`/api/fs/list?path=${encodeURIComponent(path)}${base ? `&base=${encodeURIComponent(base)}` : ''}${hidden ? '&hidden=1' : ''}`);
        setListing(l);
        setError(null);
        onPath?.(l.path);
        setTimeout(() => crumbsRef.current?.scrollToEnd({ animated: false }), 50);
      } catch (e: any) {
        if (e.status === 400 && onFile && /Not a folder/.test(e.message)) return onFile(e.message.replace(/^Not a folder: /, ''));
        setError(e.message);
      }
    },
    [hidden, onPath, onFile],
  );

  useEffect(() => {
    // Async fetch; state updates land after the request, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void go(listing?.path ?? start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  const run = () => {
    const raw = cmd.trim();
    setCmd('');
    if (!raw) return;
    if (raw === 'ls' || raw === 'pwd') return void go(listing?.path ?? start);
    const target = raw.replace(/^cd\s*/, '').replace(/^(['"])(.*)\1$/, '$2') || '~';
    void go(target, listing?.path);
  };

  const crumbs = (() => {
    if (!listing) return [];
    const shown = tildify(listing.path, home);
    const rootIsHome = shown.startsWith('~');
    let acc = rootIsHome ? home : '';
    return shown.split('/').filter(Boolean).map((p, i) => {
      if (!(i === 0 && rootIsHome)) acc += '/' + p;
      return { label: p, path: acc || '/' };
    });
  })();

  const rows: (FsEntry | { name: '..'; type: 'up' })[] = listing ? [...(listing.parent ? [{ name: '..' as const, type: 'up' as const }] : []), ...listing.entries] : [];

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.name}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 10, paddingBottom: 6 }}>
          {header}
          <ScrollView ref={crumbsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <Pressable key={c.path} onPress={() => go(c.path)} style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9, backgroundColor: last ? t.accentSoft : t.surface }}>
                  <Text style={{ color: last ? t.accent : t.text2, fontWeight: '600', fontSize: 13.5 }}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.termBg, borderRadius: 12, paddingHorizontal: 12, height: 46 }}>
            <Text style={{ color: t.accent, fontWeight: '800', fontFamily: fonts.mono }}>❯</Text>
            <TextInput
              value={cmd}
              onChangeText={setCmd}
              onSubmitEditing={run}
              placeholder="cd ~/Projects  or  ls"
              placeholderTextColor="#7d7a72"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              style={{ flex: 1, color: t.termText, fontFamily: fonts.mono, fontSize: 15 }}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
            <Text style={{ color: t.text3, fontSize: 13 }}>
              {listing ? `${listing.entries.filter((e) => e.type === 'dir').length} folders · ${listing.entries.filter((e) => e.type === 'file').length} files` : ' '}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: t.text3, fontSize: 13 }}>Hidden</Text>
              <Switch value={hidden} onValueChange={setHidden} trackColor={{ true: t.green, false: t.surface2 }} thumbColor="#fff" />
            </View>
          </View>
          {error && <Text style={{ marginHorizontal: 16, padding: 10, borderRadius: 10, backgroundColor: t.redSoft, color: t.red }}>{error}</Text>}
        </View>
      }
      renderItem={({ item: r }) => {
        const isDir = r.type === 'dir' || r.type === 'up';
        const path = r.type === 'up' ? listing!.parent! : `${listing!.path}/${r.name}`;
        const inert = !isDir && !onFile;
        return (
          <Pressable
            disabled={inert}
            onPress={() => (isDir ? go(path) : onFile?.(path))}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, minHeight: 50, backgroundColor: pressed ? t.surface : 'transparent', opacity: inert ? 0.5 : 1 })}
          >
            <Icon name={r.type === 'up' ? 'corner-left-up' : isDir ? 'folder' : 'file'} size={20} color={isDir ? t.accent : t.text3} />
            <Text style={{ flex: 1, color: isDir ? t.text : t.text2, fontSize: 15.5 }} numberOfLines={1}>{r.name}</Text>
            {r.type === 'file' && <Text style={{ color: t.text3, fontSize: 12.5 }}>{bytes(r.size)} · {ago(r.mtime)}</Text>}
          </Pressable>
        );
      }}
      ListEmptyComponent={listing ? <Text style={{ color: t.text3, textAlign: 'center', padding: 24 }}>Empty folder</Text> : null}
    />
  );
}
