/** kommende = ingen sjåfør tildelt, aktiv = sjåfør tildelt, ferdig = lukket. Settes automatisk i store.ts. */
export type Status = 'kommende' | 'aktiv' | 'ferdig';

export const STATUS_LABEL: Record<Status, string> = {
  kommende: 'Ny bestilling',
  aktiv: 'Aktiv',
  ferdig: 'Ferdig',
};

export type StepKey = 'kjoring' | 'ankommet' | 'arbeid' | 'fullfort' | 'kjortFra' | 'deponi' | 'ferdig';
export interface Step {
  time: string; // HH:MM
  comment: string;
}

export interface Job {
  id: string;
  /** Jobbnummer som vises, f.eks. «J-2036». I demo-modus lik id, i Supabase er id en UUID. */
  no: string;
  status: Status;
  // bestilling (kontor)
  customer: string;
  contact: string;
  phone: string;
  address: string;
  place: string;
  lat: number;
  lon: number;
  /** Hvordan nålen er plassert: fra adresseregisteret eller manuelt i kartet */
  pin: 'adresse' | 'kart';
  service: string;
  ref: string;
  date: string;      // YYYY-MM-DD
  time: string;      // planlagt oppmøte HH:MM (valgfritt)
  car: string;       // bil-id, '' = ingen bil valgt
  driver: string;    // sjåfør-id, '' = ingen sjåfør (Kommende)
  driverName: string; // navnet til sjåføren som lukket jobben (historikk, står på PDF)
  note: string;
  urgent: boolean;
  // utførelse (sjåfør)
  massType: string;
  amount: string;
  unit: string;
  disposal: string;
  start: string;   // arbeid startet (fra statuspunktet «Startet arbeid»)
  end: string;     // arbeid fullført (fra «Fullført arbeid»)
  /** Statuspunkter sjåføren har huket av */
  steps: Partial<Record<StepKey, Step>>;
  ticketNo: string;
  ticketPhotos: string[];
  jobPhotos: string[];
  decl: string;
  comment: string;
  // bestilling
  clientId: string;       // kunde i registeret ('' = ikke registrert, f.eks. telefonbestilling)
  request: RequestState;  // 'venter' = bestilt i portalen, ikke godtatt ennå
  requestNote: string;    // begrunnelse ved avvisning
  orderedBy: 'kunde' | 'kontor';
  orderedAt: string;      // 'YYYY-MM-DD HH:MM'
  // fakturering
  invoiced: boolean;
  invoicedAt: string;
  closedAt: string;
}

export type JobOrder = Pick<
  Job,
  'customer' | 'contact' | 'phone' | 'address' | 'place' | 'lat' | 'lon' | 'pin' | 'service' | 'ref' | 'date' | 'time' | 'car' | 'driver' | 'note' | 'urgent' | 'clientId'
>;

export type View = 'hjem' | 'kontor' | 'kunder' | 'bilpark' | 'sjafor' | 'arkiv';

/** Kunde i kunderegisteret */
export interface Client {
  id: string;
  name: string;
  orgNr: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  place: string;
  lat: number | null;
  lon: number | null;
  note: string;
}

/** Bestilling fra kundeportalen: venter på godkjenning, eller avvist. '' = godtatt / lagt inn av kontoret. */
export type RequestState = '' | 'venter' | 'avvist';
