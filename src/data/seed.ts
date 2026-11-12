import { config } from '../config';
import type { Job } from '../types';
import { dayOffset } from '../lib/utils';

/*
 * Eksempeldata rundt Oslo. Datoer er relative til i dag, slik at demoen alltid
 * ser fersk ut. Koordinatene er hentet fra Kartverkets adresseregister.
 * Biler, oppdragstyper, masser og deponier slås opp i config – finnes et navn
 * ikke der, brukes et gyldig alternativ, slik at demoen tåler endringer.
 *
 * Status settes automatisk: uten bil = Kommende, med bil = Aktiv, lukket = Ferdig.
 */

const pick = <T,>(arr: T[], want: T | undefined, i: number): T =>
  want !== undefined && arr.includes(want) ? want : arr[i % arr.length];
const S = (name: string, i: number) => pick(config.services, name, i);
const M = (name: string, i: number) => pick(config.massTypes.map(m => m.name), name, i);
const D = (i: number) => config.depots[i % config.depots.length];
const C = (i: number) => (i < 0 || !config.vehicles.length ? '' : config.vehicles[i % config.vehicles.length].id);

// [adresse, sted, lat, lon, plassering]
type Addr = [string, string, number, number, ('kart' | undefined)?];
const A = {
  stromsv: ['Strømsveien 266', 'Oslo', 59.92915, 10.84818],
  oledeviks: ['Ole Deviks vei 10', 'Oslo', 59.91467, 10.82584],
  ostensjo: ['Østensjøveien 39', 'Oslo', 59.91051, 10.81222],
  trondheimsv: ['Trondheimsveien 2', 'Oslo', 59.91871, 10.7617],
  bygdoy: ['Bygdøy allé 5', 'Oslo', 59.91512, 10.71639],
  ekeberg: ['Ekebergveien 59', 'Oslo', 59.89938, 10.77466],
  holmenkoll: ['Holmenkollveien 50', 'Oslo', 59.9509, 10.67465],
  haslev: ['Haslevangen 15', 'Oslo', 59.92545, 10.79391],
  lorenskogv: ['Lørenskogveien 75', 'Lørenskog', 59.93796, 10.93656],
  solheim: ['Solheimveien 112', 'Lørenskog', 59.9284, 10.96446],
  industriv: ['Industriveien 25', 'Skedsmokorset', 60.0135, 11.04093],
  slepend: ['Slependveien 108', 'Billingstad', 59.87766, 10.50385],
  hagalokk: ['Hagaløkkveien 26', 'Asker', 59.82854, 10.43026],
  kirkevski: ['Kirkeveien 1', 'Ski', 59.72054, 10.8361],
  grorud: ['Grorudveien 5', 'Oslo', 59.95863, 10.88241],
  maridal: ['Maridalsveien 300', 'Oslo', 59.95368, 10.76044],
  snaroy: ['Snarøyveien 30', 'Fornebu', 59.89928, 10.62738],
  alfaset: ['Alfasetveien 11', 'Oslo', 59.93134, 10.84802],
  sandaker: ['Sandakerveien 56A', 'Oslo', 59.9374, 10.76603],
  nydal: ['Nydalsveien 28', 'Oslo', 59.94965, 10.7641],
  furulund: ['Verkseier Furulunds vei 15', 'Oslo', 59.92848, 10.85647],
  ryen: ['Ryensvingen 7', 'Oslo', 59.89254, 10.80534],
  lysaker: ['Lysaker torg 5', 'Lysaker', 59.91253, 10.63714],
  nesbru: ['Nesbruveien 75', 'Nesbru', 59.86681, 10.4907],
  kjelsaas: ['Kjelsåsveien 161', 'Oslo', 59.96852, 10.77233],
  tveten: ['Tvetenveien 32', 'Oslo', 59.91249, 10.81932],
  // uten adresse – nålen er plassert manuelt i kartet
  kum: ['Kum K-117 ved turveien langs Alnaelva', 'Oslo', 59.9412, 10.8655, 'kart'],
  hytte: ['Hyttefelt Sørkedalen, hytte 14', 'Oslo', 59.9962, 10.6105, 'kart'],
  rigg: ['Riggområde ved E18, Fornebukrysset', 'Bærum', 59.9036, 10.6268, 'kart'],
} satisfies Record<string, Addr>;
type AddrKey = keyof typeof A;

