import { useState } from 'react';
import { api } from '../store';
import { PinPad } from '../components/PinPad';
import { IconChevron } from '../components/Icons';

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

function codeFromUrl(): string {
  const c = new URLSearchParams(location.search).get('setup');
  if (c) history.replaceState(null, '', location.pathname + location.hash); // don't leave it in history
  return clean(c ?? '');
}

/** First run: prove you're at the computer (setup code from its terminal), then choose a PIN. */
export function Setup({ host, onDone }: { host: string; onDone: () => void }) {
  const [code, setCode] = useState(codeFromUrl);
  const [step, setStep] = useState<'code' | 'pin' | 'confirm'>(() => (code.length === 8 ? 'pin' : 'code'));
  const [first, setFirst] = useState('');
  const [codeErr, setCodeErr] = useState('');

  if (step === 'code') {
    return (
      <div className="screen login">
        <img className="logo" src="/icon-192.png" alt="" />
        <div>
          <h1>Welcome</h1>
          <p>Let’s connect this phone to <b style={{ color: 'var(--text)' }}>{host}</b>.</p>
        </div>
        <form
          className="setup-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 8) setStep('pin');
          }}
        >
          <label htmlFor="code">Setup code</label>
          <input
            id="code"
            className="code-input"
            value={code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code}
            onChange={(e) => (setCode(clean(e.target.value)), setCodeErr(''))}
            placeholder="XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            inputMode="text"
          />
          <div className="hint">
            Shown in the terminal on your computer after running <code>npm run onboard</code> (or <code>npm start</code>).
          </div>
          {codeErr && <div className="err">{codeErr}</div>}
          <button className="btn primary block" disabled={code.length !== 8}>
            Continue <IconChevron />
          </button>
        </form>
      </div>
    );
  }

  if (step === 'pin') {
    return (
      <PinPad
        key="pin"
        title="Choose a PIN"
        subtitle="6–12 digits. You’ll use it to sign in on your phones."
        submitLabel="Next"
        onSubmit={async (pin) => {
          setFirst(pin);
          setStep('confirm');
        }}
        footer={<button className="btn ghost sm" onClick={() => setStep('code')}>Back</button>}
      />
    );
  }

  return (
    <PinPad
      key="confirm"
      title="Confirm your PIN"
      subtitle="Enter it once more"
      submitLabel="Done"
      onSubmit={async (pin) => {
        if (pin !== first) {
          setTimeout(() => setStep('pin'), 900);
          return 'PINs didn’t match. Let’s try again.';
        }
        try {
          await api('/api/setup', { body: { code, pin } });
          onDone();
        } catch (e: any) {
          if (e.status === 409) return void onDone(); // someone finished setup already; go sign in
          if (e.status === 429) return `Too many attempts. Try again in ${Math.ceil((e.body?.retryAfterMs ?? 60000) / 60000)} min.`;
          if (/setup code/.test(e.message)) {
            setCodeErr('That setup code didn’t match. Check the terminal on your computer.');
            setStep('code');
            return;
          }
          return e.message;
        }
      }}
    />
  );
}
