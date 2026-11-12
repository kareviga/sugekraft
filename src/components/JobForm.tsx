import { useMemo, useState, type FormEvent } from 'react';
import { config } from '../config';
import { allJobs, saveOrder } from '../store';
import { dayOffset } from '../lib/utils';
import type { Job, JobOrder } from '../types';
import { Modal } from './ui';

export function JobForm({ job, onClose, onSaved }: { job?: Job; onClose: () => void; onSaved: (j: Job) => void }) {
  const [v, setV] = useState<JobOrder>(() =>
    job
      ? {
          customer: job.customer,
          contact: job.contact,
          phone: job.phone,
          address: job.address,
          place: job.place,
          service: job.service,
          ref: job.ref,
          date: job.date,
          time: job.time,
          car: job.car,
          note: job.note,
          urgent: job.urgent,
        }
      : {
          customer: '',
          contact: '',
          phone: '',
          address: '',
          place: Object.keys(config.map.places)[0],
          service: config.services[0],
          ref: '',
          date: dayOffset(1),
          time: '08:00',
          car: '',
          note: '',
          urgent: false,
        },
  );

  // kjente kunder med siste kontaktinfo, for autoutfylling
  const customers = useMemo(() => {
    const m = new Map<string, Job>();
    allJobs().forEach(j => m.set(j.customer, j));
    return m;
  }, []);

  const set = <K extends keyof JobOrder>(k: K, val: JobOrder[K]) => setV(o => ({ ...o, [k]: val }));
  const setCustomer = (name: string) => {
    const known = customers.get(name);
    setV(o => (known && !job ? { ...o, customer: name, contact: o.contact || known.contact, phone: o.phone || known.phone } : { ...o, customer: name }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSaved(saveOrder(v, job?.id));
  };

  return (
    <Modal
      title={job ? `Rediger ${job.id}` : 'Ny jobb'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn alt" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn" type="submit" form="jobform">
            {job ? 'Lagre endringer' : 'Opprett jobb'}
          </button>
        </>
      }
    >
      <form id="jobform" className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="f-customer">Kunde</label>
          <input id="f-customer" list="custs" required value={v.customer} onChange={e => setCustomer(e.target.value)} autoComplete="off" />
          <datalist id="custs">
            {[...customers.keys()].sort().map(c => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="f-contact">Kontaktperson</label>
            <input id="f-contact" value={v.contact} onChange={e => set('contact', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-phone">Telefon</label>
            <input id="f-phone" inputMode="tel" value={v.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="f-address">Adresse</label>
            <input id="f-address" required value={v.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-place">Sted</label>
            <select id="f-place" value={v.place} onChange={e => set('place', e.target.value)}>
              {Object.keys(config.map.places).map(p => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="f-service">Oppdragstype</label>
            <select id="f-service" value={v.service} onChange={e => set('service', e.target.value)}>
              {config.services.map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-ref">Kundens referanse / PO</label>
            <input id="f-ref" value={v.ref} onChange={e => set('ref', e.target.value)} />
          </div>
        </div>
        <div className="three">
          <div className="field">
            <label htmlFor="f-date">Dato</label>
            <input id="f-date" type="date" required value={v.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-time">Oppmøte</label>
            <input id="f-time" type="time" value={v.time} onChange={e => set('time', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-car">Bil</label>
            <select id="f-car" value={v.car} onChange={e => set('car', e.target.value)}>
              <option value="">Ikke tildelt</option>
              {config.vehicles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.driver.split(' ')[0]})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-note">Beskjed til sjåfør</label>
          <textarea id="f-note" rows={2} value={v.note} onChange={e => set('note', e.target.value)} placeholder="Adkomst, nøkler, koder, kontakt på stedet …" />
        </div>
        <label className="chk">
          <input type="checkbox" checked={v.urgent} onChange={e => set('urgent', e.target.checked)} /> Hasteoppdrag
        </label>
      </form>
    </Modal>
  );
}
