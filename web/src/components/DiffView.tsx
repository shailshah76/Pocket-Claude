import { useMemo, useState } from 'react';
import { structuredPatch } from 'diff';

const PAGE = 300;

export interface Change {
  oldText: string;
  newText: string;
}

/** Changes described by an Edit / MultiEdit / Write tool call. */
export function changesFor(tool: string, input: Record<string, any>): Change[] | null {
  if (tool === 'Edit' && typeof input.old_string === 'string') return [{ oldText: input.old_string, newText: input.new_string ?? '' }];
  if (tool === 'MultiEdit' && Array.isArray(input.edits)) return input.edits.map((e: any) => ({ oldText: e.old_string ?? '', newText: e.new_string ?? '' }));
  if (tool === 'Write' && typeof input.content === 'string') return [{ oldText: '', newText: input.content }];
  return null;
}

export function diffStat(changes: Change[]): { add: number; del: number } {
  let add = 0;
  let del = 0;
  for (const c of changes) {
    for (const h of structuredPatch('a', 'b', c.oldText, c.newText, '', '', { context: 0 }).hunks) {
      for (const l of h.lines) {
        if (l[0] === '+') add++;
        else if (l[0] === '-') del++;
      }
    }
  }
  return { add, del };
}

type Row = { kind: 'hunk'; text: string } | { kind: 'add' | 'del' | 'ctx'; text: string; no: number | '' };

export function DiffView({ changes }: { changes: Change[] }) {
  const [limit, setLimit] = useState(PAGE);
  const rows = useMemo(() => {
    const out: Row[] = [];
    changes.forEach((c, ci) => {
      const patch = structuredPatch('a', 'b', c.oldText, c.newText, '', '', { context: 3 });
      if (changes.length > 1) out.push({ kind: 'hunk', text: `Edit ${ci + 1} of ${changes.length}` });
      for (const h of patch.hunks) {
        if (patch.hunks.length > 1) out.push({ kind: 'hunk', text: `@@ −${h.oldStart} +${h.newStart} @@` });
        let o = h.oldStart;
        let n = h.newStart;
        for (const l of h.lines) {
          const s = l[0];
          const text = l.slice(1);
          if (s === '\\') continue;
          if (s === '+') out.push({ kind: 'add', text, no: n++ });
          else if (s === '-') out.push({ kind: 'del', text, no: o++ });
          else {
            out.push({ kind: 'ctx', text, no: n++ });
            o++;
          }
        }
      }
    });
    return out;
  }, [changes]);

  return (
    <div className="diff">
      {rows.slice(0, limit).map((r, i) =>
        r.kind === 'hunk' ? (
          <div key={i} className="hunk">{r.text}</div>
        ) : (
          <div key={i} className={`ln ${r.kind}`}>
            <span className="no">{r.no}</span>
            <span className="sg">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ''}</span>
            <span className="tx">{r.text || ' '}</span>
          </div>
        ),
      )}
      {rows.length > limit && (
        <button className="more" onClick={() => setLimit(limit + PAGE)}>
          Show {Math.min(PAGE, rows.length - limit)} more lines…
        </button>
      )}
    </div>
  );
}
