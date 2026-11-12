import { useState, type MouseEvent } from 'react';
import { config, type Vehicle } from '../config';
import { JobMap } from '../components/JobMap';
import { Modal, Pill } from '../components/ui';
import { setOut, useOut } from '../store';
import { VSTATE_LABEL, vehicleStatus, type VehicleStatus, type VState } from '../lib/fleet';
import { toast } from '../lib/toast';
import { cx, driver, relDay } from '../lib/utils';
import { progress } from '../lib/steps';
import type { Job } from '../types';
import { tr, trd } from '../i18n';

/*
 * Bilpark: bare bilene. Status og hvem som er i bilen utledes av oppdragene –
 * bil og sjåfør velges i hvert oppdrag (Kontor). Her kan en bil settes ute av drift.
 */

export function Fleet({ jobs, openJob }: { jobs: Job[]; openJob: (id: string) => void }) {
  const out = useOut();
  const [sel, setSel] = useState<string | null>(null);
  const [outFor, setOutFor] = useState<string | null>(null);
  const rows = config.vehicles.map(v => ({ v, s: vehicleStatus(v, jobs, out) }));
  const count = (k: VState) => rows.filter(r => r.s.state === k).length;

  // på kartet: jobben som pågår, ellers neste jobb
  const mapJobs = rows.map(r => (r.s.state === 'ute' ? undefined : r.s.active ?? r.s.next)).filter((j): j is Job => !!j);
  const selS = sel ? rows.find(r => r.v.id === sel)?.s : undefined;

  return (
    <div className="bilpark">
      <p className="bp-summary">
        {(['oppdrag', 'planlagt', 'ledig', 'ute'] as VState[]).map(k => (
          <span key={k}>
            <i className={cx('vdot', k)} /> <b>{count(k)}</b> {tr(VSTATE_LABEL[k]).toLowerCase()}
          </span>
        ))}
      </p>

      <div className="bp-main">
        <section className="card bp-table" aria-label={tr('Biler')}>
          <table>
            <thead>
              <tr>
                <th>{tr('Bil')}</th>
                <th>{tr('Status')}</th>
                <th>{tr('I bilen nå')}</th>
                <th>{tr('Nå / neste')}</th>
                <th className="n">{tr('I dag')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, s }) => (
                <FleetRow
                  key={v.id}
                  v={v}
                  s={s}
                  open={sel === v.id}
                  onToggle={() => setSel(x => (x === v.id ? null : v.id))}
                  onOut={() => setOutFor(v.id)}
                  openJob={openJob}
                />
              ))}
            </tbody>
          </table>
        </section>

        <aside className="bp-side">
          <div className="bp-map card">
            <JobMap
              jobs={mapJobs}
              selectedId={selS ? (selS.active ?? selS.next)?.id : null}
              onSelect={id => setSel(mapJobs.find(j => j.id === id)?.car ?? null)}
              fitKey={`bp${mapJobs.length}`}
              tags
            />
          </div>
          <p className="note">{tr('Kartet viser hvor bilene er nå eller skal neste gang (tallet er bilnummeret). Bil og sjåfør velges i hvert oppdrag under Kontor.')}</p>
        </aside>
      </div>

      {outFor && <OutDialog vehicleId={outFor} onClose={() => setOutFor(null)} />}
    </div>
  );
}

