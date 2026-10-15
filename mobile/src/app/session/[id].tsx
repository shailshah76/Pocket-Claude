import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Decision, Item, PermissionMode, SessionState } from '../../../../shared/types';
import { actions, api, pendingApprovals, subscribe, toast, useStore } from '@/lib/store';
import { fonts, useTheme } from '@/lib/theme';
import { base, duration, tildify } from '@/lib/util';
import { ApprovalCard } from '@/components/ApprovalCard';
import { Markdown } from '@/components/Markdown';
import { MODES, ModePicker } from '@/components/ModePicker';
import { ToolCard } from '@/components/ToolCard';
import { Chip, Dot, Icon, IconButton, Sheet, Skeleton, type IconName } from '@/components/ui';

const NEXT_MODE: Record<PermissionMode, PermissionMode> = { default: 'acceptEdits', acceptEdits: 'plan', plan: 'default' };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = useStore((st) => (st.current?.sessionId === id ? st.current : null));
  const home = useStore((st) => st.me?.home);
  const [menu, setMenu] = useState(false);
  const list = useRef<FlatList<Item>>(null);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    subscribe(id);
    return () => subscribe(null);
  }, [id]);

  // The list is inverted (newest first), so offset 0 is the bottom of the conversation.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const near = e.nativeEvent.contentOffset.y < 120;
    if (near === showJump) setShowJump(!near);
  };
  const reversed = useMemo(
    () => (s ? s.items.filter((it) => !(it.kind === 'approval' && it.status === 'pending')).reverse() : []),
    [s],
  );

  const onDecide = useCallback((approvalId: string, d: Decision) => actions.decide(id, approvalId, d), [id]);
  const openFile = useCallback((p: string) => router.push({ pathname: '/file', params: { path: p } }), []);

  const header = (
    <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: t.border, backgroundColor: t.bg }}>
      <IconButton name="chevron-left" label="Back" onPress={() => router.back()} size={26} />
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ color: t.text, fontWeight: '600', fontSize: 15.5 }} numberOfLines={1}>{s?.title ?? 'Loading…'}</Text>
        {s && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Dot color={!s.live ? t.text3 : s.status === 'waiting' ? t.amber : s.status === 'running' ? t.accent : t.green} pulse={s.live && s.status === 'running'} />
            <Text style={{ color: t.text3, fontSize: 12 }} numberOfLines={1}>
              {base(s.cwd) || 'folder'}{s.model ? ` · ${s.model.replace(/^claude-/, '')}` : ''}{!s.live ? ' · on computer' : ''}
            </Text>
          </View>
        )}
      </View>
      <IconButton name="more-horizontal" label="Session menu" onPress={() => setMenu(true)} />
    </View>
  );

  if (!s) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={{ paddingTop: 16 }}>{[0, 1, 2].map((i) => <Skeleton key={i} />)}</View>
      </View>
    );
  }

  const last = s.items[s.items.length - 1];
  const working = s.live && s.status === 'running' && !(last?.kind === 'text' && last.streaming);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.bg }}>
      {header}
      <View style={{ flex: 1 }}>
        {reversed.length === 0 && !working ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 }}>
            <Icon name="terminal" size={32} color={t.text3} />
            <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: t.text }}>{tildify(s.cwd, home)}</Text>
            <Text style={{ color: t.text3 }}>Ask Claude anything about this folder.</Text>
          </View>
        ) : (
          <FlatList
            ref={list}
            inverted
            data={reversed}
            keyExtractor={(it) => it.id}
            renderItem={({ item }) => <ItemView item={item} cwd={s.cwd} onOpenFile={openFile} onDecide={onDecide} />}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            onScroll={onScroll}
            scrollEventThrottle={64}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListHeaderComponent={working ? <Working /> : null}
          />
        )}
        {showJump && (
          <Pressable
            onPress={() => list.current?.scrollToOffset({ offset: 0, animated: true })}
            accessibilityLabel="Scroll to bottom"
            style={{ position: 'absolute', right: 16, bottom: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: t.bgElev, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center', elevation: 4 }}
          >
            <Icon name="arrow-down" size={18} />
          </Pressable>
        )}
      </View>
      <Composer key={s.sessionId} s={s} onDecide={onDecide} />
      <SessionMenu s={s} visible={menu} onClose={() => setMenu(false)} />
    </KeyboardAvoidingView>
  );
}

