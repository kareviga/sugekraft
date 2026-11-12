import type { Job, StepKey } from '../types';
import { config } from '../config';

/*
 * Statuspunkter sjåføren huker av, i fast rekkefølge.
 * «Ankommet deponi» gjelder bare når massene skal deponeres (masse valgt, og ikke «ingen masse»).
 * «Startet arbeid» og «Fullført arbeid» gir arbeidstiden (start/slutt) som brukes i fakturagrunnlaget.
 * «Ferdig» avslutter jobben.
 */

export interface StepDef {
  key: StepKey;
  label: string;
  /** Tekst på knappen når punktet står for tur */
  action: string;
}

export const STEPS: StepDef[] = [
  { key: 'kjoring', label: 'Startet kjøring', action: 'Start kjøring' },
  { key: 'ankommet', label: 'Ankommet sted', action: 'Ankommet sted' },
  { key: 'arbeid', label: 'Startet arbeid', action: 'Start arbeid' },
  { key: 'fullfort', label: 'Fullført arbeid', action: 'Fullført arbeid' },
  { key: 'kjortFra', label: 'Kjørt fra sted', action: 'Kjørt fra sted' },
  { key: 'deponi', label: 'Ankommet deponi', action: 'Ankommet deponi' },
  { key: 'ferdig', label: 'Ferdig', action: 'Ferdig – avslutt jobben' },
];

const noMass = (j: Job) => !!config.massTypes.find(m => m.name === j.massType)?.noMass;

/** Skal massene deponeres? (masse er valgt og krever mengde/deponi) */
export const needsDepot = (j: Job) => !!j.massType && !noMass(j);

/** Punktene som gjelder for denne jobben */
export const stepsFor = (j: Job) => STEPS.filter(s => s.key !== 'deponi' || needsDepot(j) || !!j.steps.deponi);

export const nextStep = (j: Job) => stepsFor(j).find(s => !j.steps[s.key]);
export const lastStep = (j: Job) => [...stepsFor(j)].reverse().find(s => j.steps[s.key]);

/** Sjåføren har startet (kjører, er på stedet eller jobber) */
export const underway = (j: Job) => j.status === 'aktiv' && !!j.steps.kjoring;

/** Kort tekst om hvor langt jobben har kommet, f.eks. «Ankommet sted 08:40» */
export function progress(j: Job): string {
  const l = lastStep(j);
  return l ? `${l.label} ${j.steps[l.key]!.time}` : 'Ikke startet';
}

/** Felt som følger med statuspunktene */
export function stepSideEffects(key: StepKey, time: string, depot?: string): Partial<Job> {
  if (key === 'arbeid') return { start: time };
  if (key === 'fullfort') return { end: time };
  if (key === 'deponi') return { disposal: depot ?? '' };
  return {};
}
export function stepUndoEffects(key: StepKey): Partial<Job> {
  if (key === 'arbeid') return { start: '' };
  if (key === 'fullfort') return { end: '' };
  if (key === 'deponi') return { disposal: '' };
  return {};
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
/** Total tid fra «Startet kjøring» til «Ferdig» (eller siste punkt), i timer */
export function totalHours(j: Job) {
  const a = j.steps.kjoring?.time;
  const l = lastStep(j);
  const b = l && j.steps[l.key]!.time;
  if (!a || !b) return 0;
  let d = toMin(b) - toMin(a);
  if (d < 0) d += 1440;
  return d / 60;
}
