import type { RealtimeChannel } from '@supabase/supabase-js';
import { isBlocked, shouldThrottle } from './chatFilter';
import { botDisplayName, botIdFromPeerId, botReplyFor, isBotPeerId } from './mallBots';
import { HISTORY_LIMIT, mergeHistory, parseHistoryRow, type HistoryRow } from './mallChatHistory';
import {
	MALL_UNREAD_KEY,
	computeRestoredState,
	parsePersistedUnread,
	serializeUnread,
	type UnreadThreadMeta
} from './mallUnread';
import { mallFriends } from './mall';
import { myDisplayName, presence } from './presence.svelte';
import { getSupabase } from './supabase';

export type MallChatMessage = {
	id: string;
	name: string;
	text: string;
	mine: boolean;
	at: number;
};

export type WhisperMessage = MallChatMessage & { peerId: string };

export type MallChatStatus = 'connecting' | 'live' | 'offline';

const CHANNEL = 'mall-lobby';
const MAX_MESSAGES = 100;
const MAX_LEN = 500;

class MallChatStore {
	messages = $state<MallChatMessage[]>([]);
	/** 1:1 threads keyed by peer clientId. */
	whispers = $state<Record<string, WhisperMessage[]>>({});
	/** Latest known display name per peer clientId. */
	whisperNames = $state<Record<string, string>>({});
	/** Unread counts: 'mall' plus one per peer clientId. */
	unread = $state<Record<string, number>>({});
	/** Restored unread-thread metadata (counts survived reload, bodies did not). */
	restoredMeta = $state<Record<string, UnreadThreadMeta>>({});
	status = $state<MallChatStatus>('connecting');
	/** Honest rejection reason shown to the sender when moderation blocks a send. */
	lastRejection = $state<string | null>(null);
	#channel: RealtimeChannel | null = null;
	#seen = new Set<string>();
	#sendHistory: number[] = [];
	/** True once persisted unread has been restored (first connect only). */
	#restored = false;

