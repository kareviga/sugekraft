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
  driver: string;
  phone: string;
}

export interface MassType {
  name: string;
  hazardous?: boolean; // krever deklarasjonsnummer (Avfallsdeklarering.no)
  noMass?: boolean;    // ingen mengde/deponi kreves (kun spyling/inspeksjon)
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
    header: string;    // topplinje
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
  services: string[];
  massTypes: MassType[];
  units: string[];
  depots: string[];
  jobPrefix: string;
  /** Endre nøkkelen for å tvinge fram nye eksempeldata hos alle som har åpnet demoen før. */
  storageKey: string;
}

export const config: AppConfig = {
  appName: 'Sugekraft',

  company: {
    name: 'Fjordsug AS',
    orgNr: '912 345 678',
    address: 'Brobekkveien 80, 0582 Oslo',
    phone: '22 00 00 00',
    email: 'post@fjordsug.no',
    web: 'fjordsug.no',
  },

  logo: 'logo.svg',

  colors: {
    primary: '#0d5f6b',
    header: '#16252b',
    highlight: '#f0a92c',
    paper: '#eaefec',
    kommende: '#2a62b8',
    aktiv: '#c95f06',
    ferdig: '#2b8048',
    warn: '#b93426',
  },

  map: {
    center: [59.92, 10.78],
    zoom: 10,
    defaultStyle: 'topo',
  },

  vehicles: [
    { id: 'b1', name: 'Bil 1', tag: '1', type: 'Supersuger', regNr: 'EB 41207', driver: 'Ola Haugen', phone: '900 00 101' },
    { id: 'b2', name: 'Bil 2', tag: '2', type: 'Slamsuger', regNr: 'EB 41388', driver: 'Kari Bøe', phone: '900 00 102' },
    { id: 'b3', name: 'Bil 3', tag: '3', type: 'Spylebil', regNr: 'EB 39915', driver: 'Per Sletten', phone: '900 00 103' },
    { id: 'b4', name: 'Bil 4', tag: '4', type: 'Kombibil', regNr: 'EB 42051', driver: 'Ingrid Lien', phone: '900 00 104' },
    { id: 'b5', name: 'Bil 5', tag: '5', type: 'ADR-tankbil', regNr: 'EB 40762', driver: 'Arne Rustad', phone: '900 00 105' },
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
  storageKey: 'sugekraft-demo-v2',
};
