import { useMemo, useState } from 'react';
import { config } from '../config';
import { JobMap } from '../components/JobMap';
import { JobForm } from '../components/JobForm';
import { Checklist, Confirm, Lightbox, Mark, Pill, Thumbs } from '../components/ui';
import { deleteJob, updateJob, useJobs, useOut } from '../store';
import { FleetCompact } from './Fleet';
import { DriverOptions, VehicleOptions } from '../components/VehicleOptions';
import { driverBusy } from '../lib/fleet';
import { progress, underway } from '../lib/steps';
import { StepTimeline } from '../components/Steps';
import { RequestsPanel } from '../components/Requests';
import { toast } from '../lib/toast';
import { cx, dayOffset, daysBetween, driver, fmtAmount, jobDriverName, mapsUrl, nice, relDay, vehicle, vehicleLong, vehicleName } from '../lib/utils';
import { STATUS_LABEL, type Job, type Status } from '../types';
import { tr, trd } from '../i18n';

const ORDER: Record<Status, number> = { aktiv: 0, kommende: 1, ferdig: 2 };
const DONE_RANGE: Record<string, [string, number]> = {
  '1': ['I dag', 0],
  '7': ['Siste 7 dager', 7],
  '30': ['Siste 30 dager', 30],
  all: ['Alle', 99999],
};

