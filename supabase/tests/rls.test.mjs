// Tester databaseskjemaet (tilgangsregler, triggere) i PGlite med enkle erstatninger for Supabase auth/storage.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const ROOT = process.cwd() + '/'; // kjøres fra prosjektroten: npm run test:db
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log(`${cond ? '  ✓' : '  ✗ FEIL'} ${msg}`); };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated; grant select, insert, delete on storage.objects to authenticated;
`);
await db.exec(readFileSync(ROOT + 'supabase/migrations/0001_init.sql', 'utf8'));
console.log('migrering OK');
await db.exec(readFileSync(ROOT + 'supabase/seed.sql', 'utf8'));
console.log('seed OK');

// demo-brukere opprettes i "Supabase Auth"
const users = {};
for (const e of ['kontorbruker', 'sjaforbruker', 'kundebruker']) {
  const r = await db.query(`insert into auth.users (email) values ($1) returning id`, [`${e}@sugekraft.test`]);
  users[e] = r.rows[0].id;
}
const prof = await db.query(`select role, full_name from public.profiles order by role`);
ok(prof.rows.length === 3, `profiler laget fra invitasjoner: ${prof.rows.map(r => r.role).join(', ')}`);
await db.exec(`insert into public.invites (email, company_id, role, full_name) values ('a@b.test', 'c0000000-0000-4000-8000-000000000001', 'admin', 'X') on conflict do nothing`);

async function as(user, fn) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false)`); }
}
const count = async (sql, p = []) => Number((await db.query(sql, p)).rows[0].n);
const fails = async (sql, p = []) => { try { await db.query(sql, p); return false; } catch { return true; } };

const TOTAL = Number((await db.query(`select count(*) n from jobs`)).rows[0].n);
const NEXT = Number((await db.query(`select next_job_no n from companies where id = 'c0000000-0000-4000-8000-000000000001'`)).rows[0].n);

console.log('\nADMIN');
await as(users.kontorbruker, async () => {
  ok(await count(`select count(*) n from jobs`) === TOTAL, `ser alle ${TOTAL} jobber`);
  ok(await count(`select count(*) n from clients`) === 13, 'ser alle 13 kunder');
  ok(await count(`select count(*) n from vehicles`) === 6, 'ser 6 biler');
  ok(await count(`select count(*) n from profiles`) === 3, 'ser alle profiler i firmaet');
  const r = await db.query(`insert into jobs (customer, lat, lon, service, date) values ('Test', 59.9, 10.7, 'Høytrykkspyling', current_date) returning job_no, status, company_id`);
  ok(r.rows[0].job_no === NEXT && r.rows[0].status === 'kommende', `ny jobb får nr ${r.rows[0].job_no} og status ${r.rows[0].status}`);
  const id = (await db.query(`select id from jobs where job_no = $1`, [NEXT])).rows[0].id;
  await db.query(`update jobs set driver_id = 'd0000000-0000-4000-8000-000000000002' where id = $1`, [id]);
  ok((await db.query(`select status from jobs where id = $1`, [id])).rows[0].status === 'aktiv', 'sjåfør satt -> aktiv');
  await db.query(`update jobs set driver_id = null where id = $1`, [id]);
  ok((await db.query(`select status from jobs where id = $1`, [id])).rows[0].status === 'kommende', 'sjåfør fjernet -> kommende');
  // godta bestilling
  const req = (await db.query(`select id from jobs where request = 'venter' limit 1`)).rows[0].id;
  await db.query(`update jobs set request = '', driver_id = 'd0000000-0000-4000-8000-000000000001' where id = $1`, [req]);
  ok((await db.query(`select status, request from jobs where id = $1`, [req])).rows[0].status === 'aktiv', 'godtar bestilling og setter sjåfør');
});

console.log('\nSJÅFØR (Ola)');
await as(users.sjaforbruker, async () => {
  const n = await count(`select count(*) n from jobs`);
  ok(n === await count(`select count(*) n from jobs where driver_id = 'd0000000-0000-4000-8000-000000000001'`), `ser bare egne jobber (${n})`);
  ok(await count(`select count(*) n from clients`) === 0, 'ser ingen kunder i registeret');
  ok(await count(`select count(*) n from vehicles`) === 6, 'ser bilene');
  const j = (await db.query(`select id from jobs where status = 'aktiv' limit 1`)).rows[0].id;
  ok(!(await fails(`update jobs set steps = '{"kjoring":{"time":"08:00","comment":""}}', ticket_no = '1' where id = $1`, [j])), 'kan føre statuspunkt og kjøreseddel');
  ok(await fails(`update jobs set customer = 'Hacket' where id = $1`, [j]), 'kan ikke endre kunde');
  ok(await fails(`update jobs set invoiced = true where id = $1`, [j]), 'kan ikke merke fakturert');
  ok(await fails(`update jobs set driver_id = null where id = $1`, [j]), 'kan ikke fjerne seg selv');
  ok(await fails(`insert into jobs (customer, lat, lon, service, date) values ('X', 1, 1, 'Y', current_date)`), 'kan ikke opprette jobber');
  const other = await count(`select count(*) n from jobs where driver_id <> 'd0000000-0000-4000-8000-000000000001'`);
  ok(other === 0, 'ser ikke andres jobber');
  await db.query(`update jobs set status = 'ferdig', closed_at = current_date where id = $1`, [j]);
  ok(await fails(`update jobs set ticket_no = '2' where id = $1 returning id`, [j]) || (await db.query(`update jobs set ticket_no = '2' where id = $1 returning id`, [j])).rows.length === 0, 'kan ikke endre etter lukking');
  ok(await count(`select count(*) n from job_photos`) > 0, 'ser bilder på egne jobber');
});

