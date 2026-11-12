import type { Vehicle } from '../config';
import type { Job } from '../types';
import { dayOffset, driver } from './utils';

export type VState = 'oppdrag' | 'planlagt' | 'ledig' | 'ute';

export const VSTATE_LABEL: Record<VState, string> = {
  oppdrag: 'På oppdrag',
  planlagt: 'Har jobber',
  ledig: 'Ledig',
  ute: 'Ute av drift',
};

export interface VehicleStatus {
  state: VState;
  driverId: string;
  driverName: string;
  /** Jobb som pågår (har starttid) */
  active?: Job;
  /** Neste jobb som ikke er startet (i dag eller senere) */
  next?: Job;
  /** Alle jobbene bilen har i dag */
  today: Job[];
  doneToday: number;
  /** Åpne jobber totalt (alle datoer) */
  open: number;
  outNote?: string;
}

const byTime = (a: Job, b: Job) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99');

/** Status for én bil, utledet av jobber, bemanning og drift. */
export function vehicleStatus(v: Vehicle, jobs: Job[], crew: Record<string, string>, out: Record<string, string>): VehicleStatus {
  const today = dayOffset(0);
  const mine = jobs.filter(j => j.car === v.id);
  const openJobs = mine.filter(j => j.status === 'aktiv').sort(byTime);
  const active = openJobs.find(j => j.start);
  const next = openJobs.find(j => !j.start);
  const todays = mine.filter(j => j.date === today).sort(byTime);
  const d = driver(crew[v.id]);
  const outNote = out[v.id];
  const state: VState = outNote !== undefined ? 'ute' : active ? 'oppdrag' : next && next.date <= today ? 'planlagt' : 'ledig';
  return {
    state,
    driverId: d?.id ?? '',
    driverName: d?.name ?? '',
    active,
    next,
    today: todays,
    doneToday: mine.filter(j => j.status === 'ferdig' && j.closedAt === today).length,
    open: openJobs.length,
    outNote,
  };
}