	connect(): void {
		if (typeof window === 'undefined' || this.#channel) return;
		const supabase = getSupabase();
		if (!supabase) {
			this.status = 'offline';
			return;
		}
		this.status = 'connecting';
		this.#restoreUnread();
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
				this.unread = { ...this.unread, mall: (this.unread['mall'] ?? 0) + 1 };
				this.#persistUnread();
			})
			.on('broadcast', { event: 'whisper' }, ({ payload }) => {
				const p = payload as {
					id?: unknown;
					from?: unknown;
					fromName?: unknown;
					to?: unknown;
					text?: unknown;
				};
				if (
					typeof p.id !== 'string' ||
					typeof p.from !== 'string' ||
					typeof p.fromName !== 'string' ||
					typeof p.to !== 'string' ||
					typeof p.text !== 'string' ||
					!p.text.trim() ||
					p.to !== presence.clientId ||
					this.#seen.has(p.id)
				) {
					return;
				}
				this.#seen.add(p.id);
				const peerId = p.from;
				this.whisperNames = { ...this.whisperNames, [peerId]: p.fromName.slice(0, 40) };
				const thread = this.whispers[peerId] ?? [];
				this.whispers = {
					...this.whispers,
					[peerId]: [
						...thread.slice(-(MAX_MESSAGES - 1)),
						{
							id: p.id,
							name: p.fromName.slice(0, 40),
							text: p.text.slice(0, MAX_LEN),
							mine: false,
							at: Date.now(),
							peerId
						}
					]
				};
				this.unread = { ...this.unread, [peerId]: (this.unread[peerId] ?? 0) + 1 };
				if (this.restoredMeta[peerId]) {
					const meta = { ...this.restoredMeta };
					delete meta[peerId];
					this.restoredMeta = meta;
				}
				this.#persistUnread();
			})
			.subscribe((subStatus) => {
				this.status = subStatus === 'SUBSCRIBED' ? 'live' : subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR' ? 'offline' : 'connecting';
			});
		void this.#loadHistory();
	}

	/** Load the newest persisted public messages and merge with live traffic. */
	async #loadHistory(): Promise<void> {
		const supabase = getSupabase();
		if (!supabase) return;
		try {
			const { data, error } = await supabase
				.from('mall_messages')
				.select('id,name,text,created_at')
				.order('created_at', { ascending: false })
				.limit(HISTORY_LIMIT);
			if (error || !data) return;
			const rows: HistoryRow[] = [];
			for (const r of data) {
				const h = parseHistoryRow(r);
				if (h) rows.push(h);
			}
			this.messages = mergeHistory(this.messages, rows, MAX_MESSAGES);
			for (const m of this.messages) this.#seen.add(m.id);
		} catch {
			// Offline tolerance: live broadcast still works without history.
		}
	}

	disconnect(): void {
		if (this.#channel) {
			void this.#channel.unsubscribe();
			this.#channel = null;
		}
	}

	markRead(key: string): void {
		if (!this.unread[key]) return;
		const next = { ...this.unread };
		delete next[key];
		this.unread = next;
		if (this.restoredMeta[key]) {
			const meta = { ...this.restoredMeta };
			delete meta[key];
			this.restoredMeta = meta;
		}
		this.#persistUnread();
	}

	/**
	 * Persist unread counts + peer name + timestamp; message text is never
	 * stored (whispers stay ephemeral; shared browsers must not leak them).
	 */
	#persistUnread(): void {
		if (typeof window === 'undefined') return;
		try {
			const threads: UnreadThreadMeta[] = [];
			for (const [peerId, count] of Object.entries(this.unread)) {
				if (peerId === 'mall' || count <= 0) continue;
				const thread = this.whispers[peerId] ?? [];
				const last = thread[thread.length - 1];
				const restored = this.restoredMeta[peerId];
				threads.push({
					peerId,
					name: this.whisperNames[peerId] ?? restored?.name ?? 'Visitor',
					at: last?.at ?? restored?.at ?? Date.now()
				});
			}
			window.localStorage.setItem(MALL_UNREAD_KEY, serializeUnread(this.unread, threads));
		} catch {
			// Private mode / quota: unread still works for this session.
		}
	}

	/**
	 * Restore persisted unread on the first connect only. The store is a
	 * module singleton whose state survives disconnect(), so restoring on
	 * every SPA remount would inflate counts on each visit.
	 */
	#restoreUnread(): void {
		if (typeof window === 'undefined' || this.#restored) return;
		this.#restored = true;
		try {
			const raw = window.localStorage.getItem(MALL_UNREAD_KEY);
			const persisted = parsePersistedUnread(raw);
			const { unread, meta, names } = computeRestoredState(
				persisted,
				Object.keys(this.whispers),
				this.whisperNames
			);
			this.unread = unread;
			this.restoredMeta = meta;
			this.whisperNames = names;
		} catch {
			// Storage blocked: start with in-session state only.
		}
	}

	/** Total unread across mall chat and every whisper thread. */
	unreadTotal(): number {
		return Object.values(this.unread).reduce((a, b) => a + b, 0);
	}

	/** Display name for a whisper thread (live roster name wins, else last seen). */
	threadName(peerId: string): string {
		if (isBotPeerId(peerId)) {
			const bot = mallFriends.find((f) => `bot:${f.id}` === peerId);
			return bot ? botDisplayName(bot.name) : botDisplayName('Bot');
		}
		const live = presence.visitors.find((v) => v.clientId === peerId);
		if (live) return live.name;
		return this.whisperNames[peerId] ?? 'Visitor';
	}

	/** Moderation gate shared by send() and sendWhisper(). Null = allowed. */
	#moderate(text: string): string | null {
		if (isBlocked(text)) return 'Pesan ditolak: kata tidak pantas.';
		const now = Date.now();
		if (shouldThrottle(this.#sendHistory, now))
			return 'Pesan ditolak: terlalu cepat, tunggu sebentar.';
		this.#sendHistory = [...this.#sendHistory.slice(-4), now];
		return null;
	}

	async send(raw: string): Promise<boolean> {
		const text = raw.trim().slice(0, MAX_LEN);
		if (!text || !this.#channel || this.status !== 'live') return false;
		const rejection = this.#moderate(text);
		if (rejection) {
			this.lastRejection = rejection;
			return false;
		}
		this.lastRejection = null;
		const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		const name = myDisplayName();
		this.#seen.add(id);
		this.messages = [
			...this.messages.slice(-(MAX_MESSAGES - 1)),
			{ id, name, text, mine: true, at: Date.now() }
		];
		const res = await this.#channel.send({ type: 'broadcast', event: 'msg', payload: { id, name, text } });
		await this.#persist(id, name, text);
		return res === 'ok';
	}

	/** Best-effort persist to mall_messages so public chat survives refresh. */
	async #persist(id: string, name: string, text: string): Promise<void> {
		try {
			const supabase = getSupabase();
			if (!supabase) return;
			await supabase.from('mall_messages').insert({ id, name, text });
		} catch {
			// Live broadcast already delivered; persistence retries on next send.
		}
	}

	/** Whisper stays ephemeral by design: 1:1 threads are never persisted. */
	async sendWhisper(peerId: string, peerName: string, raw: string): Promise<boolean> {
		const text = raw.trim().slice(0, MAX_LEN);
		if (!text || !peerId || !this.#channel || this.status !== 'live') return false;
		const rejection = this.#moderate(text);
		if (rejection) {
			this.lastRejection = rejection;
			return false;
		}
		this.lastRejection = null;
		const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		const name = myDisplayName();
		this.#seen.add(id);
		this.whisperNames = { ...this.whisperNames, [peerId]: peerName.slice(0, 40) };
		const thread = this.whispers[peerId] ?? [];
		this.whispers = {
			...this.whispers,
			[peerId]: [
				...thread.slice(-(MAX_MESSAGES - 1)),
				{ id, name, text, mine: true, at: Date.now(), peerId }
			]
		};
		const res = await this.#channel.send({
			type: 'broadcast',
			event: 'whisper',
			payload: { id, from: presence.clientId, fromName: name, to: peerId, text }
		});
		return res === 'ok';
	}

	/**
	 * Demo-bot whisper: local only, no backend, works offline.
	 * Pushes the user message, then a canned auto-reply shortly after.
	 */
	sendBotWhisper(peerId: string, raw: string): boolean {
		const botId = botIdFromPeerId(peerId);
		const text = raw.trim().slice(0, MAX_LEN);
		if (!botId || !text) return false;
		const rejection = this.#moderate(text);
		if (rejection) {
			this.lastRejection = rejection;
			return false;
		}
		this.lastRejection = null;
		const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		const name = myDisplayName();
		this.#seen.add(id);
		this.whisperNames = { ...this.whisperNames, [peerId]: this.threadName(peerId) };
		const thread = this.whispers[peerId] ?? [];
		this.whispers = {
			...this.whispers,
			[peerId]: [
				...thread.slice(-(MAX_MESSAGES - 1)),
				{ id, name, text, mine: true, at: Date.now(), peerId }
			]
		};
		const replyId = `${id}-bot`;
		const pushReply = (): void => {
			if (this.#seen.has(replyId)) return;
			this.#seen.add(replyId);
			const current = this.whispers[peerId] ?? [];
			this.whispers = {
				...this.whispers,
				[peerId]: [
					...current.slice(-(MAX_MESSAGES - 1)),
					{
						id: replyId,
						name: this.threadName(peerId),
						text: botReplyFor(botId, text),
						mine: false,
						at: Date.now(),
						peerId
					}
				]
			};
			this.unread = { ...this.unread, [peerId]: (this.unread[peerId] ?? 0) + 1 };
			this.#persistUnread();
		};
		if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
			window.setTimeout(pushReply, 600);
		} else {
			pushReply();
		}
		return true;
	}
}

export const mallChat = new MallChatStore();
