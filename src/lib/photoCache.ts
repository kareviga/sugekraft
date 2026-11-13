/*
 * Bilder i Supabase Storage refereres som «sb:{sti}». Bucketen er privat, så vi henter
 * tidsbegrensede (signerte) URL-er og holder dem her. Egne opplastinger caches som data-URL
 * slik at de vises med en gang.
 */
const urls = new Map<string, string>();
export const setPhotoUrl = (path: string, url: string) => void urls.set(path, url);
export const getPhotoUrl = (path: string) => urls.get(path);
