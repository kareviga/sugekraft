-- =====================================================================
--  Sugekraft – databaseskjema (Supabase / Postgres)
--  Én felles løsning for mange firmaer. Alle data har company_id, og
--  Row Level Security sørger for at hver bruker bare ser sitt eget firma
--  – og innenfor firmaet bare det rollen skal se:
--    admin  : alt i eget firma
--    driver : egne tildelte jobber (kan fylle ut dokumentasjon/statuspunkter)
--    client : egne bestillinger og oppdrag (kan bestille og trekke tilbake)
-- =====================================================================


-- ---------------------------------------------------------------------
--  Tabeller
-- ---------------------------------------------------------------------

create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  -- Firmaoppsett (tidligere config.ts): org.nr, kontaktinfo, farger, kart,
  -- tjenester, massetyper, enheter, deponier, jobbprefiks, oversettelser
  settings      jsonb not null default '{}'::jsonb,
  logo_path     text,
  next_job_no   integer not null default 1001,
  created_at    timestamptz not null default now()
);

create table public.vehicles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  tag         text not null default '',
  type        text not null default '',
  reg_nr      text not null default '',
  out_note    text,                      -- ikke null = ute av drift
  active      boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.drivers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  phone       text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  org_nr      text not null default '',
  contact     text not null default '',
  phone       text not null default '',
  email       text not null default '',
  address     text not null default '',
  place       text not null default '',
  lat         double precision,
  lon         double precision,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- Én rad per innlogget bruker (auth.users). Opprettes automatisk fra invites.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  role        text not null check (role in ('admin', 'driver', 'client')),
  full_name   text not null default '',
  driver_id   uuid references public.drivers(id) on delete set null,
  client_id   uuid references public.clients(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (role <> 'driver' or driver_id is not null),
  check (role <> 'client' or client_id is not null)
);

-- Invitasjoner: når en bruker med denne e-posten opprettes i Supabase Auth,
-- lages profilen (firma + rolle) automatisk.
create table public.invites (
  email       text primary key,
  company_id  uuid not null references public.companies(id) on delete cascade,
  role        text not null check (role in ('admin', 'driver', 'client')),
  full_name   text not null default '',
  driver_id   uuid references public.drivers(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete cascade,
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);

create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  job_no        integer not null,
  status        text not null default 'kommende' check (status in ('kommende', 'aktiv', 'ferdig')),
  -- bestilling
  client_id     uuid references public.clients(id) on delete set null,
  customer      text not null,
  contact       text not null default '',
  phone         text not null default '',
  address       text not null default '',
  place         text not null default '',
  lat           double precision not null,
  lon           double precision not null,
  pin           text not null default 'adresse' check (pin in ('adresse', 'kart')),
  service       text not null,
  ref           text not null default '',
  date          date not null,
  time          text not null default '',
  vehicle_id    uuid references public.vehicles(id) on delete set null,
  driver_id     uuid references public.drivers(id) on delete set null,
  note          text not null default '',
  urgent        boolean not null default false,
  request       text not null default '' check (request in ('', 'venter', 'avvist')),
  request_note  text not null default '',
  ordered_by    text not null default 'kontor' check (ordered_by in ('kunde', 'kontor')),
  ordered_at    timestamptz not null default now(),
  -- utførelse (sjåfør)
  mass_type     text not null default '',
  amount        numeric,
  unit          text not null default '',
  disposal      text not null default '',
  work_start    text not null default '',
  work_end      text not null default '',
  steps         jsonb not null default '{}'::jsonb,
  ticket_no     text not null default '',
  decl          text not null default '',
  comment       text not null default '',
  driver_name   text not null default '',   -- navn på sjåføren som lukket jobben (historikk)
  closed_at     date,
  -- fakturering
  invoiced      boolean not null default false,
  invoiced_at   date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, job_no)
);

