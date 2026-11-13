import { useState, type FormEvent } from 'react';
import { AddressField, JobForm } from '../components/JobForm';
import { Confirm, Modal, Pill } from '../components/ui';
import { deleteClient, portalUsers, saveClient, useClients } from '../store';
import { searchAddress, type AddrHit } from '../lib/geo';
import { clientStatus } from '../lib/clientStatus';
import { toast } from '../lib/toast';
import { cx, nice, relDay } from '../lib/utils';
import type { Client, Job } from '../types';
import { tr, trd } from '../i18n';

/*
 * Kunderegister (admin). Registrerte kunder kan få innlogging til kundeportalen og bestille selv.
 */

export function Clients({ jobs, openJob }: { jobs: Job[]; openJob: (id: string) => void }) {
  const clients = useClients();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(clients[0]?.id ?? null);
  const [edit, setEdit] = useState<{ c?: Client } | null>(null);
  const [order, setOrder] = useState<Client | null>(null);
  const [del, setDel] = useState<Client | null>(null);

  const ql = q.trim().toLowerCase();
  const stats = (id: string) => {
    const js = jobs.filter(j => j.clientId === id);
    return {
      all: js,
      req: js.filter(j => j.request === 'venter').length,
      open: js.filter(j => !j.request && j.status !== 'ferdig').length,
    };
  };
  const list = clients
    .filter(c => !ql || [c.name, c.orgNr, c.contact, c.email, c.place].join(' ').toLowerCase().includes(ql))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  const c = clients.find(x => x.id === sel);

  return (
    <div className="kunder">
      <section className="card klist">
        <div className="tools">
          <button className="btn" onClick={() => setEdit({})}>
            {tr('+ Ny kunde')}
          </button>
          <input className="sel-in" type="search" placeholder={tr('Søk navn, org.nr, kontakt …')} value={q} onChange={e => setQ(e.target.value)} aria-label={tr('Søk i kunder')} />
          <small className="muted">{tr('{n} kunder i registeret', { n: clients.length })}</small>
        </div>
        {list.map(k => {
          const s = stats(k.id);
          const portal = portalUsers(k.id).length > 0;
          return (
            <button key={k.id} className={cx('row', k.id === sel && 'sel')} onClick={() => setSel(k.id)}>
              <span className="top">
                <span>{k.name}</span>
                {s.req > 0 && <span className="pill wait">{tr('{n} ny bestilling', { n: s.req })}</span>}
              </span>
              <small>
                {k.contact} · {k.place || '–'}
              </small>
              <small className="meta">
                <span>{tr('{n} åpne', { n: s.open })}</span>
                {portal && <span className="carchip">{tr('Portal')}</span>}
              </small>
            </button>
          );
        })}
        {!list.length && <p className="empty">{tr('Ingen kunder passer med søket.')}</p>}
      </section>

      <section className="kdetail">
        {c ? (
          <ClientDetail c={c} jobs={stats(c.id).all} onEdit={() => setEdit({ c })} onOrder={() => setOrder(c)} onDelete={() => setDel(c)} openJob={openJob} />
        ) : (
          <p className="empty">{tr('Velg en kunde i listen.')}</p>
        )}
      </section>

      {edit && (
        <ClientForm
          c={edit.c}
          onClose={() => setEdit(null)}
          onSaved={k => {
            setEdit(null);
            setSel(k.id);
            toast(edit.c ? tr('{c} er oppdatert.', { c: k.name }) : tr('{c} er lagt til i kunderegisteret.', { c: k.name }));
          }}
        />
      )}
      {order && (
        <JobForm
          client={order}
          onClose={() => setOrder(null)}
          onSaved={j => {
            setOrder(null);
            toast(tr('{id} er opprettet for {c}.', { id: j.no, c: j.customer }));
          }}
        />
      )}
      {del && (
        <Confirm
          title={`Slette ${del.name}?`}
          text="Kunden fjernes fra registeret. Oppdrag og historikk beholdes, men kobles fra kunden."
          ok="Slett kunde"
          danger
          onClose={() => setDel(null)}
          onOk={() => {
            deleteClient(del.id);
            setSel(null);
            toast(tr('{c} er slettet fra registeret.', { c: del.name }));
          }}
        />
      )}
    </div>
  );
}

