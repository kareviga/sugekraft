/*
 * Supabase-laget: henter data, skriver endringer, laster opp bilder og lytter på sanntid.
 * Oversetter mellom databasens kolonner (snake_case) og appens typer (Job, Client …).
 * Tilgangsreglene i databasen (RLS) avgjør hva hver bruker får se og endre.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { config, type AppConfig } from '../config';
import type { Client, Job } from '../types';
import { setPhotoUrl } from './photoCache';
import { supabase } from './supabase';
import { applyTheme } from './theme';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const sb = () => {
  if (!supabase) throw new Error('Supabase er ikke konfigurert');
  return supabase;
};
const fail = (e: { message?: string } | null) => {
  if (e) throw new Error(e.message || 'Ukjent feil');
};

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export interface Profile {
  id: string;
  company_id: string;
  role: 'admin' | 'driver' | 'client';
  full_name: string;
  driver_id: string | null;
  client_id: string | null;
}

let companyId = '';

// ---------------------------------------------------------------------------
//  Oversetting rad <-> app
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (ts: string | null) => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Bilder per jobb: refs i appen + rad-id per ref (for sletting) */
const photoRows = new Map<string, { id: string; kind: 'ticket' | 'job'; path: string }[]>();
const refOf = (path: string) => (path.startsWith('demo:') ? path : `sb:${path}`);

export function rowToJob(r: Row): Job {
  const photos = photoRows.get(r.id) ?? [];
  return {
    id: r.id,
    no: `${config.jobPrefix}-${r.job_no}`,
    status: r.status,
    customer: r.customer,
    contact: r.contact,
    phone: r.phone,
    address: r.address,
    place: r.place,
    lat: r.lat,
    lon: r.lon,
    pin: r.pin,
    service: r.service,
    ref: r.ref,
    date: r.date,
    time: r.time,
    car: r.vehicle_id ?? '',
    driver: r.driver_id ?? '',
    driverName: r.driver_name,
    note: r.note,
    urgent: r.urgent,
    massType: r.mass_type,
    amount: r.amount == null ? '' : String(r.amount),
    unit: r.unit || config.units[0],
    disposal: r.disposal,
    start: r.work_start,
    end: r.work_end,
    steps: r.steps ?? {},
    ticketNo: r.ticket_no,
    ticketPhotos: photos.filter(p => p.kind === 'ticket').map(p => refOf(p.path)),
    jobPhotos: photos.filter(p => p.kind === 'job').map(p => refOf(p.path)),
    decl: r.decl,
    comment: r.comment,
    invoiced: r.invoiced,
    invoicedAt: r.invoiced_at ?? '',
    closedAt: r.closed_at ?? '',
    clientId: r.client_id ?? '',
    request: r.request,
    requestNote: r.request_note,
    orderedBy: r.ordered_by,
    orderedAt: localStamp(r.ordered_at),
  };
}

const JOB_COLS: Partial<Record<keyof Job, string>> = {
  status: 'status', customer: 'customer', contact: 'contact', phone: 'phone', address: 'address', place: 'place',
  lat: 'lat', lon: 'lon', pin: 'pin', service: 'service', ref: 'ref', date: 'date', time: 'time', car: 'vehicle_id',
  driver: 'driver_id', driverName: 'driver_name', note: 'note', urgent: 'urgent', massType: 'mass_type', amount: 'amount',
  unit: 'unit', disposal: 'disposal', start: 'work_start', end: 'work_end', steps: 'steps', ticketNo: 'ticket_no',
  decl: 'decl', comment: 'comment', invoiced: 'invoiced', invoicedAt: 'invoiced_at', closedAt: 'closed_at',
  clientId: 'client_id', request: 'request', requestNote: 'request_note', orderedBy: 'ordered_by',
};
const NULL_IF_EMPTY = new Set(['vehicle_id', 'driver_id', 'client_id', 'invoiced_at', 'closed_at', 'amount']);

export function jobToRow(p: Partial<Job>): Row {
  const out: Row = {};
  (Object.keys(p) as (keyof Job)[]).forEach(k => {
    const col = JOB_COLS[k];
    if (!col) return;
    let v = p[k] as unknown;
    if (NULL_IF_EMPTY.has(col) && (v === '' || v === undefined)) v = null;
    if (col === 'amount' && v != null) v = Number(String(v).replace(',', '.')) || null;
    out[col] = v;
  });
  return out;
}

