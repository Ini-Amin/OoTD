import type { RealtimeChannel } from '@supabase/supabase-js';
import { auth } from './auth.svelte';
import { getSupabase } from './supabase';
import {
	joinVisitors,
	toValidPos,
	POS_STALE_MS,
	type PosEntry,
	type RosterEntry
} from './presenceJoin';

export type PresenceVisitor = {
	clientId: string;
	name: string;
	hue: number;
	storeId: string | null;
	/** Live world position in meters (3D mall); null when stale/unknown. */
	x: number | null;
	z: number | null;
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

/** This tab's chat identity, shared by presence roster and mall chat. */
export function myDisplayName(): string {
	return displayName();
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
	#roster: RosterEntry[] = [];
	#positions = new Map<string, PosEntry>();
	#pruneTimer: ReturnType<typeof setInterval> | null = null;
	#reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
				config: { presence: { key: this.clientId }, broadcast: { self: false } }
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
						const next: RosterEntry[] = [];
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
						this.#roster = next;
						this.rebuild();
					} catch {
						// Keep last-known visitors on malformed state.
					}
				})
				.on(
					'broadcast',
					{ event: 'pos' },
					({ payload }: { payload?: { id?: unknown; x?: unknown; z?: unknown } }) => {
						try {
							if (!payload || typeof payload.id !== 'string' || !payload.id) return;
							if (payload.id === this.clientId) return;
							const pos = toValidPos(payload);
							if (!pos) return;
							this.#positions.set(payload.id, { ...pos, at: Date.now() });
							this.rebuild();
						} catch {
							// Malformed positions never break the roster.
						}
					}
				)
				.subscribe((subStatus) => {
					if (subStatus === 'SUBSCRIBED') {
						this.status = 'live';
						void this.track();
					} else if (subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR') {
						this.status = 'offline';
						this.#channel = null;
						this.scheduleReconnect();
					} else {
						this.status = 'connecting';
					}
				});
			if (this.#pruneTimer) clearInterval(this.#pruneTimer);
			this.#pruneTimer = setInterval(() => {
				this.prune();
				this.rebuild();
			}, 5000);
		} catch {
			this.status = 'offline';
			this.#channel = null;
		}
	}

	disconnect(): void {
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
		}
		if (this.#pruneTimer) {
			clearInterval(this.#pruneTimer);
			this.#pruneTimer = null;
		}
		if (this.#channel) {
			try {
				void this.#channel.unsubscribe();
			} catch {
				// Offline tolerance: never throw on teardown.
			}
			this.#channel = null;
		}
		this.#roster = [];
		this.#positions.clear();
		this.visitors = [];
	}

	private scheduleReconnect(): void {
		if (typeof window === 'undefined' || this.#reconnectTimer) return;
		this.#reconnectTimer = setTimeout(() => {
			this.#reconnectTimer = null;
			if (!this.#channel) this.connect();
		}, 2000);
	}

	private rebuild(): void {
		this.visitors = joinVisitors(this.#roster, this.#positions);
	}

	private prune(): void {
		const now = Date.now();
		const known = new Set(this.#roster.map((r) => r.clientId));
		for (const [id, pos] of this.#positions) {
			if (!known.has(id) || now - pos.at > POS_STALE_MS * 2) this.#positions.delete(id);
		}
	}

	/**
	 * Re-track this tab's roster entry (store context). RARE by design:
	 * the server closes channels that track repeatedly, so live positions
	 * go over broadcast (sendPos) instead.
	 */
	update(storeId: string | null): void {
		this.#storeId = storeId;
		if (this.#channel && this.status === 'live') {
			void this.track();
		}
	}

	/** Broadcast this tab's live 3D position. Best-effort, never throws. */
	sendPos(x: number, z: number): void {
		if (!this.#channel || this.status !== 'live') return;
		if (!Number.isFinite(x) || !Number.isFinite(z)) return;
		void this.sendPosAsync(x, z);
	}

	private async sendPosAsync(x: number, z: number): Promise<void> {
		if (!this.#channel) return;
		try {
			await this.#channel.send({
				type: 'broadcast',
				event: 'pos',
				payload: { id: this.clientId, x, z }
			});
		} catch {
			// Offline tolerance: presence is best-effort.
		}
	}

	private async track(): Promise<void> {
		if (!this.#channel) return;
		try {
			await this.#channel.track({
				name: displayName(),
				hue: this.hue,
				storeId: this.#storeId
			});
		} catch {
			// Offline tolerance: presence is best-effort.
		}
	}
}

export const presence = new PresenceStore();
