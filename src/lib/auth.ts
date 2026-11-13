import { useSyncExternalStore } from 'react';
import { config, type User } from '../config';
import { sha256 } from './sha256';
import { isLive } from './mode';
import * as live from './live';
import { clearLive, loadLive } from '../store';

/*
 * Innlogging.
 *  - Demo-modus: brukerne ligger i config.ts (passord som SHA-256). Økten huskes i localStorage.
 *    Ikke ekte sikkerhet – alt kjører i nettleseren.
 *  - Live-modus: Supabase Auth (e-post + passord). Rolle, firma og kobling til sjåfør/kunde
 *    kommer fra tabellen «profiles». Tilgangen håndheves av databasen.
 * Brukernavnene fra config (kontorbruker osv.) virker i begge moduser – i live-modus
 * slås e-posten opp i config.users.
 */

const KEY = `${config.storageKey}-session`;
const ls = new Set<() => void>();
const emit = () => ls.forEach(l => l());

/** æ/ø/å kan skrives som ae/o/a (f.eks. «sjaforbruker») */
const norm = (v: string) => v.trim().toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a');

function readDemo(): User | null {
  try {
    const u = localStorage.getItem(KEY);
    return (u && config.users.find(x => x.username === u)) || null;
  } catch {
    return null;
  }
}

let current: User | null = isLive() ? null : readDemo();
/** false mens vi sjekker om det finnes en innlogget Supabase-økt */
let ready = !isLive();

async function startLive(): Promise<User | null> {
  const p = await live.fetchProfile();
  if (!p) return null;
  await loadLive(p.role);
  return {
    username: p.full_name,
    passwordHash: '',
    role: p.role,
    name: p.full_name,
    driverId: p.driver_id ?? undefined,
    clientId: p.client_id ?? undefined,
  };
}

// gjenoppta Supabase-økt ved oppstart
if (isLive()) {
  live
    .currentSession()
    .then(s => (s ? startLive() : null))
    .then(u => {
      current = u;
    })
    .catch(() => {
      current = null;
    })
    .finally(() => {
      ready = true;
      emit();
    });
}

export type LoginResult = User | 'feil' | 'ingen-profil' | 'nett';

export async function login(username: string, password: string): Promise<LoginResult> {
  if (!isLive()) {
    const hash = sha256(password);
    const u = config.users.find(x => norm(x.username) === norm(username) && x.passwordHash === hash);
    if (!u) return 'feil';
    current = u;
    try {
      localStorage.setItem(KEY, u.username);
    } catch {
      /* ignorer */
    }
    emit();
    return u;
  }
  const email = username.includes('@') ? username.trim() : config.users.find(x => norm(x.username) === norm(username))?.email ?? username.trim();
  try {
    if (!(await live.signIn(email, password))) return 'feil';
    const u = await startLive();
    if (!u) {
      await live.signOut();
      return 'ingen-profil';
    }
    current = u;
    emit();
    return u;
  } catch {
    return 'nett';
  }
}

/** Demo: logg inn som en rolle uten passord (offentlig demo-lenke). */
export function loginDemo(role: User['role']): User | null {
  if (isLive()) return null;
  const u = config.users.find(x => x.role === role);
  if (!u) return null;
  current = u;
  try {
    localStorage.setItem(KEY, u.username);
  } catch {
    /* ignorer */
  }
  emit();
  return u;
}

export async function logout() {
  if (isLive()) {
    clearLive();
    await live.signOut().catch(() => undefined);
  }
  current = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorer */
  }
  emit();
}

const sub = (l: () => void) => {
  ls.add(l);
  return () => {
    ls.delete(l);
  };
};
export function useSession(): User | null {
  return useSyncExternalStore(sub, () => current);
}
export function useAuthReady(): boolean {
  return useSyncExternalStore(sub, () => ready);
}

export const ROLE_LABEL = { admin: 'Kontor', driver: 'Sjåfør', client: 'Kunde' } as const;
