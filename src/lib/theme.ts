import { config } from '../config';

/** Farger fra firmaoppsettet blir CSS-variabler. Kalles ved oppstart og når firmaoppsettet lastes fra Supabase. */
export function applyTheme() {
  const root = document.documentElement.style;
  Object.entries(config.colors).forEach(([k, v]) => root.setProperty(`--${k}`, v));
  document.title = `${config.appName} · ${config.company.name}`;
}
