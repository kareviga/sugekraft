import { useSyncExternalStore } from 'react';
import { config, type Vehicle } from './config';
import { createSeed } from './data/seed';
import { toast } from './lib/toast';
import { dayOffset, daysBetween, nowHHMM, shiftDate } from './lib/utils';
import { isLive } from './lib/mode';
import * as live from './lib/live';
import type { Client, Job, JobOrder } from './types';
import { tr } from './i18n';

/*
 * Datalager for appen. Visningene leser og skriver gjennom funksjonene her.
 *
 * Demo-modus: alt ligger i localStorage. Datoene «følger med» i tid: åpnes demoen
 * en senere dag, flyttes alle datoer like mange dager fram.
 *
 * Live-modus (Supabase): endringer vises lokalt med en gang og skrives til databasen
 * i bakgrunnen. Skriving fra tastatur samles i ~0,6 s. Sanntid holder alle klienter i synk.
 * Ved feil vises en melding og data lastes på nytt fra serveren.
 */

interface DB {
  v: 1;
  jobs: Job[];
  nextNo: number;
  day: string;
  /** Bilparken (også biler tatt ut, med active=false, for historikken) */
  vehicles: Vehicle[];
  /** Kunderegister */
  clients: Client[];
  nextClient: number;
  /** Innloggingsprofiler (bare live, bare admin) */
  profiles: live.Profile[];
}

/** Status følger tildelingen: uten sjåfør = kommende, med sjåfør = aktiv. Ferdig settes bare ved lukking. */
const norm = (j: Job): Job => {
  const status = j.status === 'ferdig' ? 'ferdig' : j.driver ? 'aktiv' : 'kommende';
  if (status === j.status && j.pin && j.steps && j.orderedBy && j.no) return j;
  return {
    ...j,
    status,
    pin: j.pin ?? 'adresse',
    steps: j.steps ?? {},
    clientId: j.clientId ?? '',
    request: j.request ?? '',
    no: j.no ?? j.id,
    requestNote: j.requestNote ?? '',
    orderedBy: j.orderedBy ?? 'kontor',
    orderedAt: j.orderedAt ?? '',
  };
};

/** Bilene fra config.ts er utgangspunktet i demo-modus */
const DEFAULT_VEHICLES: Vehicle[] = config.vehicles.map(v => ({ ...v, active: true }));

const empty = (): DB => ({ v: 1, jobs: [], nextNo: 1, day: dayOffset(0), vehicles: [], clients: [], nextClient: 1, profiles: [] });

function fresh(): DB {
  config.vehicles = DEFAULT_VEHICLES;
  const { jobs, nextNo, clients } = createSeed();
  return { v: 1, jobs: jobs.map(norm), nextNo, day: dayOffset(0), vehicles: DEFAULT_VEHICLES, clients, nextClient: clients.length + 1, profiles: [] };
}

function rebase(db: DB): DB {
  const today = dayOffset(0);
  const n = daysBetween(db.day, today);
  if (!n) return db;
  const sh = (s: string) => shiftDate(s, n);
  return {
    ...db,
    day: today,
    jobs: db.jobs.map(j => ({ ...j, date: sh(j.date), closedAt: sh(j.closedAt), invoicedAt: sh(j.invoicedAt) })),
  };
}

function load(): DB {
  if (isLive()) return empty();
  try {
    const raw = localStorage.getItem(config.storageKey);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db && db.v === 1 && Array.isArray(db.jobs)) {
        db.jobs = db.jobs.map(j => norm({ ...j, driver: j.driver ?? '', driverName: j.driverName ?? '' }));
        db.vehicles = Array.isArray(db.vehicles) && db.vehicles.length ? db.vehicles : DEFAULT_VEHICLES;
        db.clients = db.clients ?? [];
        db.nextClient = db.nextClient ?? db.clients.length + 1;
        db.profiles = [];
        return rebase(db);
      }
    }
  } catch {
    /* korrupt eller utilgjengelig lagring – start på nytt */
  }
  return fresh();
}

