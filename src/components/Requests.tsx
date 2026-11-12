import { useState } from 'react';
import { acceptRequest, declineRequest, getClient } from '../store';
import { toast } from '../lib/toast';
import { driver, nice, relDay } from '../lib/utils';
import type { Job } from '../types';
import { JobForm } from './JobForm';
import { JobMap } from './JobMap';
import { Modal } from './ui';
import { DriverOptions, VehicleOptions } from './VehicleOptions';

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
        <b>{requests.length === 1 ? 'Ny bestilling fra kunde' : 'Nye bestillinger fra kunder'}</b>
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
                  {r.service} · ønsket {relDay(r.date).toLowerCase()}
                  {r.time ? ` kl. ${r.time}` : ''}
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
      title={`Bestilling ${r.id} fra ${r.customer}`}
      onClose={onClose}
      footer={
        declining ? (
          <>
            <button className="btn alt" onClick={() => setDeclining(false)}>
              Tilbake
            </button>
            <button
              className="btn danger"
              disabled={!reason.trim()}
              onClick={() => {
                declineRequest(r.id, reason.trim());
                toast(`Bestillingen er avvist. ${r.customer} ser begrunnelsen i portalen.`);
                onClose();
              }}
            >
              Avvis bestillingen
            </button>
          </>
        ) : (
          <>
            <button className="btn alt danger" onClick={() => setDeclining(true)}>
              Avvis
            </button>
            <button className="btn alt" onClick={() => setEdit(true)}>
              Rediger
            </button>
            <button
              className="btn finish"
              onClick={() => {
                acceptRequest(r.id, { car, driver: drv });
                const d = driver(drv);
                toast(`${r.id} er godtatt${d ? ` og satt på ${d.name}` : ' og ligger som kommende'}.`);
                onAccepted({ ...r, car, driver: drv });
              }}
            >
              Godta bestillingen
            </button>
          </>
        )
      }
    >
      <div className="formcols">
        <dl className="kv">
          <dt>Kunde</dt>
          <dd>
            {r.customer}
            {client?.orgNr ? <small className="muted"> · org.nr {client.orgNr}</small> : ''}
          </dd>
          <dt>Oppdrag</dt>
          <dd>
            <b>{r.service}</b>
            {r.urgent && <span className="hast" style={{ marginLeft: 6 }}>HASTER</span>}
          </dd>
          <dt>Sted</dt>
          <dd>
            {r.address}
            {r.place ? `, ${r.place}` : ''}
            {r.pin === 'kart' && <small className="muted"> (nål satt i kartet)</small>}
          </dd>
          <dt>Ønsket</dt>
          <dd>
            {nice(r.date)}
            {r.time ? ` kl. ${r.time}` : ''}
          </dd>
          <dt>Kontakt</dt>
          <dd>
            {r.contact} {r.phone}
          </dd>
          <dt>Referanse</dt>
          <dd>{r.ref || '–'}</dd>
          {r.note && (
            <>
              <dt>Beskrivelse</dt>
              <dd>{r.note}</dd>
            </>
          )}
          <dt>Mottatt</dt>
          <dd>
            {nice(r.orderedAt.slice(0, 10))} kl. {r.orderedAt.slice(11)}
          </dd>
        </dl>
        <div className="locmap portalmap">
          <JobMap jobs={[r]} selectedId={r.id} onSelect={() => undefined} fitKey={`r${r.id}`} maxFitZoom={15} compact />
        </div>
      </div>
      {declining ? (
        <div className="field">
          <label htmlFor="r-reason">Begrunnelse til kunden</label>
          <textarea id="r-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="F.eks. ingen ledig kapasitet den dagen – foreslå ny dato" autoFocus />
        </div>
      ) : (
        <>
          <div className="lab">Sett opp med en gang (valgfritt)</div>
          <div className="assign">
            <div className="field">
              <label htmlFor="r-car">Bil</label>
              <select id="r-car" value={car} onChange={e => setCar(e.target.value)}>
                <option value="">Velg senere</option>
                <VehicleOptions />
              </select>
            </div>
            <div className="field">
              <label htmlFor="r-drv">Sjåfør</label>
              <select id="r-drv" value={drv} onChange={e => setDrv(e.target.value)}>
                <option value="">Velg senere (Kommende)</option>
                <DriverOptions />
              </select>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
