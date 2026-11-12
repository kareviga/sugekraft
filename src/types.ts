export type Status = 'aktiv' | 'ferdig';

export const STATUS_LABEL: Record<Status, string> = {
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
  service: string;
  ref: string;
  date: string;      // YYYY-MM-DD
  time: string;      // planlagt oppmøte HH:MM (valgfritt)
  car: string;       // vehicle id, '' = ikke tildelt
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
  'customer' | 'contact' | 'phone' | 'address' | 'place' | 'service' | 'ref' | 'date' | 'time' | 'car' | 'note' | 'urgent'
>;

export type View = 'kontor' | 'sjafor' | 'arkiv';