create table public.job_photos (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  kind        text not null check (kind in ('ticket', 'job')),
  path        text not null,             -- sti i bucket «photos», eller «demo:…» for eksempelbilder
  created_at  timestamptz not null default now()
);

create index on public.vehicles (company_id);
create index on public.drivers (company_id);
create index on public.clients (company_id);
create index on public.profiles (company_id);
create index on public.jobs (company_id, date);
create index on public.jobs (company_id, status);
create index on public.jobs (driver_id);
create index on public.jobs (client_id);
create index on public.job_photos (job_id);

-- ---------------------------------------------------------------------
--  Hjelpefunksjoner for innlogget bruker (brukes i tilgangsreglene)
-- ---------------------------------------------------------------------

create or replace function public.my_company() returns uuid
language sql stable security definer set search_path = public as
$$ select company_id from public.profiles where id = auth.uid() $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_driver() returns uuid
language sql stable security definer set search_path = public as
$$ select driver_id from public.profiles where id = auth.uid() $$;

create or replace function public.my_client() returns uuid
language sql stable security definer set search_path = public as
$$ select client_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;

-- ---------------------------------------------------------------------
--  Triggere
-- ---------------------------------------------------------------------

-- Ny bruker i Supabase Auth -> profil fra invitasjon
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$
declare inv public.invites;
begin
  select * into inv from public.invites where lower(email) = lower(new.email) and used_at is null;
  if found then
    insert into public.profiles (id, company_id, role, full_name, driver_id, client_id)
    values (new.id, inv.company_id, inv.role, inv.full_name, inv.driver_id, inv.client_id);
    update public.invites set used_at = now() where email = inv.email;
  end if;
  return new;
end
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Jobber: firma, nummer, status og hvem som får endre hva
create or replace function public.jobs_before_write() returns trigger
language plpgsql security definer set search_path = public as
$$
declare
  r text := public.my_role();
begin
  if tg_op = 'INSERT' then
    if r is not null then
      new.company_id := public.my_company();
    end if;
    if r = 'client' then
      -- kunden bestiller: alltid til godkjenning, uten bil/sjåfør
      new.client_id := public.my_client();
      new.request := 'venter';
      new.request_note := '';
      new.ordered_by := 'kunde';
      new.vehicle_id := null;
      new.driver_id := null;
      new.status := 'kommende';
      new.invoiced := false;
      new.steps := '{}'::jsonb;
    elsif r = 'driver' then
      raise exception 'Sjåfører kan ikke opprette jobber';
    end if;
    -- jobbnummer per firma (innloggede brukere får alltid neste ledige nummer)
    if r is not null or new.job_no is null then
      update public.companies set next_job_no = next_job_no + 1
        where id = new.company_id returning next_job_no - 1 into new.job_no;
    end if;
    new.ordered_at := coalesce(new.ordered_at, now());
  else -- UPDATE
    new.company_id := old.company_id;
    new.job_no := old.job_no;
    if r = 'driver' then
      -- sjåføren fyller bare ut utførelse; bestilling og fakturering er låst
      if (new.client_id, new.customer, new.contact, new.phone, new.address, new.place, new.lat, new.lon, new.pin,
          new.service, new.ref, new.date, new.time, new.vehicle_id, new.driver_id, new.note, new.urgent,
          new.request, new.request_note, new.ordered_by, new.invoiced, new.invoiced_at)
         is distinct from
         (old.client_id, old.customer, old.contact, old.phone, old.address, old.place, old.lat, old.lon, old.pin,
          old.service, old.ref, old.date, old.time, old.vehicle_id, old.driver_id, old.note, old.urgent,
          old.request, old.request_note, old.ordered_by, old.invoiced, old.invoiced_at) then
        raise exception 'Sjåfører kan bare endre utførelsen av jobben';
      end if;
      if old.status = 'ferdig' then
        raise exception 'Jobben er avsluttet';
      end if;
    elsif r = 'client' then
      -- kunden kan bare endre egne bestillinger som venter på godkjenning
      if old.request <> 'venter' then
        raise exception 'Bestillingen er allerede behandlet';
      end if;
      new.client_id := old.client_id;
      new.request := 'venter';
      new.request_note := '';
      new.ordered_by := 'kunde';
      new.vehicle_id := null;
      new.driver_id := null;
      new.status := 'kommende';
      new.invoiced := false;
      new.steps := old.steps;
    end if;
    new.updated_at := now();
  end if;
  -- status følger tildelingen: uten sjåfør = kommende, med sjåfør = aktiv
  if new.status <> 'ferdig' then
    new.status := case when new.driver_id is not null then 'aktiv' else 'kommende' end;
  end if;
  return new;