const CUST = {
  nordbygg: { customer: 'Nordbygg Anlegg AS', contact: 'Geir Moen', phone: '900 00 215' },
  sorkedal: { customer: 'Sørkedalen Hytteeierlag', contact: 'Anne Dal', phone: '900 00 311' },
  alna: { customer: 'Alna Bilverksted AS', contact: 'Jon Lie', phone: '900 00 412' },
  kjokken: { customer: 'Elvebredden Restaurantdrift AS', contact: 'Siri Holm', phone: '900 00 516' },
  kommune: { customer: 'Kommunalteknikk Øst, VA', contact: 'Vakttelefon VA', phone: '900 00 600' },
  gard: { customer: 'Maridalen Gårdsdrift', contact: 'Liv Nordi', phone: '900 00 714' },
  eiendom: { customer: 'Akerselva Eiendom AS', contact: 'Morten Bakke', phone: '900 00 731' },
  kantine: { customer: 'Kollen Kantine AS', contact: 'Hanne Bjørkli', phone: '900 00 822' },
  ryen: { customer: 'Ryen Borettslag', contact: 'Styreleder Tor Aas', phone: '900 00 903' },
  transport: { customer: 'Furulund Transport AS', contact: 'Rune Strand', phone: '900 00 177' },
  naering: { customer: 'Lørenskog Næringspark AS', contact: 'Elin Berg', phone: '900 00 260' },
  asker: { customer: 'Asker Maskin AS', contact: 'Kjetil Rød', phone: '900 00 344' },
};
type CustKey = keyof typeof CUST;

interface Row {
  done?: boolean; // lukket
  c: CustKey;
  a: AddrKey;
  d: number; // dag relativt til i dag
  service: string;
  car: number; // indeks i config.vehicles, -1 = ikke tildelt (Kommende)
  ref?: string;
  time?: string;
  note?: string;
  urgent?: boolean;
  mass?: string;
  amount?: string;
  unit?: string;
  depot?: number;
  start?: string;
  end?: string;
  ticket?: string;
  photos?: number[];
  ticketPhoto?: boolean;
  decl?: string;
  comment?: string;
  invoiced?: boolean;
}

