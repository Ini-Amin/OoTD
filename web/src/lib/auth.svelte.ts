import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Theme } from '$lib/themes';
import { apiBase } from '$lib/outfits';

export type Profile = {
	username: string;
	displayName: string;
	bio: string;
	theme: Theme | null;
};

class AuthStore {
	ready = $state<boolean>(false);
	session = $state<Session | null>(null);
	profile = $state<Profile | null | undefined>(undefined);

	private client: SupabaseClient | null = null;
	private initPromise: Promise<void> | null = null;
	private refreshPromise: Promise<{ error: string | null }> | null = null;

	get token(): string | null {
		return this.session?.access_token ?? null;
	}

	private getClient(): SupabaseClient | null {
		if (this.client) return this.client;
		if (typeof window === 'undefined') return null;
		const url = import.meta.env.VITE_SUPABASE_URL;
		const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
		if (!url || !anonKey) return null;
		this.client = createClient(url, anonKey, {
			auth: {
				persistSession: true,
				autoRefreshToken: true
			}
		});
		return this.client;
	}

	init = async (): Promise<void> => {
		if (typeof window === 'undefined') return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			const client = this.getClient();
			if (!client) {
				this.ready = true;
				return;
			}

			client.auth.onAuthStateChange(async (event, newSession) => {
				this.session = newSession;
				if (event === 'SIGNED_OUT' || !newSession) {
					this.profile = null;
				} else if (event === 'SIGNED_IN') {
					await this.refreshProfile();
				}
			});

			try {
				const { data, error } = await client.auth.getSession();
				if (error || !data.session) {
					this.session = null;
					this.profile = null;
				} else {
					this.session = data.session;
					await this.refreshProfile();
				}
			} catch {
				this.session = null;
				this.profile = null;
			} finally {
				this.ready = true;
			}
		})();

		return this.initPromise;
	};

	signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
		const client = this.getClient();
		if (!client) return { error: 'Auth client unavailable' };

		try {
			const { data, error } = await client.auth.signUp({ email, password });
			if (error) {
				return { error: error.message };
			}
			if (data.user && !data.session) {
				return { error: 'Check your email to confirm your account, then sign in.' };
			}
			if (data.session) {
				this.session = data.session;
				await this.refreshProfile();
			}
			return { error: null };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Sign up failed';
			return { error: message };
		}
	};

	signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
		const client = this.getClient();
		if (!client) return { error: 'Auth client unavailable' };

		try {
			const { data, error } = await client.auth.signInWithPassword({ email, password });
			if (error) {
				return { error: error.message };
			}
			this.session = data.session;
			await this.refreshProfile();
			return { error: null };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Sign in failed';
			return { error: message };
		}
	};

	signOut = async (): Promise<{ error: string | null }> => {
		const client = this.getClient();
		this.session = null;
		this.profile = null;
		if (!client) return { error: null };

		try {
			const { error } = await client.auth.signOut();
			if (error) {
				return { error: error.message };
			}
			return { error: null };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Sign out failed';
			return { error: message };
		}
	};

	createProfile = async (
		username: string,
		displayName: string
	): Promise<{ error: string | null }> => {
		const token = this.token;
		if (!token) {
			return { error: 'unauthorized' };
		}

		try {
			const res = await fetch(`${apiBase}/v1/me`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					username: username.trim().toLowerCase(),
					displayName: displayName.trim()
				})
			});

			const body = (await res.json().catch(() => null)) as
				| { user?: Profile; error?: string }
				| null;

			if (!res.ok) {
				return { error: body?.error ?? `Request failed (${res.status})` };
			}

			if (body?.user) {
				this.profile = body.user;
			}
			return { error: null };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Network error';
			return { error: message };
		}
	};

	refreshProfile = async (): Promise<{ error: string | null }> => {
		if (this.refreshPromise) return this.refreshPromise;
		this.refreshPromise = (async () => {
			const token = this.token;
			if (!token) {
				this.profile = null;
				return { error: null };
			}

			try {
				const res = await fetch(`${apiBase}/v1/me`, {
					headers: {
						Authorization: `Bearer ${token}`
					}
				});

				if (res.status === 401) {
					try {
						await this.client?.auth.signOut({ scope: 'local' });
					} catch {
						// ignore
					}
					this.session = null;
					this.profile = null;
					return { error: 'unauthorized' };
				}

				if (!res.ok) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null;
					return { error: body?.error ?? `HTTP ${res.status}` };
				}

				const body = (await res.json()) as {
					user: Profile | null;
					authId?: string;
					email?: string;
				};

				this.profile = body.user ?? null;
				return { error: null };
			} catch (err: unknown) {
				// network error -> keep undefined
				const message = err instanceof Error ? err.message : 'Network error';
				return { error: message };
			}
		})().finally(() => {
			this.refreshPromise = null;
		});
		return this.refreshPromise;
	};
}

export const auth = new AuthStore();

export function authHeaders(): Record<string, string> {
	const t = auth.token;
	return t ? { Authorization: `Bearer ${t}` } : {};
}
