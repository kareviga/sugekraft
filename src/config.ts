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
    aktiv: string;
    ferdig: string;
    warn: string;
  };
  map: {
    center: [number, number];
    zoom: number;
    /** Kartverket-lag: 'topo' (farger) eller 'topograatone' (gråtone) */
    defaultStyle: 'topo' | 'topograatone';
    /** Steder som kan velges i jobbskjemaet. [breddegrad, lengdegrad] */
    places: Record<string, [number, number]>;
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
    name: 'Fjellsug AS',
    orgNr: '912 345 678',
    address: 'Industrivegen 12, 2640 Vinstra',
    phone: '61 29 00 00',
    email: 'post@fjellsug.no',
    web: 'fjellsug.no',
  },

  logo: 'logo.svg',

  colors: {
    primary: '#0d5f6b',
    header: '#16252b',
    highlight: '#f0a92c',
    paper: '#eaefec',
    aktiv: '#c95f06',
    ferdig: '#2b8048',
    warn: '#b93426',
  },

  map: {
    center: [61.6, 9.5],
    zoom: 8,
    defaultStyle: 'topo',
    places: {
      Lillehammer: [61.115, 10.466],
      Tretten: [61.31, 10.3],
      Fåvang: [61.458, 10.19],
      Ringebu: [61.529, 10.14],
      Vinstra: [61.597, 9.75],
      Kvam: [61.666, 9.7],
      Sjoa: [61.68, 9.55],
      Otta: [61.772, 9.54],
      Dovre: [61.985, 9.25],
      Dombås: [62.075, 9.125],
      Vågå: [61.875, 9.097],
      Lom: [61.838, 8.568],
      Bismo: [61.89, 8.27],
      Lesja: [62.12, 8.86],
    },
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
    'Sentralrenseanlegget Vinstra',
    'Slammottak Otta',
    'Massemottak Breisjøen',
    'Miljøstasjonen – farlig avfall',
    'Levert tilbake på tomt',
  ],

  jobPrefix: 'J',
  storageKey: 'sugekraft-demo-v1',
};