export function Office({
  focus,
  jobs,
  requests,
  sel,
  setSel,
  openAsDriver,
  openInArchive,
  openFleet,
}: {
  /** Åpnet fra forsiden: vis bare kommende/aktive */
  focus?: 'kommende' | 'aktiv' | 'requests' | null;
  jobs: Job[];
  requests: Job[];
  sel: string | null;
  setSel: (id: string | null) => void;
  openAsDriver: (j: Job) => void;
  openInArchive: (j: Job) => void;
  openFleet: () => void;
}) {
  const [drvF, setDrvF] = useState('');
  const [show, setShow] = useState<Record<Status, boolean>>(
    focus === 'kommende' || focus === 'aktiv'
      ? { kommende: focus === 'kommende', aktiv: focus === 'aktiv', ferdig: false }
      : { kommende: true, aktiv: true, ferdig: true },
  );
  const [doneRange, setDoneRange] = useState('7');
  const [carF, setCarF] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ job?: Job } | null>(null);
  const [fly, setFly] = useState(0);
  const [confirmDel, setConfirmDel] = useState<Job | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const today = dayOffset(0);
  const inScope = (j: Job) => j.status !== 'ferdig' || daysBetween(j.date, today) <= DONE_RANGE[doneRange][1];
  const scoped = jobs.filter(j => inScope(j) && (!carF || (carF === '-' ? !j.car : j.car === carF)) && (!drvF || (drvF === '-' ? !j.driver : j.driver === drvF)));
  const ql = q.trim().toLowerCase();
  const list = scoped
    .filter(j => show[j.status])
    .filter(j => !ql || [j.no, j.customer, j.address, j.place, j.service, j.ref, jobDriverName(j)].join(' ').toLowerCase().includes(ql))
    .sort(
      (a, b) =>
        ORDER[a.status] - ORDER[b.status] ||
        (a.status === 'ferdig' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99')),
    );
  const count = (s: Status) => scoped.filter(j => j.status === s).length;
  const noCar = jobs.filter(j => j.status !== 'ferdig' && !j.car).length;
  const noDriver = jobs.filter(j => j.status === 'kommende').length;
  const s = jobs.find(j => j.id === sel);
  const fitKey = useMemo(() => `${Object.values(show).join()}|${doneRange}|${carF}|${drvF}`, [show, doneRange, carF, drvF]);

  const pick = (id: string, flyTo: boolean) => {
    setSel(id);
    if (flyTo) setFly(n => n + 1);
  };

  return (
    <div className="kontor">
      <section className="col list" aria-label={tr('Jobbliste')}>
        <div className="tools">
          <RequestsPanel
            requests={requests}
            onAccepted={j => {
              setShow(o => ({ ...o, [j.driver ? 'aktiv' : 'kommende']: true }));
              pick(j.id, true);
            }}
          />
          <button className="btn" onClick={() => setForm({})}>
            {tr('+ Ny jobb')}
          </button>
          <div className="filters">
            {(Object.keys(STATUS_LABEL) as Status[]).map(k => (
              <button key={k} className="filter" aria-pressed={show[k]} onClick={() => setShow(o => ({ ...o, [k]: !o[k] }))}>
                <b>{count(k)}</b>
                <span>
                  <Mark status={k} />
                  {tr(STATUS_LABEL[k])}
                </span>
              </button>
            ))}
          </div>
          <input className="sel-in" type="search" placeholder={tr('Søk kunde, adresse, jobbnr …')} value={q} onChange={e => setQ(e.target.value)} aria-label={tr('Søk i jobber')} />
          <details className="morefilters">
            <summary>{tr('Flere filtre')}{carF || drvF || doneRange !== '7' ? ' •' : ''}</summary>
          <div className="two">
            <select className="sel-in" aria-label={tr('Filtrer på bil')} value={carF} onChange={e => setCarF(e.target.value)}>
              <option value="">{tr('Alle biler')}</option>
              {config.vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
              <option value="-">{tr('Uten bil')} ({noCar})</option>
            </select>
            <select className="sel-in" aria-label={tr('Filtrer på sjåfør')} value={drvF} onChange={e => setDrvF(e.target.value)}>
              <option value="">{tr('Alle sjåfører')}</option>
              {config.drivers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value="-">{tr('Uten sjåfør')} ({noDriver})</option>
            </select>
          </div>
          <select className="sel-in" aria-label={tr('Periode for ferdige jobber')} value={doneRange} onChange={e => setDoneRange(e.target.value)}>
            {Object.entries(DONE_RANGE).map(([k, [l]]) => (
              <option key={k} value={k}>
                {tr('Ferdige jobber')}: {tr(l).toLowerCase()}
              </option>
            ))}
          </select>
          </details>
        </div>
        {list.length ? (
          list.map(j => {
            const v = vehicle(j.car);
            return (
              <button key={j.id} className={cx('row', j.status, j.id === sel && 'sel')} onClick={() => pick(j.id, true)}>
                <span className="top">
                  <span>
                    {j.urgent && j.status !== 'ferdig' && <span className="hast">{tr('HAST')}</span>}
                    {j.customer}
                  </span>
                  <Pill status={j.status} />
                </span>
                <small>
                  {trd(j.service)} · {j.place}
                </small>
                <small className="meta">
                  <span>
                    {relDay(j.date)}
                    {j.time && j.status !== 'ferdig' && !underway(j) ? ` ${tr('kl.')} ${j.time}` : ''}
                  </span>
                  {v ? <span className="carchip">{v.name}</span> : j.status !== 'ferdig' && <span className="pill warn">{tr('Uten bil')}</span>}
                  {jobDriverName(j) ? <span className="carchip drv">{jobDriverName(j)}</span> : j.status !== 'ferdig' && <span className="pill warn">{tr('Uten sjåfør')}</span>}
                  {underway(j) && <span className="pill prog">{progress(j)}</span>}
                </small>
              </button>
            );
          })
        ) : (
          <p className="empty">{tr('Ingen jobber passer med filteret.')}</p>
        )}
      </section>

      <section className="mapwrap" aria-label={tr('Kart')}>
        <JobMap
          jobs={list}
          selectedId={sel}
          onSelect={id => pick(id, false)}
          fitKey={fitKey}
          flyKey={fly}
        />
        <div className="legend" aria-hidden="true">
          {(Object.keys(STATUS_LABEL) as Status[]).map(k => (
            <span key={k}>
              <Mark status={k} /> {tr(STATUS_LABEL[k])}
            </span>
          ))}
        </div>
      </section>

      <aside className="col det" aria-label={tr('Jobbdetaljer')}>
        {s && (
          <button className="back" onClick={() => setSel(null)}>
            {tr('‹ Bilparken i dag')}
          </button>
        )}
        {s ? (
          <Detail
            j={s}
            onEdit={() => setForm({ job: s })}
            onDriver={() => openAsDriver(s)}
            onArchive={() => openInArchive(s)}
            onDelete={() => setConfirmDel(s)}
            onZoom={setZoom}
          />
        ) : (
          <FleetCompact jobs={jobs} onPick={id => pick(id, true)} openFleet={openFleet} />
        )}
      </aside>

      {form && (
        <JobForm
          job={form.job}
          onClose={() => setForm(null)}
          onSaved={j => {
            setForm(null);
            setShow(o => ({ ...o, [j.status]: true }));
            pick(j.id, true);
            toast(j.driver ? tr('{id} er lagret – {d}. Oppdraget er aktivt.', { id: j.no, d: `${driver(j.driver)?.name}${j.car ? ` / ${vehicleName(j.car)}` : ''}` }) : tr('{id} er lagret som kommende (ingen sjåfør ennå).', { id: j.no }));
          }}
        />
      )}
      {confirmDel && (
        <Confirm
          title={tr('Slette {id}?', { id: confirmDel.no })}
          text={tr('Jobben for {c} {d} slettes.', { c: confirmDel.customer, d: nice(confirmDel.date) })}
          ok="Slett jobb"
          danger
          onClose={() => setConfirmDel(null)}
          onOk={() => {
            deleteJob(confirmDel.id);
            setSel(null);
            toast(tr('{id} er slettet.', { id: confirmDel.no }));
          }}
        />
      )}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function Detail({
  j,
  onEdit,
  onDriver,
  onArchive,
  onDelete,
  onZoom,
}: {
  j: Job;
  onEdit: () => void;
  onDriver: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onZoom: (src: string) => void;
}) {
  return (
    <>
      <div className="dethead">
        <div>
          <h2>{j.customer}</h2>
          <small>
            {j.no} · {trd(j.service)}
          </small>
        </div>
        <Pill status={j.status} />
      </div>
      {j.urgent && j.status !== 'ferdig' && <p className="alert">{tr('Hasteoppdrag')}</p>}
      {j.status === 'ferdig' ? (
        <dl className="kv">
          <dt>{tr('Bil')}</dt>
          <dd>{vehicleLong(j.car)}</dd>
          <dt>{tr('Sjåfør')}</dt>
          <dd>{jobDriverName(j) || '–'}</dd>
        </dl>
      ) : (
        <Assign j={j} />
      )}
      <dl className="kv">
        <dt>{j.pin === 'kart' ? tr('Sted') : tr('Adresse')}</dt>
        <dd>
          {j.address}
          {j.place ? `, ${j.place}` : ''}
          {' · '}
          <a href={mapsUrl(j)} target="_blank" rel="noopener noreferrer">
            {tr('Vis i kart')}
          </a>
        </dd>
        <dt>{tr('Dato')}</dt>
        <dd>
          {nice(j.date)}
          {j.time ? ` ${tr('kl.')} ${j.time}` : ''}
        </dd>
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
            <dd>{j.note}</dd>
          </>
        )}
        {j.status !== 'kommende' && j.massType && (
          <>
            <dt>{tr('Masse')}</dt>
            <dd>
              {trd(j.massType)} · {fmtAmount(j)}
              {j.disposal ? ` → ${trd(j.disposal)}` : ''}
            </dd>
          </>
        )}
      </dl>
      {j.status === 'kommende' ? (
        <p className="infobox">{tr('Jobben har ingen sjåfør. Velg sjåfør over for å sende den ut – da blir den aktiv.')}</p>
      ) : underway(j) || j.status === 'ferdig' ? (
        <>
          <div className="lab">{tr('Statuspunkter')}</div>
          <StepTimeline j={j} />
          <Checklist job={j} compact />
        </>
      ) : (
        <p className="note">{tr('Sjåføren har ikke begynt på jobben ennå.')}</p>
      )}
      <Thumbs job={j} refs={[...j.ticketPhotos, ...j.jobPhotos]} onOpen={onZoom} />
      {j.status !== 'ferdig' ? (
        <div className="btnrow">
          <button className="btn alt" onClick={onEdit}>
            {tr('Rediger')}
          </button>
          <button className="btn alt" onClick={onDriver} disabled={!j.driver} title={j.driver ? '' : tr('Sett på en sjåfør først')}>
            {tr('Åpne som sjåfør')}
          </button>
          {!underway(j) && (
            <button className="btn alt danger" onClick={onDelete}>
              {tr('Slett')}
            </button>
          )}
        </div>
      ) : (
        <button className="btn alt" onClick={onArchive}>
          {tr('Lag PDF-rapport')}
        </button>
      )}
    </>
  );
}

/** Velg bil og sjåfør for et oppdrag – hver for seg. Sjåfør gjør oppdraget aktivt. */
function Assign({ j }: { j: Job }) {
  const jobs = useJobs();
  const out = useOut();
  const busy = driverBusy(j.driver, jobs, j.id);
  const carOut = j.car && out[j.car] !== undefined;
  return (
    <div className="assign">
      <div className="field">
        <label htmlFor="d-car">{tr('Bil')}</label>
        <select
          id="d-car"
          value={j.car}
          onChange={e => {
            updateJob(j.id, { car: e.target.value }, true);
            toast(e.target.value ? tr('{id}: {v} er valgt.', { id: j.no, v: vehicleLong(e.target.value) }) : tr('{id}: bilen er fjernet.', { id: j.no }));
          }}
        >
          <option value="">{tr('Ingen bil valgt')}</option>
          <VehicleOptions exceptJob={j.id} />
        </select>
      </div>
      <div className="field">
        <label htmlFor="d-drv">{tr('Sjåfør')}</label>
        <select
          id="d-drv"
          value={j.driver}
          onChange={e => {
            const d = driver(e.target.value);
            updateJob(j.id, { driver: e.target.value }, true);
            toast(d ? tr('{d} er satt på {id}. Oppdraget er aktivt.', { d: d.name, id: j.no }) : tr('Sjåføren er fjernet. {id} er kommende igjen.', { id: j.no }));
          }}
        >
          <option value="">{tr('Ingen sjåfør – Kommende')}</option>
          <DriverOptions exceptJob={j.id} />
        </select>
      </div>
      {!j.car && j.driver && <p className="alert small">{tr('Velg bil før sjåføren kjører ut.')}</p>}
      {carOut && <p className="alert small">{vehicleName(j.car)} er ute av drift: {out[j.car] || tr('ingen årsak oppgitt')}.</p>}
      {busy && j.status === 'aktiv' && !underway(j) && (
        <p className="note">
          {tr('{d} er på oppdrag hos {c} nå.', { d: driver(j.driver)?.name ?? '', c: busy.customer })}
        </p>
      )}
    </div>
  );
}
