import { useState } from 'react';
import { useInstallPrompt } from '../install';
import { isIOS, isStandalone } from '../util';
import { IconDown, IconX } from './Icons';

const KEY = 'pc:install-dismissed';

export function InstallBanner() {
  const install = useInstallPrompt();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  if (hidden || isStandalone()) return null;
  const ios = isIOS();
  if (!install && !ios) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
  };

  return (
    <div className="banner install">
      <img src="/icon-192.png" alt="" />
      <div style={{ flex: 1 }}>
        <b>Install Pocket Claude</b>
        <div>
          {ios ? (
            <>Tap <ShareGlyph /> <b>Share</b>, then <b>Add to Home Screen</b>, for full screen and notifications.</>
          ) : (
            'Add it to your home screen for full screen and notifications.'
          )}
        </div>
        {install && (
          <button className="btn sm primary" style={{ marginTop: 10 }} onClick={install}>
            <IconDown /> Install
          </button>
        )}
      </div>
      <button className="icon-btn" style={{ width: 32, height: 32, marginTop: -4 }} onClick={dismiss} aria-label="Dismiss">
        <IconX />
      </button>
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }} aria-hidden="true">
      <path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
