import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/*
 * Supabase-klient. Settes opp bare når VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY finnes
 * (se .env.example). Uten dem kjører appen alltid i demo-modus.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const hasBackend = !!supabase;
