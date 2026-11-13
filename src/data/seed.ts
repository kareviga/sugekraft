import { config } from '../config';
import type { Client, Job, RequestState, Step, StepKey } from '../types';
import { dayOffset } from '../lib/utils';

/*
 * Eksempeldata rundt Oslo. Datoer er relative til i dag, slik at demoen alltid
 * ser fersk ut. Koordinatene er hentet fra Kartverkets adresseregister.
 * Biler, oppdragstyper, masser og deponier slås opp i config – finnes et navn
 * ikke der, brukes et gyldig alternativ, slik at demoen tåler endringer.
 *
 * Status settes automatisk: uten sjåfør = Kommende, med sjåfør = Aktiv, lukket = Ferdig.
 * Bil og sjåfør velges hver for seg – samme bil kjøres av ulike sjåfører.
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
  car: number; // indeks i config.vehicles, -1 = ingen bil
  drv?: number; // indeks i config.drivers; standard = samme som bil, -1 = ingen sjåfør (Kommende)
  stage?: StepKey; // siste statuspunkt for aktive jobber som er i gang (standard «arbeid»)
  sc?: Partial<Record<StepKey, string>>; // kommentarer på statuspunkter
  req?: RequestState; // bestilling fra kundeportalen som ikke er godtatt
  reqNote?: string;
  byClient?: boolean; // bestilt i kundeportalen (og godtatt)
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
  // ---- Bestillinger fra kundeportalen ----
  { c: 'nordbygg', a: 'snaroy', d: 3, service: 'Vakuumgraving', car: -1, ref: 'P-5530', time: '07:00', note: 'Grøft for fiberkabel, ca. 40 m. Ønsker oppmøte tidlig.', req: 'venter' },

  // ---- Kommende: ingen sjåfør ----
  { c: 'gard', a: 'maridal', d: 0, service: 'Tining av frosne rør', car: -1, time: '13:00', note: 'Fjøs uten vann siden i natt. Ring før ankomst.', urgent: true },
  { c: 'kommune', a: 'kum', d: 2, service: 'Høytrykkspyling', car: 2, drv: -1, ref: 'K-2026-336', time: '08:00', note: 'Ingen adresse – se nål i kartet. Kjør inn fra parkeringen ved Haugerud.' },

  // ---- Aktiv: sjåfør tildelt, planlagt ----
  { c: 'sorkedal', a: 'hytte', d: 0, service: 'Tømming septik', car: 1, drv: 5, ref: 'HYT-118', time: '13:30', note: 'Bom ved innkjøring, kode 2580. Nålen viser tanken bak hytta.' },
  { c: 'nordbygg', a: 'rigg', d: 1, service: 'Vakuumgraving', car: 0, byClient: true, ref: 'P-5502', time: '07:00', note: 'Kabelpåvisning er gjort. Grav forsiktig langs blå merking.' },

  // ---- Aktiv: pågår i dag ----
  { c: 'nordbygg', a: 'stromsv', d: 0, service: 'Vakuumgraving', car: 0, ref: 'P-5498', mass: 'Gravemasser', amount: '12', start: '07:30', photos: [1] },
  { c: 'eiendom', a: 'sandaker', d: 0, service: 'Tømming tett tank', car: 3, ref: 'AE-337', mass: 'Avløpsvann (tett tank)', amount: '8', start: '10:05', end: '11:20', stage: 'kjortFra', ticket: '48231', ticketPhoto: true, photos: [3] },

  // ---- Ferdig ----
  { done: true, c: 'nordbygg', a: 'stromsv', d: -1, service: 'Vakuumgraving', car: 0, ref: 'P-5498', mass: 'Gravemasser', amount: '18', depot: 2, start: '07:00', end: '14:30', ticket: '48213', photos: [3, 4], ticketPhoto: true, comment: 'Trang adkomst, brukte 30 m ekstra slange.', sc: { ankommet: 'Port stengt, ventet på anleggsleder.', deponi: 'Kø på mottaket, ca. 20 min.' } },
  { done: true, c: 'nordbygg', a: 'lysaker', d: -4, service: 'Tømming oljeutskiller', car: 4, ref: 'P-5470', mass: 'Oljeholdig slam (oljeutskiller)', amount: '3.5', depot: 3, decl: '3127740', start: '08:00', end: '10:45', ticket: '48199', photos: [6], ticketPhoto: true },
  { done: true, c: 'kommune', a: 'tveten', d: -4, service: 'Tømming sandfang', car: 3, ref: 'K-2026-318', mass: 'Innhold sandfang', amount: '11', depot: 2, start: '07:30', end: '15:00', ticket: '48201', photos: [10, 11], ticketPhoto: true, comment: '14 sandfang tømt. Sandfang ved nr. 12 har knekt rist.' },
];

/** Sjåfør for en rad: eksplisitt, ellers fast sjåfør for bilen. Noen ferdige jobber er kjørt av vikaren. */
const D_IDX = (r: Row, i: number) => (r.drv !== undefined ? r.drv : r.car < 0 ? -1 : r.done && i % 7 === 3 ? 5 : r.car);
const C_DRV = (n: number) => (n < 0 || !config.drivers.length ? undefined : config.drivers[n % config.drivers.length]);

