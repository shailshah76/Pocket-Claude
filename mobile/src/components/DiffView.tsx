import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { diffRows, type Change } from '@/lib/diff';
import { fonts, useTheme } from '@/lib/theme';

const PAGE = 200;

export function DiffView({ changes }: { changes: Change[] }) {
  const t = useTheme();
  const rows = useMemo(() => diffRows(changes), [changes]);
  const [limit, setLimit] = useState(PAGE);
  const mono = { fontFamily: fonts.mono, fontSize: 12.5, lineHeight: 19 };
  return (
    <View style={{ backgroundColor: t.codeBg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: '100%', paddingVertical: 4 }}>
          {rows.slice(0, limit).map((r, i) =>
            r.kind === 'hunk' ? (
              <Text key={i} style={[mono, { color: t.text3, backgroundColor: t.surface, paddingHorizontal: 12, fontSize: 12 }]}>{r.text}</Text>
            ) : (
              <View key={i} style={{ flexDirection: 'row', backgroundColor: r.kind === 'add' ? t.diffAdd : r.kind === 'del' ? t.diffDel : 'transparent' }}>
                <Text style={[mono, { width: 40, textAlign: 'right', paddingRight: 6, color: t.text3, opacity: 0.7 }]}>{r.no}</Text>
                <Text style={[mono, { width: 16, textAlign: 'center', color: r.kind === 'add' ? t.green : r.kind === 'del' ? t.red : t.text3 }]}>
                  {r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '}
                </Text>
                <Text style={[mono, { color: t.text, paddingRight: 16 }]}>{r.text || ' '}</Text>
              </View>
            ),
          )}
        </View>
      </ScrollView>
      {rows.length > limit && (
        <Pressable onPress={() => setLimit(limit + PAGE)} style={{ padding: 10 }}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Show {Math.min(PAGE, rows.length - limit)} more lines…</Text>
        </Pressable>
      )}
    </View>
  );
}
