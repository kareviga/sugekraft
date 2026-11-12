import { useState, type ChangeEvent } from 'react';
import { config } from '../config';
import { JobMap } from '../components/JobMap';
import { Checklist, Confirm, Lightbox, Pill, Thumbs } from '../components/ui';
import { setCrew, updateJob, useCrew } from '../store';
import { shrink } from '../lib/photos';
import { toast } from '../lib/toast';
import { cx, dayOffset, driver, fmtCoord, hours, isHaz, isNoMass, mapsUrl, missing, navUrl, num, nowHHMM, preferredMapApp, relDay, setPreferredMapApp, vehicle, type MapApp } from '../lib/utils';
import type { Job } from '../types';

export function Driver({
  jobs,
  personId,
  setPersonId,
  jobId,
  setJobId,
}: {
  jobs: Job[];
  personId: string;
  setPersonId: (id: string) => void;
  jobId: string | null;
  setJobId: (id: string | null) => void;
}) {
  const crew = useCrew();
  const carId = Object.keys(crew).find(k => crew[k] === personId) ?? '';
  const j = jobs.find(x => x.id === jobId);
  const me = driver(personId)?.name ?? '';
  return (
    <div className="driver">
      {j && j.status !== 'ferdig' ? (
        <DriverJob j={j} me={me} back={() => setJobId(null)} />
      ) : (
        <DriverList jobs={jobs} personId={personId} setPersonId={setPersonId} carId={carId} crew={crew} open={setJobId} />
      )}
    </div>
  );
}

