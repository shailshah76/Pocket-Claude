import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SessionSummary, Usage } from '../../../shared/types';
import { refreshSessions, useStore } from '@/lib/store';
import { fonts, useTheme } from '@/lib/theme';
import { ago, dayBucket, tildify } from '@/lib/util';
import { Button, Chip, Dot, Icon, IconButton, SectionLabel, Skeleton, s } from '@/components/ui';

export function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const sessions = useStore((st) => st.sessions);
  const me = useStore((st) => st.me);
  const usage = useStore((st) => st.usage);
  const conn = useStore((st) => st.conn);
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (sessions ?? []).filter((x) => !term || x.title.toLowerCase().includes(term) || x.cwd?.toLowerCase().includes(term));
    const out: { title: string; data: SessionSummary[] }[] = [];
    const live = list.filter((x) => x.live);
    if (live.length) out.push({ title: 'Running on phone', data: live });
    const groups = new Map<string, SessionSummary[]>();
    for (const x of list.filter((x) => !x.live)) {
      const k = dayBucket(x.lastModified);
      groups.set(k, [...(groups.get(k) ?? []), x]);
    }
    for (const [title, data] of groups) out.push({ title, data });
    return out;
  }, [sessions, q]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={(x) => x.sessionId}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[t.accent]}
            progressBackgroundColor={t.bgElev}
            onRefresh={async () => (setRefreshing(true), await refreshSessions(), setRefreshing(false))}
          />
        }
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, gap: 14, paddingBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[s.h1, { color: t.text, flex: 1 }]}>Sessions</Text>
              <IconButton name="settings" label="Settings" onPress={() => router.push('/settings')} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip>
                <Dot color={conn === 'online' ? t.green : conn === 'connecting' ? t.amber : t.red} pulse={conn === 'connecting'} />
                <Icon name="monitor" size={13} />
                <Text style={{ color: t.text2, fontSize: 13, fontWeight: '500' }}>
                  {me?.host ?? 'Computer'} · {conn === 'online' ? 'connected' : conn === 'connecting' ? 'connecting…' : 'offline'}
                </Text>
              </Chip>
              <UsageChip label="5h" w={usage.fiveHour} />
              <UsageChip label="week" w={usage.sevenDay} />
            </View>
            {conn === 'offline' && (
              <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: t.amberSoft }}>
                <Icon name="wifi-off" size={17} color={t.amber} />
                <Text style={{ flex: 1, color: t.text, fontSize: 14, lineHeight: 20 }}>
                  Can’t reach {me?.host ?? 'your computer'}. It may be asleep. Reconnecting…
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.surface, borderRadius: 13, paddingHorizontal: 12, height: 44 }}>
              <Icon name="search" size={17} color={t.text3} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search sessions or folders"
                placeholderTextColor={t.text3}
                style={{ flex: 1, color: t.text, fontSize: 16 }}
              />
            </View>
            {sessions === null && [0, 1, 2, 3].map((i) => <Skeleton key={i} />)}
          </View>
        }
        renderSectionHeader={({ section }) => <SectionLabel style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>{section.title}</SectionLabel>}
        renderItem={({ item }) => <Row s={item} home={me?.home} />}
        ListEmptyComponent={
          sessions !== null ? (
            <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
              <Icon name="message-circle" size={34} color={t.text3} />
              <Text style={{ fontFamily: fonts.serif, fontSize: 21, color: t.text }}>{q ? 'No matches' : 'No sessions yet'}</Text>
              <Text style={{ color: t.text3, textAlign: 'center' }}>
                {q ? 'Try a different search.' : 'Start one below. Sessions from your computer’s terminal show up here too.'}
              </Text>
            </View>
          ) : null
        }
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 16, alignItems: 'center' }} pointerEvents="box-none">
        <Button label="New session" icon="plus" variant="primary" onPress={() => router.push('/new')} style={{ height: 54, paddingHorizontal: 26, borderRadius: 17, elevation: 6 }} />
      </View>
    </View>
  );
}

function UsageChip({ label, w }: { label: string; w?: Usage['fiveHour'] }) {
  const t = useTheme();
  if (!w) return null;
  const pct = Math.round(w.utilization * 100);
  return (
    <Chip>
      <Text style={{ color: t.text2, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.surface2, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pct > 85 ? t.red : t.accent }} />
      </View>
      <Text style={{ color: t.text2, fontSize: 13, fontWeight: '500' }}>{pct}%</Text>
    </Chip>
  );
}

function Row({ s: x, home }: { s: SessionSummary; home?: string }) {
  const t = useTheme();
  const [now] = useState(Date.now);
  const recentlyOnMac = !x.live && now - x.lastModified < 15 * 60_000;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/session/[id]', params: { id: x.sessionId } })}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 12, marginHorizontal: 8, borderRadius: 16, backgroundColor: pressed ? t.surface : 'transparent' })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: x.live ? t.accentSoft : t.surface }}>
        <Icon name={x.live ? 'message-circle' : 'terminal'} size={19} color={x.live ? t.accent : t.text2} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '600', lineHeight: 21 }} numberOfLines={2}>{x.title}</Text>
        <Text style={{ color: t.text3, fontSize: 13 }} numberOfLines={1}>
          {tildify(x.cwd, home) || 'unknown folder'}
          {x.gitBranch && x.gitBranch !== 'HEAD' ? `  ·  ⎇ ${x.gitBranch}` : ''}  ·  {ago(x.lastModified)}
        </Text>
        {x.live && x.status && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            {x.status === 'waiting' ? (
              <><Icon name="shield" size={14} color={t.amber} /><Text style={{ color: t.amber, fontWeight: '600', fontSize: 13 }}>Needs your approval</Text></>
            ) : x.status === 'running' ? (
              <><Dot color={t.accent} pulse /><Text style={{ color: t.accent, fontWeight: '600', fontSize: 13 }}>Working…</Text></>
            ) : (
              <><Dot color={t.text3} /><Text style={{ color: t.text3, fontSize: 13 }}>Idle</Text></>
            )}
          </View>
        )}
        {recentlyOnMac && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Dot color={t.amber} />
            <Text style={{ color: t.text3, fontSize: 13 }}>Active on computer recently</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
