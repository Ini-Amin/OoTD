import type { RealtimeChannel } from '@supabase/supabase-js';
import { auth } from './auth.svelte';
import { getSupabase } from './supabase';

export type MallChatMessage = {
	id: string;
	name: string;
	text: string;
	mine: boolean;
	at: number;
};

export type MallChatStatus = 'connecting' | 'live' | 'offline';

const CHANNEL = 'mall-lobby';
const MAX_MESSAGES = 100;
const MAX_LEN = 500;

// Stable per-session guest name for logged-out chatters.
let guestName = '';

function displayName(): string {
	const p = auth.profile;
	if (p) return p.displayName?.trim() || `@${p.username}`;
	if (!guestName) guestName = `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
	return guestName;
}

class MallChatStore {
	messages = $state<MallChatMessage[]>([]);
	status = $state<MallChatStatus>('connecting');
	#channel: RealtimeChannel | null = null;
	#seen = new Set<string>();

	connect(): void {
		if (typeof window === 'undefined' || this.#channel) return;
		const supabase = getSupabase();
		if (!supabase) {
			this.status = 'offline';
			return;
		}
		this.status = 'connecting';
		const channel = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } });
		this.#channel = channel;
		channel
			.on('broadcast', { event: 'msg' }, ({ payload }) => {
				const p = payload as { id?: unknown; name?: unknown; text?: unknown };
				if (
					typeof p.id !== 'string' ||
					typeof p.name !== 'string' ||
					typeof p.text !== 'string' ||
					!p.text.trim() ||
					this.#seen.has(p.id)
				) {
					return;
				}
				this.#seen.add(p.id);
				this.messages = [
					...this.messages.slice(-(MAX_MESSAGES - 1)),
					{ id: p.id, name: p.name.slice(0, 40), text: p.text.slice(0, MAX_LEN), mine: false, at: Date.now() }
				];
			})
			.subscribe((subStatus) => {
				this.status = subStatus === 'SUBSCRIBED' ? 'live' : subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR' ? 'offline' : 'connecting';
			});
	}

	disconnect(): void {
		if (this.#channel) {
			void this.#channel.unsubscribe();
			this.#channel = null;
		}
	}

	async send(raw: string): Promise<boolean> {
		const text = raw.trim().slice(0, MAX_LEN);
		if (!text || !this.#channel || this.status !== 'live') return false;
		const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		const name = displayName();
		this.#seen.add(id);
		this.messages = [
			...this.messages.slice(-(MAX_MESSAGES - 1)),
			{ id, name, text, mine: true, at: Date.now() }
		];
		const res = await this.#channel.send({ type: 'broadcast', event: 'msg', payload: { id, name, text } });
		return res === 'ok';
	}
}

export const mallChat = new MallChatStore();
