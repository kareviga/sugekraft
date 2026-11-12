import { useEffect, useMemo, useState } from 'react';
import { config } from '../config';
import { Confirm, Lightbox, Modal, Thumbs } from '../components/ui';
import { updateJob, updateJobs } from '../store';
import { toast } from '../lib/toast';
import { cx, dayOffset, fmtAmount, hours, jobDriverName, nice, num, totals, vehicle } from '../lib/utils';
import { totalHours } from '../lib/steps';
import { StepTimeline } from '../components/Steps';
import type { Job } from '../types';
import { tr, trd } from '../i18n';

export interface ArchivePreset {
  customer: string;
  inv: 'open' | 'done' | 'all';
  pick?: string;
  n: number; // endres for å trigge
}

type Inv = 'open' | 'done' | 'all';

export function Archive({ jobs, preset }: { jobs: Job[]; preset: ArchivePreset | null }) {
  const done = useMemo(() => jobs.filter(j => j.status === 'ferdig'), [jobs]);
  const customers = useMemo(() => [...new Set(done.map(j => j.customer))].sort((a, b) => a.localeCompare(b, 'nb')), [done]);

  const [q, setQ] = useState('');
  const [cust, setCust] = useState('');
  const [inv, setInv] = useState<Inv>('open');
  const [service, setService] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [view, setView] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmInv, setConfirmInv] = useState(false);

  // forhåndsvalg når man kommer fra kontoret
  useEffect(() => {
    if (!preset) return;
    setCust(preset.customer);
    setInv(preset.inv);
    setQ('');
    setService('');
    setFrom('');
    setTo('');
    if (preset.pick) setView(preset.pick);
  }, [preset]);

  const ql = q.trim().toLowerCase();
  const list = done
    .filter(
      j =>
        (!cust || j.customer === cust) &&
        (inv === 'all' || (inv === 'open' ? !j.invoiced : j.invoiced)) &&
        (!service || j.service === service) &&
        (!from || j.date >= from) &&
        (!to || j.date <= to) &&
        (!ql || [j.id, j.customer, j.ref, j.ticketNo, j.address, j.place, j.massType, j.decl, j.comment].join(' ').toLowerCase().includes(ql)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const sel = done.filter(j => picked.has(j.id)).sort((a, b) => a.date.localeCompare(b.date));
  const selCustomers = [...new Set(sel.map(j => j.customer))];
  const allOn = list.length > 0 && list.every(j => picked.has(j.id));
  const toggle = (id: string, on: boolean) =>
    setPicked(p => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const clearFilters = () => {
    setQ('');
    setCust('');
    setInv('all');
    setService('');
    setFrom('');
    setTo('');
  };
  const openJob = done.find(j => j.id === view);

  const makePdf = async () => {
    if (!sel.length || selCustomers.length > 1) return;
    setBusy(true);
    try {
      const { buildInvoicePdf } = await import('../lib/pdf');
      const { doc, filename } = await buildInvoicePdf(sel);
      doc.save(filename);
      toast(tr('PDF-en er lastet ned.'));
    } catch (e) {
      console.error(e);
      toast(tr('PDF-en kunne ikke lages. Prøv igjen.'));
    } finally {
      setBusy(false);
    }
  };

  // ikke-fakturerte per kunde, for snarvei
  const openByCustomer = useMemo(() => {
    const m: Record<string, number> = {};
    done.filter(j => !j.invoiced).forEach(j => (m[j.customer] = (m[j.customer] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [done]);

  return (
    <div className="arkiv">
      <section className="card">
        <div className="afil">
          <div className="field grow">
            <label htmlFor="a-q">{tr('Søk')}</label>
            <input id="a-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={tr('Jobbnr, kunde, kjøreseddel, referanse …')} />
          </div>
          <div className="field">
            <label htmlFor="a-c">{tr('Kunde')}</label>
            <select id="a-c" value={cust} onChange={e => setCust(e.target.value)}>
              <option value="">{tr('Alle kunder')}</option>
              {customers.map(c => (
                <option key={c} value={c}>
                  {trd(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-s">{tr('Oppdragstype')}</label>
            <select id="a-s" value={service} onChange={e => setService(e.target.value)}>
              <option value="">{tr('Alle typer')}</option>
              {config.services.map(c => (
                <option key={c} value={c}>
                  {trd(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-i">{tr('Fakturastatus')}</label>
            <select id="a-i" value={inv} onChange={e => setInv(e.target.value as Inv)}>
              <option value="open">{tr('Ikke fakturert')}</option>
              <option value="done">{tr('Fakturert')}</option>
              <option value="all">{tr('Alle')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-from">{tr('Fra dato')}</label>
            <input id="a-from" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-to">{tr('Til dato')}</label>
            <input id="a-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <div className="abar">
          <span>
            <b>{list.length}</b> {tr('av')} {done.length} {tr('ferdige jobber')}
          </span>
          <button className="link" onClick={clearFilters}>
            {tr('Nullstill filter')}
          </button>
        </div>
        <div className="tw">
          {list.length ? (
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={tr('Velg alle i listen')}
                      checked={allOn}
                      onChange={e =>
                        setPicked(p => {
                          const n = new Set(p);
                          list.forEach(j => (e.target.checked ? n.add(j.id) : n.delete(j.id)));
                          return n;
                        })
                      }
                    />
                  </th>
                  <th>{tr('Jobb')}</th>
                  <th>{tr('Dato')}</th>
                  <th>{tr('Kunde')}</th>
                  <th>{tr('Ref.')}</th>
                  <th>{tr('Oppdrag')}</th>
                  <th>{tr('Masse')}</th>
                  <th className="n">{tr('Mengde')}</th>
                  <th>{tr('Deponi')}</th>
                  <th className="n">{tr('Timer')}</th>
                  <th className="n">{tr('Bilder')}</th>
                  <th>{tr('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map(j => (
                  <tr key={j.id} className={cx(picked.has(j.id) && 'on')} onClick={e => (e.target as HTMLElement).closest('input') || setView(j.id)}>
                    <td>
                      <input type="checkbox" aria-label={tr('Velg {id}', { id: j.id })} checked={picked.has(j.id)} onChange={e => toggle(j.id, e.target.checked)} />
                    </td>
                    <td className="nw">
                      <button className="link" onClick={() => setView(j.id)}>
                        {j.id}
                      </button>
                    </td>
                    <td className="nw">{nice(j.date)}</td>
                    <td>{j.customer}</td>
                    <td className="nw">{j.ref || '–'}</td>
                    <td>{trd(j.service)}</td>
                    <td>{trd(j.massType)}</td>
                    <td className="n">{fmtAmount(j)}</td>
                    <td>{trd(j.disposal) || '–'}</td>
                    <td className="n">{num(hours(j))}</td>
                    <td className="n">{j.ticketPhotos.length + j.jobPhotos.length}</td>
                    <td>
                      <span className={`pill ${j.invoiced ? 'ok' : 'warn'}`}>{j.invoiced ? tr('Fakturert') : tr('Ikke fakturert')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">{tr('Ingen ferdige jobber passer med filteret.')}</p>
          )}
        </div>
      </section>

      <aside className="card fak" aria-label={tr('Fakturagrunnlag')}>
        <h2>{tr('Fakturagrunnlag')}</h2>
        {!sel.length ? (
          <>
            <p className="note">{tr('Huk av ferdige jobber for én kunde for å lage PDF-vedlegg til fakturaen.')}</p>
            {openByCustomer.length > 0 && (
              <div>
                <div className="lab" style={{ marginBottom: 6 }}>
                  {tr('Klar for fakturering')}
                </div>
                <ul className="quick">
                  {openByCustomer.map(([c, n]) => (
                    <li key={c}>
                      <button
                        className="link"
                        onClick={() => {
                          setCust(c);
                          setInv('open');
                          setPicked(new Set(done.filter(j => j.customer === c && !j.invoiced).map(j => j.id)));
                        }}
                      >
                        {c}
                      </button>
                      <span>{tr('{n} jobber', { n })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <SelPanel
            sel={sel}
            customers={selCustomers}
            busy={busy}
            onPdf={makePdf}
            onInvoiced={() => setConfirmInv(true)}
            onClear={() => setPicked(new Set())}
          />
        )}
      </aside>

      {openJob && (
        <JobView
          j={openJob}
          onClose={() => setView(null)}
          onReopen={() => {
            updateJob(openJob.id, { status: 'aktiv', invoiced: false, invoicedAt: '', closedAt: '' }, true);
            toggle(openJob.id, false);
            setView(null);
            toast(tr('{id} er gjenåpnet og ligger hos sjåføren igjen.', { id: openJob.id }));
          }}
          onToggleInvoiced={() => {
            updateJob(openJob.id, { invoiced: !openJob.invoiced, invoicedAt: openJob.invoiced ? '' : dayOffset(0) }, true);
            toast(openJob.invoiced ? tr('{id} er satt til ikke fakturert.', { id: openJob.id }) : tr('{id} er merket som fakturert.', { id: openJob.id }));
          }}
        />
      )}
      {confirmInv && (
        <Confirm
          title={tr('Merk som fakturert?')}
          text={tr('{n} jobber for {c} merkes som fakturert og flyttes ut av listen «Ikke fakturert».', { n: sel.length, c: selCustomers[0] })}
          ok="Merk som fakturert"
          onClose={() => setConfirmInv(false)}
          onOk={() => {
            updateJobs(
              sel.map(j => j.id),
              { invoiced: true, invoicedAt: dayOffset(0) },
            );
            setPicked(new Set());
            toast(tr('{n} jobber er merket som fakturert.', { n: sel.length }));
          }}
        />
      )}
    </div>
  );
}

function SelPanel({
  sel,
  customers,
  busy,
  onPdf,
  onInvoiced,
  onClear,
}: {
  sel: Job[];
  customers: string[];
  busy: boolean;
  onPdf: () => void;
  onInvoiced: () => void;
  onClear: () => void;
}) {
  const many = customers.length > 1;
  const s = totals(sel);
  return (
    <>
      <div>
        <b className="fakcust">{many ? tr('{n} kunder valgt', { n: customers.length }) : customers[0]}</b>
        <small className="muted">
          {nice(sel[0].date)} – {nice(sel[sel.length - 1].date)}
        </small>
      </div>
      <dl className="sum">
        <dt>{tr('Jobber')}</dt>
        <dd>{sel.length}</dd>
        <dt>{tr('Timer')}</dt>
        <dd>{num(s.hours)}</dd>
        {Object.entries(s.amounts).map(([k, v]) => (
          <div className="sumrow" key={k}>
            <dt>{k}</dt>
            <dd>{num(v)}</dd>
          </div>
        ))}
        <dt>{tr('Bilder og kjøresedler')}</dt>
        <dd>{s.photos}</dd>
      </dl>
      {many && <p className="alert">{tr('Velg jobber for én kunde om gangen for å lage vedlegg.')}</p>}
      {sel.some(j => j.invoiced) && !many && <p className="note">{tr('Noen av de valgte jobbene er allerede fakturert.')}</p>}
      <button className="btn" onClick={onPdf} disabled={many || busy}>
        {busy ? 'Lager PDF …' : 'Last ned PDF-vedlegg'}
      </button>
      <button className="btn alt" onClick={onInvoiced} disabled={many}>
        {tr('Merk som fakturert')}
      </button>
      <button className="link" onClick={onClear}>
        {tr('Fjern valg')}
      </button>
      <p className="note">{tr('PDF-en har en samleside og én side per jobb med kjøreseddel og bilder.')}</p>
    </>
  );
}

function JobView({ j, onClose, onReopen, onToggleInvoiced }: { j: Job; onClose: () => void; onReopen: () => void; onToggleInvoiced: () => void }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const v = vehicle(j.car);
  const rows: [string, string][] = [
    [tr('Kunde'), j.customer],
    [tr('Kontakt'), [j.contact, j.phone].filter(Boolean).join(', ')],
    [tr('Kundens ref.'), j.ref || '–'],
    [tr('Adresse'), `${j.address}, ${j.place}`],
    [tr('Dato'), nice(j.date)],
    [tr('Arbeidstid'), j.start && j.end ? `${j.start} – ${j.end} (${num(hours(j))} t)` : '–'],
    [tr('Total tid'), totalHours(j) ? `${j.steps.kjoring?.time} – ${j.steps.ferdig?.time ?? '…'} (${num(totalHours(j))} ${tr('t, inkl. kjøring')})` : '–'],
    [tr('Bil / sjåfør'), `${v ? `${v.name} (${v.regNr})` : '–'} / ${jobDriverName(j) || '–'}`],
    [tr('Kjøreseddel'), j.ticketNo || '–'],
    [tr('Masse'), trd(j.massType) || '–'],
    [tr('Mengde'), fmtAmount(j)],
    [tr('Deponi / mottak'), trd(j.disposal) || '–'],
  ];
  if (j.decl) rows.push([tr('Deklarasjonsnr.'), j.decl]);
  if (j.comment) rows.push([tr('Kommentar'), j.comment]);
  if (j.invoiced) rows.push([tr('Fakturert'), nice(j.invoicedAt)]);
  return (
    <Modal
      wide
      title={`${j.id} · ${trd(j.service)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn alt" onClick={onReopen}>
            {tr('Gjenåpne for retting')}
          </button>
          <button className="btn alt" onClick={onToggleInvoiced}>
            {j.invoiced ? tr('Sett til ikke fakturert') : tr('Merk som fakturert')}
          </button>
          <button className="btn" onClick={onClose}>
            {tr('Lukk')}
          </button>
        </>
      }
    >
      <dl className="kv wide">
        {rows.map(([k, val]) => (
          <div className="kvrow" key={k}>
            <dt>{k}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      <div className="lab">{tr('Statuspunkter')}</div>
      <StepTimeline j={j} />
      <div className="lab">{tr('Kjøreseddel og bilder')}</div>
      <Thumbs job={j} refs={[...j.ticketPhotos, ...j.jobPhotos]} onOpen={setZoom} />
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </Modal>
  );
}
