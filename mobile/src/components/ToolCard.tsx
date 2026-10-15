import { memo, useMemo, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Pressable, ScrollView, Text, View } from 'react-native';
import type { Item } from '../../../shared/types';
import { changesFor, diffStat } from '@/lib/diff';
import { fonts, useTheme } from '@/lib/theme';
import { relTo } from '@/lib/util';
import { DiffView } from './DiffView';
import { Markdown } from './Markdown';
import { Icon, type IconName } from './ui';

type Tool = Extract<Item, { kind: 'tool' }>;

const META: Record<string, { icon: IconName; label: string }> = {
  Bash: { icon: 'terminal', label: 'Run' },
  Read: { icon: 'eye', label: 'Read' },
  Edit: { icon: 'edit-3', label: 'Edit' },
  MultiEdit: { icon: 'edit-3', label: 'Edit' },
  Write: { icon: 'file-plus', label: 'Write' },
  NotebookEdit: { icon: 'edit-3', label: 'Notebook' },
  Glob: { icon: 'search', label: 'Find' },
  Grep: { icon: 'search', label: 'Search' },
  WebFetch: { icon: 'globe', label: 'Fetch' },
  WebSearch: { icon: 'globe', label: 'Web' },
  Task: { icon: 'cpu', label: 'Agent' },
  Agent: { icon: 'cpu', label: 'Agent' },
  TodoWrite: { icon: 'check-square', label: 'Plan' },
  ExitPlanMode: { icon: 'map', label: 'Plan' },
  AskUserQuestion: { icon: 'help-circle', label: 'Asked' },
};

export function toolMeta(name: string): { icon: IconName; label: string } {
  if (META[name]) return META[name];
  if (name.startsWith('mcp__')) return { icon: 'tool', label: name.split('__').slice(2).join(' ') || name };
  return { icon: 'tool', label: name };
}

export function toolArg(name: string, input: Record<string, any>, cwd?: string): string {
  const path = input.file_path ?? input.notebook_path;
  if (path) return relTo(String(path), cwd);
  switch (name) {
    case 'Bash': return String(input.description || input.command || '');
    case 'Glob':
    case 'Grep': return String(input.pattern ?? '') + (input.path ? `  in ${relTo(String(input.path), cwd)}` : '');
    case 'WebFetch': return String(input.url ?? '');
    case 'WebSearch': return String(input.query ?? '');
    case 'Task':
    case 'Agent': return String(input.description ?? '');
    case 'TodoWrite': {
      const t: any[] = input.todos ?? [];
      return `${t.filter((x) => x.status === 'completed').length}/${t.length} done`;
    }
    case 'AskUserQuestion': return String(input.questions?.[0]?.question ?? '');
    default: {
      const first = Object.values(input).find((v) => typeof v === 'string');
      return typeof first === 'string' ? first : '';
    }
  }
}

export function Terminal({ children, error, maxHeight = 340 }: { children: React.ReactNode; error?: boolean; maxHeight?: number }) {
  const t = useTheme();
  return (
    <ScrollView style={{ backgroundColor: t.termBg, maxHeight }} nestedScrollEnabled>
      <Text selectable style={{ fontFamily: fonts.mono, fontSize: 12.5, lineHeight: 19, color: error ? '#ffb4a8' : t.termText, padding: 12 }}>
        {children}
      </Text>
    </ScrollView>
  );
}

