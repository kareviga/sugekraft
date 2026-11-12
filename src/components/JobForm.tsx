import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { config } from '../config';
import { allJobs, saveOrder } from '../store';
import { meters, nearestAddress, searchAddress, type AddrHit } from '../lib/geo';
import { dayOffset, fmtCoord } from '../lib/utils';
import type { Job, JobOrder } from '../types';
import { PinPicker, type Pos } from './PinPicker';
import { Modal } from './ui';

type Form = Omit<JobOrder, 'lat' | 'lon' | 'pin'>;

export function JobForm({ job, onClose, onSaved }: { job?: Job; onClose: () => void; onSaved: (j: Job) => void }) {
  const [v, setV] = useState<Form>(() =>
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
          place: '',
          service: config.services[0],
          ref: '',
          date: dayOffset(1),
          time: '08:00',
          car: '',
          note: '',
          urgent: false,
        },
  );
  const [pos, setPos] = useState<Pos | null>(job ? { lat: job.lat, lon: job.lon } : null);
  const [pin, setPin] = useState<'adresse' | 'kart'>(job?.pin ?? 'adresse');
  const [focusKey, setFocusKey] = useState(0);
  const [near, setNear] = useState<(AddrHit & { dist: number }) | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  // kjente kunder og steder, for autoutfylling
  const { customers, places } = useMemo(() => {
    const m = new Map<string, Job>();
    const p = new Set<string>();
    allJobs().forEach(j => {
      m.set(j.customer, j);
      if (j.place) p.add(j.place);
    });
    return { customers: m, places: [...p].sort((a, b) => a.localeCompare(b, 'nb')) };
  }, []);

  const set = <K extends keyof Form>(k: K, val: Form[K]) => setV(o => ({ ...o, [k]: val }));
  const setCustomer = (name: string) => {
    const known = customers.get(name);
    setV(o => (known && !job ? { ...o, customer: name, contact: o.contact || known.contact, phone: o.phone || known.phone } : { ...o, customer: name }));
  };

  const fromAddress = (h: AddrHit) => {
    setV(o => ({ ...o, address: h.text, place: h.place }));
    setPos({ lat: h.lat, lon: h.lon });
    setPin('adresse');
    setNear(null);
    setErr('');
    setFocusKey(k => k + 1);
  };

  // manuelt plassert: finn nærmeste adresse som forslag
  const nearAbort = useRef<AbortController | null>(null);
  const fromMap = (p: Pos) => {
    setPos(p);
    setPin('kart');
    setErr('');
    nearAbort.current?.abort();
    const ac = (nearAbort.current = new AbortController());
    nearestAddress(p.lat, p.lon, ac.signal)
      .then(h => !ac.signal.aborted && setNear(h))
      .catch(() => !ac.signal.aborted && setNear(null));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let p = pos, how = pin, place = v.place.trim();
    if (!p) {
      // ingen nål ennå: prøv å slå opp det som er skrevet
      setSaving(true);
      try {
        const h = v.address ? (await searchAddress(v.place ? `${v.address}, ${v.place}` : v.address))[0] : undefined;
        if (h && meters(h, { lat: config.map.center[0], lon: config.map.center[1] }) < 150000) {
          p = { lat: h.lat, lon: h.lon };
          how = 'adresse';
          if (!place) place = h.place;
        }
      } catch {
        /* ingen nett – faller gjennom til feilmelding */
      }
      setSaving(false);
      if (!p) {
        setErr('Jobben mangler plassering. Velg en adresse fra listen, eller klikk i kartet der jobben er.');
        return;
      }
    }
    onSaved(saveOrder({ ...v, place, lat: p.lat, lon: p.lon, pin: how }, job?.id));
  };

  return (
    <Modal
      wide
      title={job ? `Rediger ${job.id}` : 'Ny jobb'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn alt" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn" type="submit" form="jobform" disabled={saving}>
            {saving ? 'Finner adresse …' : job ? 'Lagre endringer' : 'Opprett jobb'}
          </button>
        </>
      }
    >
      <form id="jobform" className="form jobform" onSubmit={submit}>
        <div className="formcols">
          <div className="form">
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
            <div className="two">
              <div className="field">
                <label htmlFor="f-date">Dato</label>
                <input id="f-date" type="date" required value={v.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="f-time">Oppmøte</label>
                <input id="f-time" type="time" value={v.time} onChange={e => set('time', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-car">Bil / sjåfør</label>
              <select id="f-car" value={v.car} onChange={e => set('car', e.target.value)}>
                <option value="">Ikke tildelt ennå</option>
                {config.vehicles.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} – {c.type} ({c.driver})
                  </option>
                ))}
              </select>
              <small className="hint">{v.car ? 'Jobben blir Aktiv og vises hos sjåføren.' : 'Uten bil ligger jobben som Kommende til den tildeles.'}</small>
            </div>
            <div className="field">
              <label htmlFor="f-note">Beskjed til sjåfør</label>
              <textarea id="f-note" rows={2} value={v.note} onChange={e => set('note', e.target.value)} placeholder="Adkomst, nøkler, koder, kontakt på stedet …" />
            </div>
            <label className="chk">
              <input type="checkbox" checked={v.urgent} onChange={e => set('urgent', e.target.checked)} /> Hasteoppdrag
            </label>
          </div>

          <div className="form">
            <AddressField value={v.address} onChange={val => set('address', val)} onPick={fromAddress} />
            <div className="field">
              <label htmlFor="f-place">Sted</label>
              <input id="f-place" list="places" value={v.place} onChange={e => set('place', e.target.value)} placeholder="F.eks. Oslo, Sørkedalen, byggefelt nord" autoComplete="off" />
              <datalist id="places">
                {places.map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <span className="lab">Plassering i kart</span>
              <PinPicker pos={pos} onPick={fromMap} focusKey={focusKey} />
              {pos ? (
                <small className="hint">
                  {pin === 'adresse' ? '📍 Plassert fra adresseregisteret.' : '📍 Plassert manuelt.'} Dra nålen eller klikk i kartet for å justere. ({fmtCoord(pos)})
                </small>
              ) : (
                <small className="hint">Velg en adresse fra listen, eller klikk i kartet hvis stedet ikke har adresse.</small>
              )}
              {pin === 'kart' && near && near.text !== v.address && (
                <div className="near">
                  <span>
                    Nærmeste adresse: <b>{near.text}</b>, {near.place} <span className="muted">({Math.round(near.dist)} m unna)</span>
                  </span>
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      setV(o => ({ ...o, address: near.text, place: o.place || near.place }));
                      setNear(null);
                    }}
                  >
                    Bruk som adresse
                  </button>
                </div>
              )}
              {err && <p className="alert">{err}</p>}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Adressefelt med forslag fra Kartverkets adresseregister. Fri tekst er også lov. */