const rowToClient = (r: Row): Client => ({
  id: r.id, name: r.name, orgNr: r.org_nr, contact: r.contact, phone: r.phone, email: r.email,
  address: r.address, place: r.place, lat: r.lat, lon: r.lon, note: r.note,
});
const clientToRow = (c: Omit<Client, 'id'>): Row => ({
  name: c.name, org_nr: c.orgNr, contact: c.contact, phone: c.phone, email: c.email,
  address: c.address, place: c.place, lat: c.lat, lon: c.lon, note: c.note,
});

// ---------------------------------------------------------------------------
//  Innlogging og innlasting
// ---------------------------------------------------------------------------

export async function signIn(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email, password });
  return !error;
}
export async function signOut() {
  await sb().auth.signOut();
}
export async function currentSession() {
  const { data } = await sb().auth.getSession();
  return data.session;
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data: u } = await sb().auth.getUser();
  if (!u.user) return null;
  const { data, error } = await sb().from('profiles').select('*').eq('id', u.user.id).maybeSingle();
  if (error || !data) return null;
  companyId = data.company_id;
  return data as Profile;
}

export interface LiveData {
  jobs: Job[];
  clients: Client[];
  out: Record<string, string>;
  profiles: Profile[];
}

/** Bruk firmaoppsettet fra databasen i stedet for config.ts */
function applySettings(name: string, s: Row) {
  const c = config as AppConfig;
  if (s.company) Object.assign(c.company, s.company);
  c.company.name = name || c.company.name;
  if (s.colors) Object.assign(c.colors, s.colors);
  if (s.map) Object.assign(c.map, s.map);
  if (Array.isArray(s.services)) c.services = s.services;
  if (Array.isArray(s.massTypes)) c.massTypes = s.massTypes;
  if (Array.isArray(s.units)) c.units = s.units;
  if (Array.isArray(s.depots)) c.depots = s.depots;
  if (s.jobPrefix) c.jobPrefix = s.jobPrefix;
  if (s.translations?.en) c.translations = { en: s.translations.en };
  if (typeof s.logo === 'string') c.logo = s.logo;
  applyTheme();
}

async function signPhotos(paths: string[]) {
  const real = paths.filter(p => !p.startsWith('demo:'));
  if (!real.length) return;
  const { data } = await sb().storage.from('photos').createSignedUrls(real, 60 * 60 * 12);
  data?.forEach(d => d.signedUrl && d.path && setPhotoUrl(d.path, d.signedUrl));
}

export async function fetchAll(role: Profile['role']): Promise<LiveData> {
  const db = sb();
  const [company, vehicles, drivers, clients, jobs, photos, profiles] = await Promise.all([
    db.from('companies').select('*').eq('id', companyId).maybeSingle(),
    role === 'client' ? Promise.resolve({ data: [], error: null }) : db.from('vehicles').select('*').order('sort'),
    role === 'client' ? Promise.resolve({ data: [], error: null }) : db.from('drivers').select('*').order('name'),
    db.from('clients').select('*').order('name'),
    db.from('jobs').select('*'),
    db.from('job_photos').select('id, job_id, kind, path, created_at').order('created_at'),
    role === 'admin' ? db.from('profiles').select('*') : Promise.resolve({ data: [], error: null }),
  ]);
  [company, vehicles, drivers, clients, jobs, photos, profiles].forEach(r => fail(r.error));
  if (company.data) applySettings(company.data.name, company.data.settings ?? {});

  const c = config as AppConfig;
  c.vehicles = (vehicles.data ?? []).map((v: Row) => ({ id: v.id, name: v.name, tag: v.tag, type: v.type, regNr: v.reg_nr }));
  c.drivers = (drivers.data ?? []).map((d: Row) => ({ id: d.id, name: d.name, phone: d.phone }));
  const out: Record<string, string> = {};
  (vehicles.data ?? []).forEach((v: Row) => {
    if (v.out_note !== null) out[v.id] = v.out_note;
  });

  photoRows.clear();
  (photos.data ?? []).forEach((p: Row) => {
    const l = photoRows.get(p.job_id) ?? [];
    l.push({ id: p.id, kind: p.kind, path: p.path });
    photoRows.set(p.job_id, l);
  });
  await signPhotos((photos.data ?? []).map((p: Row) => p.path));

  return {
    jobs: (jobs.data ?? []).map(rowToJob),
    clients: (clients.data ?? []).map(rowToClient),
    out,
    profiles: (profiles.data ?? []) as Profile[],
  };
}

// ---------------------------------------------------------------------------
//  Skriving
// ---------------------------------------------------------------------------