const ROWS: Row[] = [
  // ---- Kommende: ikke tildelt bil ----
  { c: 'gard', a: 'maridal', d: 0, service: 'Tining av frosne rør', car: -1, time: '13:00', note: 'Fjøs uten vann siden i natt. Ring før ankomst.', urgent: true },
  { c: 'eiendom', a: 'nydal', d: 1, service: 'Tankrengjøring', car: -1, ref: 'AE-339', note: 'Gammel fyringsoljetank, 3000 liter. Skal saneres.' },
  { c: 'kommune', a: 'kum', d: 2, service: 'Høytrykkspyling', car: -1, ref: 'K-2026-336', time: '08:00', note: 'Ingen adresse – se nål i kartet. Kjør inn fra parkeringen ved Haugerud.' },
  { c: 'asker', a: 'nesbru', d: 4, service: 'Tømming oljeutskiller', car: -1, ref: 'AM-5521' },

  // ---- Aktiv: tildelt, planlagt ----
  { c: 'sorkedal', a: 'hytte', d: 0, service: 'Tømming septik', car: 1, ref: 'HYT-118', time: '13:30', note: 'Bom ved innkjøring, kode 2580. Nålen viser tanken bak hytta.' },
  { c: 'alna', a: 'alfaset', d: 0, service: 'Tømming oljeutskiller', car: 4, ref: 'PO-7741', time: '14:30' },
  { c: 'kommune', a: 'grorud', d: 1, service: 'Tømming sandfang', car: 3, ref: 'K-2026-331', time: '07:30', note: 'Ring vakttelefon ved ankomst. 6 sandfang langs Grorudveien.' },
  { c: 'nordbygg', a: 'rigg', d: 1, service: 'Vakuumgraving', car: 0, ref: 'P-5502', time: '07:00', note: 'Kabelpåvisning er gjort. Grav forsiktig langs blå merking.' },
  { c: 'kantine', a: 'holmenkoll', d: 2, service: 'Tømming fettutskiller', car: 1, ref: 'KK-2026-14', time: '10:00' },
  { c: 'ryen', a: 'ryen', d: 2, service: 'Høytrykkspyling', car: 2, ref: 'Sak 44/26', time: '08:00', note: 'Stakeluke i kjeller blokk C. Vaktmester møter.' },
  { c: 'transport', a: 'furulund', d: 3, service: 'Spillolje', car: 4, ref: 'FT-1093', time: '12:00' },

  // ---- Aktiv: pågår i dag ----
  { c: 'nordbygg', a: 'stromsv', d: 0, service: 'Vakuumgraving', car: 0, ref: 'P-5498', mass: 'Gravemasser', amount: '12', start: '07:30', photos: [1] },
  { c: 'kjokken', a: 'trondheimsv', d: 0, service: 'Tømming fettutskiller', car: 1, ref: 'EB-90', start: '08:15' },
  { c: 'kommune', a: 'haslev', d: 0, service: 'Høytrykkspyling', car: 2, ref: 'K-2026-327', mass: 'Ingen masse (kun spyling/inspeksjon)', start: '09:00', photos: [2] },
  { c: 'eiendom', a: 'sandaker', d: 0, service: 'Tømming tett tank', car: 3, ref: 'AE-337', mass: 'Avløpsvann (tett tank)', amount: '8', start: '10:05', ticket: '48231', ticketPhoto: true, photos: [3] },

  // ---- Ferdig ----
  { done: true, c: 'nordbygg', a: 'stromsv', d: -1, service: 'Vakuumgraving', car: 0, ref: 'P-5498', mass: 'Gravemasser', amount: '18', depot: 2, start: '07:00', end: '14:30', ticket: '48213', photos: [3, 4], ticketPhoto: true, comment: 'Trang adkomst, brukte 30 m ekstra slange.' },
  { done: true, c: 'sorkedal', a: 'hytte', d: -2, service: 'Tømming septik', car: 1, ref: 'HYT-117', mass: 'Septikslam', amount: '6', depot: 0, start: '11:00', end: '12:10', ticket: '48210', photos: [7], ticketPhoto: true },
  { done: true, c: 'kjokken', a: 'trondheimsv', d: -2, service: 'Tømming fettutskiller', car: 1, ref: 'EB-88', mass: 'Innhold fettutskiller', amount: '4.5', depot: 0, start: '13:00', end: '13:55', ticket: '48211', photos: [9], ticketPhoto: true },
  { done: true, c: 'nordbygg', a: 'snaroy', d: -3, service: 'Blåsing av pukk', car: 0, ref: 'P-5502', mass: 'Pukk', amount: '9', unit: 'tonn', depot: 4, start: '10:00', end: '13:15', ticket: '48207', photos: [5], ticketPhoto: true },
  { done: true, c: 'nordbygg', a: 'lysaker', d: -4, service: 'Tømming oljeutskiller', car: 4, ref: 'P-5470', mass: 'Oljeholdig slam (oljeutskiller)', amount: '3.5', depot: 3, decl: '3127740', start: '08:00', end: '10:45', ticket: '48199', photos: [6], ticketPhoto: true },
  { done: true, c: 'kommune', a: 'tveten', d: -4, service: 'Tømming sandfang', car: 3, ref: 'K-2026-318', mass: 'Innhold sandfang', amount: '11', depot: 2, start: '07:30', end: '15:00', ticket: '48201', photos: [10, 11], ticketPhoto: true, comment: '14 sandfang tømt. Sandfang ved nr. 12 har knekt rist.' },
  { done: true, c: 'alna', a: 'alfaset', d: -6, service: 'Spillolje', car: 4, ref: 'PO-7702', mass: 'Spillolje', amount: '850', unit: 'liter', depot: 3, decl: '3126981', start: '13:00', end: '13:50', ticket: '48188', photos: [12], ticketPhoto: true },
  { done: true, c: 'naering', a: 'solheim', d: -7, service: 'Tømming sandfang', car: 3, ref: 'LN-220', mass: 'Innhold sandfang', amount: '6', depot: 2, start: '09:00', end: '11:40', ticket: '48184', photos: [13], ticketPhoto: true },
  { done: true, c: 'nordbygg', a: 'oledeviks', d: -8, service: 'Vakuumgraving', car: 0, ref: 'P-5498', mass: 'Gravemasser', amount: '22', depot: 2, start: '07:00', end: '15:30', ticket: '48180', photos: [8, 13], ticketPhoto: true },
  { done: true, c: 'kjokken', a: 'bygdoy', d: -9, service: 'Tømming fettutskiller', car: 1, ref: 'EB-85', mass: 'Innhold fettutskiller', amount: '4', depot: 0, start: '13:00', end: '14:20', ticket: '48176', photos: [14], ticketPhoto: true, invoiced: true },
  { done: true, c: 'ryen', a: 'ryen', d: -10, service: 'Rørinspeksjon (kamera)', car: 2, ref: 'Sak 41/26', mass: 'Ingen masse (kun spyling/inspeksjon)', start: '09:00', end: '11:30', ticket: '48170', photos: [15], ticketPhoto: true, comment: 'Rotinntrenging ved 14 m. Anbefaler fresing.' },
  { done: true, c: 'kantine', a: 'holmenkoll', d: -12, service: 'Tømming fettutskiller', car: 1, ref: 'KK-2026-11', mass: 'Innhold fettutskiller', amount: '3', depot: 0, start: '10:15', end: '11:20', ticket: '48161', photos: [16], ticketPhoto: true, invoiced: true },
  { done: true, c: 'kommune', a: 'ekeberg', d: -14, service: 'Høytrykkspyling', car: 2, ref: 'K-2026-301', mass: 'Spylevann', amount: '5', depot: 0, start: '08:00', end: '12:45', ticket: '48152', photos: [17], ticketPhoto: true, invoiced: true },
  { done: true, c: 'eiendom', a: 'kjelsaas', d: -15, service: 'Tømming tett tank', car: 3, ref: 'AE-331', mass: 'Avløpsvann (tett tank)', amount: '10', depot: 1, start: '09:30', end: '10:40', ticket: '48148', photos: [18], ticketPhoto: true },
  { done: true, c: 'asker', a: 'slepend', d: -17, service: 'Tømming oljeutskiller', car: 4, ref: 'AM-5490', mass: 'Oljeholdig slam (oljeutskiller)', amount: '2', depot: 3, decl: '3123305', start: '12:00', end: '13:10', ticket: '48139', photos: [19], ticketPhoto: true },
  { done: true, c: 'naering', a: 'lorenskogv', d: -19, service: 'Tømming septik', car: 3, mass: 'Septikslam', amount: '7', depot: 1, start: '11:00', end: '12:30', ticket: '48130', photos: [20], ticketPhoto: true, invoiced: true },
  { done: true, c: 'transport', a: 'industriv', d: -21, service: 'Tømming oljeutskiller', car: 4, ref: 'FT-1071', mass: 'Oljeholdig slam (oljeutskiller)', amount: '2.5', depot: 3, decl: '3121410', start: '08:30', end: '10:00', ticket: '48122', photos: [21], ticketPhoto: true, invoiced: true },
  { done: true, c: 'nordbygg', a: 'kirkevski', d: -24, service: 'Vakuumgraving', car: 0, ref: 'P-5455', mass: 'Gravemasser', amount: '15', depot: 2, start: '07:00', end: '14:00', ticket: '48110', photos: [22], ticketPhoto: true, invoiced: true },
  { done: true, c: 'kommune', a: 'ostensjo', d: -26, service: 'Tømming sandfang', car: 3, ref: 'K-2026-290', mass: 'Innhold sandfang', amount: '9', depot: 2, start: '07:30', end: '13:30', ticket: '48101', photos: [10], ticketPhoto: true, invoiced: true },
  { done: true, c: 'asker', a: 'hagalokk', d: -27, service: 'Spillolje', car: 4, ref: 'AM-5470', mass: 'Spillolje', amount: '600', unit: 'liter', depot: 3, decl: '3120077', start: '14:00', end: '14:45', ticket: '48097', photos: [12], ticketPhoto: true, invoiced: true },
];

