/** kommende = ingen sjåfør tildelt, aktiv = sjåfør tildelt, ferdig = lukket. Settes automatisk i store.ts. */
export type Status = 'kommende' | 'aktiv' | 'ferdig';

export const STATUS_LABEL: Record<Status, string> = {
  kommende: 'Kommende',
  aktiv: 'Aktiv',
  ferdig: 'Ferdig',
};

export interface Job {
  id: string;
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
  start: string;
  end: string;
  ticketNo: string;
  ticketPhotos: string[];
  jobPhotos: string[];
  decl: string;
  comment: string;
  // fakturering
  invoiced: boolean;
  invoicedAt: string;
  closedAt: string;
}

export type JobOrder = Pick<
  Job,
  'customer' | 'contact' | 'phone' | 'address' | 'place' | 'lat' | 'lon' | 'pin' | 'service' | 'ref' | 'date' | 'time' | 'car' | 'driver' | 'note' | 'urgent'
>;

export type View = 'kontor' | 'bilpark' | 'sjafor' | 'arkiv';
