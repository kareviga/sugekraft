import { useState, type ChangeEvent } from 'react';
import { config } from '../config';
import { JobMap } from '../components/JobMap';
import { Checklist, Lightbox, Pill, Thumbs } from '../components/ui';
import { updateJob } from '../store';
import { shrink } from '../lib/photos';
import { toast } from '../lib/toast';
import { cx, dayOffset, driver, fmtCoord, hours, isHaz, isNoMass, mapsUrl, missing, navUrl, num, preferredMapApp, relDay, setPreferredMapApp, vehicle, type MapApp } from '../lib/utils';
import { nextStep, progress, underway } from '../lib/steps';
import { NextStepBar, StepTimeline } from '../components/Steps';
import type { Job } from '../types';
import { tr, trd } from '../i18n';

export function Driver({
  jobs,
  personId,
  setPersonId,
  lockPerson,
  jobId,
  setJobId,
}: {
  jobs: Job[];
  personId: string;
  setPersonId: (id: string) => void;
  /** Innlogget sjåfør: kan ikke bytte person */
  lockPerson?: boolean;
  jobId: string | null;
  setJobId: (id: string | null) => void;
}) {
  const j = jobs.find(x => x.id === jobId);
  return (
    <div className="driver">
      {j && j.status !== 'ferdig' ? (
        <DriverJob j={j} back={() => setJobId(null)} />
      ) : (
        <DriverList jobs={jobs} personId={personId} setPersonId={setPersonId} lockPerson={lockPerson} open={setJobId} />
      )}
    </div>
  );
}

