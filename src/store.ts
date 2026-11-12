import { useSyncExternalStore } from 'react';
import { config } from './config';
import { createSeed } from './data/seed';
import { toast } from './lib/toast';
import { dayOffset, daysBetween, shiftDate } from './lib/utils';
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

/** Status følger tildelingen: uten bil = kommende, med bil = aktiv. Ferdig settes bare ved lukking. */
const norm = (j: Job): Job => {
  const status = j.status === 'ferdig' ? 'ferdig' : j.car ? 'aktiv' : 'kommende';
  return status === j.status && j.pin ? j : { ...j, status, pin: j.pin ?? 'adresse' };
};

function fresh(): DB {
  const { jobs, nextNo } = createSeed();
  return { v: 1, jobs: jobs.map(norm), nextNo, day: dayOffset(0) };
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
        db.jobs = db.jobs.map(norm);
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
    const j = norm({ ...old, ...order });
    commit({ ...db, jobs: db.jobs.map(x => (x.id === old.id ? j : x)) }, true);
    return j;
  }
  const j: Job = norm({
    id: `${config.jobPrefix}-${db.nextNo}`,
    status: 'kommende',
    ...order,
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