export const ToolCard = memo(function ToolCard({ item, cwd, onOpenFile }: { item: Tool; cwd?: string; onOpenFile: (p: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(item.name === 'TodoWrite');
  const { icon, label } = toolMeta(item.name);
  const changes = useMemo(() => changesFor(item.name, item.input), [item.name, item.input]);
  const stat = useMemo(() => (changes ? diffStat(changes) : null), [changes]);
  const path = (item.input.file_path ?? item.input.notebook_path) as string | undefined;

  return (
    <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 14, backgroundColor: t.bgElev, overflow: 'hidden' }}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen(!open);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, minHeight: 48, backgroundColor: pressed ? t.surface : 'transparent' })}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={15} />
        </View>
        <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
        <Text style={{ flex: 1, color: t.text2, fontFamily: fonts.mono, fontSize: 12.5 }} numberOfLines={1}>
          {toolArg(item.name, item.input, cwd)}
        </Text>
        {stat && stat.add + stat.del > 0 && (
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: '700' }}>
            {stat.add > 0 && <Text style={{ color: t.green }}>+{stat.add} </Text>}
            {stat.del > 0 && <Text style={{ color: t.red }}>−{stat.del}</Text>}
          </Text>
        )}
        {item.status === 'running' ? (
          <ActivityIndicator size="small" color={t.accent} />
        ) : item.status === 'error' ? (
          <Icon name="x" size={16} color={t.red} />
        ) : (
          <Icon name="check" size={16} color={t.green} />
        )}
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} color={t.text3} />
      </Pressable>
      {open && <Body item={item} changes={changes} path={path} onOpenFile={onOpenFile} />}
    </View>
  );
});

function Body({ item, changes, path, onOpenFile }: { item: Tool; changes: ReturnType<typeof changesFor>; path?: string; onOpenFile: (p: string) => void }) {
  const t = useTheme();
  const { name, input, status } = item;
  const out = item.output?.trim();
  const label = (s: string) => <Text style={{ color: t.text3, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>{s}</Text>;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.border }}>
      {name === 'Bash' && (
        <Terminal>
          <Text style={{ color: t.accent }}>$ </Text>
          {String(input.command ?? '')}
          {out ? '\n\n' : ''}
          {out ? <Text style={{ color: status === 'error' ? '#ffb4a8' : t.termText }}>{out}</Text> : null}
        </Terminal>
      )}
      {name === 'TodoWrite' && <Todos todos={(input.todos as any[]) ?? []} />}
      {(name === 'Task' || name === 'Agent') && (
        <>
          {!!input.prompt && label('Instructions')}
          {!!input.prompt && <Terminal maxHeight={200}>{String(input.prompt)}</Terminal>}
          {!!out && label('Report')}
          {!!out && <View style={{ padding: 12 }}><Markdown text={out} size={14.5} /></View>}
        </>
      )}
      {changes && <DiffView changes={changes} />}
      {changes && status === 'error' && !!out && <Terminal error>{out}</Terminal>}
      {!changes && !['Bash', 'TodoWrite', 'Task', 'Agent'].includes(name) && (
        <>
          {name !== 'Read' && Object.keys(input).length > 0 && <Terminal maxHeight={200}>{JSON.stringify(input, null, 2)}</Terminal>}
          {!!out && (name !== 'Read' || status === 'error') && <Terminal error={status === 'error'}>{out}</Terminal>}
        </>
      )}
      {path && (
        <Pressable onPress={() => onOpenFile(path)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 }}>
          <Icon name="file-text" size={16} color={t.accent} />
          <Text style={{ color: t.accent, fontWeight: '600' }}>Open {path.split('/').pop()}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Todos({ todos }: { todos: { content: string; status: string; activeForm?: string }[] }) {
  const t = useTheme();
  return (
    <View style={{ padding: 12, gap: 8 }}>
      {todos.map((td, i) => {
        const done = td.status === 'completed';
        const active = td.status === 'in_progress';
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={{ width: 19, height: 19, borderRadius: 6, borderWidth: 1.5, marginTop: 2, alignItems: 'center', justifyContent: 'center',
              borderColor: done ? t.green : active ? t.accent : t.borderStrong, backgroundColor: done ? t.green : 'transparent' }}>
              {done && <Icon name="check" size={12} color="#fff" />}
            </View>
            <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: done ? t.text3 : t.text, fontWeight: active ? '600' : '400', textDecorationLine: done ? 'line-through' : 'none' }}>
              {active && td.activeForm ? td.activeForm : td.content}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
