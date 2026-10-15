import { useMemo, useState } from 'react';
import type { PermissionMode, SessionSummary } from '../../../shared/types';
import { api, toast, useStore } from '../store';
import { ago, base, dayBucket, tildify } from '../util';
import { Browser } from '../components/Browser';
import { Sheet } from '../components/Sheet';
import { Settings } from '../components/Settings';
import { ModePicker } from '../components/ModePicker';
import { InstallBanner } from '../components/InstallBanner';
import { IconBranch, IconChat, IconFolder, IconGear, IconLaptop, IconPlus, IconSearch, IconShield, IconTerminal } from '../components/Icons';

export function Home({ open, onLogout }: { open: (id: string) => void; onLogout: () => void }) {
  const sessions = useStore((s) => s.sessions);
  const me = useStore((s) => s.me);
  const usage = useStore((s) => s.usage);
  const conn = useStore((s) => s.conn);
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [settings, setSettings] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (sessions ?? []).filter((s) => !term || s.title.toLowerCase().includes(term) || s.cwd?.toLowerCase().includes(term));
  }, [sessions, q]);
  const live = filtered.filter((s) => s.live);
  const groups = useMemo(() => {
    const g = new Map<string, SessionSummary[]>();
    for (const s of filtered.filter((s) => !s.live)) {
      const k = dayBucket(s.lastModified);
      g.set(k, [...(g.get(k) ?? []), s]);
    }
    return [...g.entries()];
  }, [filtered]);

  return (
    <div className="screen">
      <div className="scroll" style={{ paddingBottom: 110 }}>
        <div className="home-head">
          <div className="row">
            <h1>Sessions</h1>
            <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Settings"><IconGear /></button>
          </div>
          <div className="host-line">
            <span className="chip">
              <span className={`dot ${conn === 'online' ? 'green' : conn === 'connecting' ? 'amber pulse' : 'red'}`} />
              <IconLaptop />
              {me?.host ?? 'Mac'} · {conn === 'online' ? 'connected' : conn === 'connecting' ? 'connecting…' : 'offline'}
            </span>
            {usage.fiveHour && (
              <span className="chip usage" title={`Resets ${new Date(usage.fiveHour.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}>
                5h <span className="meter"><i style={{ width: `${Math.round(usage.fiveHour.utilization * 100)}%` }} /></span>
                {Math.round(usage.fiveHour.utilization * 100)}%
              </span>
            )}
            {usage.sevenDay && (
              <span className="chip usage">
                week <span className="meter"><i style={{ width: `${Math.round(usage.sevenDay.utilization * 100)}%` }} /></span>
                {Math.round(usage.sevenDay.utilization * 100)}%
              </span>
            )}
          </div>
        </div>

        <InstallBanner />

        <label className="search">
          <IconSearch />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions or folders" type="search" />
        </label>

        {sessions === null && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}

        {live.length > 0 && (
          <>
            <div className="section-label">Running on phone</div>
            <div className="list">{live.map((s) => <Row key={s.sessionId} s={s} home={me?.home} onClick={() => open(s.sessionId)} />)}</div>
          </>
        )}

        {groups.map(([label, list]) => (
          <div key={label}>
            <div className="section-label">{label}</div>
            <div className="list">{list.map((s) => <Row key={s.sessionId} s={s} home={me?.home} onClick={() => open(s.sessionId)} />)}</div>
          </div>
        ))}

        {sessions !== null && filtered.length === 0 && (
          <div className="empty">
            <IconChat className="" />
            <h3>{q ? 'No matches' : 'No sessions yet'}</h3>
            <div>{q ? 'Try a different search.' : 'Start one below. Sessions from your Mac’s terminal show up here too.'}</div>
          </div>
        )}
      </div>

      <div className="fab-wrap">
        <button className="btn primary" onClick={() => setNewOpen(true)}>
          <IconPlus /> New session
        </button>
      </div>

      {newOpen && <NewSession onClose={() => setNewOpen(false)} onStarted={(id) => (setNewOpen(false), open(id))} />}
      {settings && <Settings onClose={() => setSettings(false)} onLogout={onLogout} />}
    </div>
  );
}

function Row({ s, home, onClick }: { s: SessionSummary; home?: string; onClick: () => void }) {
  const recentlyOnMac = !s.live && Date.now() - s.lastModified < 15 * 60_000;
  return (
    <button className={`srow${s.live ? ' live' : ''}`} onClick={onClick}>
      <span className="glyph">{s.live ? <IconChat /> : <IconTerminal />}</span>
      <span className="body">
        <span className="title">{s.title}</span>
        <span className="meta">
          <span className="folder">{tildify(s.cwd, home) || 'unknown folder'}</span>
          {s.gitBranch && s.gitBranch !== 'HEAD' && (
            <>
              <span className="sep">·</span>
              <IconBranch className="" />
              <span>{s.gitBranch}</span>
            </>
          )}
          <span className="sep">·</span>
          <span>{ago(s.lastModified)}</span>
        </span>
        {s.live && s.status && (
          <span className={`status-line ${s.status}`}>
            {s.status === 'waiting' ? (
              <><IconShield /> Needs your approval</>
            ) : s.status === 'running' ? (
              <><span className="dot accent pulse" /> Working…</>
            ) : (
              <><span className="dot" /> Idle</>
            )}
          </span>
        )}
        {recentlyOnMac && (
          <span className="status-line idle"><span className="dot amber" /> Active on Mac recently</span>
        )}
      </span>
    </button>
  );
}

function NewSession({ onClose, onStarted }: { onClose: () => void; onStarted: (id: string) => void }) {
  const me = useStore((s) => s.me);
  const [cwd, setCwd] = useState(me?.defaultDir ?? '~');
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<PermissionMode>('default');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const r = await api<{ sessionId: string }>('/api/sessions', { body: { cwd, prompt, mode } });
      onStarted(r.sessionId);
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  };

  return (
    <Sheet
      full
      title="New session"
      onClose={onClose}
      footer={
        <>
          <textarea
            className="field"
            rows={2}
            placeholder={`What should Claude do in ${base(cwd) || 'this folder'}?`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <ModePicker mode={mode} onChange={setMode} />
          <button className="btn primary block" disabled={busy} onClick={start}>
            {busy ? <span className="spinner" /> : <IconFolder />}
            Start in {tildify(cwd, me?.home)}
          </button>
        </>
      }
    >
      <Browser start={me?.defaultDir ?? '~'} onPath={setCwd} />
    </Sheet>
  );
}
