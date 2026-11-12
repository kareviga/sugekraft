import { useState } from 'react';
import { config } from '../config';
import { JobForm } from '../components/JobForm';
import { JobMap } from '../components/JobMap';
import { StepTimeline } from '../components/Steps';
import { Confirm, Lightbox, Modal, Thumbs } from '../components/ui';
import { deleteJob, getClient, useClients } from '../store';
import { clientStatus, type Tone } from '../lib/clientStatus';
import { toast } from '../lib/toast';
import { cx, fmtAmount, nice, relDay } from '../lib/utils';
import type { Job } from '../types';

/*
 * Kundeportalen: kunden ser sine bestillinger og oppdrag, og kan bestille nye.
 * Bestillinger sendes til kontoret for godkjenning.
 */

const TABS: [string, string, (t: Tone) => boolean][] = [
  ['open', 'Pågående og planlagte', t => t !== 'done' && t !== 'no'],
  ['done', 'Utførte', t => t === 'done'],
  ['no', 'Avviste', t => t === 'no'],
];

export function ClientPortal({ jobs, clientId }: { jobs: Job[]; clientId: string }) {
  useClients();
  const client = getClient(clientId);
  const [tab, setTab] = useState('open');
  const [form, setForm] = useState<{ job?: Job } | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [withdraw, setWithdraw] = useState<Job | null>(null);

  if (!client) return <p className="empty">Brukeren er ikke koblet til en kunde i registeret.</p>;

  const mine = jobs.filter(j => j.clientId === clientId);
  const withStatus = mine.map(j => ({ j, s: clientStatus(j) }));
  const count = (f: (t: Tone) => boolean) => withStatus.filter(x => f(x.s.tone)).length;
  const filt = TABS.find(t => t[0] === tab)![2];
  const list = withStatus
    .filter(x => filt(x.s.tone))
    .sort((a, b) => (tab === 'open' ? a.j.date.localeCompare(b.j.date) : b.j.date.localeCompare(a.j.date)));
  const open = mine.find(j => j.id === view);

  const kpis: [string, Tone][] = [
    ['Venter på godkjenning', 'wait'],
    ['Bekreftet / planlagt', 'plan'],
    ['Pågår nå', 'run'],
    ['Utført', 'done'],
  ];
  const kpiCount = (t: Tone) => (t === 'plan' ? count(x => x === 'plan' || x === 'ok') : count(x => x === t));

  return (
    <div className="portal">
      <section className="portalhead">
        <div>
          <span className="muted">Kundeportal</span>
          <h2>{client.name}</h2>
          <small className="muted">
            {client.contact} · {client.phone} · {client.email}
          </small>
        </div>
        <button className="btn big newbtn" onClick={() => setForm({})}>
          + Ny bestilling
        </button>
      </section>

      <div className="bp-kpis">
        {kpis.map(([l, t]) => (
          <div key={t} className="kpi">
            <b>{kpiCount(t)}</b>
            <span>
              <i className={cx('tone', t)} /> {l}
            </span>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="ptabs" role="tablist">
          {TABS.map(([k, l, f]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {l} <span>{count(f)}</span>
            </button>
          ))}
        </div>
        {list.length ? (
          <ul className="orders">
            {list.map(({ j, s }) => (
              <li key={j.id}>
                <button className="order" onClick={() => setView(j.id)}>
                  <span className={cx('tonebar', s.tone)} />
                  <div className="otext">
                    <b>{j.service}</b>
                    <small>
                      {j.address}
                      {j.place ? `, ${j.place}` : ''}
                    </small>
                    <small className="muted">
                      {relDay(j.date)} {j.time ? `kl. ${j.time}` : ''} · {j.id}
                      {j.ref ? ` · ref. ${j.ref}` : ''}
                    </small>
                  </div>
                  <div className="ostat">
                    <span className={cx('tpill', s.tone)}>{s.label}</span>
                    <small>{s.tone === 'no' ? 'Se begrunnelse' : s.detail}</small>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">{tab === 'open' ? 'Ingen åpne bestillinger. Trykk «Ny bestilling» for å bestille.' : 'Ingenting her ennå.'}</p>
        )}
      </section>

      <p className="note portalfoot">
        Spørsmål? Ring {config.company.name} på {config.company.phone} eller send e-post til {config.company.email}.
      </p>

      {form && (
        <JobForm
          mode="client"
          client={client}
          job={form.job}
          onClose={() => setForm(null)}
          onSaved={j => {
            setForm(null);
            setTab('open');
            toast(form.job ? 'Bestillingen er oppdatert.' : `Takk! Bestilling ${j.id} er sendt til ${config.company.name}.`);
          }}
        />
      )}
      {open && (
        <OrderView
          j={open}
          onClose={() => setView(null)}
          onEdit={() => {
            setView(null);
            setForm({ job: open });
          }}
          onWithdraw={() => setWithdraw(open)}
          onReorder={() => {
            setView(null);
            setForm({});
          }}
        />
      )}
      {withdraw && (
        <Confirm
          title="Trekke tilbake bestillingen?"
          text={`${withdraw.service} ${nice(withdraw.date)} slettes.`}
          ok="Trekk tilbake"
          danger
          onClose={() => setWithdraw(null)}
          onOk={() => {
            deleteJob(withdraw.id);
            setView(null);
            toast('Bestillingen er trukket tilbake.');
          }}
        />
      )}
    </div>
  );
}

function OrderView({ j, onClose, onEdit, onWithdraw, onReorder }: { j: Job; onClose: () => void; onEdit: () => void; onWithdraw: () => void; onReorder: () => void }) {
  const s = clientStatus(j);
  const [zoom, setZoom] = useState<string | null>(null);
  const pending = j.request === 'venter';
  return (
    <Modal
      wide
      title={`${j.service} · ${j.id}`}
      onClose={onClose}
      footer={
        <>
          {pending && (
            <>
              <button className="btn alt danger" onClick={onWithdraw}>
                Trekk tilbake
              </button>
              <button className="btn alt" onClick={onEdit}>
                Endre bestilling
              </button>
            </>
          )}
          {j.request === 'avvist' && (
            <button className="btn alt" onClick={onReorder}>
              Bestill på nytt
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Lukk
          </button>
        </>
      }
    >
      <div className={cx('statusbanner', s.tone)}>
        <b>{s.label}</b>
        <span>{s.detail}</span>
      </div>
      <div className="formcols">
        <dl className="kv">
          <dt>Sted</dt>
          <dd>
            {j.address}
            {j.place ? `, ${j.place}` : ''}
          </dd>
          <dt>{j.status === 'ferdig' ? 'Utført' : 'Dato'}</dt>
          <dd>
            {nice(j.date)}
            {j.time ? ` kl. ${j.time}` : ''}
          </dd>
          <dt>Referanse</dt>
          <dd>{j.ref || '–'}</dd>
          <dt>Kontakt</dt>
          <dd>
            {j.contact} {j.phone}
          </dd>
          {j.note && (
            <>
              <dt>Beskrivelse</dt>
              <dd>{j.note}</dd>
            </>
          )}
          {j.status === 'ferdig' && (
            <>
              <dt>Masse</dt>
              <dd>
                {j.massType || '–'} · {fmtAmount(j)}
              </dd>
              <dt>Levert til</dt>
              <dd>{j.disposal || '–'}</dd>
              <dt>Kjøreseddel</dt>
              <dd>{j.ticketNo || '–'}</dd>
            </>
          )}
          <dt>Bestilt</dt>
          <dd>
            {j.orderedBy === 'kunde' ? 'Via portalen' : `Av ${config.company.name}`}
            {j.orderedAt ? `, ${nice(j.orderedAt.slice(0, 10))} ${j.orderedAt.slice(11)}` : ''}
          </dd>
        </dl>
        <div className="locmap portalmap">
          <JobMap jobs={[j]} selectedId={j.id} onSelect={() => undefined} fitKey={`p${j.id}`} maxFitZoom={15} compact />
        </div>
      </div>
      {(j.steps.kjoring || j.status === 'ferdig') && (
        <>
          <div className="lab">Fremdrift</div>
          <StepTimeline j={j} />
        </>
      )}
      {j.status === 'ferdig' && j.ticketPhotos.length + j.jobPhotos.length > 0 && (
        <>
          <div className="lab">Kjøreseddel og bilder</div>
          <Thumbs job={j} refs={[...j.ticketPhotos, ...j.jobPhotos]} onOpen={setZoom} />
        </>
      )}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </Modal>
  );
}
