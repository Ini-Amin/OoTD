// Riwayat chat publik mall: parsing + merge pesan dari tabel mall_messages.
// Modul murni — tanpa dependensi svelte/supabase agar unit-testable.
export type HistoryMessage = {
	id: string;
	name: string;
	text: string;
	mine: boolean;
	at: number;
};

export type HistoryRow = {
	id: string;
	name: string;
	text: string;
	at: number;
};

/** Max rows fetched from mall_messages on connect. */
export const HISTORY_LIMIT = 50;

/**
 * Validate one PostgREST row into a HistoryRow. Null when the row is
 * malformed (wrong types, empty text, unparseable timestamp).
 */
export function parseHistoryRow(row: unknown): HistoryRow | null {
	if (typeof row !== 'object' || row === null) return null;
	const r = row as Record<string, unknown>;
	if (typeof r.id !== 'string' || !r.id) return null;
	if (typeof r.name !== 'string' || !r.name.trim()) return null;
	if (typeof r.text !== 'string' || !r.text.trim()) return null;
	const at = Date.parse(typeof r.created_at === 'string' ? r.created_at : '');
	if (!Number.isFinite(at)) return null;
	return { id: r.id, name: r.name.slice(0, 40), text: r.text.slice(0, 500), at };
}

/**
 * Merge persisted history with live messages: dedup by id (live/current
 * wins so the local `mine` flag survives), chronological order, capped to
 * the newest `max` entries.
 */
export function mergeHistory(
	current: HistoryMessage[],
	history: HistoryRow[],
	max: number
): HistoryMessage[] {
	const seen = new Set<string>();
	const merged: HistoryMessage[] = [];
	for (const m of current) {
		if (seen.has(m.id)) continue;
		seen.add(m.id);
		merged.push(m);
	}
	for (const h of history) {
		if (seen.has(h.id)) continue;
		seen.add(h.id);
		merged.push({ id: h.id, name: h.name, text: h.text, mine: false, at: h.at });
	}
	merged.sort((a, b) => a.at - b.at);
	return merged.slice(-max);
}
