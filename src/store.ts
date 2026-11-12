import { useSyncExternalStore } from 'react';
import { config } from './config';
import { createSeed } from './data/seed';
import { toast } from './lib/toast';
import { dayOffset, daysBetween, placePos, shiftDate } from './lib/utils';
import type { Job, JobOrder } from './types';

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
}

function fresh(): DB {
  const { jobs, nextNo } = createSeed();
  return { v: 1, jobs, nextNo, day: dayOffset(0) };
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
        // eldre lagring kan ha status «kommende» – den finnes ikke lenger
        db.jobs = db.jobs.map(j => ((j.status as string) === 'kommende' ? { ...j, status: 'aktiv' } : j));
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
  db = next;
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
export const getJob = (id: string | null | undefined) => (id ? db.jobs.find(j => j.id === id) : undefined);
export const allJobs = () => db.jobs;

export function updateJob(id: string, patch: Partial<Job>, immediate = false) {
  commit({ ...db, jobs: db.jobs.map(j => (j.id === id ? { ...j, ...patch } : j)) }, immediate);
}

export function updateJobs(ids: string[], patch: Partial<Job>) {
  const s = new Set(ids);
  commit({ ...db, jobs: db.jobs.map(j => (s.has(j.id) ? { ...j, ...patch } : j)) }, true);
}

export function saveOrder(order: JobOrder, id?: string): Job {
  const old = getJob(id);
  if (old) {
    const moved = old.place !== order.place;
    const pos = moved ? placePos(order.place, db.jobs.indexOf(old) + 7) : [old.lat, old.lon];
    const j = { ...old, ...order, lat: pos[0], lon: pos[1] };
    commit({ ...db, jobs: db.jobs.map(x => (x.id === old.id ? j : x)) }, true);
    return j;
  }
  const [lat, lon] = placePos(order.place, db.nextNo);
  const j: Job = {
    id: `${config.jobPrefix}-${db.nextNo}`,
    status: 'aktiv',
    ...order,
    lat,
    lon,
    massType: '',
    amount: '',
    unit: config.units[0],
    disposal: '',
    start: '',
    end: '',
    ticketNo: '',
    ticketPhotos: [],
    jobPhotos: [],
    decl: '',
    comment: '',
    invoiced: false,
    invoicedAt: '',
    closedAt: '',
  };
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