function DriverList({
  jobs,
  personId,
  setPersonId,
  carId,
  crew,
  open,
}: {
  jobs: Job[];
  personId: string;
  setPersonId: (id: string) => void;
  carId: string;
  crew: Record<string, string>;
  open: (id: string) => void;
}) {
  const v = vehicle(carId);
  const today = dayOffset(0);
  const mine = jobs
    .filter(j => j.car === carId && j.status !== 'ferdig')
    .sort((a, b) => (a.start ? -1 : 0) - (b.start ? -1 : 0) || a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  const doneToday = jobs.filter(j => j.car === carId && j.status === 'ferdig' && j.closedAt === today).length;
  return (
    <>
      <div className="pad drvhead">
        <div className="two keep">
          <div className="field">
            <label htmlFor="d-me">Jeg er</label>
            <select id="d-me" value={personId} onChange={e => setPersonId(e.target.value)}>
              {config.drivers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-sel">Bil i dag</label>
            <select
              id="d-sel"
              value={carId}
              onChange={e => {
                const vid = e.target.value;
                const other = driver(crew[vid]);
                setCrew(vid, vid ? personId : '');
                if (!vid) {
                  if (carId) setCrew(carId, '');
                  toast('Du står ikke lenger på noen bil.');
                } else toast(`Du kjører ${vehicle(vid)?.name}.${other && other.id !== personId ? ` ${other.name} er tatt av bilen.` : ''}`);
              }}
            >
              <option value="">Ingen bil</option>
              {config.vehicles.map(x => {
                const o = driver(crew[x.id]);
                return (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.regNr}){o && o.id !== personId ? ` – ${o.name.split(' ')[0]}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <div className="stats">
          <div>
            <b>{mine.filter(j => j.date <= today).length}</b>
            <span>igjen i dag</span>
          </div>
          <div>
            <b>{doneToday}</b>
            <span>ferdig i dag</span>
          </div>
          <div>
            <b>{mine.filter(j => j.date > today).length}</b>
            <span>senere</span>
          </div>
        </div>
      </div>
      <div className="dmap">
        <JobMap jobs={mine} onSelect={open} fitKey={`d${carId}`} />
      </div>
      <div className="pad">
        <h2>Mine jobber</h2>
        {mine.length ? (
          mine.map(j => {
            const m = missing(j).length;
            return (
              <button key={j.id} className={cx('jobcard', j.status)} onClick={() => open(j.id)}>
                <span className="spread">
                  <b>
                    {j.urgent && <span className="hast">HAST</span>}
                    {j.customer}
                  </b>
                  <Pill status={j.status} />
                </span>
                <small>
                  {j.service} · {relDay(j.date)}
                  {j.time && !j.start ? ` kl. ${j.time}` : ''}
                </small>
                <small>
                  {j.address}, {j.place}
                </small>
                {j.start && m > 0 && <small className="warntext">{m} punkter mangler før lukking</small>}
              </button>
            );
          })
        ) : (
          <p className="empty">{v ? `Ingen jobber på ${v.name} nå.` : 'Velg hvilken bil du kjører i dag for å se jobbene dine.'}</p>
        )}
      </div>
    </>
  );
}

function PhotoField({ j, k, label, me }: { j: Job; k: 'ticketPhotos' | 'jobPhotos'; label: string; me: string }) {
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const add = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      const added: string[] = [];
      for (const f of files) added.push(await shrink(f));
      updateJob(j.id, { [k]: [...j[k], ...added], ...(me && j.driverName !== me ? { driverName: me } : {}) }, true);
    } catch {
      toast('Bildet kunne ikke leses. Velg et JPG- eller PNG-bilde.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="photofield">
      <div className="lab">{label}</div>
      <Thumbs job={j} refs={j[k]} onOpen={setZoom} onRemove={i => updateJob(j.id, { [k]: j[k].filter((_, n) => n !== i) }, true)} />
      <label className={cx('upl', busy && 'busy')}>
        {busy ? 'Behandler bilde …' : j[k].length ? '+ Legg til flere' : '📷 Ta eller velg bilde'}
        <input type="file" accept="image/*" capture="environment" multiple onChange={add} />
      </label>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function DriverJob({ j, me, back }: { j: Job; me: string; back: () => void }) {
  const [confirmClose, setConfirmClose] = useState(false);
  const [app, setApp] = useState<MapApp>(preferredMapApp);
  // den som fyller ut jobben registreres som sjåfør
  const set = (patch: Partial<Job>) => updateJob(j.id, me && j.driverName !== me ? { ...patch, driverName: me } : patch);
  const chooseApp = (a: MapApp) => {
    setApp(a);
    setPreferredMapApp(a);
  };
  const appName = app === 'apple' ? 'Apple Kart' : 'Google Maps';
  const miss = missing(j);
  const v = vehicle(j.car);

  const head = (
    <>
      <button className="back" onClick={back}>
        ‹ Mine jobber
      </button>
      <div>
        <div className="spread">
          <h2>{j.customer}</h2>
          <Pill status={j.status} />
        </div>
        <small className="muted">
          {j.id} · {j.service} · {relDay(j.date)}
          {j.time ? ` kl. ${j.time}` : ''}
        </small>
      </div>
      {j.urgent && <p className="alert">Hasteoppdrag</p>}
      <div className="locbox">
        <div className="locmap">
          <JobMap jobs={[j]} selectedId={j.id} onSelect={() => undefined} fitKey={`loc${j.id}${j.lat}${j.lon}`} maxFitZoom={15} compact />
        </div>
        <div className="locinfo">
          <b>{j.address}</b>
          {j.place && <span>{j.place}</span>}
          {j.pin === 'kart' && <small className="warntext">Ingen adresse – kjør etter nålen i kartet.</small>}
        </div>
        <a className="btn big navbtn" href={navUrl(j, app)} target="_blank" rel="noopener noreferrer">
          ➤ Naviger til stedet
        </a>
        <div className="appswitch" role="group" aria-label="Kartapp for navigasjon">
          <button type="button" aria-pressed={app === 'google'} onClick={() => chooseApp('google')}>
            Google Maps
          </button>
          <button type="button" aria-pressed={app === 'apple'} onClick={() => chooseApp('apple')}>
            Apple Kart
          </button>
        </div>
        <div className="locrow">
          <a href={mapsUrl(j, app)} target="_blank" rel="noopener noreferrer">
            Vis i {appName}
          </a>
          <button
            type="button"
            className="link"
            onClick={() =>
              navigator.clipboard
                ?.writeText(fmtCoord(j))
                .then(() => toast('Koordinatene er kopiert.'))
                .catch(() => toast(fmtCoord(j)))
            }
          >
            Kopier koordinater ({fmtCoord(j)})
          </button>
        </div>
      </div>
      <dl className="kv">
        <dt>Kontakt</dt>
        <dd>
          {j.contact} {j.phone && <a href={`tel:${j.phone.replace(/\s/g, '')}`}>{j.phone}</a>}
        </dd>
        {j.ref && (
          <>
            <dt>Kundens ref.</dt>
            <dd>{j.ref}</dd>
          </>
        )}
        {j.note && (
          <>
            <dt>Beskjed</dt>
            <dd>
              <b>{j.note}</b>
            </dd>
          </>
        )}
      </dl>
    </>
  );

  return (
    <div className="pad">
      {head}
      <hr />
      <PhotoField j={j} k="ticketPhotos" label="Bilde av kjøreseddel" me={me} />
      <div className="field">
        <label htmlFor="j-ticket">Kjøreseddelnummer</label>
        <input id="j-ticket" inputMode="numeric" value={j.ticketNo} onChange={e => set({ ticketNo: e.target.value })} />
      </div>
      <PhotoField j={j} k="jobPhotos" label="Bilder av jobben" me={me} />
      <div className="field">
        <label htmlFor="j-mass">Type masse</label>
        <select id="j-mass" value={j.massType} onChange={e => set({ massType: e.target.value })}>
          <option value="">Velg</option>
          {config.massTypes.map(m => (
            <option key={m.name} value={m.name}>
              {m.name}
              {m.hazardous ? ' ⚠' : ''}
            </option>
          ))}
        </select>
      </div>
      {j.massType && !isNoMass(j) && (
        <>
          <div className="two keep">
            <div className="field">
              <label htmlFor="j-amount">Mengde</label>
              <input id="j-amount" type="number" min="0" step="0.5" inputMode="decimal" value={j.amount} onChange={e => set({ amount: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="j-unit">Enhet</label>
              <select id="j-unit" value={j.unit} onChange={e => set({ unit: e.target.value })}>
                {config.units.map(u => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="j-disposal">Deponi eller mottak</label>
            <select id="j-disposal" value={j.disposal} onChange={e => set({ disposal: e.target.value })}>
              <option value="">Velg</option>
              {config.depots.map(d => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </>
      )}
      {isHaz(j) && (
        <div className="field">
          <label htmlFor="j-decl">Deklarasjonsnummer (Avfallsdeklarering.no)</label>
          <input id="j-decl" inputMode="numeric" value={j.decl} onChange={e => set({ decl: e.target.value })} />
        </div>
      )}
      <div className="two keep">
        <div className="field">
          <label htmlFor="j-start">Start</label>
          <div className="timein">
            <input id="j-start" type="time" value={j.start} onChange={e => set({ start: e.target.value })} />
            <button type="button" className="now" onClick={() => set({ start: nowHHMM() })}>
              Nå
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="j-end">Slutt</label>
          <div className="timein">
            <input id="j-end" type="time" value={j.end} onChange={e => set({ end: e.target.value })} />
            <button type="button" className="now" onClick={() => set({ end: nowHHMM() })}>
              Nå
            </button>
          </div>
        </div>
      </div>
      {j.start && j.end && <p className="note">Arbeidstid: {num(hours(j))} timer</p>}
      <div className="field">
        <label htmlFor="j-comment">Kommentar til faktura</label>
        <textarea id="j-comment" rows={2} value={j.comment} placeholder="F.eks. ekstra slange, ventetid eller hindringer" onChange={e => set({ comment: e.target.value })} />
      </div>
      <hr />
      <Checklist job={j} />
      {miss.length ? <p className="alert">Fyll ut {miss.length === 1 ? 'punktet' : `de ${miss.length} punktene`} som mangler før jobben kan lukkes.</p> : <p className="okline">Alt er fylt ut. Jobben kan lukkes.</p>}
      <button className="btn big" disabled={miss.length > 0} onClick={() => setConfirmClose(true)}>
        Lukk jobb
      </button>
      {confirmClose && (
        <Confirm
          title="Lukke jobben?"
          text={`${j.id} for ${j.customer} sendes til arkivet og blir klar for fakturering. ${v ? v.name : ''}`}
          ok="Lukk jobb"
          onClose={() => setConfirmClose(false)}
          onOk={() => {
            if (missing(j).length) return;
            updateJob(j.id, { status: 'ferdig', closedAt: dayOffset(0), driverName: j.driverName || me }, true);
            back();
            toast(`${j.id} er lukket og ligger i arkivet.`);
          }}
        />
      )}
    </div>
  );
}
