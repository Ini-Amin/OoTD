import { CATEGORY_LABEL, isCategory, type Category, type Piece } from './pieces';

/** Single localStorage key holding the outfit-id -> pieces map. */
export const PIECE_CACHE_KEY = 'ootd-piece-cache';

/** Max cached outfits; oldest (by savedAt) evicted first. */
export const PIECE_CACHE_CAP = 100;

export type CachedEntry = {
	pieces: Piece[];
	savedAt: number;
};

export type PieceCacheMap = Record<string, CachedEntry>;

/** One-shot session guard: an outfit is auto-tagged at most once per page session. */
const autoTagAttempted = new Set<string>();

/** Claim the single auto-tag attempt for an outfit. Returns false if already attempted. */
export function claimAutoTagAttempt(outfitId: string): boolean {
	if (autoTagAttempted.has(outfitId)) return false;
	autoTagAttempted.add(outfitId);
	return true;
}

export function hasAutoTagAttempted(outfitId: string): boolean {
	return autoTagAttempted.has(outfitId);
}

/** Pure: is this a plausible normalized box (fractions 0..1, positive area, inside frame)? */
export function isValidBox(box: unknown): box is { x: number; y: number; w: number; h: number } {
	if (!box || typeof box !== 'object') return false;
	const { x, y, w, h } = box as Record<string, unknown>;
	for (const v of [x, y, w, h]) {
		if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) return false;
	}
	if ((w as number) <= 0 || (h as number) <= 0) return false;
	if ((x as number) + (w as number) > 1 || (y as number) + (h as number) > 1) return false;
	return true;
}

/** Pure: validate one cached piece (unknown JSON) into a Piece, or null. */
export function toValidPiece(outfitId: string, raw: unknown): Piece | null {
	if (!raw || typeof raw !== 'object') return null;
	const p = raw as Record<string, unknown>;
	if (!isCategory(p.category)) return null;
	const category = p.category as Category;
	if (!isValidBox({ x: p.x, y: p.y, w: p.w, h: p.h })) return null;
	return {
		id: typeof p.id === 'string' && p.id ? p.id : `${outfitId}:${category}`,
		category,
		label: typeof p.label === 'string' && p.label ? p.label : CATEGORY_LABEL[category],
		x: p.x as number,
		y: p.y as number,
		w: p.w as number,
		h: p.h as number
	};
}

/** Pure: validate a raw cached entry; null when missing/invalid/empty. */
export function sanitizeCachedPieces(outfitId: string, raw: unknown): Piece[] | null {
	if (!Array.isArray(raw) || raw.length === 0) return null;
	const pieces: Piece[] = [];
	for (const item of raw) {
		const piece = toValidPiece(outfitId, item);
		if (piece) pieces.push(piece);
	}
	return pieces.length > 0 ? pieces : null;
}

/**
 * Pure: drop oldest entries (by savedAt) until the map fits the cap.
 * Returns a new object; ties evict in insertion order (stable sort).
 */
export function pruneCache(map: PieceCacheMap, cap: number = PIECE_CACHE_CAP): PieceCacheMap {
	const keys = Object.keys(map);
	if (keys.length <= cap) return { ...map };
	const byAge = keys
		.map((key, index) => ({ key, at: map[key].savedAt, index }))
		.sort((a, b) => a.at - b.at || a.index - b.index);
	const drop = new Set(byAge.slice(0, keys.length - cap).map((e) => e.key));
	const out: PieceCacheMap = {};
	for (const key of keys) {
		if (!drop.has(key)) out[key] = map[key];
	}
	return out;
}

function readCacheMap(): PieceCacheMap {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(PIECE_CACHE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		const out: PieceCacheMap = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (!value || typeof value !== 'object') continue;
			const entry = value as { pieces?: unknown; savedAt?: unknown };
			const pieces = sanitizeCachedPieces(key, entry.pieces);
			if (!pieces) continue;
			out[key] = {
				pieces,
				savedAt: typeof entry.savedAt === 'number' ? entry.savedAt : 0
			};
		}
		return out;
	} catch {
		return {};
	}
}

/** Cached AI-tagged pieces for an outfit, or null on miss/invalid/SSR. */
export function getCachedPieces(outfitId: string): Piece[] | null {
	if (!outfitId) return null;
	return readCacheMap()[outfitId]?.pieces ?? null;
}

/** Store AI-tagged pieces for an outfit (cap 100, oldest evicted). Silent on quota/SSR. */
export function setCachedPieces(outfitId: string, pieces: Piece[]): void {
	if (!outfitId || pieces.length === 0 || typeof localStorage === 'undefined') return;
	try {
		const map = readCacheMap();
		map[outfitId] = { pieces, savedAt: Date.now() };
		localStorage.setItem(PIECE_CACHE_KEY, JSON.stringify(pruneCache(map)));
	} catch {
		// Quota or privacy mode: cache is best-effort only.
	}
}
