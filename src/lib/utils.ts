import { config } from '../config';
import type { Job } from '../types';

export const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
};
export const dayOffset = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const shiftDate = (s: string, n: number) => {
  if (!s) return s;
  const [y, m, d] = s.split('-').map(Number);
  return iso(new Date(y, m - 1, d + n, 12));
};
export const daysBetween = (a: string, b: string) => {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
};
export const nice = (s: string) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
};
const WD = ['søn.', 'man.', 'tir.', 'ons.', 'tor.', 'fre.', 'lør.'];
export const relDay = (s: string) => {
  const n = daysBetween(dayOffset(0), s);
  if (n === 0) return 'I dag';
  if (n === 1) return 'I morgen';
  if (n === -1) return 'I går';
  const [y, m, d] = s.split('-').map(Number);
  const wd = WD[new Date(y, m - 1, d).getDay()];
  return `${wd} ${d}.${m}.`;
};
export const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString('nb-NO');
export const nowHHMM = () => {
  const n = new Date();
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
};

export const vehicle = (id: string) => config.vehicles.find(v => v.id === id);
export const vehicleName = (id: string) => vehicle(id)?.name ?? 'Ikke tildelt';
export const vehicleLong = (id: string) => {
  const v = vehicle(id);
  return v ? `${v.name} – ${v.type} (${v.driver})` : 'Ikke tildelt';
};

export function hours(j: Pick<Job, 'start' | 'end'>) {
  if (!j.start || !j.end) return 0;
  const [a, b] = j.start.split(':').map(Number), [c, d] = j.end.split(':').map(Number);
  let m = c * 60 + d - a * 60 - b;
  if (m < 0) m += 1440;
  return m / 60;
}

const mass = (name: string) => config.massTypes.find(m => m.name === name);
export const isHaz = (j: Job) => !!mass(j.massType)?.hazardous;
export const isNoMass = (j: Job) => !!mass(j.massType)?.noMass;
export const fmtAmount = (j: Job) => (isNoMass(j) || !j.amount ? '–' : `${num(+j.amount)} ${j.unit}`);

/** Påkrevde felt før en jobb kan lukkes. [etikett, oppfylt] */
export function requirements(j: Job): [string, boolean][] {
  const r: [string, boolean][] = [
    ['Bilde av kjøreseddel', j.ticketPhotos.length > 0],
    ['Kjøreseddelnummer', !!j.ticketNo.trim()],
    ['Bilde av jobben', j.jobPhotos.length > 0],
    ['Type masse', !!j.massType],
  ];
  if (j.massType && !isNoMass(j)) {
    r.push(['Mengde', +j.amount > 0]);
    r.push(['Deponi eller mottak', !!j.disposal]);
  }
  if (isHaz(j)) r.push(['Deklarasjonsnummer (farlig avfall)', !!j.decl.trim()]);
  r.push(['Start- og sluttid', !!(j.start && j.end)]);
  return r;
}
export const missing = (j: Job) => requirements(j).filter(r => !r[1]).map(r => r[0]);

/** Plasser en jobb litt tilfeldig (men stabilt) rundt stedets sentrum. */
export function placePos(place: string, seed: number): [number, number] {
  const p = config.map.places[place] ?? config.map.center;
  return [p[0] + (((seed * 37) % 11) - 5) * 0.0055, p[1] + (((seed * 53) % 13) - 6) * 0.012];
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export const download = (name: string) => name.replace(/[^\wæøåÆØÅ-]+/g, '_');

export function totals(list: Job[]) {
  const amounts: Record<string, number> = {};
  list.forEach(j => {
    if (!j.amount || fmtAmount(j) === '–') return;
    const k = `${j.massType} (${j.unit})`;
    amounts[k] = (amounts[k] || 0) + +j.amount;
  });
  return {
    hours: list.reduce((a, j) => a + hours(j), 0),
    photos: list.reduce((a, j) => a + j.ticketPhotos.length + j.jobPhotos.length, 0),
    amounts,
  };
}
