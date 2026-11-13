import { config } from '../config';
import { isLive } from './mode';

/*
 * Tilpasset demo-lenke: «…/?firma=Hansen Sug AS» viser mottakerens firmanavn i appen og på
 * PDF-rapporten. Navnet huskes i nettleseren, slik at det blir stående ved omlasting.
 * «?firma=» (tomt) fjerner tilpasningen. Gjelder bare demo-modus.
 * Kontaktinfoen til demo-firmaet skjules, så det ikke står feil adresse/telefon på rapporten.
 */
const KEY = 'sugekraft-firma';

export function applyFirmaParam() {
  if (isLive()) return;
  let name: string | null = null;
  try {
    const p = new URLSearchParams(location.search);
    if (p.has('firma')) {
      const v = (p.get('firma') ?? '').trim().slice(0, 60);
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
    }
    name = localStorage.getItem(KEY);
  } catch {
    /* ignorer */
  }
  if (!name) return;
  Object.assign(config.company, { name, orgNr: '', address: '', phone: '', email: '', web: '' });
}
