import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Decision, Item, PermissionMode, SessionState } from '../../../shared/types';
import { actions, api, pendingApprovals, subscribe, toast, useStore } from '../store';
import { base, duration, tildify } from '../util';
import { ApprovalCard } from '../components/ApprovalCard';
import { Browser } from '../components/Browser';
import { FileViewer } from '../components/FileViewer';
import { Markdown } from '../components/Markdown';
import { ModePicker } from '../components/ModePicker';
import { Sheet } from '../components/Sheet';
import { ToolCard } from '../components/ToolCard';
import {
  IconBack, IconDown, IconFolder, IconFork, IconMap, IconMore, IconPencil, IconPlay, IconPower, IconSend, IconShield, IconStop, IconTerminal,
} from '../components/Icons';

const MODE_LABEL: Record<PermissionMode, string> = { default: 'Ask before acting', acceptEdits: 'Auto-accept edits', plan: 'Plan mode' };
const NEXT_MODE: Record<PermissionMode, PermissionMode> = { default: 'acceptEdits', acceptEdits: 'plan', plan: 'default' };

export function Chat({ id, back, open }: { id: string; back: () => void; open: (id: string, replace?: boolean) => void }) {
  const s = useStore((st) => (st.current?.sessionId === id ? st.current : null));
  const home = useStore((st) => st.me?.home);
  const [file, setFile] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [files, setFiles] = useState(false);

  useEffect(() => {
    subscribe(id);
    return () => subscribe(null);
  }, [id]);

  const scroller = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const stick = useRef(true);
  const onScroll = () => {
    const el = scroller.current!;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = near;
    setAtBottom(near);
  };
  const toBottom = (smooth = false) => scroller.current?.scrollTo({ top: 1e9, behavior: smooth ? 'smooth' : 'auto' });
  useLayoutEffect(() => {
    if (stick.current) toBottom();
  }, [s?.items, s?.status]);

  const onDecide = useCallback((approvalId: string, d: Decision) => actions.decide(id, approvalId, d), [id]);
  const openFile = useCallback((p: string) => setFile(p), []);

  if (!s) {
    return (
      <div className="screen">
        <div className="topbar">
          <button className="icon-btn" onClick={back} aria-label="Back"><IconBack /></button>
          <div className="titles"><div className="t1">Loading…</div></div>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ padding: 16 }}>{[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}</div>
      </div>
    );
  }

  const pending = pendingApprovals(s.items);
  const last = s.items[s.items.length - 1];
  const working = s.live && (s.status === 'running') && !(last?.kind === 'text' && last.streaming);

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={back} aria-label="Back"><IconBack /></button>
        <div className="titles">
          <div className="t1">{s.title}</div>
          <div className="t2">
            <span className={`dot ${!s.live ? '' : s.status === 'waiting' ? 'amber' : s.status === 'running' ? 'accent pulse' : 'green'}`} />
            <span>{base(s.cwd) || 'folder'}</span>
            {s.model && <><span>·</span><span>{s.model.replace(/^claude-/, '')}</span></>}
            {!s.live && <><span>·</span><span>on Mac</span></>}
          </div>
        </div>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Session menu"><IconMore /></button>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll" ref={scroller} onScroll={onScroll}>
        <div className="timeline">
          {s.items.length === 0 && (
            <div className="empty">
              <IconTerminal />
              <h3>{tildify(s.cwd, home)}</h3>
              <div>Ask Claude anything about this folder.</div>
            </div>
          )}
          {s.items.map((it) =>
            it.kind === 'approval' && it.status === 'pending' ? null : (
              <ItemView key={it.id} item={it} cwd={s.cwd} onOpenFile={openFile} onDecide={onDecide} />
            ),
          )}
          {working && (
            <div className="working">
              <span className="bars"><i /><i /><i /></span> Claude is working…
            </div>
          )}
        </div>
      </div>

        {!atBottom && (
          <button className="jump" onClick={() => toBottom(true)} aria-label="Scroll to bottom">
            <IconDown />
          </button>
        )}
      </div>

      <Composer key={s.sessionId} s={s} pending={pending} onDecide={onDecide} open={open} />

      {menu && (
        <SessionMenu
          s={s}
          onClose={() => setMenu(false)}
          onFiles={() => (setMenu(false), setFiles(true))}
        />
      )}
      {files && (
        <Sheet full title="Files" onClose={() => setFiles(false)}>
          <Browser start={s.cwd || '~'} onFile={(p) => setFile(p)} />
        </Sheet>
      )}
      {file && <FileViewer path={file} onClose={() => setFile(null)} />}
    </div>
  );
}

const ItemView = memo(function ItemView({ item, cwd, onOpenFile, onDecide }: { item: Item; cwd: string; onOpenFile: (p: string) => void; onDecide: (id: string, d: Decision) => void }) {
  switch (item.kind) {
    case 'user':
      return <div className="msg-user">{item.text}</div>;
    case 'text':
      return item.text ? <div className={`msg-text${item.streaming ? ' streaming' : ''}`}><Markdown text={item.text} /></div> : null;
    case 'thinking':
      return (
        <details className="thinking">
          <summary>Thought for a moment</summary>
          <Markdown text={item.text} />
        </details>
      );
    case 'tool':
      return <ToolCard item={item} cwd={cwd} onOpenFile={onOpenFile} />;
    case 'approval':
      return <ApprovalCard item={item} cwd={cwd} onDecide={(d) => onDecide(item.id, d)} />;
    case 'result':
      return (
        <div className={`result${item.ok ? '' : ' bad'}`}>
          {item.ok ? `Done in ${duration(item.durationMs)}` : `Stopped${item.error ? `: ${item.error.slice(0, 80)}` : ''}`}
        </div>
      );
    case 'notice':
      return <div className={`notice ${item.level}`}>{item.text}</div>;
  }
});

