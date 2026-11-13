import type { Vehicle } from '../config';
import type { Job } from '../types';
import { dayOffset, driver } from './utils';
import { underway } from './steps';

/*
 * Status for en bil utledes av oppdragene.
 * - På oppdrag: sjåføren har huket av «Startet kjøring» på en jobb med bilen
 * - Har jobber: bilen har tildelte jobber i dag som ikke er startet
 * - Ledig: ingen åpne jobber i dag
 */

export type VState = 'oppdrag' | 'planlagt' | 'ledig';

export const VSTATE_LABEL: Record<VState, string> = {
  oppdrag: 'På oppdrag',
  planlagt: 'Har jobber i dag',
  ledig: 'Ledig',
};

export interface VehicleStatus {
  state: VState;
  /** Sjåføren i bilen nå (fra jobben som pågår) */
  nowDriver: string;
  /** Jobb som pågår */
  active?: Job;
  /** Neste jobb som ikke er startet */
  next?: Job;
  /** Bilens jobber i dag, i rekkefølge */
  today: Job[];
  doneToday: number;
  /** Åpne jobber på bilen, alle datoer */
  open: number;
}

const byTime = (a: Job, b: Job) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99');

export function vehicleStatus(v: Vehicle, jobs: Job[]): VehicleStatus {
  const today = dayOffset(0);
  const mine = jobs.filter(j => j.car === v.id);
  const openJobs = mine.filter(j => j.status !== 'ferdig').sort(byTime);
  const active = openJobs.find(underway);
  const next = openJobs.find(j => !underway(j));
  const state: VState =
    active ? 'oppdrag' : openJobs.some(j => j.date <= today) ? 'planlagt' : 'ledig';
  return {
    state,
    nowDriver: active ? driver(active.driver)?.name ?? '' : '',
    active,
    next,
    today: mine.filter(j => j.date === today).sort((a, b) => (a.steps.kjoring?.time || a.time || '99').localeCompare(b.steps.kjoring?.time || b.time || '99')),
    doneToday: mine.filter(j => j.status === 'ferdig' && j.closedAt === today).length,
    open: openJobs.length,
  };
}

/** Er sjåføren opptatt på en annen jobb som pågår nå? Returnerer den jobben. */
export const driverBusy = (driverId: string, jobs: Job[], exceptJob?: string) =>
  driverId ? jobs.find(j => j.driver === driverId && underway(j) && j.id !== exceptJob) : undefined;
