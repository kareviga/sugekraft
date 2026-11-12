import { useMemo, useState } from 'react';
import { config } from '../config';
import { JobMap } from '../components/JobMap';
import { JobForm } from '../components/JobForm';
import { Checklist, Confirm, Lightbox, Mark, Pill, Thumbs } from '../components/ui';
import { deleteJob, updateJob } from '../store';
import { toast } from '../lib/toast';
import { cx, dayOffset, daysBetween, fmtAmount, fmtCoord, mapsUrl, missing, nice, relDay, vehicle, vehicleLong, vehicleName } from '../lib/utils';
import { STATUS_LABEL, type Job, type Status } from '../types';

const ORDER: Record<Status, number> = { aktiv: 0, kommende: 1, ferdig: 2 };
const DONE_RANGE: Record<string, [string, number]> = {
  '1': ['I dag', 0],
  '7': ['Siste 7 dager', 7],
  '30': ['Siste 30 dager', 30],
  all: ['Alle', 99999],
};

export function Office({
  jobs,
  sel,
  setSel,
  openAsDriver,
  openInArchive,
}: {
  jobs: Job[];
  sel: string | null;
  setSel: (id: string | null) => void;
  openAsDriver: (j: Job) => void;
  openInArchive: (j: Job) => void;
}) {
  const [show, setShow] = useState<Record<Status, boolean>>({ kommende: true, aktiv: true, ferdig: true });
  const [doneRange, setDoneRange] = useState('7');
  const [carF, setCarF] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ job?: Job } | null>(null);
  const [fly, setFly] = useState(0);
  const [confirmDel, setConfirmDel] = useState<Job | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const today = dayOffset(0);
  const inScope = (j: Job) => j.status !== 'ferdig' || daysBetween(j.date, today) <= DONE_RANGE[doneRange][1];
  const scoped = jobs.filter(j => inScope(j) && (!carF || (carF === '-' ? !j.car : j.car === carF)));
  const ql = q.trim().toLowerCase();
  const list = scoped
    .filter(j => show[j.status])
    .filter(j => !ql || [j.id, j.customer, j.address, j.place, j.service, j.ref].join(' ').toLowerCase().includes(ql))
    .sort(
      (a, b) =>
        ORDER[a.status] - ORDER[b.status] ||
        (a.status === 'ferdig' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99')),
    );
  const count = (s: Status) => scoped.filter(j => j.status === s).length;
  const unassigned = jobs.filter(j => j.status === 'kommende').length;
  const s = jobs.find(j => j.id === sel);
  const fitKey = useMemo(() => `${Object.values(show).join()}|${doneRange}|${carF}`, [show, doneRange, carF]);

  const pick = (id: string, flyTo: boolean) => {
    setSel(id);
    if (flyTo) setFly(n => n + 1);
  };

  return (
    <div className="kontor">
      <section className="col list" aria-label="Jobbliste">
        <div className="tools">
          <button className="btn" onClick={() => setForm({})}>
            + Ny jobb
          </button>
          <div className="filters">
            {(Object.keys(STATUS_LABEL) as Status[]).map(k => (
              <button key={k} className="filter" aria-pressed={show[k]} onClick={() => setShow(o => ({ ...o, [k]: !o[k] }))}>
                <b>{count(k)}</b>
                <span>
                  <Mark status={k} />
                  {STATUS_LABEL[k]}
                </span>
              </button>
            ))}
          </div>
          <div className="two">
            <select className="sel-in" aria-label="Filtrer på bil" value={carF} onChange={e => setCarF(e.target.value)}>
              <option value="">Alle biler</option>
              {config.vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} – {v.driver.split(' ')[0]}
                </option>
              ))}
              <option value="-">Ikke tildelt ({unassigned})</option>
            </select>
            <select className="sel-in" aria-label="Periode for ferdige jobber" value={doneRange} onChange={e => setDoneRange(e.target.value)}>
              {Object.entries(DONE_RANGE).map(([k, [l]]) => (
                <option key={k} value={k}>
                  Ferdige: {l.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <input className="sel-in" type="search" placeholder="Søk kunde, adresse, jobbnr …" value={q} onChange={e => setQ(e.target.value)} aria-label="Søk i jobber" />
        </div>
        {list.length ? (
          list.map(j => {
            const m = j.status === 'aktiv' && j.start ? missing(j).length : 0;
            const v = vehicle(j.car);
            return (
              <button key={j.id} className={cx('row', j.status, j.id === sel && 'sel')} onClick={() => pick(j.id, true)}>
                <span className="top">
                  <span>
                    {j.urgent && j.status !== 'ferdig' && <span className="hast">HAST</span>}
                    {j.customer}
                  </span>
                  <Pill status={j.status} />
                </span>
                <small>
                  {j.service} · {j.place}
                </small>
                <small className="meta">
                  <span>
                    {relDay(j.date)}
                    {j.time && j.status !== 'ferdig' && !j.start ? ` kl. ${j.time}` : ''}
                  </span>
                  {v ? <span className="carchip">{v.name}</span> : <span className="pill warn">Ikke tildelt</span>}
                  {m > 0 && <span className="pill warn">Mangler {m}</span>}
                  {j.status === 'ferdig' && (j.invoiced ? <span className="pill ok">Fakturert</span> : null)}
                </small>
              </button>
            );
          })
        ) : (
          <p className="empty">Ingen jobber passer med filteret.</p>
        )}
      </section>

      <section className="mapwrap" aria-label="Kart">
        <JobMap jobs={list} selectedId={sel} onSelect={id => pick(id, false)} fitKey={fitKey} flyKey={fly} />
        <div className="legend" aria-hidden="true">
          {(Object.keys(STATUS_LABEL) as Status[]).map(k => (
            <span key={k}>
              <Mark status={k} /> {STATUS_LABEL[k]}
            </span>
          ))}
          <span className="lg-note">Tallet viser bilnummer</span>
        </div>
      </section>

      <aside className="col det" aria-label="Jobbdetaljer">
        {s && (
          <button className="back" onClick={() => setSel(null)}>
            ‹ Bilparken i dag
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
          <Fleet jobs={jobs} onPick={id => pick(id, true)} />
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
            toast(`${j.id} er lagret${j.car ? ' og tildelt ' + vehicleName(j.car) : ''}.`);
          }}
        />
      )}
      {confirmDel && (
        <Confirm
          title={`Slette ${confirmDel.id}?`}
          text={`Jobben for ${confirmDel.customer} ${nice(confirmDel.date)} slettes.`}
          ok="Slett jobb"
          danger
          onClose={() => setConfirmDel(null)}
          onOk={() => {
            deleteJob(confirmDel.id);
            setSel(null);
            toast(`${confirmDel.id} er slettet.`);
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
            {j.id} · {j.service}
          </small>
        </div>
        <Pill status={j.status} />
      </div>
      {j.urgent && j.status !== 'ferdig' && <p className="alert">Hasteoppdrag</p>}
      <div className="field">
        <label htmlFor="d-car">Tildelt bil</label>
        <select
          id="d-car"
          value={j.car}
          disabled={j.status === 'ferdig'}
          onChange={e => {
            updateJob(j.id, { car: e.target.value }, true);
            toast(e.target.value ? `${j.id} er tildelt ${vehicleLong(e.target.value)} og er nå aktiv.` : `Tildelingen er fjernet. ${j.id} er kommende igjen.`);
          }}
        >
          <option value="">Ikke tildelt</option>
          {config.vehicles.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} – {c.type} ({c.driver})
            </option>
          ))}
        </select>
      </div>
      <dl className="kv">
        <dt>{j.pin === 'kart' ? 'Sted' : 'Adresse'}</dt>
        <dd>
          {j.address}
          {j.place ? `, ${j.place}` : ''}
          <br />
          <small className="muted">
            {j.pin === 'kart' ? `Nål plassert manuelt (${fmtCoord(j)})` : 'Fra adresseregisteret'} ·{' '}
            <a href={mapsUrl(j)} target="_blank" rel="noopener noreferrer">
              Google Maps
            </a>
          </small>
        </dd>
        <dt>Dato</dt>
        <dd>
          {nice(j.date)}
          {j.time ? ` kl. ${j.time}` : ''}
        </dd>
        <dt>Kontakt</dt>
        <dd>
          {j.contact} {j.phone && <a href={`tel:${j.phone.replace(/\s/g, '')}`}>{j.phone}</a>}
        </dd>
        <dt>Kundens ref.</dt>
        <dd>{j.ref || '–'}</dd>
        {j.note && (
          <>
            <dt>Beskjed</dt>
            <dd>{j.note}</dd>
          </>
        )}
        {j.start && (
          <>
            <dt>Masse</dt>
            <dd>{j.massType || '–'}</dd>
            <dt>Mengde</dt>
            <dd>{fmtAmount(j)}</dd>
            <dt>Tid</dt>
            <dd>{j.start ? `${j.start} – ${j.end || 'pågår'}` : '–'}</dd>
          </>
        )}
      </dl>
      {j.status === 'kommende' ? (
        <p className="infobox">Jobben er ikke tildelt. Velg bil over for å sende den til sjåføren – da blir den aktiv.</p>
      ) : j.start || j.status === 'ferdig' ? (
        <Checklist job={j} />
      ) : (
        <p className="note">Sjåføren har ikke begynt på jobben ennå.</p>
      )}
      <Thumbs job={j} refs={[...j.ticketPhotos, ...j.jobPhotos]} onOpen={onZoom} />
      {j.status !== 'ferdig' ? (
        <div className="btnrow">
          <button className="btn alt" onClick={onEdit}>
            Rediger
          </button>
          <button className="btn alt" onClick={onDriver} disabled={!j.car} title={j.car ? '' : 'Tildel en bil først'}>
            Åpne som sjåfør
          </button>
          {!j.start && (
            <button className="btn alt danger" onClick={onDelete}>
              Slett
            </button>
          )}
        </div>
      ) : (
        <button className="btn alt" onClick={onArchive}>
          Åpne i arkivet
        </button>
      )}
    </>
  );
}

/** Vises når ingen jobb er valgt: status per bil i dag. */
function Fleet({ jobs, onPick }: { jobs: Job[]; onPick: (id: string) => void }) {
  const today = dayOffset(0);
  return (
    <>
      <h2>Bilparken i dag</h2>
      <p className="note">Velg en jobb i listen eller kartet for å se detaljer.</p>
      <ul className="fleet">
        {config.vehicles.map(v => {
          const mine = jobs.filter(j => j.car === v.id && j.date === today);
          const active = mine.find(j => j.status === 'aktiv' && j.start);
          const done = mine.filter(j => j.status === 'ferdig').length;
          const next = mine.filter(j => j.status === 'aktiv' && !j.start).sort((a, b) => (a.time || '').localeCompare(b.time || ''))[0];
          return (
            <li key={v.id}>
              <span className={cx('fleet-tag', active ? 'aktiv' : next ? 'neste' : 'idle')}>{v.tag}</span>
              <div>
                <b>
                  {v.name} · {v.driver}
                </b>
                <small>
                  {v.type} · {v.regNr}
                </small>
                {active ? (
                  <button className="link" onClick={() => onPick(active.id)}>
                    Pågår: {active.customer}, {active.place}
                  </button>
                ) : next ? (
                  <button className="link" onClick={() => onPick(next.id)}>
                    Neste: {next.customer}
                    {next.time ? ` kl. ${next.time}` : ''}
                  </button>
                ) : (
                  <small>Ingen flere jobber i dag</small>
                )}
                {done > 0 && <small>{done} ferdig i dag</small>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
