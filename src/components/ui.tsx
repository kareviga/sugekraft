import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { config } from '../config';
import { onToast, type ToastAction } from '../lib/toast';
import { photoSrc } from '../lib/photos';
import { requirements } from '../lib/utils';
import { STATUS_LABEL, type Job, type Status } from '../types';
import { tr } from '../i18n';

export function Pill({ status }: { status: Status }) {
  return <span className={`pill ${status}`}>{tr(STATUS_LABEL[status])}</span>;
}

export function Mark({ status }: { status: Status }) {
  return <i className={`mark ${status}`} aria-hidden="true" />;
}

export function Modal({
  title,
  onClose,
  children,
  wide,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    const first = ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not(.x)');
    first?.focus();
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="ov" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`dlg${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" ref={ref}>
        <div className="dlghead">
          <h2>{title}</h2>
          <button className="x" type="button" aria-label={tr('Lukk')} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dlgbody">{children}</div>
        {footer && <div className="dlgfoot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({
  title,
  text,
  ok,
  danger,
  onOk,
  onClose,
}: {
  title: string;
  text: ReactNode;
  ok: string;
  danger?: boolean;
  onOk: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn alt" onClick={onClose}>
            {tr('Avbryt')}
          </button>
          <button
            className={`btn${danger ? ' danger' : ''}`}
            onClick={() => {
              onOk();
              onClose();
            }}
          >
            {ok}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{text}</p>
    </Modal>
  );
}

export function Toasts() {
  const [msg, setMsg] = useState('');
  const [action, setAction] = useState<ToastAction | null>(null);
  useEffect(() => {
    let t = 0;
    return onToast((m, a) => {
      setMsg(m);
      setAction(a ?? null);
      clearTimeout(t);
      t = window.setTimeout(() => {
        setMsg('');
        setAction(null);
      }, a ? 7000 : 3800);
    });
  }, []);
  return (
    <div id="toast" role="status" aria-live="polite" className={msg ? '' : 'empty'}>
      {msg}
      {action && (
        <button
          className="toastbtn"
          onClick={() => {
            action.run();
            setMsg('');
            setAction(null);
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function Thumbs({ job, refs, onRemove, onOpen }: { job: Job; refs: string[]; onRemove?: (i: number) => void; onOpen?: (src: string) => void }) {
  if (!refs.length) return null;
  return (
    <div className="thumbs">
      {refs.map((r, i) => (
        <div className="thumb" key={i + r.slice(-24)}>
          <img src={photoSrc(r, job)} alt={tr('Bilde {n}', { n: i + 1 })} onClick={() => onOpen?.(photoSrc(r, job))} style={onOpen ? { cursor: 'zoom-in' } : undefined} />
          {onRemove && (
            <button type="button" aria-label={tr('Fjern bilde {n}', { n: i + 1 })} onClick={() => onRemove(i)}>
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, [onClose]);
  return createPortal(
    <div className="ov lightbox" onClick={onClose} role="dialog" aria-label={tr('Bilde')}>
      <img src={src} alt={tr('Forstørret bilde')} />
    </div>,
    document.body,
  );
}

/** Dokumentasjonskrav. compact: én linje med det som mangler (kontorets oversikt). */
export function Checklist({ job, compact }: { job: Job; compact?: boolean }) {
  const r = requirements(job);
  const ok = r.filter(x => x[1]).length;
  const miss = r.filter(x => !x[1]).map(x => x[0]);
  return (
    <div className="checkwrap">
      <div className="lab spread">
        <span>{tr('Dokumentasjon')}</span>
        <span>
          {tr('{a} av {b}', { a: ok, b: r.length })}
        </span>
      </div>
      <div className="bar">
        <i style={{ width: `${(ok / r.length) * 100}%` }} />
      </div>
      {compact ? (
        miss.length ? (
          <small className="muted">
            {tr('Mangler')}: {miss.join(', ')}
          </small>
        ) : (
          <small className="okline">{tr('Alt er fylt ut.')}</small>
        )
      ) : (
        <ul className="check">
          {r.map(([label, done]) => (
            <li key={label} className={done ? '' : 'no'}>
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  const [bad, setBad] = useState(!config.logo);
  if (bad) {
    const ini = config.company.name
      .split(/\s+/)
      .filter(w => !/^(AS|ASA|DA|ANS|SA)$/i.test(w))
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return (
      <span className="logo-ini" style={{ width: size, height: size, fontSize: size * 0.45 }}>
        {ini}
      </span>
    );
  }
  return <img className="logo" src={config.logo} alt="" style={{ height: size }} onError={() => setBad(true)} />;
}
