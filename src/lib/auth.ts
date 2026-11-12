import { useSyncExternalStore } from 'react';
import { config, type User } from '../config';

/*
 * Enkel demo-innlogging. Brukerne ligger i config.ts. Økten huskes i localStorage
 * til man logger ut. Dette er IKKE sikkerhet – alt kjører i nettleseren.
 */

const KEY = `${config.storageKey}-session`;
const ls = new Set<() => void>();

function read(): User | null {
  try {
    const u = localStorage.getItem(KEY);
    return (u && config.users.find(x => x.username === u)) || null;
  } catch {
    return null;
  }
}
let current = read();

export function login(username: string, password: string): User | null {
  const u = config.users.find(x => x.username === username.trim().toLowerCase() && x.password === password);
  if (!u) return null;
  current = u;
  try {
    localStorage.setItem(KEY, u.username);
  } catch {
    /* ignorer */
  }
  ls.forEach(l => l());
  return u;
}

export function logout() {
  current = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorer */
  }
  ls.forEach(l => l());
}

export function useSession(): User | null {
  return useSyncExternalStore(
    l => {
      ls.add(l);
      return () => {
        ls.delete(l);
      };
    },
    () => current,
  );
}

export const ROLE_LABEL = { admin: 'Kontor', driver: 'Sjåfør', client: 'Kunde' } as const;
