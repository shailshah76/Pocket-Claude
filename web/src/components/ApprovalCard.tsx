import { memo, useMemo, useState } from 'react';
import type { Decision, Item, Question } from '../../../shared/types';
import { DiffView, changesFor } from './DiffView';
import { Markdown } from './Markdown';
import { IconCheck, IconMap, IconQuestion, IconShield, IconX } from './Icons';
import { toolArg, toolMeta } from './ToolCard';

type Approval = Extract<Item, { kind: 'approval' }>;

export const ApprovalCard = memo(function ApprovalCard({
  item,
  cwd,
  onDecide,
  compact,
}: {
  item: Approval;
  cwd?: string;
  onDecide: (d: Decision) => void;
  compact?: boolean;
}) {
  if (item.status !== 'pending') return <Settled item={item} cwd={cwd} />;
  if (item.toolName === 'AskUserQuestion') return <QuestionCard item={item} onDecide={onDecide} />;
  if (item.toolName === 'ExitPlanMode') return <PlanCard item={item} onDecide={onDecide} compact={compact} />;
  return <PermissionCard item={item} cwd={cwd} onDecide={onDecide} compact={compact} />;
});

function PermissionCard({ item, cwd, onDecide, compact }: { item: Approval; cwd?: string; onDecide: (d: Decision) => void; compact?: boolean }) {
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const changes = useMemo(() => changesFor(item.toolName, item.input), [item]);
  const { label } = toolMeta(item.toolName);
  const question = item.title || askText(item.toolName, item.input, cwd, label);
  const why = item.description || (typeof item.input.description === 'string' ? item.input.description : '') || item.reason;
  const command = item.toolName === 'Bash' ? String(item.input.command ?? '') : null;

  return (
    <div className="approval">
      <div className="approval-head">
        <span className="badge"><IconShield /></span>
        <div className="what">
          <div className="q">{question}</div>
          {why && <div className="why">{why}</div>}
        </div>
      </div>
      {command && (
        <div className="preview">
          <pre className="term"><span className="ps">$ </span>{command}</pre>
        </div>
      )}
      {changes && !compact && (
        <div className="preview"><DiffView changes={changes} /></div>
      )}
      {!command && !changes && (
        <div className="preview">
          <pre className="term">{JSON.stringify(item.input, null, 2)}</pre>
        </div>
      )}
      {noting && (
        <div className="note">
          <textarea className="field" rows={2} autoFocus placeholder="Tell Claude what to do instead (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}
      <div className="actions">
        <button className="btn" onClick={() => onDecide({ type: 'deny', message: note })}>
          <IconX /> Deny
        </button>
        <button className="btn primary" onClick={() => onDecide({ type: 'allow' })}>
          <IconCheck /> Allow
        </button>
      </div>
      <div className="extra">
        <button onClick={() => setNoting(!noting)}>{noting ? 'Hide note' : 'Deny with a note…'}</button>
        {item.canAlwaysAllow && <button onClick={() => onDecide({ type: 'allow_always' })}>Always allow</button>}
      </div>
    </div>
  );
}

function PlanCard({ item, onDecide, compact }: { item: Approval; onDecide: (d: Decision) => void; compact?: boolean }) {
  const [note, setNote] = useState('');
  const plan = String(item.input.plan ?? '');
  return (
    <div className="approval">
      <div className="approval-head">
        <span className="badge"><IconMap /></span>
        <div className="what">
          <div className="q">Claude’s plan is ready</div>
          <div className="why">Approve to let Claude start working, or send feedback to keep planning.</div>
        </div>
      </div>
      {plan && !compact && <div className="preview plan"><Markdown text={plan} /></div>}
      <div className="note">
        <textarea className="field" rows={1} placeholder="Feedback to keep planning…" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="actions">
        <button className="btn" disabled={!note.trim()} onClick={() => onDecide({ type: 'deny', message: note })}>
          Keep planning
        </button>
        <button className="btn primary" onClick={() => onDecide({ type: 'allow' })}>
          <IconCheck /> Approve plan
        </button>
      </div>
    </div>
  );
}

function QuestionCard({ item, onDecide }: { item: Approval; onDecide: (d: Decision) => void }) {
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
  const answerFor = (q: Question) => {
    const o = other[q.question]?.trim();
    const sel = picked[q.question] ?? [];
    return [...sel, ...(o ? [o] : [])].join(', ');
  };
  const ready = questions.every((q) => answerFor(q));

  return (
    <div className="approval">
      <div className="approval-head">
        <span className="badge"><IconQuestion /></span>
        <div className="what">
          <div className="q">Claude has {questions.length > 1 ? `${questions.length} questions` : 'a question'}</div>
        </div>
      </div>
      {questions.map((q) => (
        <div className="qblock" key={q.question}>
          <div className="qq">{q.question}</div>
          <div className="opts">
            {q.options.map((o) => (
              <button key={o.label} className={`opt${picked[q.question]?.includes(o.label) ? ' on' : ''}`} onClick={() => toggle(q, o.label)}>
                <div className="ol">{o.label}</div>
                {o.description && <div className="od">{o.description}</div>}
              </button>
            ))}
            <input
              className="field"
              placeholder="Other…"
              value={other[q.question] ?? ''}
              onChange={(e) => {
                setOther({ ...other, [q.question]: e.target.value });
                if (!q.multiSelect && e.target.value) setPicked({ ...picked, [q.question]: [] });
              }}
            />
          </div>
        </div>
      ))}
      <div className="actions">
        <button className="btn" onClick={() => onDecide({ type: 'deny', message: 'The user skipped these questions.' })}>Skip</button>
        <button
          className="btn primary"
          disabled={!ready}
          onClick={() => onDecide({ type: 'answer', answers: Object.fromEntries(questions.map((q) => [q.question, answerFor(q)])) })}
        >
          Submit
        </button>
      </div>
    </div>
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

function Settled({ item, cwd }: { item: Approval; cwd?: string }) {
  const { label } = toolMeta(item.toolName);
  const answers = item.input.answers as Record<string, string> | undefined;
  const text =
    item.toolName === 'AskUserQuestion'
      ? answers ? `You answered: ${Object.values(answers).join(' · ')}` : item.status === 'cancelled' ? 'Question cancelled' : 'You skipped the question'
      : item.toolName === 'ExitPlanMode'
        ? item.status === 'allowed' ? 'You approved the plan' : 'You asked Claude to keep planning'
        : `${item.status === 'allowed' ? 'Allowed' : item.status === 'denied' ? 'Denied' : 'Cancelled'}: ${item.toolName === 'Bash' ? String(item.input.command ?? '') : `${label.toLowerCase()} ${toolArg(item.toolName, item.input, cwd)}`}`;
  return (
    <div className="approval-done">
      {item.status === 'allowed' ? <IconCheck className="ok" /> : <IconX className={item.status === 'denied' ? 'bad' : ''} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  );
}
