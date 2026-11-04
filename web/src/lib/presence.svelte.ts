import type { RealtimeChannel } from '@supabase/supabase-js';
import { auth } from './auth.svelte';
import { getSupabase } from './supabase';

export type PresenceVisitor = {
	clientId: string;
	name: string;
	hue: number;
	storeId: string | null;
};

export type PresenceStatus = 'connecting' | 'live' | 'offline';

const CHANNEL = 'mall-presence';

// Stable per-session identity for this browser tab.
function newClientId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let guestName = '';

function displayName(): string {
	const p = auth.profile;
	if (p) return (p.displayName?.trim() || `@${p.username}`).slice(0, 40);
	if (!guestName) guestName = `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
	return guestName;
}

function isValidStoreId(storeId: unknown): storeId is string | null {
	return storeId === null || (typeof storeId === 'string' && storeId.length <= 64);
}

class PresenceStore {
	visitors = $state<PresenceVisitor[]>([]);
	status = $state<PresenceStatus>('connecting');
	readonly clientId = newClientId();
	readonly hue = Math.floor(Math.random() * 360);
	#channel: RealtimeChannel | null = null;
	#storeId: string | null = null;

	connect(): void {
		if (typeof window === 'undefined' || this.#channel) return;
		let supabase: ReturnType<typeof getSupabase>;
		try {
			supabase = getSupabase();
		} catch {
			this.status = 'offline';
			return;
		}
		if (!supabase) {
			this.status = 'offline';
			return;
		}
		this.status = 'connecting';
		try {
			const channel = supabase.channel(CHANNEL, {
				config: { presence: { key: this.clientId } }
			});
			this.#channel = channel;
			channel
				.on('presence', { event: 'sync' }, () => {
					try {
						const state = channel.presenceState<{
							name?: unknown;
							hue?: unknown;
							storeId?: unknown;
						}>();
						const next: PresenceVisitor[] = [];
						for (const [key, presences] of Object.entries(state)) {
							if (key === this.clientId) continue;
							for (const p of presences) {
								if (typeof p.name !== 'string' || !p.name.trim()) continue;
								if (typeof p.hue !== 'number' || !Number.isFinite(p.hue)) continue;
								if (!isValidStoreId(p.storeId)) continue;
								next.push({
									clientId: key,
									name: p.name.slice(0, 40),
									hue: ((Math.round(p.hue) % 360) + 360) % 360,
									storeId: p.storeId
								});
								break;
							}
						}
						this.visitors = next;
					} catch {
						// Keep last-known visitors on malformed state.
					}
				})
				.subscribe((subStatus) => {
					if (subStatus === 'SUBSCRIBED') {
						this.status = 'live';
						void this.track();
					} else if (subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR') {
						this.status = 'offline';
					} else {
						this.status = 'connecting';
					}
				});
		} catch {
			this.status = 'offline';
			this.#channel = null;
		}
	}

	disconnect(): void {
		if (this.#channel) {
			try {
				void this.#channel.unsubscribe();
			} catch {
				// Offline tolerance: never throw on teardown.
			}
			this.#channel = null;
		}
		this.visitors = [];
	}

	/** Re-track this tab's position. Safe to call before connect or while offline. */
	update(storeId: string | null): void {
		this.#storeId = storeId;
		if (this.#channel && this.status === 'live') {
			void this.track();
		}
	}

	private async track(): Promise<void> {
		if (!this.#channel) return;
		try {
			await this.#channel.track({ name: displayName(), hue: this.hue, storeId: this.#storeId });
		} catch {
			// Offline tolerance: presence is best-effort.
		}
	}
}

export const presence = new PresenceStore();
