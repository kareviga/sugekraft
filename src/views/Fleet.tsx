import { useState } from 'react';
import { config } from '../config';
import { JobMap } from '../components/JobMap';
import { Modal, Pill } from '../components/ui';
import { setOut, useOut } from '../store';
import { VSTATE_LABEL, vehicleStatus, type VehicleStatus, type VState } from '../lib/fleet';
import { toast } from '../lib/toast';
import { cx, driver, relDay } from '../lib/utils';
import type { Job } from '../types';

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
      <div className="bp-kpis">
        {(['oppdrag', 'planlagt', 'ledig', 'ute'] as VState[]).map(k => (
          <div key={k} className={cx('kpi', k)}>
            <b>{count(k)}</b>
            <span>
              <i className={cx('vdot', k)} /> {VSTATE_LABEL[k]}
            </span>
          </div>
        ))}
      </div>

      <div className="bp-main">
        <section className="bp-list" aria-label="Biler">
          {rows.map(({ v, s }) => (
            <article key={v.id} className={cx('vcard', s.state, sel === v.id && 'sel')} onClick={() => setSel(v.id)}>
              <header>
                <span className={cx('fleet-tag', s.state)}>{v.tag}</span>
                <div className="vtitle">
                  <b>{v.name}</b>
                  <small>
                    {v.type} · {v.regNr}
                  </small>
                </div>
                <span className={cx('vstate', s.state)}>{VSTATE_LABEL[s.state]}</span>
              </header>

              <dl className="vfacts">
                <dt>I bilen nå</dt>
                <dd>{s.nowDriver ? <b>{s.nowDriver}</b> : <span className="muted">Ingen</span>}</dd>
              </dl>

              <Doing s={s} openJob={openJob} />

              {s.today.length > 0 && (
                <ol className="vday">
                  {s.today.map(j => (
                    <li key={j.id} className={j.status}>
                      <button className="link" onClick={() => openJob(j.id)}>
                        <span className="vt">{j.start ? j.start : j.time || '–'}</span>
                        {j.customer}
                        <span className="muted"> · {driver(j.driver)?.name.split(' ')[0] ?? 'ingen sjåfør'}</span>
                      </button>
                      <Pill status={j.status} />
                    </li>
                  ))}
                </ol>
              )}

              <footer>
                <small className="muted">
                  {s.today.length} jobber i dag · {s.doneToday} ferdig · {s.open} åpne totalt
                </small>
                {s.state === 'ute' ? (
                  <button
                    className="link"
                    onClick={e => {
                      e.stopPropagation();
                      setOut(v.id, null);
                      toast(`${v.name} er satt i drift igjen.`);
                    }}
                  >
                    Sett i drift
                  </button>
                ) : (
                  <button
                    className="link warnlink"
                    onClick={e => {
                      e.stopPropagation();
                      setOutFor(v.id);
                    }}
                  >
                    Sett ute av drift
                  </button>
                )}
              </footer>
            </article>
          ))}
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
          <p className="note">Kartet viser hvor bilene er nå (jobben som pågår) eller skal neste gang. Tallet er bilnummeret.</p>
          <p className="note">Bil og sjåfør velges i hvert oppdrag under Kontor. Bilparken oppdateres av seg selv når oppdragene startes og lukkes.</p>
        </aside>
      </div>

      {outFor && <OutDialog vehicleId={outFor} onClose={() => setOutFor(null)} />}
    </div>
  );
}

function Doing({ s, openJob }: { s: VehicleStatus; openJob: (id: string) => void }) {
  if (s.state === 'ute') return <p className="vdoing ute">Ute av drift{s.outNote ? `: ${s.outNote}` : ''}</p>;
  if (s.active)
    return (
      <p className="vdoing oppdrag">
        <b>På oppdrag:</b>{' '}
        <button className="link" onClick={() => openJob(s.active!.id)}>
          {s.active.customer}
        </button>
        <br />
        <small>
          {s.active.address}
          {s.active.place ? `, ${s.active.place}` : ''} · startet {s.active.start}
        </small>
      </p>
    );
  if (s.next)
    return (
      <p className="vdoing planlagt">
        <b>Ikke på oppdrag.</b> Neste:{' '}
        <button className="link" onClick={() => openJob(s.next!.id)}>
          {s.next.customer}
        </button>{' '}
        <small>
          {relDay(s.next.date).toLowerCase()}
          {s.next.time ? ` kl. ${s.next.time}` : ''}
          {s.next.driver ? ` · ${driver(s.next.driver)?.name}` : ' · ingen sjåfør ennå'}
        </small>
      </p>
    );
  return <p className="vdoing ledig">Ledig – ingen åpne jobber.</p>;
}

function OutDialog({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const v = config.vehicles.find(x => x.id === vehicleId)!;
  const [note, setNote] = useState('');
  return (
    <Modal
      title={`${v.name} ute av drift`}
      onClose={onClose}
      footer={
        <>
          <button className="btn alt" onClick={onClose}>
            Avbryt
          </button>
          <button
            className="btn danger"
            onClick={() => {
              setOut(v.id, note.trim());
              toast(`${v.name} er satt ute av drift.`);
              onClose();
            }}
          >
            Sett ute av drift
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="out-note">Årsak (valgfritt)</label>
        <input id="out-note" value={note} onChange={e => setNote(e.target.value)} placeholder="F.eks. verksted, EU-kontroll, skade" />
      </div>
      <p className="note">Oppdragene som har denne bilen, blir liggende. Bytt bil på dem i Kontor om nødvendig.</p>
    </Modal>
  );
}

/** Kort oversikt brukt i Kontor når ingen jobb er valgt. */
export function FleetCompact({ jobs, onPick, openFleet }: { jobs: Job[]; onPick: (id: string) => void; openFleet: () => void }) {
  const out = useOut();
  return (
    <>
      <div className="spread">
        <h2>Bilparken nå</h2>
        <button className="link" onClick={openFleet}>
          Åpne bilpark ›
        </button>
      </div>
      <p className="note">Velg en jobb i listen eller kartet for å se detaljer.</p>
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
                  <small className="warntext">Ute av drift{s.outNote ? `: ${s.outNote}` : ''}</small>
                ) : s.active ? (
                  <button className="link" onClick={() => onPick(s.active!.id)}>
                    På oppdrag: {s.active.customer}
                  </button>
                ) : s.next && s.state === 'planlagt' ? (
                  <button className="link" onClick={() => onPick(s.next!.id)}>
                    Neste: {s.next.customer}
                    {s.next.time ? ` kl. ${s.next.time}` : ''}
                  </button>
                ) : (
                  <small>Ledig</small>
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