/** Bemanning i dag: bil-indeks → sjåfør-indeks. Bil 6 står uten sjåfør, Jonas er vikar. */
const CREW: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
/** Hvem som kjørte de ferdige jobbene: normalt fast sjåfør, men noen ganger vikaren. */
const histDriver = (car: number, i: number) => config.drivers[(i % 7 === 3 ? 5 : car) % config.drivers.length]?.name ?? '';

export function createSeed(): { jobs: Job[]; nextNo: number; crew: Record<string, string>; out: Record<string, string> } {
  const crew: Record<string, string> = {};
  CREW.forEach(([v, d]) => {
    const veh = config.vehicles[v], drv = config.drivers[d];
    if (veh && drv) crew[veh.id] = drv.id;
  });
  const out: Record<string, string> = {};
  const reserve = config.vehicles[5];
  if (reserve) out[reserve.id] = 'EU-kontroll fredag';
  let no = 2031;
  const jobs = ROWS.map((r, i): Job => {
    const [address, place, lat, lon, how] = A[r.a] as Addr;
    const car = C(r.car);
    return {
      id: `${config.jobPrefix}-${no++}`,
      status: r.done ? 'ferdig' : car ? 'aktiv' : 'kommende',
      ...CUST[r.c],
      address,
      place,
      lat,
      lon,
      pin: how === 'kart' ? 'kart' : 'adresse',
      service: S(r.service, i),
      ref: r.ref ?? '',
      date: dayOffset(r.d),
      time: r.time ?? r.start ?? '',
      car,
      driverName: r.done || r.start ? histDriver(r.car, i) : '',
      note: r.note ?? '',
      urgent: !!r.urgent,
      massType: r.mass ? M(r.mass, i) : '',
      amount: r.amount ?? '',
      unit: r.unit && config.units.includes(r.unit) ? r.unit : config.units[0],
      disposal: r.depot !== undefined ? D(r.depot) : '',
      start: r.start ?? '',
      end: r.end ?? '',
      ticketNo: r.ticket ?? '',
      ticketPhotos: r.ticketPhoto ? ['demo:ticket'] : [],
      jobPhotos: (r.photos ?? []).map(p => `demo:job:${p}`),
      decl: r.decl ?? '',
      comment: r.comment ?? '',
      invoiced: !!r.invoiced,
      invoicedAt: r.invoiced ? dayOffset(r.d + 3) : '',
      closedAt: r.done ? dayOffset(r.d) : '',
    };
  });
  return { jobs, nextNo: no, crew, out };
}
