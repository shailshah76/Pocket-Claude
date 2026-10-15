import { useEffect, useState } from 'react';
import { api, useStore } from '../store';
import { bytes, tildify } from '../util';
import { IconWrap } from './Icons';
import { Sheet } from './Sheet';

interface FileData {
  path: string;
  text?: string;
  binary?: boolean;
  truncated?: boolean;
  size: number;
}

export function FileViewer({ path, onClose }: { path: string; onClose: () => void }) {
  const home = useStore((s) => s.me?.home);
  const [data, setData] = useState<FileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrap, setWrap] = useState(false);

  useEffect(() => {
    api<FileData>(`/api/fs/read?path=${encodeURIComponent(path)}`).then(setData, (e) => setError(e.message));
  }, [path]);

  const lines = data?.text?.split('\n') ?? [];
  const name = path.split('/').pop();

  return (
    <Sheet
      full
      onClose={onClose}
      title={<span style={{ fontFamily: 'var(--mono)', fontSize: 16 }}>{name}</span>}
      actions={
        <button className={`icon-btn`} onClick={() => setWrap(!wrap)} aria-pressed={wrap} aria-label="Wrap lines" style={wrap ? { color: 'var(--accent)' } : undefined}>
          <IconWrap />
        </button>
      }
    >
      <div style={{ padding: '0 20px 8px', fontSize: 12.5, color: 'var(--text-3)', fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
        {tildify(data?.path ?? path, home)}
        {data && ` · ${bytes(data.size)}`}
        {data && !data.binary && ` · ${lines.length} lines`}
      </div>
      {error && <div className="fs-error">{error}</div>}
      {!data && !error && <div className="skeleton" />}
      {data?.binary && <div className="empty">Binary file, can’t preview.</div>}
      {data?.text !== undefined && (
        <div className={`code${wrap ? ' wrap' : ''}`}>
          {lines.map((l, i) => (
            <div className="ln" key={i}>
              <span className="no">{i + 1}</span>
              <span className="tx">{l || ' '}</span>
            </div>
          ))}
          {data.truncated && <div className="empty">File truncated at 1 MB</div>}
        </div>
      )}
    </Sheet>
  );
}
