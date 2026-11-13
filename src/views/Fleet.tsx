import { useState, type FormEvent } from 'react';
import type { Vehicle } from '../config';
import { Confirm, Modal } from '../components/ui';
import { removeVehicle, saveVehicle, useVehicles } from '../store';
import { VSTATE_LABEL, vehicleStatus } from '../lib/fleet';
import { toast } from '../lib/toast';
import { cx } from '../lib/utils';
import type { Job } from '../types';
import { tr, trd } from '../i18n';

/*
 * Bilpark: oversikt over firmaets biler. Legg til nye biler og ta biler ut av flåten.
 * Status (på oppdrag / har jobber i dag / ledig) og hvem som kjører, kommer fra jobbene.
 */

export function Fleet({ jobs, openJob }: { jobs: Job[]; openJob: (id: string) => void }) {
  const all = useVehicles();
  const vehicles = all.filter(v => v.active !== false);
  const [form, setForm] = useState<{ v?: Vehicle } | null>(null);
  const [remove, setRemove] = useState<Vehicle | null>(null);

  return (
    <div className="bilpark">
      <div className="pagehead spread">
        <div>
          <h2>{tr('Bilpark')}</h2>
          <p className="muted">{tr('{n} biler i flåten', { n: vehicles.length })}</p>
        </div>
        <button className="btn" onClick={() => setForm({})}>
          {tr('+ Legg til bil')}
        </button>
      </div>

      <section className="card bp-table">
        {vehicles.length ? (
          <table>
            <thead>
              <tr>
                <th>{tr('Bil')}</th>
                <th>{tr('Reg.nr.')}</th>
                <th>{tr('Status')}</th>
                <th>{tr('I bilen nå')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => {
                const s = vehicleStatus(v, jobs);
                return (
                  <tr key={v.id} className="vrow2">
                    <td>
                      <span className="vname">
                        <span className={cx('fleet-tag', s.state)}>{v.tag}</span>
                        <span>
                          <b>{v.name}</b>
                          <small className="muted">{trd(v.type)}</small>
                        </span>
                      </span>
                    </td>
                    <td className="nw">{v.regNr || '–'}</td>
                    <td>
                      {s.active ? (
                        <button className="link" onClick={() => openJob(s.active!.id)}>
                          <span className={cx('vstate', s.state)}>{tr(VSTATE_LABEL[s.state])}</span>
                        </button>
                      ) : (
                        <span className={cx('vstate', s.state)}>{tr(VSTATE_LABEL[s.state])}</span>
                      )}
                    </td>
                    <td>{s.nowDriver || <span className="muted">–</span>}</td>
                    <td className="n nw">
                      <button className="link" onClick={() => setForm({ v })}>
                        {tr('Rediger')}
                      </button>
                      <button className="link warnlink" style={{ marginLeft: 16 }} onClick={() => setRemove(v)}>
                        {tr('Fjern')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="empty">{tr('Ingen biler ennå. Trykk «Legg til bil».')}</p>
        )}
      </section>

      {form && (
        <VehicleForm
          v={form.v}
          onClose={() => setForm(null)}
          onSaved={v => {
            setForm(null);
            toast(form.v ? tr('{v} er oppdatert.', { v: v.name }) : tr('{v} er lagt til i bilparken.', { v: v.name }));
          }}
        />
      )}
      {remove && (
        <Confirm
          title={tr('Fjerne {v} fra bilparken?', { v: remove.name })}
          text={tr('Bilen kan ikke lenger velges på nye jobber. Tidligere jobber og rapporter beholder bilen.')}
          ok={tr('Fjern bil')}
          danger
          onClose={() => setRemove(null)}
          onOk={() => {
            removeVehicle(remove.id);
            toast(tr('{v} er fjernet fra bilparken.', { v: remove.name }));
          }}
        />
      )}
    </div>
  );
}

function VehicleForm({ v, onClose, onSaved }: { v?: Vehicle; onClose: () => void; onSaved: (v: Vehicle) => void }) {
  const vehicles = useVehicles();
  const [name, setName] = useState(v?.name ?? `${tr('Bil')} ${vehicles.length + 1}`);
  const [type, setType] = useState(v?.type ?? '');
  const [regNr, setRegNr] = useState(v?.regNr ?? '');
  const [saving, setSaving] = useState(false);
  const types = [...new Set(vehicles.map(x => x.type).filter(Boolean))];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    onSaved(await saveVehicle({ name: name.trim(), type: type.trim(), regNr: regNr.trim().toUpperCase() }, v?.id));
  };

  return (
    <Modal
      title={v ? tr('Rediger {id}', { id: v.name }) : tr('Ny bil')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn alt" onClick={onClose}>
            {tr('Avbryt')}
          </button>
          <button className="btn" type="submit" form="vehicleform" disabled={saving || !name.trim()}>
            {v ? tr('Lagre') : tr('Legg til bil')}
          </button>
        </>
      }
    >
      <form id="vehicleform" className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="v-name">{tr('Navn')}</label>
          <input id="v-name" required value={name} onChange={e => setName(e.target.value)} placeholder={tr('F.eks. Bil 7')} />
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="v-type">{tr('Type')}</label>
            <input id="v-type" list="vtypes" value={type} onChange={e => setType(e.target.value)} placeholder={tr('F.eks. Slamsuger')} />
            <datalist id="vtypes">
              {types.map(t => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="v-reg">{tr('Reg.nr.')}</label>
            <input id="v-reg" value={regNr} onChange={e => setRegNr(e.target.value)} placeholder="EB 12345" autoCapitalize="characters" />
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Kort oversikt brukt i Jobber når ingen jobb er valgt. */
export function FleetCompact({ jobs, onPick, openFleet }: { jobs: Job[]; onPick: (id: string) => void; openFleet: () => void }) {
  const vehicles = useVehicles().filter(v => v.active !== false);
  return (
    <>
      <div className="spread">
        <h2>{tr('Bilparken nå')}</h2>
        <button className="link" onClick={openFleet}>
          {tr('Åpne bilpark ›')}
        </button>
      </div>
      <p className="note">{tr('Velg en jobb i listen eller kartet for å se detaljer.')}</p>
      <ul className="fleet">
        {vehicles.map(v => {
          const s = vehicleStatus(v, jobs);
          return (
            <li key={v.id}>
              <span className={cx('fleet-tag', s.state)}>{v.tag}</span>
              <div>
                <b>
                  {v.name}
                  {s.nowDriver ? ` · ${s.nowDriver}` : ''}
                </b>
                {s.active ? (
                  <button className="link" onClick={() => onPick(s.active!.id)}>
                    {tr('På oppdrag')}: {s.active.customer}
                  </button>
                ) : s.next && s.state === 'planlagt' ? (
                  <button className="link" onClick={() => onPick(s.next!.id)}>
                    {tr('Neste')}: {s.next.customer}
                    {s.next.time ? ` ${tr('kl.')} ${s.next.time}` : ''}
                  </button>
                ) : (
                  <small>{tr('Ledig')}</small>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