end
$$;
create trigger jobs_before_write before insert or update on public.jobs
  for each row execute function public.jobs_before_write();

-- Kunder kan bare slette (trekke tilbake) bestillinger som venter
create or replace function public.jobs_before_delete() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if public.my_role() = 'client' and old.request <> 'venter' then
    raise exception 'Bestillingen er allerede behandlet';
  end if;
  return old;
end
$$;
create trigger jobs_before_delete before delete on public.jobs
  for each row execute function public.jobs_before_delete();

-- Bilder arver firma fra jobben
create or replace function public.photos_before_insert() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  select company_id into new.company_id from public.jobs where id = new.job_id;
  return new;
end
$$;
create trigger photos_before_insert before insert on public.job_photos
  for each row execute function public.photos_before_insert();

-- Alt opprettet av en innlogget bruker havner i brukerens firma
create or replace function public.set_company() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if public.my_role() is not null then
    new.company_id := public.my_company();
  end if;
  return new;
end
$$;
create trigger vehicles_company before insert or update on public.vehicles for each row execute function public.set_company();
create trigger drivers_company  before insert or update on public.drivers  for each row execute function public.set_company();
create trigger clients_company  before insert or update on public.clients  for each row execute function public.set_company();
create trigger invites_company  before insert or update on public.invites  for each row execute function public.set_company();

-- ---------------------------------------------------------------------
--  Row Level Security
-- ---------------------------------------------------------------------

alter table public.companies  enable row level security;
alter table public.profiles   enable row level security;
alter table public.invites    enable row level security;
alter table public.vehicles   enable row level security;
alter table public.drivers    enable row level security;
alter table public.clients    enable row level security;
alter table public.jobs       enable row level security;
alter table public.job_photos enable row level security;

-- firma: alle i firmaet kan lese oppsettet, bare admin kan endre
create policy companies_read   on public.companies for select to authenticated using (id = public.my_company());
create policy companies_update on public.companies for update to authenticated using (id = public.my_company() and public.is_admin());

-- profiler: egen profil, admin ser alle i firmaet
create policy profiles_read  on public.profiles for select to authenticated
  using (id = auth.uid() or (company_id = public.my_company() and public.is_admin()));
create policy profiles_admin on public.profiles for update to authenticated
  using (company_id = public.my_company() and public.is_admin())
  with check (company_id = public.my_company());
create policy profiles_delete on public.profiles for delete to authenticated
  using (company_id = public.my_company() and public.is_admin() and id <> auth.uid());

-- invitasjoner: bare admin
create policy invites_admin on public.invites for all to authenticated
  using (company_id = public.my_company() and public.is_admin())
  with check (company_id = public.my_company() and public.is_admin());

-- biler og sjåfører: admin alt, sjåfør lese
create policy vehicles_read  on public.vehicles for select to authenticated
  using (company_id = public.my_company() and public.my_role() in ('admin', 'driver'));
create policy vehicles_admin on public.vehicles for all to authenticated
  using (company_id = public.my_company() and public.is_admin())
  with check (company_id = public.my_company() and public.is_admin());
create policy drivers_read  on public.drivers for select to authenticated
  using (company_id = public.my_company() and public.my_role() in ('admin', 'driver'));
