import { memo, useMemo, useState, type ComponentType } from 'react';
import type { Item } from '../../../shared/types';
import { relTo } from '../util';
import { DiffView, changesFor, diffStat } from './DiffView';
import { Markdown } from './Markdown';
import {
  IconBot, IconCheck, IconChevron, IconEye, IconFile, IconFilePlus, IconGlobe, IconList, IconMap,
  IconPencil, IconQuestion, IconSearch, IconTerminal, IconTool, IconX,
} from './Icons';

type Tool = Extract<Item, { kind: 'tool' }>;

const META: Record<string, { icon: ComponentType<{ className?: string }>; label: string }> = {
  Bash: { icon: IconTerminal, label: 'Run' },
  Read: { icon: IconEye, label: 'Read' },
  Edit: { icon: IconPencil, label: 'Edit' },
  MultiEdit: { icon: IconPencil, label: 'Edit' },
  Write: { icon: IconFilePlus, label: 'Write' },
  NotebookEdit: { icon: IconPencil, label: 'Notebook' },
  Glob: { icon: IconSearch, label: 'Find' },
  Grep: { icon: IconSearch, label: 'Search' },
  WebFetch: { icon: IconGlobe, label: 'Fetch' },
  WebSearch: { icon: IconGlobe, label: 'Web' },
  Task: { icon: IconBot, label: 'Agent' },
  Agent: { icon: IconBot, label: 'Agent' },
  TodoWrite: { icon: IconList, label: 'Plan' },
  ExitPlanMode: { icon: IconMap, label: 'Plan' },
  AskUserQuestion: { icon: IconQuestion, label: 'Asked' },
};

export function toolMeta(name: string) {
  if (META[name]) return META[name];
  if (name.startsWith('mcp__')) return { icon: IconTool, label: name.split('__').slice(2).join(' ') || name };
  return { icon: IconTool, label: name };
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

export const ToolCard = memo(function ToolCard({ item, cwd, onOpenFile }: { item: Tool; cwd?: string; onOpenFile: (p: string) => void }) {
  const isTodo = item.name === 'TodoWrite';
  const [open, setOpen] = useState(isTodo);
  const { icon: Icon, label } = toolMeta(item.name);
  const changes = useMemo(() => changesFor(item.name, item.input), [item.name, item.input]);
  const stat = useMemo(() => (changes ? diffStat(changes) : null), [changes]);
  const path = (item.input.file_path ?? item.input.notebook_path) as string | undefined;

  return (
    <div className={`tool${open ? ' open' : ''}`}>
      <button className="tool-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="ticon"><Icon /></span>
        <span className="tname">{label}</span>
        <span className="targ">{toolArg(item.name, item.input, cwd)}</span>
        {stat && (stat.add > 0 || stat.del > 0) && (
          <span>
            {stat.add > 0 && <span className="stat-add">+{stat.add}</span>} {stat.del > 0 && <span className="stat-del">−{stat.del}</span>}
          </span>
        )}
        <span className="tstat">
          {item.status === 'running' ? <span className="spinner" /> : item.status === 'error' ? <IconX className="bad" /> : <IconCheck className="ok" />}
        </span>
        <IconChevron className="chev" />
      </button>
      {open && <ToolBody item={item} changes={changes} path={path} onOpenFile={onOpenFile} />}
    </div>
  );
});

function ToolBody({ item, changes, path, onOpenFile }: { item: Tool; changes: ReturnType<typeof changesFor>; path?: string; onOpenFile: (p: string) => void }) {
  const { name, input, output, status } = item;
  const out = output?.trim();
  return (
    <div className="tool-body">
      {name === 'Bash' && (
        <pre className="term">
          <span className="ps">$ </span>
          {String(input.command ?? '')}
          {out ? '\n\n' : ''}
          {out && <span className={status === 'error' ? 'term err' : undefined}>{out}</span>}
        </pre>
      )}
      {name === 'TodoWrite' && <Todos todos={(input.todos as any[]) ?? []} />}
      {(name === 'Task' || name === 'Agent') && (
        <>
          {input.prompt && <div className="label">Instructions</div>}
          {input.prompt && <pre className="term">{String(input.prompt)}</pre>}
          {out && <div className="label">Report</div>}
          {out && <div style={{ padding: '4px 12px 12px', fontSize: 14.5 }}><Markdown text={out} /></div>}
        </>
      )}
      {changes && <DiffView changes={changes} />}
      {changes && status === 'error' && out && <pre className="term err">{out}</pre>}
      {!changes && !['Bash', 'TodoWrite', 'Task', 'Agent'].includes(name) && (
        <>
          {name !== 'Read' && Object.keys(input).length > 0 && (
            <pre className="term">{JSON.stringify(input, null, 2)}</pre>
          )}
          {out && name !== 'Read' && <pre className={`term${status === 'error' ? ' err' : ''}`}>{out}</pre>}
          {name === 'Read' && status === 'error' && out && <pre className="term err">{out}</pre>}
        </>
      )}
      {path && (
        <button className="tool-link" onClick={() => onOpenFile(path)}>
          <IconFile /> Open {path.split('/').pop()}
        </button>
      )}
    </div>
  );
}

function Todos({ todos }: { todos: { content: string; status: string; activeForm?: string }[] }) {
  return (
    <ul className="todo">
      {todos.map((t, i) => (
        <li key={i} className={t.status === 'completed' ? 'done' : t.status === 'in_progress' ? 'active' : ''}>
          <span className="box">{t.status === 'completed' && <IconCheck />}</span>
          <span>{t.status === 'in_progress' && t.activeForm ? t.activeForm : t.content}</span>
        </li>
      ))}
    </ul>
  );
}
