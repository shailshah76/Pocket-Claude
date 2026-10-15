import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './Icons';

export function Sheet(props: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
  actions?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onClose]);

  return createPortal(
    <>
      <div className="scrim" onClick={props.onClose} />
      <div className={`sheet${props.full ? ' full' : ''}`} role="dialog" aria-modal="true">
        <div className="grab" />
        {props.title !== undefined && (
          <div className="sheet-head">
            <h2>{props.title}</h2>
            {props.actions}
            <button className="icon-btn" onClick={props.onClose} aria-label="Close">
              <IconX />
            </button>
          </div>
        )}
        <div className="sheet-body">{props.children}</div>
        {props.footer && <div className="sheet-foot">{props.footer}</div>}
      </div>
    </>,
    document.body,
  );
}
