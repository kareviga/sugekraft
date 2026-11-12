import type { Job } from '../types';
import { progress, underway } from './steps';
import { tr } from '../i18n';

export type Tone = 'wait' | 'no' | 'ok' | 'plan' | 'run' | 'done';

/** Status slik kunden ser den i portalen. */
export function clientStatus(j: Job): { label: string; tone: Tone; detail: string } {
  if (j.request === 'venter') return { label: tr('Venter på godkjenning'), tone: 'wait', detail: tr('Bestillingen er mottatt og blir behandlet.') };
  if (j.request === 'avvist') return { label: tr('Avvist'), tone: 'no', detail: j.requestNote || tr('Bestillingen kunne ikke tas.') };
  if (j.status === 'ferdig') return { label: tr('Utført'), tone: 'done', detail: tr('Jobben er utført.') };
  if (underway(j)) return { label: tr('Pågår'), tone: 'run', detail: progress(j) };
  if (j.status === 'aktiv') return { label: tr('Planlagt'), tone: 'plan', detail: tr('Bil og sjåfør er satt opp.') };
  return { label: tr('Bekreftet'), tone: 'ok', detail: tr('Bestillingen er godkjent og blir planlagt.') };
}
