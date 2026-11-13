/* =====================================================================
 *  SUGEKRAFT – KONFIGURASJON
 *  Alt som er firmaspesifikt ligger her. Endre denne fila for å tilpasse
 *  demoen til et nytt firma. Bytt også ut public/logo.svg (eller pek
 *  `logo` til en annen fil/URL).
 *
 *  Tips: Når du har endret biler, steder, oppdragstyper e.l., trykk
 *  «Nullstill demo» i appen slik at eksempeldataene bygges på nytt.
 * ===================================================================== */

export interface Vehicle {
  id: string;        // intern nøkkel, må være unik
  name: string;      // vises i lister, f.eks. «Bil 1»
  tag: string;       // kort merke på kartnålen (1–2 tegn)
  type: string;      // f.eks. «Supersuger»
  regNr: string;
  /** false = tatt ut av bilparken (beholdes i historikken) */
  active?: boolean;
}

/** Sjåfører er adskilt fra bilene. I hvert oppdrag velges bil og sjåfør hver for seg. */
export interface Driver {
  id: string;
  name: string;
  phone: string;
}

export interface MassType {
  name: string;
  hazardous?: boolean; // krever deklarasjonsnummer (Avfallsdeklarering.no)
  noMass?: boolean;    // ingen mengde/deponi kreves (kun spyling/inspeksjon)
}

export type Role = 'admin' | 'driver' | 'client';

/**
 * Demo-innlogginger. driverId kobler til en sjåfør, clientId til en kunde i kunderegisteret (se data/seed.ts).
 * Passord lagres bare som SHA-256-hash. Lag ny hash med:  node scripts/hash-password.mjs "passord"
 */
export interface User {
  username: string;
  /** E-post i Supabase (live-modus). Brukernavnet over virker også ved innlogging. */
  email?: string;
  passwordHash: string;
  role: Role;
  name: string;
  driverId?: string;
  clientId?: string;
}

export interface AppConfig {
  appName: string;
  company: {
    name: string;
    orgNr: string;
    address: string;
    phone: string;
    email: string;
    web: string;
  };
  /** Sti til logo (relativt til public/) eller full URL. Sett til '' for å bruke initialer. */
  logo: string;
  colors: {
    primary: string;   // knapper, lenker, PDF-aksent
    header: string;    // topplinje (bakgrunn)
    headerText: string; // tekst i topplinjen
    highlight: string; // aktiv fane, fokusramme
    paper: string;     // bakgrunn
    kommende: string;
    aktiv: string;
    ferdig: string;
    warn: string;
  };
  map: {
    /** Kartsenter og zoom når appen åpnes. Adressesøk sorterer treff etter avstand hit. */
    center: [number, number];
    zoom: number;
    /** Kartverket-lag: 'topo' (farger) eller 'topograatone' (gråtone) */
    defaultStyle: 'topo' | 'topograatone';
  };
  vehicles: Vehicle[];
  drivers: Driver[];
  users: User[];
  services: string[];
  massTypes: MassType[];
  units: string[];
  depots: string[];
  jobPrefix: string;
  /** Engelske navn på data over (tjenester, masser, deponier, enheter, biltyper). Mangler et navn, vises norsk. */
  translations: { en: Record<string, string> };
  /** Endre nøkkelen for å tvinge fram nye eksempeldata hos alle som har åpnet demoen før. */
  storageKey: string;
}

