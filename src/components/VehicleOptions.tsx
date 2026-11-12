import { config } from '../config';
import { useJobs, useOut } from '../store';
import { driverBusy } from '../lib/fleet';
import { underway } from '../lib/steps';

/** <option>-er for biler. Viser om bilen er ute av drift eller på oppdrag nå. */
export function VehicleOptions({ exceptJob }: { exceptJob?: string }) {
  const out = useOut();
  const jobs = useJobs();
  return (
    <>
      {config.vehicles.map(c => {
        const busy = jobs.find(j => j.car === c.id && underway(j) && j.id !== exceptJob);
        return (
          <option key={c.id} value={c.id}>
            {c.name} – {c.type}
            {out[c.id] !== undefined ? ' (ute av drift)' : busy ? ` (på oppdrag nå)` : ''}
          </option>
        );
      })}
    </>
  );
}

/** <option>-er for sjåfører. Viser om sjåføren er på et annet oppdrag nå. */
export function DriverOptions({ exceptJob }: { exceptJob?: string }) {
  const jobs = useJobs();
  return (
    <>
      {config.drivers.map(d => {
        const busy = driverBusy(d.id, jobs, exceptJob);
        return (
          <option key={d.id} value={d.id}>
            {d.name}
            {busy ? ` (på oppdrag nå: ${busy.customer})` : ''}
          </option>
        );
      })}
    </>
  );
}