function Working() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 }}>
      <Dot color={t.accent} pulse />
      <Text style={{ color: t.text3, fontSize: 14 }}>Claude is working…</Text>
    </View>
  );
}

const ItemView = memo(function ItemView({ item, cwd, onOpenFile, onDecide }: { item: Item; cwd: string; onOpenFile: (p: string) => void; onDecide: (id: string, d: Decision) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  switch (item.kind) {
    case 'user':
      return (
        <View style={{ alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: t.surface2, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 15, paddingVertical: 10 }}>
          <Text selectable style={{ color: t.text, fontSize: 16, lineHeight: 23 }}>{item.text}</Text>
        </View>
      );
    case 'text':
      return item.text ? <Markdown text={item.streaming ? item.text + ' ▍' : item.text} /> : null;
    case 'thinking':
      return (
        <Pressable onPress={() => setOpen(!open)}>
          <Text style={{ color: t.text3, fontStyle: 'italic', fontSize: 14 }}>{open ? '▾' : '▸'} Thought for a moment</Text>
          {open && <View style={{ marginTop: 6, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: t.borderStrong }}><Markdown text={item.text} size={14} color={t.text3} /></View>}
        </Pressable>
      );
    case 'tool':
      return <ToolCard item={item} cwd={cwd} onOpenFile={onOpenFile} />;
    case 'approval':
      return <ApprovalCard item={item} cwd={cwd} onDecide={(d) => onDecide(item.id, d)} />;
    case 'result':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
          <Text style={{ color: item.ok ? t.text3 : t.red, fontSize: 12.5 }}>
            {item.ok ? `Done in ${duration(item.durationMs)}` : `Stopped${item.error ? `: ${item.error.slice(0, 60)}` : ''}`}
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
        </View>
      );
    case 'notice':
      return (
        <Text style={{ padding: 12, borderRadius: 12, backgroundColor: item.level === 'error' ? t.redSoft : t.surface, color: item.level === 'error' ? t.red : t.text2 }}>
          {item.text}
        </Text>
      );
  }
});

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => (a.remove(), b.remove());
  }, []);
  return open;
}

