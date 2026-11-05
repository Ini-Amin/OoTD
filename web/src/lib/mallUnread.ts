// Unread badge persistence for mall whispers (localStorage fallback).
// Whisper bodies stay ephemeral by design (mallChat.svelte.ts) — only the
// unread counts + peer name + timestamp survive a reload, so the badge
// reads honestly: restored threads show "new activity" without implying
// history exists. Never persist message text here (shared browsers).
// Modul murni — tanpa dependensi svelte agar unit-testable.
export const MALL_UNREAD_KEY = 'ootd-mall-unread-v1';

export type UnreadThreadMeta = {
	peerId: string;
	name: string;
	at: number;
};

export type PersistedUnread = {
	unread: Record<string, number>;
	threads: UnreadThreadMeta[];
};

const EMPTY: PersistedUnread = { unread: {}, threads: [] };

export function serializeUnread(unread: Record<string, number>, threads: UnreadThreadMeta[]): string {
	const cleanUnread: Record<string, number> = {};
	for (const [k, v] of Object.entries(unread)) {
		if (typeof k !== 'string' || !k) continue;
		if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
		cleanUnread[k] = Math.floor(v);
	}
	const cleanThreads = threads
		.filter((t) => typeof t.peerId === 'string' && t.peerId && (cleanUnread[t.peerId] ?? 0) > 0)
		.map((t) => ({
			peerId: t.peerId.slice(0, 80),
			name: String(t.name ?? '').slice(0, 40),
			at: Number.isFinite(t.at) ? t.at : 0
		}));
	return JSON.stringify({ unread: cleanUnread, threads: cleanThreads });
}

/**
 * Parse a stored payload back into unread state. Corrupt JSON, wrong
 * shapes, or non-positive counts collapse to empty state (never throw).
 */
export function parsePersistedUnread(raw: unknown): PersistedUnread {
	if (typeof raw !== 'string' || !raw) return { ...EMPTY, unread: {}, threads: [] };
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return { unread: {}, threads: [] };
	}
	if (typeof data !== 'object' || data === null) return { unread: {}, threads: [] };
	const d = data as Record<string, unknown>;
	const unread: Record<string, number> = {};
	if (typeof d.unread === 'object' && d.unread !== null) {
		for (const [k, v] of Object.entries(d.unread as Record<string, unknown>)) {
			if (!k || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
			unread[k] = Math.floor(v);
		}
	}
	const threads: UnreadThreadMeta[] = [];
	if (Array.isArray(d.threads)) {
		for (const t of d.threads) {
			if (typeof t !== 'object' || t === null) continue;
			const r = t as Record<string, unknown>;
			if (typeof r.peerId !== 'string' || !r.peerId) continue;
			threads.push({
				peerId: r.peerId.slice(0, 80),
				name: typeof r.name === 'string' ? r.name.slice(0, 40) : '',
				at: typeof r.at === 'number' && Number.isFinite(r.at) ? r.at : 0
			});
		}
	}
	return { unread, threads };
}

export type RestoredInboxState = {
	unread: Record<string, number>;
	meta: Record<string, UnreadThreadMeta>;
	names: Record<string, string>;
};

/**
 * First-connect restore: persisted counts REPLACE live state, never add to
 * it. The caller must invoke this at most once per page load — running it
 * on every SPA remount would inflate every count on each visit.
 */
export function computeRestoredState(
	persisted: PersistedUnread,
	livePeerIds: readonly string[],
	liveNames: Record<string, string>
): RestoredInboxState {
	const unread = { ...persisted.unread };
	const live = new Set(livePeerIds);
	const meta: Record<string, UnreadThreadMeta> = {};
	for (const t of persisted.threads) {
		if ((unread[t.peerId] ?? 0) > 0 && !live.has(t.peerId)) meta[t.peerId] = { ...t };
	}
	const names = { ...liveNames };
	for (const t of persisted.threads) {
		if (!names[t.peerId] && t.name) names[t.peerId] = t.name;
	}
	return { unread, meta, names };
}

/** Unread threads first, then most recent. Ties keep insertion order. */
export function sortThreadIds(
	ids: string[],
	unread: Record<string, number>,
	lastAt: (id: string) => number
): string[] {
	return [...ids].sort((a, b) => {
		const au = (unread[a] ?? 0) > 0 ? 0 : 1;
		const bu = (unread[b] ?? 0) > 0 ? 0 : 1;
		if (au !== bu) return au - bu;
		return lastAt(b) - lastAt(a);
	});
}
