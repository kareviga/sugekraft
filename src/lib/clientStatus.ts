import type { Job } from '../types';
import { progress, underway } from './steps';

export type Tone = 'wait' | 'no' | 'ok' | 'plan' | 'run' | 'done';

/** Status slik kunden ser den i portalen. */
export function clientStatus(j: Job): { label: string; tone: Tone; detail: string } {
  if (j.request === 'venter') return { label: 'Venter på godkjenning', tone: 'wait', detail: 'Bestillingen er mottatt og blir behandlet.' };
  if (j.request === 'avvist') return { label: 'Avvist', tone: 'no', detail: j.requestNote || 'Bestillingen kunne ikke tas.' };
  if (j.status === 'ferdig') return { label: 'Utført', tone: 'done', detail: 'Jobben er utført.' };
  if (underway(j)) return { label: 'Pågår', tone: 'run', detail: progress(j) };
  if (j.status === 'aktiv') return { label: 'Planlagt', tone: 'plan', detail: 'Bil og sjåfør er satt opp.' };
  return { label: 'Bekreftet', tone: 'ok', detail: 'Bestillingen er godkjent og blir planlagt.' };
}
