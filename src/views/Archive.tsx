import { useEffect, useMemo, useState } from 'react';
import { config } from '../config';
import { Confirm, Lightbox, Modal, Thumbs } from '../components/ui';
import { updateJob, updateJobs } from '../store';
import { toast } from '../lib/toast';
import { cx, dayOffset, fmtAmount, hours, jobDriverName, nice, num, totals, vehicle } from '../lib/utils';
import { totalHours } from '../lib/steps';
import { StepTimeline } from '../components/Steps';
import type { Job } from '../types';

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
      toast('PDF-en er lastet ned.');
    } catch (e) {
      console.error(e);
      toast('PDF-en kunne ikke lages. Prøv igjen.');
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
            <label htmlFor="a-q">Søk</label>
            <input id="a-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Jobbnr, kunde, kjøreseddel, referanse …" />
          </div>
          <div className="field">
            <label htmlFor="a-c">Kunde</label>
            <select id="a-c" value={cust} onChange={e => setCust(e.target.value)}>
              <option value="">Alle kunder</option>
              {customers.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-s">Oppdragstype</label>
            <select id="a-s" value={service} onChange={e => setService(e.target.value)}>
              <option value="">Alle typer</option>
              {config.services.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-i">Fakturastatus</label>
            <select id="a-i" value={inv} onChange={e => setInv(e.target.value as Inv)}>
              <option value="open">Ikke fakturert</option>
              <option value="done">Fakturert</option>
              <option value="all">Alle</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-from">Fra dato</label>
            <input id="a-from" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-to">Til dato</label>
            <input id="a-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <div className="abar">
          <span>
            <b>{list.length}</b> av {done.length} ferdige jobber
          </span>
          <button className="link" onClick={clearFilters}>
            Nullstill filter
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
                      aria-label="Velg alle i listen"
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
                  <th>Jobb</th>
                  <th>Dato</th>
                  <th>Kunde</th>
                  <th>Ref.</th>
                  <th>Oppdrag</th>
                  <th>Masse</th>
                  <th className="n">Mengde</th>
                  <th>Deponi</th>
                  <th className="n">Timer</th>
                  <th className="n">Bilder</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map(j => (
                  <tr key={j.id} className={cx(picked.has(j.id) && 'on')} onClick={e => (e.target as HTMLElement).closest('input') || setView(j.id)}>
                    <td>
                      <input type="checkbox" aria-label={`Velg ${j.id}`} checked={picked.has(j.id)} onChange={e => toggle(j.id, e.target.checked)} />
                    </td>
                    <td className="nw">
                      <button className="link" onClick={() => setView(j.id)}>
                        {j.id}
                      </button>
                    </td>
                    <td className="nw">{nice(j.date)}</td>
                    <td>{j.customer}</td>
                    <td className="nw">{j.ref || '–'}</td>
                    <td>{j.service}</td>
                    <td>{j.massType}</td>
                    <td className="n">{fmtAmount(j)}</td>
                    <td>{j.disposal || '–'}</td>
                    <td className="n">{num(hours(j))}</td>
                    <td className="n">{j.ticketPhotos.length + j.jobPhotos.length}</td>
                    <td>
                      <span className={`pill ${j.invoiced ? 'ok' : 'warn'}`}>{j.invoiced ? 'Fakturert' : 'Ikke fakturert'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">Ingen ferdige jobber passer med filteret.</p>
          )}
        </div>
      </section>

      <aside className="card fak" aria-label="Fakturagrunnlag">
        <h2>Fakturagrunnlag</h2>
        {!sel.length ? (
          <>
            <p className="note">Huk av ferdige jobber for én kunde for å lage PDF-vedlegg til fakturaen.</p>
            {openByCustomer.length > 0 && (
              <div>
                <div className="lab" style={{ marginBottom: 6 }}>
                  Klar for fakturering
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
                      <span>{n} jobber</span>
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
            toast(`${openJob.id} er gjenåpnet og ligger hos sjåføren igjen.`);
          }}
          onToggleInvoiced={() => {
            updateJob(openJob.id, { invoiced: !openJob.invoiced, invoicedAt: openJob.invoiced ? '' : dayOffset(0) }, true);
            toast(openJob.invoiced ? `${openJob.id} er satt til ikke fakturert.` : `${openJob.id} er merket som fakturert.`);
          }}
        />
      )}
      {confirmInv && (
        <Confirm
          title="Merk som fakturert?"
          text={`${sel.length} jobber for ${selCustomers[0]} merkes som fakturert og flyttes ut av listen «Ikke fakturert».`}
          ok="Merk som fakturert"
          onClose={() => setConfirmInv(false)}
          onOk={() => {
            updateJobs(
              sel.map(j => j.id),
              { invoiced: true, invoicedAt: dayOffset(0) },
            );
            setPicked(new Set());
            toast(`${sel.length} jobber er merket som fakturert.`);
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
        <b className="fakcust">{many ? `${customers.length} kunder valgt` : customers[0]}</b>
        <small className="muted">
          {nice(sel[0].date)} – {nice(sel[sel.length - 1].date)}
        </small>
      </div>
      <dl className="sum">
        <dt>Jobber</dt>
        <dd>{sel.length}</dd>
        <dt>Timer</dt>
        <dd>{num(s.hours)}</dd>
        {Object.entries(s.amounts).map(([k, v]) => (
          <div className="sumrow" key={k}>
            <dt>{k}</dt>
            <dd>{num(v)}</dd>
          </div>
        ))}
        <dt>Bilder og kjøresedler</dt>
        <dd>{s.photos}</dd>
      </dl>
      {many && <p className="alert">Velg jobber for én kunde om gangen for å lage vedlegg.</p>}
      {sel.some(j => j.invoiced) && !many && <p className="note">Noen av de valgte jobbene er allerede fakturert.</p>}
      <button className="btn" onClick={onPdf} disabled={many || busy}>
        {busy ? 'Lager PDF …' : 'Last ned PDF-vedlegg'}
      </button>
      <button className="btn alt" onClick={onInvoiced} disabled={many}>
        Merk som fakturert
      </button>
      <button className="link" onClick={onClear}>
        Fjern valg
      </button>
      <p className="note">PDF-en har en samleside og én side per jobb med kjøreseddel og bilder.</p>
    </>
  );
}

function JobView({ j, onClose, onReopen, onToggleInvoiced }: { j: Job; onClose: () => void; onReopen: () => void; onToggleInvoiced: () => void }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const v = vehicle(j.car);
  const rows: [string, string][] = [
    ['Kunde', j.customer],
    ['Kontakt', [j.contact, j.phone].filter(Boolean).join(', ')],
    ['Kundens ref.', j.ref || '–'],
    ['Adresse', `${j.address}, ${j.place}`],
    ['Dato', nice(j.date)],
    ['Arbeidstid', j.start && j.end ? `${j.start} – ${j.end} (${num(hours(j))} t)` : '–'],
    ['Total tid', totalHours(j) ? `${j.steps.kjoring?.time} – ${j.steps.ferdig?.time ?? '…'} (${num(totalHours(j))} t, inkl. kjøring)` : '–'],
    ['Bil / sjåfør', `${v ? `${v.name} (${v.regNr})` : '–'} / ${jobDriverName(j) || '–'}`],
    ['Kjøreseddel', j.ticketNo || '–'],
    ['Masse', j.massType || '–'],
    ['Mengde', fmtAmount(j)],
    ['Deponi / mottak', j.disposal || '–'],
  ];
  if (j.decl) rows.push(['Deklarasjonsnr.', j.decl]);
  if (j.comment) rows.push(['Kommentar', j.comment]);
  if (j.invoiced) rows.push(['Fakturert', nice(j.invoicedAt)]);
  return (
    <Modal
      wide
      title={`${j.id} · ${j.service}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn alt" onClick={onReopen}>
            Gjenåpne for retting
          </button>
          <button className="btn alt" onClick={onToggleInvoiced}>
            {j.invoiced ? 'Sett til ikke fakturert' : 'Merk som fakturert'}
          </button>
          <button className="btn" onClick={onClose}>
            Lukk
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
      <div className="lab">Statuspunkter</div>
      <StepTimeline j={j} />
      <div className="lab">Kjøreseddel og bilder</div>
      <Thumbs job={j} refs={[...j.ticketPhotos, ...j.jobPhotos]} onOpen={setZoom} />
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </Modal>
  );
}
