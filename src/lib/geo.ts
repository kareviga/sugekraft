import { config } from '../config';

/*
 * Adresseoppslag mot Kartverkets åpne adresse-API (Geonorge).
 * Gratis, ingen nøkkel, CORS åpent. https://ws.geonorge.no/adresser/v1/
 */

export interface AddrHit {
  text: string;   // «Strømsveien 266»
  postnr: string;
  place: string;  // «Oslo»
  kommune: string;
  lat: number;
  lon: number;
}

const BASE = 'https://ws.geonorge.no/adresser/v1';
const FIELDS = 'adresser.adressetekst,adresser.postnummer,adresser.poststed,adresser.kommunenavn,adresser.representasjonspunkt';

/** «LØRENSKOG» → «Lørenskog», «NORDRE FOLLO» → «Nordre Follo» */
export const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase());

interface Raw {
  adressetekst: string;
  postnummer: string;
  poststed: string;
  kommunenavn: string;
  representasjonspunkt?: { lat: number; lon: number };
}
const toHit = (a: Raw): AddrHit => ({
  text: a.adressetekst,
  postnr: a.postnummer,
  place: titleCase(a.poststed ?? ''),
  kommune: titleCase(a.kommunenavn ?? ''),
  lat: a.representasjonspunkt!.lat,
  lon: a.representasjonspunkt!.lon,
});

/** Avstand i meter (god nok tilnærming over korte avstander) */
export function meters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const k = 111320;
  const dx = (a.lon - b.lon) * k * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const dy = (a.lat - b.lat) * k;
  return Math.hypot(dx, dy);
}

/**
 * Søk etter adresse mens brukeren skriver. «Gate 12, Oslo» eller «Gate 12, 0668»
 * avgrenser på poststed/postnummer/kommune. Treff sorteres etter avstand til kartsenteret.
 */
export async function searchAddress(input: string, signal?: AbortSignal): Promise<AddrHit[]> {
  const [street, area = ''] = input.split(',').map(s => s.trim());
  if (!street || street.replace(/\d/g, '').trim().length < 3) return [];
  const q = new URLSearchParams({ sok: street.replace(/[*]/g, '') + '*', treffPerSide: '100', utkoordsys: '4258', filtrer: FIELDS });
  const r = await fetch(`${BASE}/sok?${q}`, { signal });
  if (!r.ok) return [];
  const data = (await r.json()) as { adresser?: Raw[] };
  const a = area.toLowerCase();
  const c = { lat: config.map.center[0], lon: config.map.center[1] };
  const seen = new Set<string>();
  return (data.adresser ?? [])
    .filter(x => x.representasjonspunkt)
    .map(toHit)
    .filter(h => !a || h.place.toLowerCase().startsWith(a) || h.postnr.startsWith(a) || h.kommune.toLowerCase().startsWith(a))
    .sort((x, y) => meters(x, c) - meters(y, c))
    .filter(h => {
      const k = h.text + h.postnr;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 7);
}

/** Nærmeste registrerte adresse til et punkt (for manuelt plasserte nåler). */
export async function nearestAddress(lat: number, lon: number, signal?: AbortSignal): Promise<(AddrHit & { dist: number }) | null> {
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: '400', treffPerSide: '1', koordsys: '4258', utkoordsys: '4258', filtrer: FIELDS });
  const r = await fetch(`${BASE}/punktsok?${q}`, { signal });
  if (!r.ok) return null;
  const data = (await r.json()) as { adresser?: Raw[] };
  const a = data.adresser?.find(x => x.representasjonspunkt);
  if (!a) return null;
  const h = toHit(a);
  return { ...h, dist: meters(h, { lat, lon }) };
}
