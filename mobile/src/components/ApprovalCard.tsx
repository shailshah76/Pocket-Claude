import { memo, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Decision, Item, Question } from '../../../shared/types';
import { changesFor } from '@/lib/diff';
import { useTheme } from '@/lib/theme';
import { DiffView } from './DiffView';
import { Markdown } from './Markdown';
import { Terminal, toolArg, toolMeta } from './ToolCard';
import { Button, Icon, type IconName } from './ui';

type Approval = Extract<Item, { kind: 'approval' }>;

export const ApprovalCard = memo(function ApprovalCard({ item, cwd, onDecide }: { item: Approval; cwd?: string; onDecide: (d: Decision) => void }) {
  if (item.status !== 'pending') return <Settled item={item} cwd={cwd} />;
  if (item.toolName === 'AskUserQuestion') return <QuestionCard item={item} onDecide={onDecide} />;
  if (item.toolName === 'ExitPlanMode') return <PlanCard item={item} onDecide={onDecide} />;
  return <PermissionCard item={item} cwd={cwd} onDecide={onDecide} />;
});

function Shell({ icon, title, sub, children }: { icon: IconName; title: string; sub?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ borderRadius: 22, backgroundColor: t.bgElev, borderWidth: 1.5, borderColor: t.amber, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.amberSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={t.amber} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: '600', fontSize: 15.5, lineHeight: 21 }}>{title}</Text>
          {!!sub && <Text style={{ color: t.text3, fontSize: 13, marginTop: 2 }}>{sub}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

function askText(tool: string, input: Record<string, any>, cwd: string | undefined, label: string): string {
  const target = toolArg(tool, input, cwd);
  switch (tool) {
    case 'Bash': return 'Run this command?';
    case 'Edit':
    case 'MultiEdit': return `Edit ${target}?`;
    case 'Write': return `Write ${target}?`;
    case 'WebFetch': return `Fetch ${target}?`;
    case 'WebSearch': return `Search the web for “${target}”?`;
    default: return target ? `Allow ${label}: ${target}?` : `Allow ${label}?`;
  }
}

function PermissionCard({ item, cwd, onDecide }: { item: Approval; cwd?: string; onDecide: (d: Decision) => void }) {
  const t = useTheme();
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const changes = useMemo(() => changesFor(item.toolName, item.input), [item]);
  const { label } = toolMeta(item.toolName);
  const why = item.description || (typeof item.input.description === 'string' ? item.input.description : '') || item.reason;
  const command = item.toolName === 'Bash' ? String(item.input.command ?? '') : null;

  return (
    <Shell icon="shield" title={item.title || askText(item.toolName, item.input, cwd, label.toLowerCase())} sub={why}>
      <View style={{ marginHorizontal: 14, marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: t.border }}>
        {command !== null ? (
          <Terminal maxHeight={160}><Text style={{ color: t.accent }}>$ </Text>{command}</Terminal>
        ) : changes ? (
          <View style={{ maxHeight: 220 }}><DiffView changes={changes} /></View>
        ) : (
          <Terminal maxHeight={160}>{JSON.stringify(item.input, null, 2)}</Terminal>
        )}
      </View>
      {noting && (
        <TextInput
          value={note}
          onChangeText={setNote}
          autoFocus
          multiline
          placeholder="Tell Claude what to do instead (optional)"
          placeholderTextColor={t.text3}
          style={{ marginHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, padding: 11, color: t.text, fontSize: 15, minHeight: 44 }}
        />
      )}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14 }}>
        <Button label="Deny" icon="x" onPress={() => onDecide({ type: 'deny', message: note })} style={{ flex: 1 }} />
        <Button label="Allow" icon="check" variant="primary" onPress={() => onDecide({ type: 'allow' })} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => setNoting(!noting)} hitSlop={8}>
          <Text style={{ color: t.text2, fontWeight: '500', fontSize: 13.5 }}>{noting ? 'Hide note' : 'Deny with a note…'}</Text>
        </Pressable>
        {item.canAlwaysAllow && (
          <Pressable onPress={() => onDecide({ type: 'allow_always' })} hitSlop={8}>
            <Text style={{ color: t.text2, fontWeight: '500', fontSize: 13.5 }}>Always allow</Text>
          </Pressable>
        )}
      </View>
    </Shell>
  );
}

