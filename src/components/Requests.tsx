import { useState } from 'react';
import { acceptRequest, declineRequest, getClient } from '../store';
import { toast } from '../lib/toast';
import { driver, nice, relDay } from '../lib/utils';
import type { Job } from '../types';
import { JobForm } from './JobForm';
import { JobMap } from './JobMap';
import { Modal } from './ui';
import { DriverOptions, VehicleOptions } from './VehicleOptions';
import { tr, trd } from '../i18n';

/*
 * Nye bestillinger fra kundeportalen. Kontoret godtar (og kan sette bil/sjåfør med en gang) eller avviser.
 */

export function RequestsPanel({ requests, onAccepted }: { requests: Job[]; onAccepted: (j: Job) => void }) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<string | null>(null);
  if (!requests.length) return null;
  const sorted = [...requests].sort((a, b) => a.orderedAt.localeCompare(b.orderedAt));
  const cur = requests.find(r => r.id === view);
  return (
    <div className="reqpanel">
      <button className="reqhead" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="reqbadge">{requests.length}</span>
        <b>{requests.length === 1 ? tr('Ny bestilling fra kunde') : tr('Nye bestillinger fra kunder')}</b>
        <span className="muted">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul>
          {sorted.map(r => (
            <li key={r.id}>
              <button onClick={() => setView(r.id)}>
                <span className="spread">
                  <b>{r.customer}</b>
                  <small className="muted">{r.orderedAt.slice(11)}</small>
                </span>
                <small>
                  {trd(r.service)} · {tr('ønsket')} {relDay(r.date).toLowerCase()}
                  {r.time ? ` ${tr('kl.')} ${r.time}` : ''}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {cur && (
        <RequestDialog
          r={cur}
          onClose={() => setView(null)}
          onAccepted={j => {
            setView(null);
            onAccepted(j);
          }}
        />
      )}
    </div>
  );
}

function RequestDialog({ r, onClose, onAccepted }: { r: Job; onClose: () => void; onAccepted: (j: Job) => void }) {
  const [car, setCar] = useState('');
  const [drv, setDrv] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [edit, setEdit] = useState(false);
  const client = getClient(r.clientId);

  if (edit) return <JobForm job={r} onClose={() => setEdit(false)} onSaved={() => setEdit(false)} />;

  return (
    <Modal
      wide
      title={tr('Bestilling {id} fra {c}', { id: r.no, c: r.customer })}
      onClose={onClose}
      footer={
        declining ? (
          <>
            <button className="btn alt" onClick={() => setDeclining(false)}>
              {tr('Tilbake')}
            </button>
            <button
              className="btn danger"
              disabled={!reason.trim()}
              onClick={() => {
                declineRequest(r.id, reason.trim());
                toast(tr('Bestillingen er avvist. {c} ser begrunnelsen i portalen.', { c: r.customer }));
                onClose();
              }}
            >
              {tr('Avvis bestillingen')}
            </button>
          </>
        ) : (
          <>
            <button className="btn alt danger" onClick={() => setDeclining(true)}>
              {tr('Avvis')}
            </button>
            <button className="btn alt" onClick={() => setEdit(true)}>
              {tr('Rediger')}
            </button>
            <button
              className="btn finish"
              onClick={() => {
                acceptRequest(r.id, { car, driver: drv });
                const d = driver(drv);
                toast(d ? tr('{id} er godtatt og satt på {d}.', { id: r.no, d: d.name }) : tr('{id} er godtatt og ligger som kommende.', { id: r.no }));
                onAccepted({ ...r, car, driver: drv });
              }}
            >
              {tr('Godta bestillingen')}
            </button>
          </>
        )
      }
    >
      <div className="formcols">
        <dl className="kv">
          <dt>{tr('Kunde')}</dt>
          <dd>
            {r.customer}
            {client?.orgNr ? <small className="muted"> · org.nr {client.orgNr}</small> : ''}
          </dd>
          <dt>{tr('Oppdrag')}</dt>
          <dd>
            <b>{trd(r.service)}</b>
            {r.urgent && <span className="hast" style={{ marginLeft: 6 }}>{tr('HASTER')}</span>}
          </dd>
          <dt>{tr('Sted')}</dt>
          <dd>
            {r.address}
            {r.place ? `, ${r.place}` : ''}
            {r.pin === 'kart' && <small className="muted">{' '}{tr('(nål satt i kartet)')}</small>}
          </dd>
          <dt>{tr('Ønsket')}</dt>
          <dd>
            {nice(r.date)}
            {r.time ? ` ${tr('kl.')} ${r.time}` : ''}
          </dd>
          <dt>{tr('Kontakt')}</dt>
          <dd>
            {r.contact} {r.phone}
          </dd>
          <dt>{tr('Referanse')}</dt>
          <dd>{r.ref || '–'}</dd>
          {r.note && (
            <>
              <dt>{tr('Beskrivelse')}</dt>
              <dd>{r.note}</dd>
            </>
          )}
          <dt>{tr('Mottatt')}</dt>
          <dd>
            {nice(r.orderedAt.slice(0, 10))} {tr('kl.')} {r.orderedAt.slice(11)}
          </dd>
        </dl>
        <div className="locmap portalmap">
          <JobMap jobs={[r]} selectedId={r.id} onSelect={() => undefined} fitKey={`r${r.id}`} maxFitZoom={15} compact />
        </div>
      </div>
      {declining ? (
        <div className="field">
          <label htmlFor="r-reason">{tr('Begrunnelse til kunden')}</label>
          <textarea id="r-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder={tr('F.eks. ingen ledig kapasitet den dagen – foreslå ny dato')} autoFocus />
        </div>
      ) : (
        <>
          <div className="lab">{tr('Sett opp med en gang (valgfritt)')}</div>
          <div className="assign">
            <div className="field">
              <label htmlFor="r-car">{tr('Bil')}</label>
              <select id="r-car" value={car} onChange={e => setCar(e.target.value)}>
                <option value="">{tr('Velg senere')}</option>
                <VehicleOptions />
              </select>
            </div>
            <div className="field">
              <label htmlFor="r-drv">{tr('Sjåfør')}</label>
              <select id="r-drv" value={drv} onChange={e => setDrv(e.target.value)}>
                <option value="">{tr('Velg senere (Kommende)')}</option>
                <DriverOptions />
              </select>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