function DriverList({
  jobs,
  personId,
  setPersonId,
  lockPerson,
  open,
}: {
  jobs: Job[];
  personId: string;
  setPersonId: (id: string) => void;
  lockPerson?: boolean;
  open: (id: string) => void;
}) {
  const today = dayOffset(0);
  const mine = jobs
    .filter(j => j.driver === personId && j.status === 'aktiv')
    .sort((a, b) => (underway(a) ? -1 : 0) - (underway(b) ? -1 : 0) || a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  const me = driver(personId);
  const doneToday = jobs.filter(j => j.driver === personId && j.status === 'ferdig' && j.closedAt === today).length;
  return (
    <>
      <div className="pad drvhead">
        {lockPerson ? (
          <div className="hello">
            <span className="muted">{tr('Innlogget som')}</span>
            <h2>{me?.name}</h2>
          </div>
        ) : (
        <div className="field">
          <label htmlFor="d-me">{tr('Jeg er (demo: velg sjåfør)')}</label>
          <select id="d-me" value={personId} onChange={e => setPersonId(e.target.value)}>
            {config.drivers.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        )}
        <div className="stats">
          <div>
            <b>{mine.filter(j => j.date <= today).length}</b>
            <span>{tr('igjen i dag')}</span>
          </div>
          <div>
            <b>{doneToday}</b>
            <span>{tr('ferdig i dag')}</span>
          </div>
          <div>
            <b>{mine.filter(j => j.date > today).length}</b>
            <span>{tr('senere')}</span>
          </div>
        </div>
      </div>
      <div className="dmap">
        <JobMap jobs={mine} onSelect={open} fitKey={`d${personId}`} />
      </div>
      <div className="pad">
        <h2>{tr('Mine jobber')}</h2>
        {mine.length ? (
          mine.map(j => {
            const m = missing(j).length;
            return (
              <button key={j.id} className={cx('jobcard', j.status)} onClick={() => open(j.id)}>
                <span className="spread">
                  <b>
                    {j.urgent && <span className="hast">{tr('HAST')}</span>}
                    {j.customer}
                  </b>
                  <Pill status={j.status} />
                </span>
                <small>
                  {trd(j.service)} · {relDay(j.date)}
                  {j.time && !underway(j) ? ` ${tr('kl.')} ${j.time}` : ''}
                </small>
                <small>
                  {j.address}
                  {j.place ? `, ${j.place}` : ''}
                </small>
                <small className="jcar">{vehicle(j.car) ? `🚚 ${vehicle(j.car)!.name} – ${trd(vehicle(j.car)!.type)} (${vehicle(j.car)!.regNr})` : tr('⚠ Ingen bil valgt – kontakt kontoret')}</small>
                <small className="jstep">
                  {underway(j) ? <span className="pill prog">{progress(j)}</span> : null} {tr('Neste')}: <b>{nextStep(j)?.label}</b>
                </small>
                {underway(j) && m > 0 && <small className="warntext">{tr('{n} punkter mangler før jobben kan avsluttes', { n: m })}</small>}
              </button>
            );
          })
        ) : (
          <p className="empty">{tr('Ingen oppdrag på {n} nå.', { n: me?.name ?? '' })}</p>
        )}
      </div>
    </>
  );
}

function PhotoField({ j, k, label }: { j: Job; k: 'ticketPhotos' | 'jobPhotos'; label: string }) {
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
      updateJob(j.id, { [k]: [...j[k], ...added] }, true);
    } catch {
      toast(tr('Bildet kunne ikke leses. Velg et JPG- eller PNG-bilde.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="photofield">
      <div className="lab">{label}</div>
      <Thumbs job={j} refs={j[k]} onOpen={setZoom} onRemove={i => updateJob(j.id, { [k]: j[k].filter((_, n) => n !== i) }, true)} />
      <label className={cx('upl', busy && 'busy')}>
        {busy ? tr('Behandler bilde …') : j[k].length ? tr('+ Legg til flere') : tr('📷 Ta eller velg bilde')}
        <input type="file" accept="image/*" capture="environment" multiple onChange={add} />
      </label>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function DriverJob({ j, back }: { j: Job; back: () => void }) {
  const [app, setApp] = useState<MapApp>(preferredMapApp);
  const set = (patch: Partial<Job>) => updateJob(j.id, patch);
  const chooseApp = (a: MapApp) => {
    setApp(a);
    setPreferredMapApp(a);
  };
  const appName = app === 'apple' ? tr('Apple Kart') : 'Google Maps';
  const miss = missing(j);
  const v = vehicle(j.car);

  const head = (
    <>
      <button className="back" onClick={back}>
        {tr('‹ Mine jobber')}
      </button>
      <div>
        <div className="spread">
          <h2>{j.customer}</h2>
          <Pill status={j.status} />
        </div>
        <small className="muted">
          {j.id} · {trd(j.service)} · {relDay(j.date)}
          {j.time ? ` ${tr('kl.')} ${j.time}` : ''}
        </small>
        <small className="jcar">{v ? `🚚 ${v.name} – ${trd(v.type)} (${v.regNr})` : tr('⚠ Ingen bil valgt – kontakt kontoret')}</small>
      </div>
      {j.urgent && <p className="alert">{tr('Hasteoppdrag')}</p>}
      <div className="locbox">
        <div className="locmap">
          <JobMap jobs={[j]} selectedId={j.id} onSelect={() => undefined} fitKey={`loc${j.id}${j.lat}${j.lon}`} maxFitZoom={15} compact />
        </div>
        <div className="locinfo">
          <b>{j.address}</b>
          {j.place && <span>{j.place}</span>}
          {j.pin === 'kart' && <small className="warntext">{tr('Ingen adresse – kjør etter nålen i kartet.')}</small>}
        </div>
        <a className="btn big navbtn" href={navUrl(j, app)} target="_blank" rel="noopener noreferrer">
          {tr('➤ Naviger til stedet')}
        </a>
        <div className="appswitch" role="group" aria-label={tr('Kartapp for navigasjon')}>
          <button type="button" aria-pressed={app === 'google'} onClick={() => chooseApp('google')}>
            {tr('Google Maps')}
          </button>
          <button type="button" aria-pressed={app === 'apple'} onClick={() => chooseApp('apple')}>
            {tr('Apple Kart')}
          </button>
        </div>
        <div className="locrow">
          <a href={mapsUrl(j, app)} target="_blank" rel="noopener noreferrer">
            {tr('Vis i {app}', { app: appName })}
          </a>
          <button
            type="button"
            className="link"
            onClick={() =>
              navigator.clipboard
                ?.writeText(fmtCoord(j))
                .then(() => toast(tr('Koordinatene er kopiert.')))
                .catch(() => toast(fmtCoord(j)))
            }
          >
            {tr('Kopier koordinater')} ({fmtCoord(j)})
          </button>
        </div>
      </div>
      <dl className="kv">
        <dt>{tr('Kontakt')}</dt>
        <dd>
          {j.contact} {j.phone && <a href={`tel:${j.phone.replace(/\s/g, '')}`}>{j.phone}</a>}
        </dd>
        {j.ref && (
          <>
            <dt>{tr('Kundens ref.')}</dt>
            <dd>{j.ref}</dd>
          </>
        )}
        {j.note && (
          <>
            <dt>{tr('Beskjed')}</dt>
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
      <h3>{tr('Statuspunkter')}</h3>
      <StepTimeline j={j} interactive onClosed={back} />
      <NextStepBar j={j} onClosed={back} />
      <hr />
      <h3>{tr('Dokumentasjon')}</h3>
      <PhotoField j={j} k="ticketPhotos" label={tr('Bilde av kjøreseddel')} />
      <div className="field">
        <label htmlFor="j-ticket">{tr('Kjøreseddelnummer')}</label>
        <input id="j-ticket" inputMode="numeric" value={j.ticketNo} onChange={e => set({ ticketNo: e.target.value })} />
      </div>
      <PhotoField j={j} k="jobPhotos" label={tr('Bilder av jobben')} />
      <div className="field">
        <label htmlFor="j-mass">{tr('Type masse')}</label>
        <select id="j-mass" value={j.massType} onChange={e => set({ massType: e.target.value })}>
          <option value="">{tr('Velg')}</option>
          {config.massTypes.map(m => (
            <option key={m.name} value={m.name}>
              {trd(m.name)}
              {m.hazardous ? ' ⚠' : ''}
            </option>
          ))}
        </select>
      </div>
      {j.massType && !isNoMass(j) && (
        <>
          <div className="two keep">
            <div className="field">
              <label htmlFor="j-amount">{tr('Mengde')}</label>
              <input id="j-amount" type="number" min="0" step="0.5" inputMode="decimal" value={j.amount} onChange={e => set({ amount: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="j-unit">{tr('Enhet')}</label>
              <select id="j-unit" value={j.unit} onChange={e => set({ unit: e.target.value })}>
                {config.units.map(u => (
                  <option key={u} value={u}>
                    {trd(u)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
      {isHaz(j) && (
        <div className="field">
          <label htmlFor="j-decl">{tr('Deklarasjonsnummer (Avfallsdeklarering.no)')}</label>
          <input id="j-decl" inputMode="numeric" value={j.decl} onChange={e => set({ decl: e.target.value })} />
        </div>
      )}
      {j.start && j.end && <p className="note">Arbeidstid (fra statuspunktene): {num(hours(j))} timer</p>}
      <div className="field">
        <label htmlFor="j-comment">{tr('Kommentar til faktura')}</label>
        <textarea id="j-comment" rows={2} value={j.comment} placeholder={tr('F.eks. ekstra slange, ventetid eller hindringer')} onChange={e => set({ comment: e.target.value })} />
      </div>
      <hr />
      <Checklist job={j} />
      {miss.length ? (
        <p className="alert">{tr('Fyll ut {n} punkt(er) som mangler. Jobben avsluttes med statuspunktet «Ferdig».', { n: miss.length })}</p>
      ) : (
        <p className="okline">{tr('Alt er fylt ut. Avslutt med statuspunktet «Ferdig» øverst.')}</p>
      )}
    </div>
  );
}