let db = load();
const listeners = new Set<() => void>();
let saveTimer = 0;

function persistNow() {
  if (isLive()) return;
  try {
    localStorage.setItem(config.storageKey, JSON.stringify({ ...db, profiles: [] }));
  } catch {
    toast(tr('Lagringsplassen i nettleseren er full. Fjern noen bilder eller nullstill demoen.'));
  }
}
function commit(next: DB, immediate = false) {
  db = { ...next, jobs: next.jobs.map(norm) };
  if (db.vehicles.length || isLive()) config.vehicles = db.vehicles;
  listeners.forEach(l => l());
  if (isLive()) return;
  clearTimeout(saveTimer);
  if (immediate) persistNow();
  else saveTimer = window.setTimeout(persistNow, 250);
}
if (!isLive()) {
  persistNow();
  window.addEventListener('beforeunload', persistNow);
  // Demo i flere faner (f.eks. kunde i én, kontor i en annen): hent endringer fra de andre fanene
  window.addEventListener('storage', e => {
    if (e.key !== config.storageKey || !e.newValue) return;
    try {
      const next = JSON.parse(e.newValue) as DB;
      if (!next || !Array.isArray(next.jobs)) return;
      db = { ...next, profiles: [], jobs: next.jobs.map(norm), vehicles: next.vehicles ?? db.vehicles };
      config.vehicles = db.vehicles;
      listeners.forEach(l => l());
    } catch {
      /* ignorer ugyldige data */
    }
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

// ---------------------------------------------------------------------------
//  Live: innlasting, feil, sanntid
// ---------------------------------------------------------------------------

/** Ventende tekstendringer per jobb (samles før de skrives) */
const pending = new Map<string, Partial<Job>>();
const timers = new Map<string, number>();

function remoteError(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  toast(tr('Kunne ikke lagre: {m}', { m }));
  void reloadLive();
}
/** Kjør en skriveoperasjon mot Supabase i bakgrunnen */
function remote(fn: () => Promise<unknown>) {
  if (!isLive()) return;
  fn().catch(remoteError);
}

let liveRole: live.Profile['role'] = 'admin';

export async function loadLive(role: live.Profile['role']) {
  liveRole = role;
  const d = await live.fetchAll(role);
  commit({ ...empty(), jobs: d.jobs, clients: d.clients, vehicles: d.vehicles, profiles: d.profiles });
  live.subscribe({
    job: j => {
      const p = pending.get(j.id);
      const merged = p ? { ...j, ...p } : j;
      const exists = db.jobs.some(x => x.id === j.id);
      commit({ ...db, jobs: exists ? db.jobs.map(x => (x.id === j.id ? merged : x)) : [...db.jobs, merged] });
    },
    jobDeleted: id => commit({ ...db, jobs: db.jobs.filter(j => j.id !== id) }),
    photosChanged: id => commit({ ...db, jobs: db.jobs.map(j => (j.id === id ? { ...j, ...live.photoRefs(id) } : j)) }),
    vehicle: v => {
      const exists = db.vehicles.some(x => x.id === v.id);
      commit({ ...db, vehicles: exists ? db.vehicles.map(x => (x.id === v.id ? v : x)) : [...db.vehicles, v] });
    },
  });
}
async function reloadLive() {
  try {
    await loadLive(liveRole);
  } catch {
    /* nettverk nede – prøv igjen ved neste endring */
  }
}
export function clearLive() {
  live.unsubscribe();
  pending.clear();
  commit(empty());
}

function flush(id: string) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  const p = pending.get(id);
  pending.delete(id);
  if (!p) return;
  const { ticketPhotos, jobPhotos, ...rest } = p;
  remote(async () => {
    if (ticketPhotos) {
      const refs = await live.syncPhotos(id, 'ticket', ticketPhotos);
      commit({ ...db, jobs: db.jobs.map(j => (j.id === id ? { ...j, ticketPhotos: refs } : j)) });
    }
    if (jobPhotos) {
      const refs = await live.syncPhotos(id, 'job', jobPhotos);
      commit({ ...db, jobs: db.jobs.map(j => (j.id === id ? { ...j, jobPhotos: refs } : j)) });
    }
    await live.updateJobRow(id, rest);
  });
}

// ---------------------------------------------------------------------------
//  Lesing
// ---------------------------------------------------------------------------

export function useJobs(): Job[] {
  return useSyncExternalStore(subscribe, () => db.jobs);
}
export function useClients(): Client[] {
  return useSyncExternalStore(subscribe, () => db.clients);
}
export function useVehicles(): Vehicle[] {
  return useSyncExternalStore(subscribe, () => db.vehicles);
}
export const getClient = (id: string | undefined) => (id ? db.clients.find(c => c.id === id) : undefined);
export const clientByName = (name: string) => db.clients.find(c => c.name.trim().toLowerCase() === name.trim().toLowerCase());
export const getJob = (id: string | null | undefined) => (id ? db.jobs.find(j => j.id === id) : undefined);
export const allJobs = () => db.jobs;

/** Innlogginger til kundeportalen for en kunde (navn/brukernavn) */
export function portalUsers(clientId: string): string[] {
  if (isLive()) return db.profiles.filter(p => p.role === 'client' && p.client_id === clientId).map(p => p.full_name || '–');
  return config.users.filter(u => u.clientId === clientId).map(u => `${u.username} (${u.name})`);
}

// ---------------------------------------------------------------------------
//  Kunder
// ---------------------------------------------------------------------------

export async function saveClient(data: Omit<Client, 'id'>, id?: string): Promise<Client> {
  if (id) {
    const c = { ...data, id };
    // hold navnet på kundens åpne oppdrag i synk
    const old = getClient(id);
    const rename = old && old.name !== c.name;
    const jobs = rename ? db.jobs.map(j => (j.clientId === id && j.status !== 'ferdig' ? { ...j, customer: c.name } : j)) : db.jobs;
    commit({ ...db, jobs, clients: db.clients.map(x => (x.id === id ? c : x)) }, true);
    if (isLive()) {
      await live.saveClientRow(c, false).catch(remoteError);
      if (rename) {
        const ids = jobs.filter(j => j.clientId === id && j.status !== 'ferdig').map(j => j.id);
        if (ids.length) remote(() => live.updateJobRows(ids, { customer: c.name }));
      }
    }
    return c;
  }
  const c = { ...data, id: isLive() ? live.uuid() : `k${db.nextClient}` };
  commit({ ...db, clients: [...db.clients, c], nextClient: db.nextClient + 1 }, true);
  if (isLive()) await live.saveClientRow(c, true).catch(remoteError);
  return c;
}
export function deleteClient(id: string) {
  commit({ ...db, clients: db.clients.filter(c => c.id !== id), jobs: db.jobs.map(j => (j.clientId === id ? { ...j, clientId: '' } : j)) }, true);
  remote(() => live.deleteClientRow(id));
}

// ---------------------------------------------------------------------------
//  Biler
// ---------------------------------------------------------------------------

/** Legg til eller endre en bil. Kortnavnet på kartnålen lages fra navnet (f.eks. «Bil 7» → «7»). */
export async function saveVehicle(data: Omit<Vehicle, 'id' | 'tag' | 'active'>, id?: string): Promise<Vehicle> {
  const digits = data.name.match(/\d+/)?.[0];
  const tag = (digits ?? data.name.replace(/\s+/g, '').slice(0, 2)).slice(0, 3).toUpperCase();
  if (id) {
    const v = { ...db.vehicles.find(x => x.id === id)!, ...data, tag };
    commit({ ...db, vehicles: db.vehicles.map(x => (x.id === id ? v : x)) }, true);
    if (isLive()) await live.saveVehicleRow(v, false).catch(remoteError);
    return v;
  }
  const v: Vehicle = { ...data, tag, active: true, id: isLive() ? live.uuid() : `b${Date.now().toString(36)}` };
  commit({ ...db, vehicles: [...db.vehicles, v] }, true);
  if (isLive()) await live.saveVehicleRow(v, true, db.vehicles.length).catch(remoteError);
  return v;
}

/** Ta en bil ut av bilparken. Den beholdes i historikken (gamle jobber og rapporter). */
export function removeVehicle(id: string) {
  const v = db.vehicles.find(x => x.id === id);
  if (!v) return;
  const off = { ...v, active: false };
  commit({ ...db, vehicles: db.vehicles.map(x => (x.id === id ? off : x)) }, true);
  remote(() => live.saveVehicleRow(off, false));
}

// ---------------------------------------------------------------------------
//  Jobber
// ---------------------------------------------------------------------------

const stamp = () => `${dayOffset(0)} ${nowHHMM()}`;

/** Godta en bestilling fra portalen. Den blir et vanlig oppdrag (Kommende, eller Aktiv om sjåfør settes). */
export function acceptRequest(id: string, patch: Partial<Job> = {}) {
  updateJob(id, { ...patch, request: '', requestNote: '' }, true);
}
export function declineRequest(id: string, note: string) {
  updateJob(id, { request: 'avvist', requestNote: note }, true);
}

/** Endre en jobb. immediate=false brukes for tasting – da samles endringene før de lagres. */
export function updateJob(id: string, patch: Partial<Job>, immediate = false) {
  commit({ ...db, jobs: db.jobs.map(j => (j.id === id ? { ...j, ...patch } : j)) }, immediate);
  if (!isLive()) return;
  pending.set(id, { ...pending.get(id), ...patch });
  clearTimeout(timers.get(id));
  if (immediate || patch.ticketPhotos || patch.jobPhotos) flush(id);
  else timers.set(id, window.setTimeout(() => flush(id), 600));
}

export function updateJobs(ids: string[], patch: Partial<Job>) {
  const s = new Set(ids);
  commit({ ...db, jobs: db.jobs.map(j => (s.has(j.id) ? { ...j, ...patch } : j)) }, true);
  remote(() => live.updateJobRows(ids, patch));
}

export async function saveOrder(order: JobOrder, id?: string, extra: Partial<Job> = {}): Promise<Job> {
  const old = getJob(id);
  if (old) {
    const j = norm({ ...old, ...order, ...extra });
    commit({ ...db, jobs: db.jobs.map(x => (x.id === old.id ? j : x)) }, true);
    if (isLive()) await live.updateJobRow(old.id, { ...order, ...extra }).catch(remoteError);
    return j;
  }
  const j: Job = norm({
    id: isLive() ? live.uuid() : `${config.jobPrefix}-${db.nextNo}`,
    no: isLive() ? '…' : `${config.jobPrefix}-${db.nextNo}`,
    status: 'kommende',
    ...order,
    driverName: '',
    request: '',
    requestNote: '',
    orderedBy: 'kontor',
    orderedAt: stamp(),
    massType: '',
    amount: '',
    unit: config.units[0],
    disposal: '',
    start: '',
    end: '',
    steps: {},
    ticketNo: '',
    ticketPhotos: [],
    jobPhotos: [],
    decl: '',
    comment: '',
    invoiced: false,
    invoicedAt: '',
    closedAt: '',
    ...extra,
  });
  if (!isLive()) {
    commit({ ...db, jobs: [...db.jobs, j], nextNo: db.nextNo + 1 }, true);
    return j;
  }
  try {
    const saved = await live.insertJob(j);
    commit({ ...db, jobs: [...db.jobs.filter(x => x.id !== saved.id), saved] });
    return saved;
  } catch (e) {
    remoteError(e);
    throw e;
  }
}

export function deleteJob(id: string) {
  commit({ ...db, jobs: db.jobs.filter(j => j.id !== id) }, true);
  remote(() => live.deleteJobRow(id));
}

export function resetDemo() {
  if (isLive()) return;
  try {
    localStorage.removeItem(config.storageKey);
  } catch {
    /* ignorer */
  }
  commit(fresh(), true);
}