function PlanCard({ item, onDecide }: { item: Approval; onDecide: (d: Decision) => void }) {
  const t = useTheme();
  const [note, setNote] = useState('');
  const plan = String(item.input.plan ?? '');
  return (
    <Shell icon="map" title="Claude’s plan is ready" sub="Approve to start, or send feedback to keep planning.">
      {!!plan && (
        <View style={{ marginHorizontal: 14, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: t.surface }}>
          <Markdown text={plan} size={14.5} />
        </View>
      )}
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="Feedback to keep planning…"
        placeholderTextColor={t.text3}
        style={{ marginHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, padding: 11, color: t.text, fontSize: 15 }}
      />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>
        <Button label="Keep planning" disabled={!note.trim()} onPress={() => onDecide({ type: 'deny', message: note })} style={{ flex: 1 }} />
        <Button label="Approve" icon="check" variant="primary" onPress={() => onDecide({ type: 'allow' })} style={{ flex: 1 }} />
      </View>
    </Shell>
  );
}

function QuestionCard({ item, onDecide }: { item: Approval; onDecide: (d: Decision) => void }) {
  const t = useTheme();
  const questions = (item.input.questions as Question[]) ?? [];
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});

  const toggle = (q: Question, label: string) => {
    setPicked((p) => {
      const cur = p[q.question] ?? [];
      if (!q.multiSelect) return { ...p, [q.question]: [label] };
      return { ...p, [q.question]: cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label] };
    });
    if (!q.multiSelect) setOther((o) => ({ ...o, [q.question]: '' }));
  };
  const answerFor = (q: Question) => [...(picked[q.question] ?? []), ...(other[q.question]?.trim() ? [other[q.question].trim()] : [])].join(', ');
  const ready = questions.every((q) => answerFor(q));

  return (
    <Shell icon="help-circle" title={`Claude has ${questions.length > 1 ? `${questions.length} questions` : 'a question'}`}>
      {questions.map((q) => (
        <View key={q.question} style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 6 }}>
          <Text style={{ color: t.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>{q.question}</Text>
          {q.options.map((o) => {
            const on = picked[q.question]?.includes(o.label);
            return (
              <Pressable
                key={o.label}
                onPress={() => toggle(q, o.label)}
                style={{ padding: 11, borderRadius: 12, borderWidth: 1.5, borderColor: on ? t.accent : t.borderStrong, backgroundColor: on ? t.accentSoft : 'transparent' }}
                accessibilityRole={q.multiSelect ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: on }}
              >
                <Text style={{ color: t.text, fontWeight: '600', fontSize: 14.5 }}>{o.label}</Text>
                {!!o.description && <Text style={{ color: t.text2, fontSize: 13, marginTop: 1 }}>{o.description}</Text>}
              </Pressable>
            );
          })}
          <TextInput
            value={other[q.question] ?? ''}
            onChangeText={(v) => {
              setOther({ ...other, [q.question]: v });
              if (!q.multiSelect && v) setPicked({ ...picked, [q.question]: [] });
            }}
            placeholder="Other…"
            placeholderTextColor={t.text3}
            style={{ borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, padding: 11, color: t.text, fontSize: 15 }}
          />
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>
        <Button label="Skip" onPress={() => onDecide({ type: 'deny', message: 'The user skipped these questions.' })} style={{ flex: 1 }} />
        <Button
          label="Submit"
          variant="primary"
          disabled={!ready}
          onPress={() => onDecide({ type: 'answer', answers: Object.fromEntries(questions.map((q) => [q.question, answerFor(q)])) })}
          style={{ flex: 1 }}
        />
      </View>
    </Shell>
  );
}

function Settled({ item, cwd }: { item: Approval; cwd?: string }) {
  const t = useTheme();
  const { label } = toolMeta(item.toolName);
  const answers = item.input.answers as Record<string, string> | undefined;
  const text =
    item.toolName === 'AskUserQuestion'
      ? answers ? `You answered: ${Object.values(answers).join(' · ')}` : item.status === 'cancelled' ? 'Question cancelled' : 'You skipped the question'
      : item.toolName === 'ExitPlanMode'
        ? item.status === 'allowed' ? 'You approved the plan' : 'You asked Claude to keep planning'
        : `${item.status === 'allowed' ? 'Allowed' : item.status === 'denied' ? 'Denied' : 'Cancelled'}: ${item.toolName === 'Bash' ? String(item.input.command ?? '') : `${label.toLowerCase()} ${toolArg(item.toolName, item.input, cwd)}`}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
      <Icon name={item.status === 'allowed' ? 'check' : 'x'} size={15} color={item.status === 'allowed' ? t.green : item.status === 'denied' ? t.red : t.text3} />
      <Text style={{ color: t.text3, fontSize: 13.5, flex: 1 }} numberOfLines={1}>{text}</Text>
    </View>
  );
}
