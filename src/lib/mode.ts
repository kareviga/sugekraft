import { hasBackend } from './supabase';

/*
 * Modus:
 *  - «live»: ekte data i Supabase (krever .env-oppsett)
 *  - «demo»: eksempeldata i nettleseren, virker uten nett – fin til presentasjoner
 * Valget gjøres på innloggingssiden og huskes i nettleseren.
 */
const KEY = 'sugekraft-mode';
export type Mode = 'live' | 'demo';

function read(): Mode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'demo' || v === 'live' ? v : null;
  } catch {
    return null;
  }
}

export const mode: Mode = hasBackend && read() !== 'demo' ? 'live' : 'demo';
export const isLive = () => mode === 'live';

export function setMode(m: Mode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* ignorer */
  }
  location.reload();
}