export const config: AppConfig = {
  appName: 'Sugekraft',

  company: {
    name: 'Sugefirma AS',
    orgNr: '912 345 678',
    address: 'Brobekkveien 80, 0582 Oslo',
    phone: '22 00 00 00',
    email: 'post@sugefirma.no',
    web: 'sugefirma.no',
  },

  logo: 'logo.svg',

  colors: {
    primary: '#4f46e5',
    header: '#ffffff',
    headerText: '#1e2433',
    highlight: '#f59e0b',
    paper: '#f4f5fa',
    kommende: '#0369a1',
    aktiv: '#c2410c',
    ferdig: '#15803d',
    warn: '#dc2626',
  },

  map: {
    center: [59.92, 10.78],
    zoom: 10,
    defaultStyle: 'topo',
  },

  vehicles: [
    { id: 'b1', name: 'Bil 1', tag: '1', type: 'Supersuger', regNr: 'EB 41207' },
    { id: 'b2', name: 'Bil 2', tag: '2', type: 'Slamsuger', regNr: 'EB 41388' },
    { id: 'b3', name: 'Bil 3', tag: '3', type: 'Spylebil', regNr: 'EB 39915' },
    { id: 'b4', name: 'Bil 4', tag: '4', type: 'Kombibil', regNr: 'EB 42051' },
    { id: 'b5', name: 'Bil 5', tag: '5', type: 'ADR-tankbil', regNr: 'EB 40762' },
    { id: 'b6', name: 'Bil 6', tag: '6', type: 'Slamsuger (reserve)', regNr: 'EB 37720' },
  ],

  drivers: [
    { id: 's1', name: 'Ola Haugen', phone: '900 00 101' },
    { id: 's2', name: 'Kari Bøe', phone: '900 00 102' },
    { id: 's3', name: 'Per Sletten', phone: '900 00 103' },
    { id: 's4', name: 'Ingrid Lien', phone: '900 00 104' },
    { id: 's5', name: 'Arne Rustad', phone: '900 00 105' },
    { id: 's6', name: 'Jonas Vik', phone: '900 00 106' },
  ],

  // Demo-innlogginger. Passordene står ikke i koden, bare hashen (ikke ekte sikkerhet – alt kjører i nettleseren).
  users: [
    { username: 'kontorbruker', email: 'kontorbruker@sugekraft.test', passwordHash: 'c75114bab7b2183a9997576532490c86477bb32fee745f16ffe22a1ac17a1e3e', role: 'admin', name: 'Kontoret' },
    { username: 'sjåførbruker', email: 'sjaforbruker@sugekraft.test', passwordHash: '243339a3f7687a38c572e554e70370f6f07882ecb0a198f8834f2ccaf7fd6eff', role: 'driver', name: 'Ola Haugen', driverId: 's1' },
    { username: 'kundebruker', email: 'kundebruker@sugekraft.test', passwordHash: '20a46a7bd5a56161264158f42eb66503ef2cf8544d0cdb3cb7e1fdd8da139c8e', role: 'client', name: 'Geir Moen', clientId: 'k1' },
  ],

  services: [
    'Tømming septik',
    'Tømming tett tank',
    'Tømming oljeutskiller',
    'Tømming fettutskiller',
    'Tømming sandfang',
    'Høytrykkspyling',
    'Rørinspeksjon (kamera)',
    'Tining av frosne rør',
    'Tankrengjøring',
    'Farlig avfall',
    'Spillolje',
    'Vakuumgraving',
    'Blåsing av pukk',
  ],

  massTypes: [
    { name: 'Septikslam' },
    { name: 'Avløpsvann (tett tank)' },
    { name: 'Innhold sandfang' },
    { name: 'Innhold fettutskiller' },
    { name: 'Oljeholdig slam (oljeutskiller)', hazardous: true },
    { name: 'Spillolje', hazardous: true },
    { name: 'Annet farlig avfall', hazardous: true },
    { name: 'Gravemasser' },
    { name: 'Pukk' },
    { name: 'Spylevann' },
    { name: 'Ingen masse (kun spyling/inspeksjon)', noMass: true },
  ],

  units: ['m³', 'tonn', 'liter'],

  depots: [
    'Bekkelaget renseanlegg',
    'VEAS renseanlegg',
    'Massemottak Grorud',
    'Haraldrud – mottak farlig avfall',
    'Levert tilbake på tomt',
  ],

  jobPrefix: 'J',

  translations: {
    en: {
      // oppdragstyper
      'Tømming septik': 'Septic tank emptying',
      'Tømming tett tank': 'Holding tank emptying',
      'Tømming oljeutskiller': 'Oil separator emptying',
      'Tømming fettutskiller': 'Grease trap emptying',
      'Tømming sandfang': 'Gully / sand trap emptying',
      'Høytrykkspyling': 'High-pressure jetting',
      'Rørinspeksjon (kamera)': 'Pipe inspection (CCTV)',
      'Tining av frosne rør': 'Thawing frozen pipes',
      'Tankrengjøring': 'Tank cleaning',
      'Farlig avfall': 'Hazardous waste',
      'Spillolje': 'Waste oil',
      'Vakuumgraving': 'Vacuum excavation',
      'Blåsing av pukk': 'Gravel blowing',
      // massetyper
      'Septikslam': 'Septic sludge',
      'Avløpsvann (tett tank)': 'Wastewater (holding tank)',
      'Innhold sandfang': 'Sand trap contents',
      'Innhold fettutskiller': 'Grease trap contents',
      'Oljeholdig slam (oljeutskiller)': 'Oily sludge (oil separator)',
      'Annet farlig avfall': 'Other hazardous waste',
      'Gravemasser': 'Excavated soil',
      'Pukk': 'Gravel',
      'Spylevann': 'Jetting water',
      'Ingen masse (kun spyling/inspeksjon)': 'No material (jetting/inspection only)',
      // enheter
      'tonn': 'tonnes',
      'liter': 'litres',
      // deponier
      'Bekkelaget renseanlegg': 'Bekkelaget treatment plant',
      'VEAS renseanlegg': 'VEAS treatment plant',
      'Massemottak Grorud': 'Grorud soil reception',
      'Haraldrud – mottak farlig avfall': 'Haraldrud – hazardous waste reception',
      'Levert tilbake på tomt': 'Returned to site',
      // biltyper
      'Supersuger': 'Super sucker',
      'Slamsuger': 'Vacuum tanker',
      'Spylebil': 'Jetting truck',
      'Kombibil': 'Combination truck',
      'ADR-tankbil': 'ADR tanker',
      'Slamsuger (reserve)': 'Vacuum tanker (spare)',
    },
  },
  storageKey: 'sugekraft-demo-v7',
};
