import { config } from '../config';
import type { Job, Status } from '../types';
import { dayOffset, placePos } from '../lib/utils';

/*
 * Eksempeldata. Datoer er relative til i dag, slik at demoen alltid ser
 * fersk ut. Navn på steder, biler, oppdragstyper, masser og deponier slås
 * opp i config – finnes de ikke der, brukes et gyldig alternativ, slik at
 * demoen tåler at konfigurasjonen endres.
 */

const pick = <T,>(arr: T[], want: T | undefined, i: number): T =>
  want !== undefined && arr.includes(want) ? want : arr[i % arr.length];
const places = () => Object.keys(config.map.places);
const P = (name: string, i: number) => pick(places(), name, i);
const S = (name: string, i: number) => pick(config.services, name, i);
const M = (name: string, i: number) => pick(config.massTypes.map(m => m.name), name, i);
const D = (i: number) => config.depots[i % config.depots.length];
const C = (i: number) => (i < 0 ? '' : config.vehicles[i % config.vehicles.length].id);

const CUST = {
  nordbygg: { customer: 'Nordbygg Anlegg AS', contact: 'Geir Moen', phone: '900 00 215' },
  fjellro: { customer: 'Fjellro Hytteeierlag', contact: 'Anne Dal', phone: '900 00 311' },
  dalen: { customer: 'Dalen Verksted AS', contact: 'Jon Lie', phone: '900 00 412' },
  vegkroa: { customer: 'Vegkroa Drift AS', contact: 'Siri Holm', phone: '900 00 516' },
  kommune: { customer: 'Fjellbygd kommune, VA', contact: 'Vakttelefon VA', phone: '900 00 600' },
  nordi: { customer: 'Nordi Gard', contact: 'Liv Nordi', phone: '900 00 714' },
  lagen: { customer: 'Lågen Eiendom AS', contact: 'Morten Bakke', phone: '900 00 731' },
  bjorkli: { customer: 'Bjørkli Fjellstue', contact: 'Hanne Bjørkli', phone: '900 00 822' },
  solsida: { customer: 'Solsida Borettslag', contact: 'Styreleder Tor Aas', phone: '900 00 903' },
  midtdal: { customer: 'Midtdal Transport AS', contact: 'Rune Strand', phone: '900 00 177' },
};
type CustKey = keyof typeof CUST;

interface Row {
  s: Status;
  c: CustKey;
  d: number; // dag relativt til i dag
  place: string;
  service: string;
  car: number; // indeks i config.vehicles, -1 = ikke tildelt
  address: string;
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
  // ---- kommende ----
  { s: 'kommende', c: 'fjellro', d: 0, place: 'Sjoa', service: 'Tømming septik', car: 1, address: 'Fjellrovegen 14', ref: 'HYT-118', time: '13:00', note: 'Bom ved innkjøring. Kode 2580.' },
  { s: 'kommende', c: 'dalen', d: 0, place: 'Vinstra', service: 'Tømming oljeutskiller', car: 4, address: 'Industrivegen 3', ref: 'PO-7741', time: '14:30' },
  { s: 'kommende', c: 'kommune', d: 1, place: 'Dombås', service: 'Tømming sandfang', car: 3, address: 'Pumpestasjon Nord, Stasjonsvegen', ref: 'K-2026-331', time: '07:30', note: 'Ring vakttelefon ved ankomst. 6 sandfang i Storgata.' },
  { s: 'kommende', c: 'nordi', d: 1, place: 'Lom', service: 'Tining av frosne rør', car: -1, address: 'Nordigardsvegen 40', time: '09:00', note: 'Kunden ønsker oppmøte før kl. 10. Fjøs uten vann.', urgent: true },
  { s: 'kommende', c: 'nordbygg', d: 1, place: 'Ringebu', service: 'Vakuumgraving', car: 0, address: 'Byggefelt Solsida, tomt 12', ref: 'P-5502', time: '07:00', note: 'Kabelpåvisning er gjort. Grav forsiktig langs blå merking.' },
  { s: 'kommende', c: 'bjorkli', d: 2, place: 'Kvam', service: 'Tømming fettutskiller', car: 1, address: 'Bjørklivegen 210', ref: 'BF-2026-14', time: '10:00' },
  { s: 'kommende', c: 'solsida', d: 2, place: 'Otta', service: 'Høytrykkspyling', car: 2, address: 'Solsida 2–18', ref: 'Sak 44/26', time: '08:00', note: 'Stakeluke i kjeller blokk C. Vaktmester møter.' },
  { s: 'kommende', c: 'midtdal', d: 3, place: 'Otta', service: 'Spillolje', car: 4, address: 'Verkstedvegen 7', ref: 'MT-1093', time: '12:00' },
  { s: 'kommende', c: 'lagen', d: 5, place: 'Lillehammer', service: 'Tankrengjøring', car: -1, address: 'Kirkegata 51', ref: 'LE-339', note: 'Gammel fyringsoljetank, 3000 liter. Skal saneres.' },

