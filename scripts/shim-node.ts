// Minimal nettleser-miljø slik at app-koden (i18n, seed) kan kjøres i Node av gen-seed.
const g = globalThis as unknown as Record<string, unknown>;
const mem = new Map<string, string>();
g.window = globalThis;
g.document = { documentElement: {} };
g.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
export {};
