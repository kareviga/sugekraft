import { useEffect, useMemo, useState } from 'react';
import { Lightbox, Modal, Thumbs } from '../components/ui';
import { StepTimeline } from '../components/Steps';
import { Icon } from '../components/Icon';
import { updateJob } from '../store';
import { toast } from '../lib/toast';
import { cx, fmtAmount, hours, jobDriverName, nice, num, totals, vehicle } from '../lib/utils';
import { totalHours } from '../lib/steps';
import type { Job } from '../types';
import { tr, trd } from '../i18n';

/*
 * Rapporter: PDF-oppsummering av utførte jobber, som kunden kan legge ved sin egen faktura.
 * Velg én jobb eller flere jobber for samme kunde og last ned PDF.
 */

export interface ArchivePreset {
  customer: string;
  pick?: string;
  n: number; // endres for å trigge
}

async function downloadPdf(list: Job[]) {
  try {
    const { buildReportPdf } = await import('../lib/pdf');
    const { doc, filename } = await buildReportPdf(list);
    doc.save(filename);
    toast(tr('PDF-en er lastet ned.'));
  } catch (e) {
    console.error(e);
    toast(tr('PDF-en kunne ikke lages. Prøv igjen.'));
  }
}

export function Archive({ jobs, preset }: { jobs: Job[]; preset: ArchivePreset | null }) {
  const done = useMemo(() => jobs.filter(j => j.status === 'ferdig'), [jobs]);
  const customers = useMemo(() => [...new Set(done.map(j => j.customer))].sort((a, b) => a.localeCompare(b, 'nb')), [done]);

  const [q, setQ] = useState('');
  const [cust, setCust] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [view, setView] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // forhåndsvalg når man kommer fra en jobb
  useEffect(() => {
    if (!preset) return;
    setCust(preset.customer);
    setQ('');
    setFrom('');
    setTo('');
    if (preset.pick) setView(preset.pick);
  }, [preset]);

  const ql = q.trim().toLowerCase();
  const list = done
    .filter(
      j =>
        (!cust || j.customer === cust) &&
        (!from || j.date >= from) &&
        (!to || j.date <= to) &&
        (!ql || [j.no, j.customer, j.ref, j.ticketNo, j.address, j.place].join(' ').toLowerCase().includes(ql)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));

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
  const filtered = !!(q || cust || from || to);
  const openJob = done.find(j => j.id === view);

  const byCustomer = useMemo(() => {
    const m: Record<string, number> = {};
    list.forEach(j => (m[j.customer] = (m[j.customer] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [list]);

  const makePdf = async (l: Job[]) => {
    setBusy(true);
    await downloadPdf(l);
    setBusy(false);
  };

  return (
    <div className="arkiv">
      <div className="pagehead">
        <h2>{tr('Rapporter')}</h2>
        <p className="muted">{tr('Lag en PDF-oppsummering av utførte jobber – til å legge ved kundens faktura.')}</p>
      </div>
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
                  {c}
                </option>
              ))}
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
            <b>{list.length}</b> {tr('utførte jobber')}
          </span>
          {filtered && (
            <button
              className="link"
              onClick={() => {
                setQ('');
                setCust('');
                setFrom('');
                setTo('');
              }}
            >
              {tr('Nullstill filter')}
            </button>
          )}
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
                  <th>{tr('Oppdrag')}</th>
                  <th className="n">{tr('Mengde')}</th>
                  <th className="n">{tr('Timer')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map(j => (
                  <tr key={j.id} className={cx(picked.has(j.id) && 'on')} onClick={e => (e.target as HTMLElement).closest('input') || setView(j.id)}>
                    <td>
                      <input type="checkbox" aria-label={tr('Velg {id}', { id: j.no })} checked={picked.has(j.id)} onChange={e => toggle(j.id, e.target.checked)} />
                    </td>
                    <td className="nw">
                      <button className="link" onClick={() => setView(j.id)}>
                        {j.no}
                      </button>
                    </td>
                    <td className="nw">{nice(j.date)}</td>
                    <td>{j.customer}</td>
                    <td>{trd(j.service)}</td>
                    <td className="n">{fmtAmount(j)}</td>
                    <td className="n">{num(hours(j))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">{tr('Ingen utførte jobber passer med filteret.')}</p>
          )}
        </div>
      </section>

      <aside className="card fak" aria-label={tr('PDF-rapport')}>
        <h2>{tr('PDF-rapport')}</h2>
        {!sel.length ? (
          <>
            <p className="note">{tr('Huk av jobbene som skal være med, eller velg en kunde:')}</p>
            {byCustomer.length > 0 && (
              <ul className="quick">
                {byCustomer.map(([c, n]) => (
                  <li key={c}>
                    <button
                      className="link"
                      onClick={() => {
                        setCust(c);
                        setPicked(new Set(list.filter(j => j.customer === c).map(j => j.id)));
                      }}
                    >
                      {c}
                    </button>
                    <span>{tr('{n} jobber', { n })}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <SelPanel sel={sel} customers={selCustomers} busy={busy} onPdf={() => void makePdf(sel)} onClear={() => setPicked(new Set())} />
        )}
      </aside>

      {openJob && (
        <JobView
          j={openJob}
          onClose={() => setView(null)}
          onPdf={() => void downloadPdf([openJob])}
          onReopen={() => {
            updateJob(openJob.id, { status: 'aktiv', closedAt: '' }, true);
            toggle(openJob.id, false);
            setView(null);
            toast(tr('{id} er gjenåpnet og ligger hos sjåføren igjen.', { id: openJob.no }));
          }}
        />
      )}
    </div>
  );
}

function SelPanel({ sel, customers, busy, onPdf, onClear }: { sel: Job[]; customers: string[]; busy: boolean; onPdf: () => void; onClear: () => void }) {
  const many = customers.length > 1;
  const s = totals(sel);
  return (
    <>
      <div>
        <b className="fakcust">{many ? tr('{n} kunder valgt', { n: customers.length }) : customers[0]}</b>
        <small className="muted">
          {sel.length === 1 ? nice(sel[0].date) : `${nice(sel[0].date)} – ${nice(sel[sel.length - 1].date)}`}
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
      </dl>
      {many && <p className="alert">{tr('Velg jobber for én kunde om gangen.')}</p>}
      <button className="btn big" onClick={onPdf} disabled={many || busy}>
        <Icon name="invoice" size={20} /> {busy ? tr('Lager PDF …') : tr('Last ned PDF')}
      </button>
      <button className="link" onClick={onClear}>
        {tr('Fjern valg')}
      </button>
      <p className="note">{tr('PDF-en har en samleside og én side per jobb med kjøreseddel og bilder.')}</p>
    </>
  );
}

function JobView({ j, onClose, onPdf, onReopen }: { j: Job; onClose: () => void; onPdf: () => void; onReopen: () => void }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const v = vehicle(j.car);
  const rows: [string, string][] = [
    [tr('Kunde'), j.customer],
    [tr('Kundens ref.'), j.ref || '–'],
    [tr('Adresse'), `${j.address}${j.place ? `, ${j.place}` : ''}`],
    [tr('Dato'), nice(j.date)],
    [tr('Arbeidstid'), j.start && j.end ? `${j.start} – ${j.end} (${num(hours(j))} t)` : '–'],
    [tr('Total tid'), totalHours(j) ? `${j.steps.kjoring?.time} – ${j.steps.ferdig?.time ?? '…'} (${num(totalHours(j))} ${tr('t, inkl. kjøring')})` : '–'],
    [tr('Bil / sjåfør'), `${v ? v.name : '–'} / ${jobDriverName(j) || '–'}`],
    [tr('Masse'), j.massType ? `${trd(j.massType)} · ${fmtAmount(j)}` : '–'],
    [tr('Deponi / mottak'), trd(j.disposal) || '–'],
    [tr('Kjøreseddel'), j.ticketNo || '–'],
  ];
  if (j.decl) rows.push([tr('Deklarasjonsnr.'), j.decl]);
  if (j.comment) rows.push([tr('Kommentar'), j.comment]);
  return (
    <Modal
      wide
      title={`${j.no} · ${trd(j.service)}`}
      onClose={onClose}
      footer={
        <>
          <button className="link reopen" onClick={onReopen}>
            {tr('Gjenåpne for retting')}
          </button>
          <button className="btn alt" onClick={onClose}>
            {tr('Lukk')}
          </button>
          <button className="btn" onClick={onPdf}>
            {tr('Last ned PDF')}
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