  // ---- aktive (i dag) ----
  { s: 'aktiv', c: 'nordbygg', d: 0, place: 'Otta', service: 'Vakuumgraving', car: 0, address: 'Tomt B7, Stasjonsvegen', ref: 'P-5498', mass: 'Gravemasser', amount: '12', unit: 'm³', start: '07:30', photos: [1] },
  { s: 'aktiv', c: 'vegkroa', d: 0, place: 'Kvam', service: 'Tømming fettutskiller', car: 1, address: 'E6-vegen 201', ref: 'VK-90', start: '08:15' },
  { s: 'aktiv', c: 'kommune', d: 0, place: 'Lillehammer', service: 'Høytrykkspyling', car: 2, address: 'Kum 44, Elvegata', ref: 'K-2026-327', mass: 'Ingen masse (kun spyling/inspeksjon)', start: '09:00', photos: [2] },
  { s: 'aktiv', c: 'lagen', d: 0, place: 'Fåvang', service: 'Tømming tett tank', car: 3, address: 'Fåvangvegen 88', ref: 'LE-337', mass: 'Avløpsvann (tett tank)', amount: '8', start: '10:05', ticket: '48231', ticketPhoto: true, photos: [3] },

  // ---- ferdige ----
  { s: 'ferdig', c: 'nordbygg', d: -1, place: 'Otta', service: 'Vakuumgraving', car: 0, address: 'Tomt B7, Stasjonsvegen', ref: 'P-5498', mass: 'Gravemasser', amount: '18', depot: 2, start: '07:00', end: '14:30', ticket: '48213', photos: [3, 4], ticketPhoto: true, comment: 'Trang adkomst, brukte 30 m ekstra slange.' },
  { s: 'ferdig', c: 'fjellro', d: -2, place: 'Sjoa', service: 'Tømming septik', car: 1, address: 'Fjellrovegen 8', ref: 'HYT-117', mass: 'Septikslam', amount: '6', depot: 1, start: '11:00', end: '12:10', ticket: '48210', photos: [7], ticketPhoto: true },
  { s: 'ferdig', c: 'fjellro', d: -2, place: 'Sjoa', service: 'Tømming septik', car: 1, address: 'Fjellrovegen 22', ref: 'HYT-117', mass: 'Septikslam', amount: '4.5', depot: 1, start: '12:30', end: '13:25', ticket: '48211', photos: [9], ticketPhoto: true },
  { s: 'ferdig', c: 'nordbygg', d: -3, place: 'Ringebu', service: 'Blåsing av pukk', car: 0, address: 'Byggefelt Solsida, tomt 9', ref: 'P-5502', mass: 'Pukk', amount: '9', unit: 'tonn', depot: 4, start: '10:00', end: '13:15', ticket: '48207', photos: [5], ticketPhoto: true },
  { s: 'ferdig', c: 'nordbygg', d: -4, place: 'Tretten', service: 'Tømming oljeutskiller', car: 4, address: 'Riggplass Sør', ref: 'P-5470', mass: 'Oljeholdig slam (oljeutskiller)', amount: '3.5', depot: 3, decl: '3127740', start: '08:00', end: '10:45', ticket: '48199', photos: [6], ticketPhoto: true },
  { s: 'ferdig', c: 'kommune', d: -4, place: 'Dombås', service: 'Tømming sandfang', car: 3, address: 'Storgata 1–30', ref: 'K-2026-318', mass: 'Innhold sandfang', amount: '11', depot: 2, start: '07:30', end: '15:00', ticket: '48201', photos: [10, 11], ticketPhoto: true, comment: '14 sandfang tømt. Sandfang ved nr. 12 har knekt rist.' },
  { s: 'ferdig', c: 'dalen', d: -6, place: 'Vinstra', service: 'Spillolje', car: 4, address: 'Industrivegen 3', ref: 'PO-7702', mass: 'Spillolje', amount: '850', unit: 'liter', depot: 3, decl: '3126981', start: '13:00', end: '13:50', ticket: '48188', photos: [12], ticketPhoto: true },
  { s: 'ferdig', c: 'nordbygg', d: -8, place: 'Otta', service: 'Vakuumgraving', car: 0, address: 'Tomt B7, Stasjonsvegen', ref: 'P-5498', mass: 'Gravemasser', amount: '22', depot: 2, start: '07:00', end: '15:30', ticket: '48180', photos: [8, 13], ticketPhoto: true },
  { s: 'ferdig', c: 'vegkroa', d: -9, place: 'Vågå', service: 'Tømming fettutskiller', car: 1, address: 'Rasteplassen, Riksveg 15', ref: 'VK-88', mass: 'Innhold fettutskiller', amount: '4', depot: 0, start: '13:00', end: '14:20', ticket: '48176', photos: [14], ticketPhoto: true, invoiced: true },
  { s: 'ferdig', c: 'solsida', d: -10, place: 'Otta', service: 'Rørinspeksjon (kamera)', car: 2, address: 'Solsida 10', ref: 'Sak 41/26', mass: 'Ingen masse (kun spyling/inspeksjon)', start: '09:00', end: '11:30', ticket: '48170', photos: [15], ticketPhoto: true, comment: 'Rotinntrenging ved 14 m. Anbefaler fresing.' },
  { s: 'ferdig', c: 'bjorkli', d: -12, place: 'Kvam', service: 'Tømming fettutskiller', car: 1, address: 'Bjørklivegen 210', ref: 'BF-2026-11', mass: 'Innhold fettutskiller', amount: '3', depot: 0, start: '10:15', end: '11:20', ticket: '48161', photos: [16], ticketPhoto: true, invoiced: true },
  { s: 'ferdig', c: 'kommune', d: -14, place: 'Lesja', service: 'Høytrykkspyling', car: 2, address: 'Pumpestasjon Lesja sentrum', ref: 'K-2026-301', mass: 'Spylevann', amount: '5', depot: 0, start: '08:00', end: '12:45', ticket: '48152', photos: [17], ticketPhoto: true, invoiced: true },
  { s: 'ferdig', c: 'lagen', d: -15, place: 'Lillehammer', service: 'Tømming tett tank', car: 3, address: 'Fåberggata 140', ref: 'LE-331', mass: 'Avløpsvann (tett tank)', amount: '10', depot: 0, start: '09:30', end: '10:40', ticket: '48148', photos: [18], ticketPhoto: true },
  { s: 'ferdig', c: 'fjellro', d: -16, place: 'Sjoa', service: 'Tømming septik', car: 1, address: 'Fjellrovegen 31', ref: 'HYT-112', mass: 'Septikslam', amount: '5', depot: 1, start: '12:00', end: '13:05', ticket: '48141', photos: [19], ticketPhoto: true, invoiced: true },
  { s: 'ferdig', c: 'nordi', d: -19, place: 'Lom', service: 'Tømming septik', car: 3, address: 'Nordigardsvegen 40', mass: 'Septikslam', amount: '7', depot: 1, start: '11:00', end: '12:30', ticket: '48130', photos: [20], ticketPhoto: true },
  { s: 'ferdig', c: 'midtdal', d: -21, place: 'Otta', service: 'Tømming oljeutskiller', car: 4, address: 'Verkstedvegen 7', ref: 'MT-1071', mass: 'Oljeholdig slam (oljeutskiller)', amount: '2.5', depot: 3, decl: '3121410', start: '08:30', end: '10:00', ticket: '48122', photos: [21], ticketPhoto: true, invoiced: true },
  { s: 'ferdig', c: 'nordbygg', d: -24, place: 'Dovre', service: 'Vakuumgraving', car: 0, address: 'Hjerkinnvegen, kryss fv. 29', ref: 'P-5455', mass: 'Gravemasser', amount: '15', depot: 2, start: '07:00', end: '14:00', ticket: '48110', photos: [22], ticketPhoto: true, invoiced: true },
];

export function createSeed(): { jobs: Job[]; nextNo: number } {
  let no = 2031;
  const jobs = ROWS.map((r, i): Job => {
    const place = P(r.place, i);
    const [lat, lon] = placePos(place, i + 3);
    const j: Job = {
      id: `${config.jobPrefix}-${no++}`,
      status: r.s,
      ...CUST[r.c],
      address: r.address,
      place,
      lat,
      lon,
      service: S(r.service, i),
      ref: r.ref ?? '',
      date: dayOffset(r.d),
      time: r.time ?? (r.s === 'kommende' ? '' : r.start ?? ''),
      car: C(r.car),
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
      closedAt: r.s === 'ferdig' ? dayOffset(r.d) : '',
    };
    return j;
  });
  return { jobs, nextNo: no };
}
