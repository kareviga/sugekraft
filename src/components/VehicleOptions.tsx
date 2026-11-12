import { config } from '../config';
import { useCrew, useOut } from '../store';
import { driver } from '../lib/utils';

/** <option>-er for biler med dagens sjåfør. Brukes i nedtrekkslister for tildeling. */
export function VehicleOptions() {
  const crew = useCrew();
  const out = useOut();
  return (
    <>
      {config.vehicles.map(c => {
        const d = driver(crew[c.id]);
        return (
          <option key={c.id} value={c.id}>
            {c.name} – {c.type} ({out[c.id] !== undefined ? 'ute av drift' : d ? d.name : 'ingen sjåfør'})
          </option>
        );
      })}
    </>
  );
}