function Composer({ s, onDecide }: { s: SessionState; onDecide: (id: string, d: Decision) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOpen();
  const [text, setText] = useState('');
  const [now] = useState(Date.now);
  const recentlyActive = now - s.lastModified < 15 * 60_000;
  const [fork, setFork] = useState(recentlyActive);
  const [busy, setBusy] = useState(false);
  const pending = pendingApprovals(s.items);
  const top = pending[0];
  const running = s.live && (s.status === 'running' || s.status === 'waiting');
  const mode = MODES.find((m) => m.id === s.mode) ?? MODES[0];

  const submit = async () => {
    const msg = text.trim();
    if (!msg) return;
    if (s.live) {
      actions.send(s.sessionId, msg);
      setText('');
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ sessionId: string }>('/api/sessions', { body: { resumeId: s.sessionId, fork, prompt: msg, cwd: s.cwd } });
      setText('');
      if (r.sessionId !== s.sessionId) router.replace({ pathname: '/session/[id]', params: { id: r.sessionId } });
      else subscribe(s.sessionId);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: (keyboard ? 0 : insets.bottom) + 10, gap: 8, borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.bg }}>
      {top && (
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 6 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <ApprovalCard item={top} cwd={s.cwd} onDecide={(d) => onDecide(top.id, d)} />
          {pending.length > 1 && <Text style={{ color: t.text3, textAlign: 'center', fontSize: 12.5 }}>{pending.length - 1} more waiting</Text>}
        </ScrollView>
      )}
      {!s.live && (
        <>
          <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: 12, padding: 3, gap: 2 }}>
            {([['Continue', 'play', false], ['Fork a copy', 'git-branch', true]] as const).map(([label, icon, val]) => (
              <Pressable key={label} onPress={() => setFork(val)} accessibilityRole="radio" accessibilityState={{ checked: fork === val }}
                style={{ flex: 1, height: 36, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: fork === val ? t.bgElev : 'transparent', elevation: fork === val ? 2 : 0 }}>
                <Icon name={icon} size={14} color={fork === val ? t.text : t.text2} />
                <Text style={{ color: fork === val ? t.text : t.text2, fontWeight: '600', fontSize: 13.5 }}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: t.text3, fontSize: 12.5, textAlign: 'center' }}>
            {fork
              ? 'Starts a copy so a terminal still using this session isn’t disturbed.'
              : recentlyActive
                ? 'Heads up: this was active on your computer recently. If it’s still open in a terminal, fork instead.'
                : 'Picks up this session right where it left off.'}
          </Text>
        </>
      )}
      {s.live && !top && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Chip icon={mode.icon} onPress={() => actions.mode(s.sessionId, NEXT_MODE[s.mode])}>{mode.long}</Chip>
          <View style={{ flex: 1 }} />
          {s.status === 'running' && <Text style={{ color: t.text3, fontSize: 12.5 }}>Messages queue while Claude works</Text>}
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: t.bgElev, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 24, paddingLeft: 16, padding: 5 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder={s.live ? (running ? 'Add a follow-up…' : 'Reply to Claude…') : fork ? 'Message to start the fork…' : 'Message to continue…'}
          placeholderTextColor={t.text3}
          style={{ flex: 1, color: t.text, fontSize: 16, maxHeight: 150, paddingVertical: 9 }}
        />
        {running && !text.trim() ? (
          <Pressable onPress={() => actions.interrupt(s.sessionId)} accessibilityLabel="Stop Claude"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.text, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: t.bg }} />
          </Pressable>
        ) : (
          <Pressable onPress={submit} disabled={!text.trim() || busy} accessibilityLabel="Send"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: !text.trim() || busy ? 0.35 : 1 }}>
            <Icon name="arrow-up" size={20} color={t.onAccent} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SessionMenu({ s, visible, onClose }: { s: SessionState; visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const home = useStore((st) => st.me?.home);
  return (
    <Sheet visible={visible} onClose={onClose} title={s.title}>
      <Text style={{ paddingHorizontal: 20, paddingBottom: 10, color: t.text3, fontFamily: fonts.mono, fontSize: 12.5 }}>{tildify(s.cwd, home)}</Text>
      {s.live && <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><ModePicker mode={s.mode} onChange={(m) => actions.mode(s.sessionId, m)} /></View>}
      <MenuRow icon="folder" label="Browse files" onPress={() => (onClose(), router.push({ pathname: '/files', params: { start: s.cwd } }))} />
      <MenuRow
        icon="terminal"
        label="Copy terminal resume command"
        sub="Pick this up later at your computer"
        onPress={async () => {
          await Clipboard.setStringAsync(`cd ${JSON.stringify(s.cwd)} && claude --resume ${s.sessionId}`);
          toast('Resume command copied');
          onClose();
        }}
      />
      {s.live && (
        <MenuRow
          icon="power"
          label="End phone session"
          sub="The conversation is saved; resume it any time"
          danger
          onPress={() => {
            void api(`/api/sessions/${s.sessionId}/stop`, { body: {} });
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function MenuRow({ icon, label, sub, onPress, danger }: { icon: IconName; label: string; sub?: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: pressed ? t.surface : 'transparent' })}>
      <Icon name={icon} size={21} color={danger ? t.red : t.text2} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? t.red : t.text, fontSize: 16 }}>{label}</Text>
        {sub && <Text style={{ color: t.text3, fontSize: 13 }}>{sub}</Text>}
      </View>
    </Pressable>
  );
}
