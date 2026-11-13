import { config } from '../config';
import { useJobs, useVehicles } from '../store';
import { driverBusy } from '../lib/fleet';
import { underway } from '../lib/steps';
import { tr, trd } from '../i18n';

/** <option>-er for biler i bilparken. Viser om bilen er på oppdrag nå. «current» tas med selv om bilen er tatt ut. */
export function VehicleOptions({ exceptJob, current }: { exceptJob?: string; current?: string }) {
  const vehicles = useVehicles();
  const jobs = useJobs();
  return (
    <>
      {vehicles
        .filter(c => c.active !== false || c.id === current)
        .map(c => {
          const busy = jobs.find(j => j.car === c.id && underway(j) && j.id !== exceptJob);
          return (
            <option key={c.id} value={c.id}>
              {c.name} – {trd(c.type)}
              {busy ? ` (${tr('på oppdrag nå')})` : ''}
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
            {busy ? ` (${tr('på oppdrag nå')}: ${busy.customer})` : ''}
          </option>
        );
      })}
    </>
  );
}
