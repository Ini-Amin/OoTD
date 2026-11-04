import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let tried = false;

/** Shared anon Supabase client for realtime features (chat). Null when unconfigured or SSR. */
export function getSupabase(): SupabaseClient | null {
	if (client || tried || typeof window === 'undefined') return client;
	tried = true;
	const url = import.meta.env.VITE_SUPABASE_URL;
	const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
	if (!url || !anonKey) return null;
	client = createClient(url, anonKey);
	return client;
}
