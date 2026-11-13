/*
 * Lager supabase/seed.sql fra eksempeldataene i appen (src/data/seed.ts) og firmaoppsettet
 * i src/config.ts, slik at databasen og demo-modusen har nøyaktig samme innhold.
 *
 *   npm run gen:seed
 *
 * Datoer skrives relativt til dagen seed kjøres (current_date + n).
 */
import './shim-node';
import { writeFileSync } from 'node:fs';
import { config } from '../src/config';
import { createSeed } from '../src/data/seed';
import { dayOffset, daysBetween } from '../src/lib/utils';

const today = dayOffset(0);
const uid = (p: string, n: number) => `${p}0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const num = (id: string) => parseInt(id.replace(/\D/g, ''), 10);
const COMPANY = uid('c', 1);
const vehicleId = (id: string) => (id ? uid('b', num(id)) : null);
const driverId = (id: string) => (id ? uid('d', num(id)) : null);
const clientId = (id: string) => (id ? uid('e', num(id)) : null);

const q = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return v === '' ? "''" : 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const rel = (d: string) => (d ? `current_date + ${daysBetween(today, d)}` : 'null');
const relTs = (s: string) => {
  if (!s) return 'now()';
  const [d, t] = s.split(' ');
  return `((current_date + ${daysBetween(today, d)}) + time '${t || '12:00'}') at time zone 'Europe/Oslo'`;
};

const { jobs, nextNo, out, clients } = createSeed();
const L: string[] = [];
L.push('-- GENERERT av scripts/gen-seed.ts – ikke rediger for hånd. Kjør: npm run gen:seed');
L.push('-- Eksempeldata for demo-firmaet. Kjøres etter migrations/0001_init.sql.');
L.push('begin;');
L.push(`delete from public.companies where id = '${COMPANY}';`);

const settings = {
  company: config.company,
  logo: config.logo,
  colors: config.colors,
  map: config.map,
  services: config.services,
  massTypes: config.massTypes,
  units: config.units,
  depots: config.depots,
  jobPrefix: config.jobPrefix,
  translations: config.translations,
};
L.push(`insert into public.companies (id, slug, name, settings, next_job_no) values ('${COMPANY}', 'fjordsug', ${q(config.company.name)}, ${json(settings)}, ${nextNo});`);

config.vehicles.forEach((v, i) =>
  L.push(`insert into public.vehicles (id, company_id, name, tag, type, reg_nr, out_note, sort) values ('${vehicleId(v.id)}', '${COMPANY}', ${q(v.name)}, ${q(v.tag)}, ${q(v.type)}, ${q(v.regNr)}, ${out[v.id] !== undefined ? q(out[v.id]) : 'null'}, ${i});`),
);
config.drivers.forEach(d =>
  L.push(`insert into public.drivers (id, company_id, name, phone) values ('${driverId(d.id)}', '${COMPANY}', ${q(d.name)}, ${q(d.phone)});`),
);
clients.forEach(c =>
  L.push(
    `insert into public.clients (id, company_id, name, org_nr, contact, phone, email, address, place, lat, lon, note) values ('${clientId(c.id)}', '${COMPANY}', ${q(c.name)}, ${q(c.orgNr)}, ${q(c.contact)}, ${q(c.phone)}, ${q(c.email)}, ${q(c.address)}, ${q(c.place)}, ${q(c.lat)}, ${q(c.lon)}, ${q(c.note)});`,
  ),
);

jobs.forEach(j => {
  const id = uid('f', num(j.id));
  L.push(
    `insert into public.jobs (id, company_id, job_no, status, client_id, customer, contact, phone, address, place, lat, lon, pin, service, ref, date, time, vehicle_id, driver_id, note, urgent, request, request_note, ordered_by, ordered_at, mass_type, amount, unit, disposal, work_start, work_end, steps, ticket_no, decl, comment, driver_name, closed_at, invoiced, invoiced_at) values (` +
      [
        q(id), q(COMPANY), num(j.id), q(j.status), q(clientId(j.clientId)), q(j.customer), q(j.contact), q(j.phone), q(j.address), q(j.place), j.lat, j.lon, q(j.pin),
        q(j.service), q(j.ref), rel(j.date), q(j.time), q(vehicleId(j.car)), q(driverId(j.driver)), q(j.note), q(j.urgent), q(j.request), q(j.requestNote),
        q(j.orderedBy), relTs(j.orderedAt), q(j.massType), j.amount ? j.amount : 'null', q(j.unit), q(j.disposal), q(j.start), q(j.end), json(j.steps),
        q(j.ticketNo), q(j.decl), q(j.comment), q(j.driverName), rel(j.closedAt), q(j.invoiced), rel(j.invoicedAt),
      ].join(', ') +
      ');',
  );
  [...j.ticketPhotos.map(p => ['ticket', p]), ...j.jobPhotos.map(p => ['job', p])].forEach(([kind, path]) =>
    L.push(`insert into public.job_photos (job_id, kind, path) values ('${id}', '${kind}', ${q(path)});`),
  );
});

// Invitasjoner for demo-brukerne. Opprett brukerne med disse e-postene i Supabase
// (Authentication -> Users -> Add user), så kobles de automatisk til firma og rolle.
const INVITES: [string, string, string, string | null, string | null][] = [
  ['kontorbruker@sugekraft.test', 'admin', 'Kontoret', null, null],
  ['sjaforbruker@sugekraft.test', 'driver', 'Ola Haugen', driverId('s1'), null],
  ['kundebruker@sugekraft.test', 'client', 'Geir Moen', null, clientId('k1')],
];
INVITES.forEach(([email, role, name, d, c]) =>
  L.push(
    `insert into public.invites (email, company_id, role, full_name, driver_id, client_id) values (${q(email)}, '${COMPANY}', ${q(role)}, ${q(name)}, ${q(d)}, ${q(c)}) on conflict (email) do update set company_id = excluded.company_id, role = excluded.role, full_name = excluded.full_name, driver_id = excluded.driver_id, client_id = excluded.client_id, used_at = null;`,
  ),
);
// Brukere som allerede finnes (seed kjøres på nytt): koble profilene igjen
L.push(`insert into public.profiles (id, company_id, role, full_name, driver_id, client_id)
  select u.id, i.company_id, i.role, i.full_name, i.driver_id, i.client_id
  from auth.users u join public.invites i on lower(i.email) = lower(u.email)
  on conflict (id) do update set company_id = excluded.company_id, role = excluded.role, full_name = excluded.full_name,
    driver_id = excluded.driver_id, client_id = excluded.client_id;`);
L.push(`update public.invites set used_at = now() where lower(email) in (select lower(email) from auth.users);`);
L.push('commit;');

writeFileSync('supabase/seed.sql', L.join('\n') + '\n'); // kjøres fra prosjektroten
console.log(`supabase/seed.sql: ${jobs.length} jobber, ${clients.length} kunder, ${config.vehicles.length} biler, ${config.drivers.length} sjåfører`);
