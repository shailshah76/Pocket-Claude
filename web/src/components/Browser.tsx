import { useCallback, useEffect, useRef, useState } from 'react';
import type { FsListing } from '../../../shared/types';
import { api, useStore } from '../store';
import { ago, bytes, tildify } from '../util';
import { IconFile, IconFolder, IconUp } from './Icons';

/**
 * Folder navigator with a tiny shell: type `cd path`, `cd ..`, `ls`, or paste a path.
 * Taps on files call `onFile` (when given).
 */
export function Browser({ start, onPath, onFile }: { start: string; onPath?: (p: string) => void; onFile?: (p: string) => void }) {
  const home = useStore((s) => s.me?.home ?? '');
  const [listing, setListing] = useState<FsListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [cmd, setCmd] = useState('');
  const crumbsRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    async (path: string, base?: string) => {
      try {
        const l = await api<FsListing>(`/api/fs/list?path=${encodeURIComponent(path)}${base ? `&base=${encodeURIComponent(base)}` : ''}${hidden ? '&hidden=1' : ''}`);
        setListing(l);
        setError(null);
        onPath?.(l.path);
        requestAnimationFrame(() => crumbsRef.current?.scrollTo({ left: 99999 }));
      } catch (e: any) {
        // A path to a file: open it instead of erroring.
        if (e.status === 400 && onFile && /Not a folder/.test(e.message)) {
          onFile(e.message.replace(/^Not a folder: /, ''));
          return;
        }
        setError(e.message);
      }
    },
    [hidden, onPath, onFile],
  );

  useEffect(() => {
    void go(listing?.path ?? start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  const run = () => {
    const raw = cmd.trim();
    setCmd('');
    if (!raw) return;
    if (raw === 'ls' || raw === 'pwd') return void go(listing?.path ?? start);
    const target = raw.replace(/^cd\s*/, '').replace(/^(['"])(.*)\1$/, '$2') || '~';
    void go(target, listing?.path);
  };

  const crumbs = (() => {
    if (!listing) return [];
    const shown = tildify(listing.path, home);
    const parts = shown.split('/').filter(Boolean);
    const rootIsHome = shown.startsWith('~');
    let acc = rootIsHome ? home : '';
    return parts.map((p, i) => {
      if (!(i === 0 && rootIsHome)) acc += '/' + p;
      return { label: p, path: acc || '/' };
    });
  })();

  return (
    <>
      <div className="crumbs" ref={crumbsRef}>
        {crumbs.map((c) => (
          <button key={c.path} onClick={() => go(c.path)}>{c.label}</button>
        ))}
      </div>
      <form className="cmd" onSubmit={(e) => (e.preventDefault(), run())}>
        <span className="prompt">❯</span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="cd ~/Projects  or  ls"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
        />
      </form>
      <div className="toggle-row">
        <span>{listing ? `${listing.entries.filter((e) => e.type === 'dir').length} folders · ${listing.entries.filter((e) => e.type === 'file').length} files` : ' '}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Hidden
          <button type="button" className={`switch${hidden ? ' on' : ''}`} onClick={() => setHidden(!hidden)} aria-pressed={hidden} aria-label="Show hidden files" />
        </label>
      </div>
      {error && <div className="fs-error">{error}</div>}
      {listing?.parent && (
        <button className="fs-row dir" onClick={() => go(listing.parent!)}>
          <IconUp />
          <span className="name">..</span>
        </button>
      )}
      {listing?.entries.map((e) =>
        e.type === 'dir' ? (
          <button key={e.name} className="fs-row dir" onClick={() => go(`${listing.path}/${e.name}`)}>
            <IconFolder />
            <span className="name">{e.name}</span>
          </button>
        ) : (
          <button
            key={e.name}
            className={`fs-row file${onFile ? '' : ' inert'}`}
            onClick={() => onFile?.(`${listing.path}/${e.name}`)}
            disabled={!onFile}
          >
            <IconFile />
            <span className="name">{e.name}</span>
            <span className="sub">{bytes(e.size)} · {ago(e.mtime)}</span>
          </button>
        ),
      )}
      {listing && listing.entries.length === 0 && <div className="empty" style={{ padding: 24 }}>Empty folder</div>}
    </>
  );
}