export async function insertJob(j: Job): Promise<Job> {
  const row = { id: j.id, ...jobToRow(j), ordered_at: new Date().toISOString() };
  const { data, error } = await sb().from('jobs').insert(row).select('*').single();
  fail(error);
  return rowToJob(data!);
}

export async function updateJobRow(id: string, patch: Partial<Job>) {
  const row = jobToRow(patch);
  if (!Object.keys(row).length) return;
  const { error } = await sb().from('jobs').update(row).eq('id', id);
  fail(error);
}

export async function updateJobRows(ids: string[], patch: Partial<Job>) {
  const { error } = await sb().from('jobs').update(jobToRow(patch)).in('id', ids);
  fail(error);
}

export async function deleteJobRow(id: string) {
  const { error } = await sb().from('jobs').delete().eq('id', id);
  fail(error);
  photoRows.delete(id);
}

/** Synk bildelistene: last opp nye (data-URL) og slett fjernede. Returnerer nye refs. */
export async function syncPhotos(jobId: string, kind: 'ticket' | 'job', next: string[]): Promise<string[]> {
  const db = sb();
  const rows = photoRows.get(jobId) ?? [];
  const mine = rows.filter(r => r.kind === kind);
  // slett de som er fjernet
  for (const r of mine) {
    if (!next.includes(refOf(r.path))) {
      const { error } = await db.from('job_photos').delete().eq('id', r.id);
      fail(error);
      if (!r.path.startsWith('demo:')) await db.storage.from('photos').remove([r.path]);
      rows.splice(rows.indexOf(r), 1);
    }
  }
  // last opp nye
  const result: string[] = [];
  for (const ref of next) {
    if (!ref.startsWith('data:')) {
      result.push(ref);
      continue;
    }
    const path = `${companyId}/${jobId}/${uuid()}.jpg`;
    const blob = await (await fetch(ref)).blob();
    const up = await db.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
    fail(up.error);
    const { data, error } = await db.from('job_photos').insert({ job_id: jobId, kind, path }).select('id').single();
    fail(error);
    rows.push({ id: data!.id, kind, path });
    setPhotoUrl(path, ref); // vis lokal kopi til siden lastes på nytt
    result.push(refOf(path));
  }
  photoRows.set(jobId, rows);
  return result;
}

export async function saveClientRow(c: Client, isNew: boolean) {
  const row = clientToRow(c);
  const q = isNew ? sb().from('clients').insert({ id: c.id, ...row }) : sb().from('clients').update(row).eq('id', c.id);
  const { error } = await q;
  fail(error);
}
export async function deleteClientRow(id: string) {
  const { error } = await sb().from('clients').delete().eq('id', id);
  fail(error);
}
export async function setVehicleOut(id: string, note: string | null) {
  const { error } = await sb().from('vehicles').update({ out_note: note }).eq('id', id);
  fail(error);
}

// ---------------------------------------------------------------------------
//  Sanntid
// ---------------------------------------------------------------------------

let channel: RealtimeChannel | null = null;

export function subscribe(h: {
  job: (j: Job) => void;
  jobDeleted: (id: string) => void;
  photosChanged: (jobId: string) => void;
  vehicle: (id: string, outNote: string | null) => void;
}) {
  unsubscribe();
  const db = sb();
  channel = db
    .channel('sugekraft')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, p => {
      if (p.eventType === 'DELETE') h.jobDeleted((p.old as Row).id);
      else h.job(rowToJob(p.new as Row));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_photos' }, async p => {
      const jobId = ((p.new as Row)?.job_id ?? (p.old as Row)?.job_id) as string | undefined;
      if (!jobId) return;
      const { data } = await db.from('job_photos').select('id, kind, path').eq('job_id', jobId).order('created_at');
      photoRows.set(jobId, (data ?? []) as { id: string; kind: 'ticket' | 'job'; path: string }[]);
      await signPhotos((data ?? []).map((r: Row) => r.path));
      h.photosChanged(jobId);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicles' }, p => {
      const r = p.new as Row;
      h.vehicle(r.id, r.out_note);
    })
    .subscribe();
}

export function unsubscribe() {
  if (channel) void supabase?.removeChannel(channel);
  channel = null;
}

/** Bilder for en jobb slik de ligger i cachen (etter sanntidsendring) */
export const photoRefs = (jobId: string) => {
  const rows = photoRows.get(jobId) ?? [];
  return {
    ticketPhotos: rows.filter(p => p.kind === 'ticket').map(p => refOf(p.path)),
    jobPhotos: rows.filter(p => p.kind === 'job').map(p => refOf(p.path)),
  };
};
