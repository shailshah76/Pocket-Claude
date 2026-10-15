import { useCallback, useEffect, useState } from 'react';
import { api, connect, disconnect, loadMe, onAuthChange, useStore } from './store';
import { Login } from './screens/Login';
import { Setup } from './screens/Setup';
import { Home } from './screens/Home';
import { Chat } from './screens/Chat';
import { IconWarn } from './components/Icons';

function useHashRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const m = hash.match(/^#\/s\/([\w-]+)/);
  return m ? m[1] : null;
}

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ host: string } | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const conn = useStore((s) => s.conn);
  const me = useStore((s) => s.me);
  const toast = useStore((s) => s.toast);
  const sessionId = useHashRoute();

  const boot = useCallback(async () => {
    try {
      const st = await api<{ authed: boolean; needsSetup: boolean; host: string }>('/api/status');
      setUnreachable(false);
      setSetup(st.needsSetup ? { host: st.host } : null);
      setAuthed(st.authed);
      if (st.authed) {
        await loadMe();
        connect();
      }
    } catch {
      setUnreachable(true);
      setTimeout(boot, 4000);
    }
  }, []);

  useEffect(() => {
    onAuthChange((a) => {
      if (!a) {
        disconnect();
        setAuthed(false);
      }
    });
    void boot();
  }, [boot]);

  const open = useCallback((id: string, replace = false) => {
    if (replace) location.replace(`#/s/${id}`);
    else location.hash = `#/s/${id}`;
  }, []);
  const back = useCallback(() => {
    if (history.length > 1 && location.hash) history.back();
    else location.hash = '';
  }, []);

  const logout = async () => {
    await api('/api/logout', { body: {} }).catch(() => {});
    disconnect();
    setAuthed(false);
  };

  if (authed === null) {
    return (
      <div className="screen login">
        <img className="logo" src="/icon-192.png" alt="" />
        {unreachable ? (
          <div className="empty" style={{ padding: 0 }}>
            <h3>Can’t reach your Mac</h3>
            <div>It may be asleep, offline, or not on Tailscale.<br />Retrying automatically…</div>
          </div>
        ) : (
          <span className="spinner" />
        )}
      </div>
    );
  }

  if (setup) return <Setup host={setup.host} onDone={() => void boot()} />;
  if (!authed) return <Login onDone={() => void boot()} />;

  return (
    <>
      {conn === 'offline' && (
        <div className="offline-bar" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, paddingTop: 'calc(var(--safe-top) + 7px)' }}>
          <IconWarn className="" />
          Can’t reach {me?.host ?? 'your Mac'}. It may be asleep. Reconnecting…
        </div>
      )}
      {sessionId ? <Chat id={sessionId} back={back} open={open} /> : <Home open={open} onLogout={logout} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
