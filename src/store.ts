import { useSyncExternalStore } from 'react';
import { config } from './config';
import { createSeed } from './data/seed';
import { toast } from './lib/toast';
import { dayOffset, daysBetween, shiftDate } from './lib/utils';
import type { Client, Job, JobOrder } from './types';
import { nowHHMM } from './lib/utils';

/*
 * Enkel lagring i localStorage. Ingen backend.
 * Datoene «følger med» i tid: åpnes demoen en senere dag, flyttes alle
 * datoer like mange dager fram, slik at «i dag» og «i morgen» stemmer.
 */

interface DB {
  v: 1;
  jobs: Job[];
  nextNo: number;
  day: string;
  /** Biler ute av drift: bil-id → merknad */
  out: Record<string, string>;
  /** Kunderegister */
  clients: Client[];
  nextClient: number;
}

/** Status følger tildelingen: uten sjåfør = kommende, med sjåfør = aktiv. Ferdig settes bare ved lukking. */
const norm = (j: Job): Job => {
  const status = j.status === 'ferdig' ? 'ferdig' : j.driver ? 'aktiv' : 'kommende';
  if (status === j.status && j.pin && j.steps && j.orderedBy) return j;
  return {
    ...j,
    status,
    pin: j.pin ?? 'adresse',
    steps: j.steps ?? {},
    clientId: j.clientId ?? '',
    request: j.request ?? '',
    requestNote: j.requestNote ?? '',
    orderedBy: j.orderedBy ?? 'kontor',
    orderedAt: j.orderedAt ?? '',
  };
};

function fresh(): DB {
  const { jobs, nextNo, out, clients } = createSeed();
  return { v: 1, jobs: jobs.map(norm), nextNo, day: dayOffset(0), out, clients, nextClient: clients.length + 1 };
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
  try {
    const raw = localStorage.getItem(config.storageKey);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db && db.v === 1 && Array.isArray(db.jobs)) {
        db.jobs = db.jobs.map(j => norm({ ...j, driver: j.driver ?? '', driverName: j.driverName ?? '' }));
        db.out = db.out ?? {};
        db.clients = db.clients ?? [];
        db.nextClient = db.nextClient ?? db.clients.length + 1;
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
  try {
    localStorage.setItem(config.storageKey, JSON.stringify(db));
  } catch {
    toast('Lagringsplassen i nettleseren er full. Fjern noen bilder eller nullstill demoen.');
  }
}
function commit(next: DB, immediate = false) {
  db = { ...next, jobs: next.jobs.map(norm) };
  listeners.forEach(l => l());
  clearTimeout(saveTimer);
  if (immediate) persistNow();
  else saveTimer = window.setTimeout(persistNow, 250);
}
persistNow();
window.addEventListener('beforeunload', persistNow);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useJobs(): Job[] {
  return useSyncExternalStore(subscribe, () => db.jobs);
}
export function useClients(): Client[] {
  return useSyncExternalStore(subscribe, () => db.clients);
}
export const getClient = (id: string | undefined) => (id ? db.clients.find(c => c.id === id) : undefined);
export const clientByName = (name: string) => db.clients.find(c => c.name.trim().toLowerCase() === name.trim().toLowerCase());

export function saveClient(data: Omit<Client, 'id'>, id?: string): Client {
  if (id) {
    const c = { ...data, id };
    // hold navnet på kundens åpne oppdrag i synk
    const old = getClient(id);
    const jobs = old && old.name !== c.name ? db.jobs.map(j => (j.clientId === id && j.status !== 'ferdig' ? { ...j, customer: c.name } : j)) : db.jobs;
    commit({ ...db, jobs, clients: db.clients.map(x => (x.id === id ? c : x)) }, true);
    return c;
  }
  const c = { ...data, id: `k${db.nextClient}` };
  commit({ ...db, clients: [...db.clients, c], nextClient: db.nextClient + 1 }, true);
  return c;
}
export function deleteClient(id: string) {
  commit({ ...db, clients: db.clients.filter(c => c.id !== id), jobs: db.jobs.map(j => (j.clientId === id ? { ...j, clientId: '' } : j)) }, true);
}

const stamp = () => `${dayOffset(0)} ${nowHHMM()}`;
/** Godta en bestilling fra portalen. Den blir et vanlig oppdrag (Kommende, eller Aktiv om sjåfør settes). */
export function acceptRequest(id: string, patch: Partial<Job> = {}) {
  updateJob(id, { ...patch, request: '', requestNote: '' }, true);
}
export function declineRequest(id: string, note: string) {
  updateJob(id, { request: 'avvist', requestNote: note }, true);
}

export function useOut(): Record<string, string> {
  return useSyncExternalStore(subscribe, () => db.out);
}

/** Sett bil ute av drift (med merknad) eller tilbake i drift (null). */
export function setOut(vehicleId: string, note: string | null) {
  const out = { ...db.out };
  if (note === null) delete out[vehicleId];
  else out[vehicleId] = note;
  commit({ ...db, out }, true);
}
export const getJob = (id: string | null | undefined) => (id ? db.jobs.find(j => j.id === id) : undefined);
export const allJobs = () => db.jobs;

export function updateJob(id: string, patch: Partial<Job>, immediate = false) {
  commit({ ...db, jobs: db.jobs.map(j => (j.id === id ? { ...j, ...patch } : j)) }, immediate);
}

export function updateJobs(ids: string[], patch: Partial<Job>) {
  const s = new Set(ids);
  commit({ ...db, jobs: db.jobs.map(j => (s.has(j.id) ? { ...j, ...patch } : j)) }, true);
}

export function saveOrder(order: JobOrder, id?: string, extra: Partial<Job> = {}): Job {
  const old = getJob(id);
  if (old) {
    const j = norm({ ...old, ...order, ...extra });
    commit({ ...db, jobs: db.jobs.map(x => (x.id === old.id ? j : x)) }, true);
    return j;
  }
  const j: Job = norm({
    id: `${config.jobPrefix}-${db.nextNo}`,
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
  commit({ ...db, jobs: [...db.jobs, j], nextNo: db.nextNo + 1 }, true);
  return j;
}

export function deleteJob(id: string) {
  commit({ ...db, jobs: db.jobs.filter(j => j.id !== id) }, true);
}

export function resetDemo() {
  try {
    localStorage.removeItem(config.storageKey);
  } catch {
    /* ignorer */
  }
  commit(fresh(), true);
}