function FleetRow({
  v,
  s,
  open,
  onToggle,
  onOut,
  openJob,
}: {
  v: Vehicle;
  s: VehicleStatus;
  open: boolean;
  onToggle: () => void;
  onOut: () => void;
  openJob: (id: string) => void;
}) {
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <>
      <tr className={cx('vrow2', open && 'on')} onClick={onToggle}>
        <td>
          <span className="vname">
            <i className={cx('vdot', s.state)} />
            <span>
              <b>{v.name}</b>
              <small className="muted">
                {v.type} · {v.regNr}
              </small>
            </span>
          </span>
        </td>
        <td>
          <span className={cx('vstate', s.state)}>{tr(VSTATE_LABEL[s.state])}</span>
        </td>
        <td>{s.nowDriver || <span className="muted">–</span>}</td>
        <td className="vnow">
          {s.state === 'ute' ? (
            <span className="warntext">{s.outNote || tr('Ute av drift')}</span>
          ) : s.active ? (
            <>
              <button className="link" onClick={e => (stop(e), openJob(s.active!.id))}>
                {s.active.customer}
              </button>
              <small className="muted"> · {progress(s.active).toLowerCase()}</small>
            </>
          ) : s.next ? (
            <>
              <span className="muted">{tr('Neste:')}{' '}</span>
              <button className="link" onClick={e => (stop(e), openJob(s.next!.id))}>
                {s.next.customer}
              </button>
              <small className="muted">
                {' '}
                · {relDay(s.next.date).toLowerCase()}
                {s.next.time ? ` ${tr('kl.')} ${s.next.time}` : ''}
              </small>
            </>
          ) : (
            <span className="muted">{tr('Ingen åpne jobber')}</span>
          )}
        </td>
        <td className="n">
          {s.today.length}
          {s.doneToday ? <small className="muted"> ({s.doneToday} ferdig)</small> : ''}
        </td>
        <td className="n">
          {s.state === 'ute' ? (
            <button
              className="link"
              onClick={e => {
                stop(e);
                setOut(v.id, null);
                toast(tr('{v} er satt i drift igjen.', { v: v.name }));
              }}
            >
              {tr('Sett i drift')}
            </button>
          ) : (
            <button className="link warnlink" onClick={e => (stop(e), onOut())}>
              {tr('Ute av drift')}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="vsub">
          <td colSpan={6}>
            {s.today.length ? (
              <ol className="vday">
                {s.today.map(j => (
                  <li key={j.id}>
                    <button className="link" onClick={() => openJob(j.id)}>
                      <span className="vt">{j.steps.kjoring?.time ?? (j.time || '–')}</span>
                      {j.customer}
                      <span className="muted">
                        {' '}
                        · {trd(j.service)} · {driver(j.driver)?.name ?? tr('ingen sjåfør')}
                      </span>
                    </button>
                    <Pill status={j.status} />
                  </li>
                ))}
              </ol>
            ) : (
              <span className="muted">{tr('Ingen jobber på {v} i dag.', { v: v.name })}</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function OutDialog({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const v = config.vehicles.find(x => x.id === vehicleId)!;
  const [note, setNote] = useState('');
  return (
    <Modal
      title={tr('{v} ute av drift', { v: v.name })}
      onClose={onClose}
      footer={
        <>
          <button className="btn alt" onClick={onClose}>
            {tr('Avbryt')}
          </button>
          <button
            className="btn danger"
            onClick={() => {
              setOut(v.id, note.trim());
              toast(tr('{v} er satt ute av drift.', { v: v.name }));
              onClose();
            }}
          >
            {tr('Sett ute av drift')}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="out-note">{tr('Årsak (valgfritt)')}</label>
        <input id="out-note" value={note} onChange={e => setNote(e.target.value)} placeholder={tr('F.eks. verksted, EU-kontroll, skade')} />
      </div>
      <p className="note">{tr('Oppdragene som har denne bilen, blir liggende. Bytt bil på dem i Kontor om nødvendig.')}</p>
    </Modal>
  );
}

/** Kort oversikt brukt i Kontor når ingen jobb er valgt. */
export function FleetCompact({ jobs, onPick, openFleet }: { jobs: Job[]; onPick: (id: string) => void; openFleet: () => void }) {
  const out = useOut();
  return (
    <>
      <div className="spread">
        <h2>{tr('Bilparken nå')}</h2>
        <button className="link" onClick={openFleet}>
          {tr('Åpne bilpark ›')}
        </button>
      </div>
      <p className="note">{tr('Velg en jobb i listen eller kartet for å se detaljer.')}</p>
      <ul className="fleet">
        {config.vehicles.map(v => {
          const s = vehicleStatus(v, jobs, out);
          return (
            <li key={v.id}>
              <span className={cx('fleet-tag', s.state)}>{v.tag}</span>
              <div>
                <b>
                  {v.name}
                  {s.nowDriver ? ` · ${s.nowDriver}` : ''}
                </b>
                {s.state === 'ute' ? (
                  <small className="warntext">{tr('Ute av drift')}{s.outNote ? `: ${s.outNote}` : ''}</small>
                ) : s.active ? (
                  <button className="link" onClick={() => onPick(s.active!.id)}>
                    {tr('På oppdrag')}: {s.active.customer}
                  </button>
                ) : s.next && s.state === 'planlagt' ? (
                  <button className="link" onClick={() => onPick(s.next!.id)}>
                    {tr('Neste')}: {s.next.customer}
                    {s.next.time ? ` ${tr('kl.')} ${s.next.time}` : ''}
                  </button>
                ) : (
                  <small>{tr('Ledig')}</small>
                )}
                {s.doneToday > 0 && <small>{s.doneToday} ferdig i dag</small>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