function ClientDetail({
  c,
  jobs,
  onEdit,
  onOrder,
  onDelete,
  openJob,
}: {
  c: Client;
  jobs: Job[];
  onEdit: () => void;
  onOrder: () => void;
  onDelete: () => void;
  openJob: (id: string) => void;
}) {
  const users = portalUsers(c.id);
  const sorted = [...jobs].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="card kcard">
      <div className="spread">
        <div>
          <h2>{c.name}</h2>
          <small className="muted">{c.orgNr ? `${tr('Org.nr')} ${c.orgNr}` : tr('Org.nr ikke registrert')}</small>
        </div>
        <div className="btnrow">
          <button className="btn alt" onClick={onEdit}>
            {tr('Rediger')}
          </button>
          <button className="btn" onClick={onOrder}>
            {tr('+ Nytt oppdrag')}
          </button>
        </div>
      </div>
      <dl className="kv">
        <dt>{tr('Kontakt')}</dt>
        <dd>{c.contact || '–'}</dd>
        <dt>{tr('Telefon')}</dt>
        <dd>{c.phone ? <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a> : '–'}</dd>
        <dt>{tr('E-post')}</dt>
        <dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '–'}</dd>
        <dt>{tr('Adresse')}</dt>
        <dd>
          {c.address || '–'}
          {c.place ? `, ${c.place}` : ''}
        </dd>
        {c.note && (
          <>
            <dt>{tr('Merknad')}</dt>
            <dd>{c.note}</dd>
          </>
        )}
        <dt>{tr('Kundeportal')}</dt>
        <dd>
          {users.length ? (
            users.map(u => (
              <span key={u} className="okline">
                {tr('✓ Innlogging:')} {u}
              </span>
            ))
          ) : (
            <span className="muted">{tr('Ingen innlogging ennå (settes opp senere)')}</span>
          )}
        </dd>
      </dl>

      <h3>{tr('Oppdrag og bestillinger')} ({jobs.length})</h3>
      {sorted.length ? (
        <table className="ktable">
          <thead>
            <tr>
              <th>{tr('Jobb')}</th>
              <th>{tr('Dato')}</th>
              <th>{tr('Oppdrag')}</th>
              <th>{tr('Sted')}</th>
              <th>{tr('Status')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(j => {
              const s = clientStatus(j);
              return (
                <tr key={j.id} onClick={() => !j.request && openJob(j.id)} className={j.request ? 'noclick' : ''}>
                  <td className="nw">{j.no}</td>
                  <td className="nw">{j.status === 'ferdig' ? nice(j.date) : relDay(j.date)}</td>
                  <td>
                    {trd(j.service)}
                    {j.orderedBy === 'kunde' && <small className="muted">{' '}{tr('· via portal')}</small>}
                  </td>
                  <td>{j.address}</td>
                  <td>{j.request ? <span className={cx('tpill', s.tone)}>{s.label}</span> : <Pill status={j.status} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="note">{tr('Ingen oppdrag ennå.')}</p>
      )}
      <button className="link warnlink" onClick={onDelete} style={{ alignSelf: 'flex-start' }}>
        {tr('Slett kunde')}
      </button>
    </div>
  );
}

function ClientForm({ c, onClose, onSaved }: { c?: Client; onClose: () => void; onSaved: (c: Client) => void }) {
  const [v, setV] = useState<Omit<Client, 'id'>>(
    c ?? { name: '', orgNr: '', contact: '', phone: '', email: '', address: '', place: '', lat: null, lon: null, note: '' },
  );
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Omit<Client, 'id'>>(k: K, val: Omit<Client, 'id'>[K]) => setV(o => ({ ...o, [k]: val }));
  const pick = (h: AddrHit) => setV(o => ({ ...o, address: h.text, place: h.place, lat: h.lat, lon: h.lon }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let data = v;
    // adresse skrevet uten å velge fra listen: prøv å finne posisjon
    if (data.address && (data.lat == null || (c && c.address !== data.address && c.lat === data.lat))) {
      setSaving(true);
      try {
        const h = (await searchAddress(data.place ? `${data.address}, ${data.place}` : data.address))[0];
        if (h) data = { ...data, lat: h.lat, lon: h.lon, place: data.place || h.place };
      } catch {
        /* uten nett: lagres uten posisjon */
      }
      setSaving(false);
    }
    setSaving(true);
    onSaved(await saveClient(data, c?.id));
  };

  return (
    <Modal
      title={c ? tr('Rediger {id}', { id: c.name }) : tr('Ny kunde')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn alt" onClick={onClose}>
            {tr('Avbryt')}
          </button>
          <button className="btn" type="submit" form="clientform" disabled={saving}>
            {saving ? tr('Finner adresse …') : c ? tr('Lagre') : tr('Legg til kunde')}
          </button>
        </>
      }
    >
      <form id="clientform" className="form" onSubmit={submit}>
        <div className="two">
          <div className="field">
            <label htmlFor="c-name">{tr('Firmanavn / navn')}</label>
            <input id="c-name" required value={v.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-org">{tr('Org.nr')}</label>
            <input id="c-org" inputMode="numeric" value={v.orgNr} onChange={e => set('orgNr', e.target.value)} />
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="c-contact">{tr('Kontaktperson')}</label>
            <input id="c-contact" value={v.contact} onChange={e => set('contact', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-phone">{tr('Telefon')}</label>
            <input id="c-phone" inputMode="tel" value={v.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="c-email">{tr('E-post')}</label>
          <input id="c-email" type="email" value={v.email} onChange={e => set('email', e.target.value)} />
        </div>
        <AddressField value={v.address} onChange={val => setV(o => ({ ...o, address: val, lat: null, lon: null }))} onPick={pick} label={tr('Adresse')} />
        <div className="field">
          <label htmlFor="c-place">{tr('Sted')}</label>
          <input id="c-place" value={v.place} onChange={e => set('place', e.target.value)} />
          {v.lat != null && <small className="hint">{tr('📍 Adressen er funnet i adresseregisteret.')}</small>}
        </div>
        <div className="field">
          <label htmlFor="c-note">{tr('Merknad (internt)')}</label>
          <textarea id="c-note" rows={2} value={v.note} onChange={e => set('note', e.target.value)} placeholder={tr('F.eks. fakturakrav, faste avtaler')} />
        </div>
      </form>
    </Modal>
  );
}
