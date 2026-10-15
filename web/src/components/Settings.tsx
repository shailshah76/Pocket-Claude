import { useEffect, useState } from 'react';
import { api, loadMe, toast, useStore } from '../store';
import { Browser } from './Browser';
import { isIOS, isStandalone, tildify } from '../util';
import { IconBell, IconFolder, IconLogout } from './Icons';
import { Sheet } from './Sheet';

function urlB64ToUint8Array(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSub(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export function Settings({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const me = useStore((s) => s.me);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickPath, setPickPath] = useState('');
  const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext;
  const needsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    currentSub().then((s) => setSubscribed(!!s)).catch(() => setSubscribed(false));
  }, []);

  const enable = async () => {
    if (!me?.vapidPublicKey) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Notifications were blocked. Enable them in system settings.');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(me.vapidPublicKey) });
      await api('/api/push/subscribe', { body: sub.toJSON() });
      setSubscribed(true);
      toast('Notifications on');
    } catch (e: any) {
      toast(e.message ?? 'Could not enable notifications');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const sub = await currentSub();
    if (sub) {
      await api('/api/push/unsubscribe', { body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    setSubscribed(false);
  };

  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="settings-block">
        <h4>Notifications</h4>
        {!pushSupported ? (
          <p>{window.isSecureContext ? 'This browser doesn’t support push notifications.' : 'Notifications need HTTPS. Open the app through your Tailscale https:// address.'}</p>
        ) : needsInstall ? (
          <p>On iPhone, first tap <b>Share → Add to Home Screen</b>, then open Pocket Claude from your home screen to turn on notifications.</p>
        ) : (
          <>
            <p>Get a ping when Claude needs approval or finishes, while the app is closed.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {subscribed ? (
                <>
                  <button className="btn sm" onClick={() => api('/api/push/test', { body: {} }).then((r) => toast(r.sent ? 'Sent. Lock your phone to see it.' : 'No devices subscribed'))}>
                    <IconBell /> Send test
                  </button>
                  <button className="btn sm ghost" onClick={disable}>Turn off</button>
                </>
              ) : (
                <button className="btn sm primary" disabled={busy || subscribed === null} onClick={enable}>
                  <IconBell /> Turn on notifications
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <div className="settings-block">
        <h4>This Mac</h4>
        <div className="kv"><span>Host</span><span>{me?.host}</span></div>
        <div className="kv">
          <span>Default folder</span>
          <button style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 13 }} onClick={() => setPicking(true)}>
            {tildify(me?.defaultDir, me?.home)} ›
          </button>
        </div>
        <div className="kv"><span>Address</span><span>{location.host}</span></div>
        <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-3)' }}>To change the PIN, run <code>npm run setup</code> on the computer.</p>
      </div>
      <div className="settings-block">
        <button className="btn block danger" onClick={onLogout}>
          <IconLogout /> Sign out of this phone
        </button>
      </div>
      {picking && (
        <Sheet
          full
          title="Default folder"
          onClose={() => setPicking(false)}
          footer={
            <button
              className="btn primary block"
              onClick={async () => {
                try {
                  await api('/api/settings', { body: { defaultDir: pickPath } });
                  await loadMe();
                  toast('Default folder updated');
                  setPicking(false);
                } catch (e: any) {
                  toast(e.message);
                }
              }}
            >
              <IconFolder /> Use {tildify(pickPath, me?.home) || 'this folder'}
            </button>
          }
        >
          <Browser start={me?.defaultDir ?? '~'} onPath={setPickPath} />
        </Sheet>
      )}
    </Sheet>
  );
}
