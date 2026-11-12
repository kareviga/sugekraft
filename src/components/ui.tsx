import { useEffect, useRef, useState, type ReactNode } from 'react';
import { config } from '../config';
import { onToast } from '../lib/toast';
import { photoSrc } from '../lib/photos';
import { requirements } from '../lib/utils';
import { STATUS_LABEL, type Job, type Status } from '../types';

export function Pill({ status }: { status: Status }) {
  return <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>;
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
  return (
    <div className="ov" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`dlg${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" ref={ref}>
        <div className="dlghead">
          <h2>{title}</h2>
          <button className="x" type="button" aria-label="Lukk" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dlgbody">{children}</div>
        {footer && <div className="dlgfoot">{footer}</div>}
      </div>
    </div>
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
            Avbryt
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
  useEffect(() => {
    let t = 0;
    return onToast(m => {
      setMsg(m);
      clearTimeout(t);
      t = window.setTimeout(() => setMsg(''), 3800);
    });
  }, []);
  return (
    <div id="toast" role="status" aria-live="polite">
      {msg}
    </div>
  );
}

export function Thumbs({ job, refs, onRemove, onOpen }: { job: Job; refs: string[]; onRemove?: (i: number) => void; onOpen?: (src: string) => void }) {
  if (!refs.length) return null;
  return (
    <div className="thumbs">
      {refs.map((r, i) => (
        <div className="thumb" key={i + r.slice(-24)}>
          <img src={photoSrc(r, job)} alt={`Bilde ${i + 1}`} onClick={() => onOpen?.(photoSrc(r, job))} style={onOpen ? { cursor: 'zoom-in' } : undefined} />
          {onRemove && (
            <button type="button" aria-label={`Fjern bilde ${i + 1}`} onClick={() => onRemove(i)}>
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
  return (
    <div className="ov lightbox" onClick={onClose} role="dialog" aria-label="Bilde">
      <img src={src} alt="Forstørret bilde" />
    </div>
  );
}

export function Checklist({ job }: { job: Job }) {
  const r = requirements(job);
  const ok = r.filter(x => x[1]).length;
  return (
    <div className="checkwrap">
      <div className="lab spread">
        <span>Dokumentasjon</span>
        <span>
          {ok} av {r.length}
        </span>
      </div>
      <div className="bar">
        <i style={{ width: `${(ok / r.length) * 100}%` }} />
      </div>
      <ul className="check">
        {r.map(([label, done]) => (
          <li key={label} className={done ? '' : 'no'}>
            {label}
          </li>
        ))}
      </ul>
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
