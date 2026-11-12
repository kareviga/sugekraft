import { useSyncExternalStore } from 'react';
import { config } from '../config';
import { en } from './en';

/*
 * Språk: norsk (standard) og engelsk.
 * - tr('Norsk tekst') slår opp engelsk oversettelse i en.ts. Norsk tekst er nøkkelen.
 * - Variabler: tr('{n} jobber i dag', { n: 3 })
 * - trd(verdi) oversetter data fra config (tjenester, masser, deponier, biltyper) via config.translations.
 * Mangler en oversettelse, vises norsk tekst. Manglende nøkler samles i window.__i18nMissing.
 */

export type Lang = 'no' | 'en';
const KEY = 'sugekraft-lang';

let lang: Lang = (() => {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'no';
  } catch {
    return 'no';
  }
})();
const ls = new Set<() => void>();
document.documentElement.lang = lang === 'en' ? 'en' : 'nb';

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignorer */
  }
  document.documentElement.lang = l === 'en' ? 'en' : 'nb';
  ls.forEach(f => f());
}
export function useLang(): Lang {
  return useSyncExternalStore(
    f => {
      ls.add(f);
      return () => {
        ls.delete(f);
      };
    },
    () => lang,
  );
}

const missing = new Set<string>();
(window as unknown as { __i18nMissing: Set<string> }).__i18nMissing = missing;

export function tr(no: string, vars?: Record<string, string | number>): string {
  let s = no;
  if (lang === 'en') {
    const e = en[no];
    if (e !== undefined) s = e;
    else missing.add(no);
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}

/** Oversett data fra konfigurasjonen (tjenester, massetyper, deponier, enheter, biltyper). */
export const trd = (s: string) => (lang === 'en' && s ? config.translations.en[s] ?? s : s);

/** Datoformat for tall og datoer */
export const locale = () => (lang === 'en' ? 'en-GB' : 'nb-NO');
