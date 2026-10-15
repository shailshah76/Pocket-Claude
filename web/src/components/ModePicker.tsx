import type { PermissionMode } from '../../../shared/types';
import { IconMap, IconPencil, IconShield } from './Icons';

const MODES: { id: PermissionMode; label: string; icon: typeof IconShield }[] = [
  { id: 'default', label: 'Ask', icon: IconShield },
  { id: 'acceptEdits', label: 'Auto-edit', icon: IconPencil },
  { id: 'plan', label: 'Plan', icon: IconMap },
];

export function ModePicker({ mode, onChange, disabled }: { mode: PermissionMode; onChange: (m: PermissionMode) => void; disabled?: boolean }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Permission mode">
      {MODES.map((m) => (
        <button key={m.id} role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => onChange(m.id)} disabled={disabled}>
          <m.icon /> {m.label}
        </button>
      ))}
    </div>
  );
}