create policy drivers_admin on public.drivers for all to authenticated
  using (company_id = public.my_company() and public.is_admin())
  with check (company_id = public.my_company() and public.is_admin());

-- kunder: admin alt, kunden ser seg selv
create policy clients_read  on public.clients for select to authenticated
  using (company_id = public.my_company() and (public.is_admin() or id = public.my_client()));
create policy clients_admin on public.clients for all to authenticated
  using (company_id = public.my_company() and public.is_admin())
  with check (company_id = public.my_company() and public.is_admin());

-- jobber
create policy jobs_admin on public.jobs for all to authenticated
  using (company_id = public.my_company() and public.is_admin())
  with check (company_id = public.my_company() and public.is_admin());
create policy jobs_driver_read on public.jobs for select to authenticated
  using (company_id = public.my_company() and public.my_role() = 'driver'
         and driver_id = public.my_driver() and request = '');
create policy jobs_driver_update on public.jobs for update to authenticated
  using (company_id = public.my_company() and public.my_role() = 'driver'
         and driver_id = public.my_driver() and status <> 'ferdig')
  with check (driver_id = public.my_driver());
create policy jobs_client_read on public.jobs for select to authenticated
  using (company_id = public.my_company() and public.my_role() = 'client' and client_id = public.my_client());
create policy jobs_client_insert on public.jobs for insert to authenticated
  with check (public.my_role() = 'client');
create policy jobs_client_update on public.jobs for update to authenticated
  using (public.my_role() = 'client' and client_id = public.my_client() and request = 'venter')
  with check (client_id = public.my_client());
create policy jobs_client_delete on public.jobs for delete to authenticated
  using (public.my_role() = 'client' and client_id = public.my_client() and request = 'venter');

-- bilder: admin alt, sjåfør på egne aktive jobber, kunde ser bilder på egne utførte jobber
create policy photos_admin on public.job_photos for all to authenticated
  using (company_id = public.my_company() and public.is_admin())
  with check (company_id = public.my_company() and public.is_admin());
create policy photos_driver on public.job_photos for all to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.driver_id = public.my_driver()
                 and j.company_id = public.my_company() and j.status <> 'ferdig'))
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.driver_id = public.my_driver()
                      and j.company_id = public.my_company() and j.status <> 'ferdig'));
create policy photos_driver_read on public.job_photos for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.driver_id = public.my_driver()
                 and j.company_id = public.my_company()));
create policy photos_client_read on public.job_photos for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.client_id = public.my_client()
                 and j.company_id = public.my_company() and j.status = 'ferdig'));

-- ---------------------------------------------------------------------
--  Fillagring: bucket «photos», sti = {company_id}/{job_id}/{filnavn}
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
  on conflict (id) do nothing;

create or replace function public.can_read_photo(p text) returns boolean
language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from public.jobs j
    where j.company_id::text = split_part(p, '/', 1)
      and j.id::text = split_part(p, '/', 2)
      and j.company_id = public.my_company()
      and (public.is_admin()
           or j.driver_id = public.my_driver()
           or (j.client_id = public.my_client() and j.status = 'ferdig'))
  )
$$;
create or replace function public.can_write_photo(p text) returns boolean
language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from public.jobs j
    where j.company_id::text = split_part(p, '/', 1)
      and j.id::text = split_part(p, '/', 2)
      and j.company_id = public.my_company()
      and (public.is_admin() or (j.driver_id = public.my_driver() and j.status <> 'ferdig'))
  )
$$;

create policy photos_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.can_read_photo(name));
create policy photos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.can_write_photo(name));
create policy photos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.can_write_photo(name));

-- ---------------------------------------------------------------------
--  Sanntid: endringer i jobber sendes til appene
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.jobs, public.job_photos, public.vehicles';
  end if;
end $$;

-- tilgang for innloggede brukere (RLS avgjør hvilke rader)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