const ORDER: StepKey[] = ['kjoring', 'ankommet', 'arbeid', 'fullfort', 'kjortFra', 'deponi', 'ferdig'];
const hm = (t: string, add: number) => {
  const [h, m] = t.split(':').map(Number);
  const x = (((h * 60 + m + add) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};
/** Lager realistiske statuspunkter ut fra start/slutt for arbeidet. */
function buildSteps(r: Row, needsDepot: boolean): Partial<Record<StepKey, Step>> {
  if (!r.start) return {};
  const T = r.start, E = r.end ?? hm(T, 75);
  const at: Record<StepKey, string> = {
    kjoring: hm(T, -32),
    ankommet: hm(T, -6),
    arbeid: T,
    fullfort: E,
    kjortFra: hm(E, 9),
    deponi: hm(E, 41),
    ferdig: hm(E, needsDepot ? 58 : 22),
  };
  const stage: StepKey = r.done ? 'ferdig' : r.stage ?? 'arbeid';
  const steps: Partial<Record<StepKey, Step>> = {};
  for (const k of ORDER) {
    if (k === 'deponi' && !needsDepot) continue;
    steps[k] = { time: at[k], comment: r.sc?.[k] ?? '' };
    if (k === stage) break;
  }
  return steps;
}

// Kunderegister: [kunde-nøkkel, org.nr, e-post, adresse-nøkkel]. Første kunde (k1) er demo-innloggingen «client».
const CLIENTS: [CustKey | 'frogner', string, string, AddrKey][] = [
  ['nordbygg', '914 222 301', 'geir.moen@nordbygg.example', 'oledeviks'],
  ['sorkedal', '997 401 552', 'styret@sorkedalen-hytter.example', 'hytte'],
  ['alna', '918 330 412', 'verksted@alnabil.example', 'alfaset'],
  ['kjokken', '921 004 516', 'drift@elvebredden.example', 'trondheimsv'],
  ['kommune', '974 600 600', 'va-vakt@kommunalteknikk.example', 'haslev'],
  ['gard', '985 714 220', 'liv@maridalen-gard.example', 'maridal'],
  ['eiendom', '913 731 001', 'morten.bakke@akerselva-eiendom.example', 'sandaker'],
  ['kantine', '922 822 140', 'post@kollenkantine.example', 'holmenkoll'],
  ['ryen', '948 903 777', 'styret@ryen-brl.example', 'ryen'],
  ['transport', '917 177 300', 'rune@furulund-transport.example', 'furulund'],
  ['naering', '926 260 090', 'drift@lorenskog-naeringspark.example', 'solheim'],
  ['asker', '931 344 500', 'kjetil@askermaskin.example', 'hagalokk'],
  ['frogner', '997 512 044', 'styret@frogner-sameie.example', 'bygdoy'],
];
const EXTRA = { frogner: { customer: 'Frogner Sameie', contact: 'Vaktmester Leif Holt', phone: '900 00 455' } };

function createClients(): Client[] {
  return CLIENTS.map(([k, orgNr, email, a], i) => {
    const c = k === 'frogner' ? EXTRA.frogner : CUST[k];
    const [address, place, lat, lon] = A[a] as Addr;
    return { id: `k${i + 1}`, name: c.customer, orgNr, contact: c.contact, phone: c.phone, email, address, place, lat, lon, note: k === 'kommune' ? 'Faktura merkes med saksnummer.' : '' };
  });
}

export function createSeed(): { jobs: Job[]; nextNo: number; out: Record<string, string>; clients: Client[] } {
  const clients = createClients();
  const clientId = (name: string) => clients.find(c => c.name === name)?.id ?? '';
  const out: Record<string, string> = {};
  const reserve = config.vehicles[5];
  if (reserve) out[reserve.id] = 'EU-kontroll fredag';
  let no = 2031;
  const jobs = ROWS.map((r, i): Job => {
    const [address, place, lat, lon, how] = A[r.a] as Addr;
    const car = C(r.car);
    return {
      id: `${config.jobPrefix}-${no}`,
      no: `${config.jobPrefix}-${no++}`,
      status: r.done ? 'ferdig' : C_DRV(D_IDX(r, i)) ? 'aktiv' : 'kommende',
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
      driver: C_DRV(D_IDX(r, i))?.id ?? '',
      driverName: r.done ? C_DRV(D_IDX(r, i))?.name ?? '' : '',
      note: r.note ?? '',
      urgent: !!r.urgent,
      clientId: clientId(CUST[r.c].customer),
      request: r.req ?? '',
      requestNote: r.reqNote ?? '',
      orderedBy: r.req || r.byClient ? 'kunde' : 'kontor',
      orderedAt: `${dayOffset(Math.min(r.d, 0) - (r.req ? 0 : 2))} ${r.req ? '08:12' : '14:05'}`,
      massType: r.mass ? M(r.mass, i) : '',
      amount: r.amount ?? '',
      unit: r.unit && config.units.includes(r.unit) ? r.unit : config.units[0],
      disposal: r.depot !== undefined ? D(r.depot) : '',
      ...(() => {
        const mass = r.mass ? M(r.mass, i) : '';
        const steps = buildSteps(r, !!mass && !config.massTypes.find(m => m.name === mass)?.noMass);
        return { steps, start: steps.arbeid?.time ?? '', end: steps.fullfort?.time ?? '' };
      })(),
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
  return { jobs, nextNo: no, out, clients };
}