function AddressField({ value, onChange, onPick }: { value: string; onChange: (v: string) => void; onPick: (h: AddrHit) => void }) {
  const [hits, setHits] = useState<AddrHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const typed = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!typed.current) return;
    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      setState('loading');
      try {
        const h = await searchAddress(value, ac.signal);
        if (ac.signal.aborted) return;
        setHits(h);
        setActive(-1);
        setOpen(document.activeElement === input.current);
        setState('idle');
      } catch {
        if (!ac.signal.aborted) setState('error');
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [value]);

  const choose = (h: AddrHit) => {
    typed.current = false;
    setOpen(false);
    onPick(h);
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => (a + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => (a <= 0 ? hits.length - 1 : a - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(hits[active]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  };
  const showList = open && value.trim().length >= 3;

  return (
    <div className="field addr">
      <label htmlFor="f-address">Adresse eller beskrivelse</label>
      <input
        id="f-address"
        ref={input}
        role="combobox"
        aria-expanded={showList}
        aria-controls="addr-list"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `addr-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder="Begynn å skrive, f.eks. Strømsveien 266"
        onChange={e => {
          typed.current = true;
          onChange(e.target.value);
        }}
        onKeyDown={key}
        onFocus={() => hits.length && setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {state === 'loading' && <span className="addrspin" aria-hidden="true" />}
      {showList && (
        <ul id="addr-list" role="listbox" className="addrlist">
          {hits.map((h, i) => (
            <li
              id={`addr-${i}`}
              key={h.text + h.postnr}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'on' : ''}
              onMouseDown={e => {
                e.preventDefault();
                choose(h);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <b>{h.text}</b>
              <span>
                {h.postnr} {h.place}
                {h.kommune && h.kommune !== h.place ? ` · ${h.kommune}` : ''}
              </span>
            </li>
          ))}
          {!hits.length && <li className="none">Ingen treff i adresseregisteret. Behold teksten som beskrivelse og klikk i kartet for å plassere jobben.</li>}
        </ul>
      )}
      {state === 'error' && <small className="hint warntext">Adressesøket svarer ikke. Plasser jobben ved å klikke i kartet.</small>}
    </div>
  );
}
