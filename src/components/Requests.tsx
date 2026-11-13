import { useState } from 'react';
import { acceptRequest, declineRequest, getClient } from '../store';
import { toast } from '../lib/toast';
import { driver, nice } from '../lib/utils';
import type { Job } from '../types';
import { JobForm } from './JobForm';
import { JobMap } from './JobMap';
import { Modal } from './ui';
import { DriverOptions, VehicleOptions } from './VehicleOptions';
import { tr, trd } from '../i18n';

/*
 * Bestilling fra kundeportalen: kontoret godtar (og kan sette bil/sjåfør med en gang) eller avviser.
 */

export function RequestDialog({ r, onClose, onAccepted, decline = false }: { r: Job; onClose: () => void; onAccepted: (j: Job) => void; decline?: boolean }) {
  const [car, setCar] = useState('');
  const [drv, setDrv] = useState('');
  const [declining, setDeclining] = useState(decline);
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
                toast(d ? tr('{id} er godtatt og satt på {d}.', { id: r.no, d: d.name }) : tr('{id} er godtatt og venter på sjåfør.', { id: r.no }));
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
                <option value="">{tr('Velg senere')}</option>
                <DriverOptions />
              </select>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
