import { useState, type FormEvent } from 'react';
import { config } from '../config';
import { AddressField, JobForm } from '../components/JobForm';
import { Confirm, Modal, Pill } from '../components/ui';
import { deleteClient, saveClient, useClients } from '../store';
import { searchAddress, type AddrHit } from '../lib/geo';
import { clientStatus } from '../lib/clientStatus';
import { toast } from '../lib/toast';
import { cx, nice, relDay } from '../lib/utils';
import type { Client, Job } from '../types';

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
      uninv: js.filter(j => j.status === 'ferdig' && !j.invoiced).length,
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
            + Ny kunde
          </button>
          <input className="sel-in" type="search" placeholder="Søk navn, org.nr, kontakt …" value={q} onChange={e => setQ(e.target.value)} aria-label="Søk i kunder" />
          <small className="muted">{clients.length} kunder i registeret</small>
        </div>
        {list.map(k => {
          const s = stats(k.id);
          const portal = config.users.some(u => u.clientId === k.id);
          return (
            <button key={k.id} className={cx('row', k.id === sel && 'sel')} onClick={() => setSel(k.id)}>
              <span className="top">
                <span>{k.name}</span>
                {s.req > 0 && <span className="pill wait">{s.req} ny bestilling</span>}
              </span>
              <small>
                {k.contact} · {k.place || '–'}
              </small>
              <small className="meta">
                <span>{s.open} åpne</span>
                {s.uninv > 0 && <span>{s.uninv} ikke fakturert</span>}
                {portal && <span className="carchip">Portal</span>}
              </small>
            </button>
          );
        })}
        {!list.length && <p className="empty">Ingen kunder passer med søket.</p>}
      </section>

      <section className="kdetail">
        {c ? (
          <ClientDetail c={c} jobs={stats(c.id).all} onEdit={() => setEdit({ c })} onOrder={() => setOrder(c)} onDelete={() => setDel(c)} openJob={openJob} />
        ) : (
          <p className="empty">Velg en kunde i listen.</p>
        )}
      </section>

      {edit && (
        <ClientForm
          c={edit.c}
          onClose={() => setEdit(null)}
          onSaved={k => {
            setEdit(null);
            setSel(k.id);
            toast(edit.c ? `${k.name} er oppdatert.` : `${k.name} er lagt til i kunderegisteret.`);
          }}
        />
      )}
      {order && (
        <JobForm
          client={order}
          onClose={() => setOrder(null)}
          onSaved={j => {
            setOrder(null);
            toast(`${j.id} er opprettet for ${j.customer}.`);
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
            toast(`${del.name} er slettet fra registeret.`);
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
  const users = config.users.filter(u => u.clientId === c.id);
  const sorted = [...jobs].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="card kcard">
      <div className="spread">
        <div>
          <h2>{c.name}</h2>
          <small className="muted">{c.orgNr ? `Org.nr ${c.orgNr}` : 'Org.nr ikke registrert'}</small>
        </div>
        <div className="btnrow">
          <button className="btn alt" onClick={onEdit}>
            Rediger
          </button>
          <button className="btn" onClick={onOrder}>
            + Nytt oppdrag
          </button>
        </div>
      </div>
      <dl className="kv">
        <dt>Kontakt</dt>
        <dd>{c.contact || '–'}</dd>
        <dt>Telefon</dt>
        <dd>{c.phone ? <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a> : '–'}</dd>
        <dt>E-post</dt>
        <dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '–'}</dd>
        <dt>Adresse</dt>
        <dd>
          {c.address || '–'}
          {c.place ? `, ${c.place}` : ''}
        </dd>
        {c.note && (
          <>
            <dt>Merknad</dt>
            <dd>{c.note}</dd>
          </>
        )}
        <dt>Kundeportal</dt>
        <dd>
          {users.length ? (
            users.map(u => (
              <span key={u.username} className="okline">
                ✓ Innlogging: {u.username} ({u.name})
              </span>
            ))
          ) : (
            <span className="muted">Ingen innlogging ennå (settes opp senere)</span>
          )}
        </dd>
      </dl>

      <h3>Oppdrag og bestillinger ({jobs.length})</h3>
      {sorted.length ? (
        <table className="ktable">
          <thead>
            <tr>
              <th>Jobb</th>
              <th>Dato</th>
              <th>Oppdrag</th>
              <th>Sted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(j => {
              const s = clientStatus(j);
              return (
                <tr key={j.id} onClick={() => !j.request && openJob(j.id)} className={j.request ? 'noclick' : ''}>
                  <td className="nw">{j.id}</td>
                  <td className="nw">{j.status === 'ferdig' ? nice(j.date) : relDay(j.date)}</td>
                  <td>
                    {j.service}
                    {j.orderedBy === 'kunde' && <small className="muted"> · via portal</small>}
                  </td>
                  <td>{j.address}</td>
                  <td>{j.request ? <span className={cx('tpill', s.tone)}>{s.label}</span> : <Pill status={j.status} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="note">Ingen oppdrag ennå.</p>
      )}
      <button className="link warnlink" onClick={onDelete} style={{ alignSelf: 'flex-start' }}>
        Slett kunde
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
    onSaved(saveClient(data, c?.id));
  };

  return (
    <Modal
      title={c ? `Rediger ${c.name}` : 'Ny kunde'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn alt" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn" type="submit" form="clientform" disabled={saving}>
            {saving ? 'Finner adresse …' : c ? 'Lagre' : 'Legg til kunde'}
          </button>
        </>
      }
    >
      <form id="clientform" className="form" onSubmit={submit}>
        <div className="two">
          <div className="field">
            <label htmlFor="c-name">Firmanavn / navn</label>
            <input id="c-name" required value={v.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-org">Org.nr</label>
            <input id="c-org" inputMode="numeric" value={v.orgNr} onChange={e => set('orgNr', e.target.value)} />
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="c-contact">Kontaktperson</label>
            <input id="c-contact" value={v.contact} onChange={e => set('contact', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-phone">Telefon</label>
            <input id="c-phone" inputMode="tel" value={v.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="c-email">E-post</label>
          <input id="c-email" type="email" value={v.email} onChange={e => set('email', e.target.value)} />
        </div>
        <AddressField value={v.address} onChange={val => setV(o => ({ ...o, address: val, lat: null, lon: null }))} onPick={pick} label="Adresse" />
        <div className="field">
          <label htmlFor="c-place">Sted</label>
          <input id="c-place" value={v.place} onChange={e => set('place', e.target.value)} />
          {v.lat != null && <small className="hint">📍 Adressen er funnet i adresseregisteret.</small>}
        </div>
        <div className="field">
          <label htmlFor="c-note">Merknad (internt)</label>
          <textarea id="c-note" rows={2} value={v.note} onChange={e => set('note', e.target.value)} placeholder="F.eks. fakturakrav, faste avtaler" />
        </div>
      </form>
    </Modal>
  );
}
