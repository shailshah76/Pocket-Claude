import { useEffect, useState, type ReactNode } from 'react';
import { IconBackspace } from './Icons';

const MAX = 12;

/** Full-screen numeric keypad. `onSubmit` returns an error message to shake + clear, or nothing on success. */
export function PinPad({
  title,
  subtitle,
  submitLabel = 'Enter',
  onSubmit,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  submitLabel?: string;
  onSubmit: (pin: string) => Promise<string | void>;
  footer?: ReactNode;
}) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (p: string) => {
    if (p.length < 6 || busy) return;
    setBusy(true);
    const error = await onSubmit(p);
    setBusy(false);
    if (error) {
      setShake(true);
      navigator.vibrate?.(120);
      setTimeout(() => (setShake(false), setPin('')), 450);
      setErr(error);
    } else {
      setPin('');
    }
  };

  const press = (d: string) => {
    if (busy) return;
    setErr('');
    setPin((p) => (p.length < MAX ? p + d : p));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
      else if (e.key === 'Enter') void submit(pin);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="screen login">
      <img className="logo" src="/icon-192.png" alt="" />
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className={`pin-dots${shake ? ' shake' : ''}`} aria-label={`${pin.length} digits entered`}>
        {Array.from({ length: Math.max(6, pin.length) }, (_, i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="err" role="alert">{err}</div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="key" onClick={() => press(d)}>{d}</button>
        ))}
        <button className="key fn" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete">
          <IconBackspace />
        </button>
        <button className="key" onClick={() => press('0')}>0</button>
        <button
          className="key fn"
          onClick={() => submit(pin)}
          disabled={pin.length < 6 || busy}
          style={{ color: pin.length >= 6 ? 'var(--accent)' : undefined, fontWeight: 600 }}
        >
          {busy ? <span className="spinner" /> : submitLabel}
        </button>
      </div>
      {footer}
    </div>
  );
}