function Composer({ s, pending, onDecide, open }: { s: SessionState; pending: ReturnType<typeof pendingApprovals>; onDecide: (id: string, d: Decision) => void; open: (id: string, replace?: boolean) => void }) {
  const [text, setText] = useState(() => sessionStorage.getItem(`draft:${s.sessionId}`) ?? '');
  const recentlyActive = Date.now() - s.lastModified < 15 * 60_000;
  const [fork, setFork] = useState(recentlyActive);
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      if (text) sessionStorage.setItem(`draft:${s.sessionId}`, text);
      else sessionStorage.removeItem(`draft:${s.sessionId}`);
    } catch { /* private mode */ }
  }, [text, s.sessionId]);

  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const running = s.live && (s.status === 'running' || s.status === 'waiting');

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    if (s.live) {
      actions.send(s.sessionId, t);
      setText('');
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ sessionId: string }>('/api/sessions', { body: { resumeId: s.sessionId, fork, prompt: t, cwd: s.cwd } });
      setText('');
      if (r.sessionId !== s.sessionId) open(r.sessionId, true);
      else subscribe(s.sessionId);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const top = pending[0];

  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        {top && (
          <div style={{ maxHeight: '58dvh', overflowY: 'auto', borderRadius: 'var(--r-lg)' }}>
            <ApprovalCard item={top} cwd={s.cwd} onDecide={(d) => onDecide(top.id, d)} />
            {pending.length > 1 && <div className="composer-hint" style={{ marginTop: 6 }}>{pending.length - 1} more waiting</div>}
          </div>
        )}
        {!s.live && (
          <>
            <div className="seg" role="radiogroup" aria-label="Resume style">
              <button className={!fork ? 'on' : ''} onClick={() => setFork(false)} role="radio" aria-checked={!fork}><IconPlay /> Continue</button>
              <button className={fork ? 'on' : ''} onClick={() => setFork(true)} role="radio" aria-checked={fork}><IconFork /> Fork a copy</button>
            </div>
            <div className="composer-hint">
              {fork
                ? 'Starts a copy so a terminal still using this session isn’t disturbed.'
                : recentlyActive
                  ? 'Heads up: this was active on your Mac recently. If it’s still open in a terminal, fork instead.'
                  : 'Picks up this session right where it left off.'}
            </div>
          </>
        )}
        {s.live && !top && (
          <div className="composer-row">
            <button className="chip" onClick={() => actions.mode(s.sessionId, NEXT_MODE[s.mode])} aria-label="Change permission mode">
              {s.mode === 'plan' ? <IconMap /> : s.mode === 'acceptEdits' ? <IconPencil /> : <IconShield />}
              {MODE_LABEL[s.mode]}
            </button>
            <span style={{ flex: 1 }} />
            {s.status === 'running' && <span className="composer-hint">Messages queue while Claude works</span>}
          </div>
        )}
        <div className="composer">
          <textarea
            ref={ta}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={s.live ? (running ? 'Add a follow-up…' : 'Reply to Claude…') : fork ? 'Message to start the fork…' : 'Message to continue…'}
            enterKeyHint="send"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          {running && !text.trim() ? (
            <button className="send stop" onClick={() => actions.interrupt(s.sessionId)} aria-label="Stop Claude"><IconStop /></button>
          ) : (
            <button className="send" disabled={!text.trim() || busy} onClick={submit} aria-label="Send">
              {busy ? <span className="spinner" /> : <IconSend />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionMenu({ s, onClose, onFiles }: { s: SessionState; onClose: () => void; onFiles: () => void }) {
  const home = useStore((st) => st.me?.home);
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg);
    } catch {
      toast(text);
    }
    onClose();
  };
  return (
    <Sheet title={s.title} onClose={onClose}>
      <div className="menu">
        <div style={{ padding: '0 12px 8px', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-3)', wordBreak: 'break-all' }}>{tildify(s.cwd, home)}</div>
        {s.live && (
          <div style={{ padding: '4px 4px 10px' }}>
            <ModePicker mode={s.mode} onChange={(m) => actions.mode(s.sessionId, m)} />
          </div>
        )}
        <button onClick={onFiles}><IconFolder /> Browse files</button>
        <button onClick={() => copy(`cd ${JSON.stringify(s.cwd)} && claude --resume ${s.sessionId}`, 'Resume command copied')}>
          <IconTerminal />
          <span>
            Copy terminal resume command
            <div className="sub">Pick this up later at your Mac</div>
          </span>
        </button>
        {s.live && (
          <button
            className="danger"
            onClick={() => {
              void api(`/api/sessions/${s.sessionId}/stop`, { body: {} });
              onClose();
            }}
          >
            <IconPower />
            <span>
              End phone session
              <div className="sub" style={{ color: 'var(--text-3)' }}>The conversation is saved; you can resume it any time</div>
            </span>
          </button>
        )}
      </div>
    </Sheet>
  );
}
