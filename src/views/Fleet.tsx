import { useState } from 'react';
import { config } from '../config';
import { JobMap } from '../components/JobMap';
import { Modal, Pill } from '../components/ui';
import { setCrew, setOut, useCrew, useOut } from '../store';
import { VSTATE_LABEL, vehicleStatus, type VehicleStatus, type VState } from '../lib/fleet';
import { toast } from '../lib/toast';
import { cx, dayOffset, driver, relDay } from '../lib/utils';
import type { Job } from '../types';

/*
 * Bilpark: alle biler med sjåfør i dag, hva de holder på med og hva som står for tur.
 * Biler og sjåfører er adskilt – hvem som kjører hvilken bil settes her.
 */

export function Fleet({ jobs, openJob }: { jobs: Job[]; openJob: (id: string) => void }) {
  const crew = useCrew();
  const out = useOut();
  const [sel, setSel] = useState<string | null>(null);
  const [outFor, setOutFor] = useState<string | null>(null);
  const rows = config.vehicles.map(v => ({ v, s: vehicleStatus(v, jobs, crew, out) }));
  const count = (k: VState) => rows.filter(r => r.s.state === k).length;

  // på kartet: jobben som pågår, ellers neste jobb
  const mapJobs = rows.map(r => r.s.active ?? (r.s.state !== 'ute' ? r.s.next : undefined)).filter((j): j is Job => !!j);
  const selJob = sel ? rows.find(r => r.v.id === sel)?.s : undefined;
  const assigned = new Set(Object.values(crew));
  const freeDrivers = config.drivers.filter(d => !assigned.has(d.id));

  const assign = (vehicleId: string, driverId: string) => {
    const prevVeh = Object.keys(crew).find(k => crew[k] === driverId);
    setCrew(vehicleId, driverId);
    const v = config.vehicles.find(x => x.id === vehicleId)!;
    const d = driver(driverId);
    if (!d) toast(`${v.name} står nå uten sjåfør.`);
    else if (prevVeh && prevVeh !== vehicleId) toast(`${d.name} er flyttet fra ${config.vehicles.find(x => x.id === prevVeh)?.name} til ${v.name}.`);
    else toast(`${d.name} kjører ${v.name}.`);
  };

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
        <div className="kpi">
          <b>{freeDrivers.length}</b>
          <span>Sjåfører uten bil</span>
        </div>
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

              <div className="vrow">
                <label htmlFor={`crew-${v.id}`}>Sjåfør</label>
                <select id={`crew-${v.id}`} value={s.driverId} onClick={e => e.stopPropagation()} onChange={e => assign(v.id, e.target.value)}>
                  <option value="">Ingen sjåfør</option>
                  {config.drivers.map(d => {
                    const on = Object.keys(crew).find(k => crew[k] === d.id);
                    const other = on && on !== v.id ? config.vehicles.find(x => x.id === on)?.name : '';
                    return (
                      <option key={d.id} value={d.id}>
                        {d.name}
                        {other ? ` (står på ${other})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <Doing s={s} openJob={openJob} />

              {s.today.length > 0 && (
                <ol className="vday">
                  {s.today.map(j => (
                    <li key={j.id} className={j.status}>
                      <button className="link" onClick={() => openJob(j.id)}>
                        <span className="vt">{j.start && j.status !== 'ferdig' ? 'Nå' : j.time || '–'}</span>
                        {j.customer}
                        <span className="muted"> · {j.service}</span>
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
              selectedId={selJob ? (selJob.active ?? selJob.next)?.id : null}
              onSelect={id => setSel(mapJobs.find(j => j.id === id)?.car ?? null)}
              fitKey={`bp${mapJobs.length}`}
              tags
            />
          </div>
          <p className="note">Kartet viser hvor bilene er nå (jobben som pågår) eller skal neste gang.</p>
          <div className="card bp-drivers">
            <h3>Sjåfører</h3>
            <ul>
              {config.drivers.map(d => {
                const vid = Object.keys(crew).find(k => crew[k] === d.id);
                const v = config.vehicles.find(x => x.id === vid);
                return (
                  <li key={d.id}>
                    <span>
                      <b>{d.name}</b>
                      <small className="muted">
                        {' '}
                        <a href={`tel:${d.phone.replace(/\s/g, '')}`}>{d.phone}</a>
                      </small>
                    </span>
                    {v ? <span className="carchip">{v.name}</span> : <span className="pill warn">Ingen bil</span>}
                  </li>
                );
              })}
            </ul>
          </div>
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
      <p className="note">Jobbene som er tildelt bilen blir liggende. Flytt dem til en annen bil i Kontor om nødvendig.</p>
    </Modal>
  );
}

/** Kort oversikt brukt i Kontor når ingen jobb er valgt. */
export function FleetCompact({ jobs, onPick, openFleet }: { jobs: Job[]; onPick: (id: string) => void; openFleet: () => void }) {
  const crew = useCrew();
  const out = useOut();
  const today = dayOffset(0);
  return (
    <>
      <div className="spread">
        <h2>Bilparken i dag</h2>
        <button className="link" onClick={openFleet}>
          Åpne bilpark ›
        </button>
      </div>
      <p className="note">Velg en jobb i listen eller kartet for å se detaljer.</p>
      <ul className="fleet">
        {config.vehicles.map(v => {
          const s = vehicleStatus(v, jobs, crew, out);
          return (
            <li key={v.id}>
              <span className={cx('fleet-tag', s.state)}>{v.tag}</span>
              <div>
                <b>
                  {v.name} · {s.driverName || <span className="warntext">ingen sjåfør</span>}
                </b>
                {s.state === 'ute' ? (
                  <small className="warntext">Ute av drift{s.outNote ? `: ${s.outNote}` : ''}</small>
                ) : s.active ? (
                  <button className="link" onClick={() => onPick(s.active!.id)}>
                    På oppdrag: {s.active.customer}
                  </button>
                ) : s.next && s.next.date <= today ? (
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