console.log('\nKUNDE (Nordbygg)');
await as(users.kundebruker, async () => {
  const mine = await count(`select count(*) n from jobs`);
  ok(mine === await count(`select count(*) n from jobs where client_id = 'e0000000-0000-4000-8000-000000000001'`), `ser bare egne oppdrag (${mine})`);
  ok(await count(`select count(*) n from clients`) === 1, 'ser bare seg selv i kunderegisteret');
  ok(await count(`select count(*) n from vehicles`) === 0, 'ser ikke bilparken');
  ok(await count(`select count(*) n from drivers`) === 0, 'ser ikke sjåførlisten');
  const r = await db.query(`insert into jobs (company_id, customer, lat, lon, service, date, driver_id, request, invoiced)
    values ('c0000000-0000-4000-8000-000000000001', 'Nordbygg Anlegg AS', 59.9, 10.8, 'Tømming sandfang', current_date + 2,
            'd0000000-0000-4000-8000-000000000003', '', true) returning request, driver_id, invoiced, ordered_by, status, client_id`);
  const x = r.rows[0];
  ok(x.request === 'venter' && x.driver_id === null && !x.invoiced && x.ordered_by === 'kunde' && x.status === 'kommende', 'ny bestilling tvinges til «venter», uten sjåfør');
  const accepted = (await db.query(`select id from jobs where request = '' limit 1`)).rows[0].id;
  ok(await fails(`update jobs set note = 'endret' where id = $1`, [accepted]) || (await db.query(`update jobs set note='x' where id = $1 returning id`, [accepted])).rows.length === 0, 'kan ikke endre godkjent oppdrag');
  const del = await db.query(`delete from jobs where id = $1 returning id`, [accepted]);
  ok(del.rows.length === 0, 'kan ikke slette godkjent oppdrag');
  const pend = (await db.query(`select id from jobs where request = 'venter' limit 1`)).rows[0].id;
  ok(!(await fails(`update jobs set note = 'Ny beskrivelse' where id = $1`, [pend])), 'kan endre bestilling som venter');
  ok((await db.query(`delete from jobs where id = $1 returning id`, [pend])).rows.length === 1, 'kan trekke tilbake bestilling som venter');
  const photos = await count(`select count(*) n from job_photos p join jobs j on j.id = p.job_id where j.status <> 'ferdig'`);
  ok(photos === 0, 'ser bare bilder på utførte jobber');
});

console.log('\nTO FIRMAER');
await db.exec(`insert into companies (id, slug, name) values ('c0000000-0000-4000-8000-000000000002', 'annet', 'Annet Sug AS');
               insert into invites (email, company_id, role, full_name) values ('admin@annet.test', 'c0000000-0000-4000-8000-000000000002', 'admin', 'Admin 2');`);
const a2 = (await db.query(`insert into auth.users (email) values ('admin@annet.test') returning id`)).rows[0].id;
await as(a2, async () => {
  ok(await count(`select count(*) n from jobs`) === 0, 'admin i annet firma ser 0 jobber fra Fjordsug');
  ok(await count(`select count(*) n from clients`) === 0, '…og 0 kunder');
  ok(await count(`select count(*) n from companies`) === 1, '…og bare sitt eget firma');
  const r = await db.query(`insert into jobs (company_id, customer, lat, lon, service, date) values ('c0000000-0000-4000-8000-000000000001', 'X', 1, 1, 'Y', current_date) returning company_id, job_no`);
  ok(r.rows[0].company_id === 'c0000000-0000-4000-8000-000000000002' && r.rows[0].job_no === 1001, 'jobb havner i eget firma med egen nummerserie');
  ok((await db.query(`update jobs set note='x' where company_id = 'c0000000-0000-4000-8000-000000000001' returning id`)).rows.length === 0, 'kan ikke endre andres jobber');
});

console.log('\nFILLAGRING');
const fin = (await db.query(`select id from jobs where status='ferdig' and client_id = 'e0000000-0000-4000-8000-000000000001' limit 1`)).rows[0].id;
const act = (await db.query(`select id from jobs where status='aktiv' and client_id = 'e0000000-0000-4000-8000-000000000001' limit 1`)).rows[0].id;
const C = 'c0000000-0000-4000-8000-000000000001';
await db.query(`insert into storage.objects (bucket_id, name) values ('photos', $1), ('photos', $2)`, [`${C}/${fin}/a.jpg`, `${C}/${act}/b.jpg`]);
await as(users.kundebruker, async () => {
  ok(await count(`select count(*) n from storage.objects`) === 1, 'kunde ser bare filer på utført jobb');
  ok(await fails(`insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${C}/${fin}/c.jpg`]), 'kunde kan ikke laste opp');
});
await as(a2, async () => ok(await count(`select count(*) n from storage.objects`) === 0, 'annet firma ser ingen filer'));
await as(users.kontorbruker, async () => ok(await count(`select count(*) n from storage.objects`) === 2, 'admin ser alle filer i firmaet'));

console.log(`\n${pass} OK, ${fail} feil`);
process.exit(fail ? 1 : 0);
