// Deterministic client-side "Similar looks" scoring for the outfit detail view.
// Pure module (no fetch, no Svelte) so it stays unit-testable in node (similar.test.ts).
//
// v0 limitation: Outfit.pieces is only present on GET /v1/outfits/{id} — the
// list endpoint and the seeded previews carry none — so the piece component
// is mostly inactive and the score renormalizes over the remaining weights.
import type { Outfit } from './outfits.ts';
import type { Piece } from './pieces.ts';

/** Max recommendations shown (2-column grid x 3 rows in the 22rem meta-pane). */
export const SIMILAR_LIMIT = 6;

/** Minimum score for a candidate to qualify (before the shared-tag/piece gate). */
export const SIMILAR_MIN_SCORE = 0.2;

/**
 * Component weights for similarityScore. They sum to 1:
 * tags 0.50 (curated vocabulary; occasions like Formal/Kondangan live in tags,
 * there is no occasion field), pieces 0.20 (mostly inactive in v0, see above),
 * accent 0.20 (parsed hex color distance), same creator 0.10.
 * Deliberately excluded: title/caption overlap (noisy mixed-language free
 * text) and savedBy/commentCount/match (popularity, not similarity —
 * savedBy is only a tie-break).
 */
export const SIMILAR_WEIGHTS = {
	tags: 0.5,
	pieces: 0.2,
	accent: 0.2,
	creator: 0.1
} as const;

const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);

export type Rgb = { r: number; g: number; b: number };

function clamp01(n: number): number {
	if (Number.isNaN(n)) return 0;
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Lowercase, trim, strip leading '#' ('' for non-strings, so malformed API data never throws). */
export function normalizeTag(tag: unknown): string {
	if (typeof tag !== 'string') return '';
	return tag.trim().toLowerCase().replace(/^#+/, '');
}

function normalizeHandle(handle: unknown): string {
	if (typeof handle !== 'string') return '';
	return handle.trim().toLowerCase().replace(/^@+/, '');
}

function normalizeLabel(label: unknown): string {
	if (typeof label !== 'string') return '';
	return label.trim().toLowerCase();
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
	if (a.size === 0 || b.size === 0) return 0;
	let intersection = 0;
	for (const item of a) {
		if (b.has(item)) intersection++;
	}
	return intersection / (a.size + b.size - intersection);
}

/**
 * Jaccard |A∩B|/|A∪B| over normalized tags. 0 when either side has no
 * usable tags (no evidence of similarity, never NaN).
 */
export function tagSimilarity(
	a: readonly unknown[] | undefined,
	b: readonly unknown[] | undefined
): number {
	const setA = new Set<string>();
	const setB = new Set<string>();
	for (const t of a ?? []) {
		const n = normalizeTag(t);
		if (n) setA.add(n);
	}
	for (const t of b ?? []) {
		const n = normalizeTag(t);
		if (n) setB.add(n);
	}
	return jaccard(setA, setB);
}

type PieceLike = Pick<Piece, 'category' | 'label'>;

/**
 * Mean of the Piece.category-set Jaccard and the exact-normalized-label-set
 * Jaccard (0..1). 0 when either side has no usable pieces — the caller
 * (similarityScore) treats that case as "not computable" and renormalizes
 * the remaining weights instead of scoring this component as 0.
 */
export function pieceSimilarity(
	a: readonly PieceLike[] | undefined,
	b: readonly PieceLike[] | undefined
): number {
	const catsA = new Set<string>();
	const catsB = new Set<string>();
	const labelsA = new Set<string>();
	const labelsB = new Set<string>();
	for (const p of a ?? []) {
		if (!p || typeof p !== 'object') continue;
		if (typeof p.category === 'string' && p.category) catsA.add(p.category);
		const label = normalizeLabel(p.label);
		if (label) labelsA.add(label);
	}
	for (const p of b ?? []) {
		if (!p || typeof p !== 'object') continue;
		if (typeof p.category === 'string' && p.category) catsB.add(p.category);
		const label = normalizeLabel(p.label);
		if (label) labelsB.add(label);
	}
	if (catsA.size + labelsA.size === 0 || catsB.size + labelsB.size === 0) return 0;
	return (jaccard(catsA, catsB) + jaccard(labelsA, labelsB)) / 2;
}

/** Parse #rrggbb or #rgb (with or without '#', any case); null when unparseable. */
export function hexToRgb(hex: unknown): Rgb | null {
	if (typeof hex !== 'string') return null;
	let h = hex.trim();
	if (h.startsWith('#')) h = h.slice(1);
	if (h.length === 3) h = [...h].map((c) => c + c).join('');
	if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
	return {
		r: parseInt(h.slice(0, 2), 16),
		g: parseInt(h.slice(2, 4), 16),
		b: parseInt(h.slice(4, 6), 16)
	};
}

/**
 * 1 - (Euclidean RGB distance / max distance), so identical colors score 1
 * and black-vs-white scores 0. Missing/unparseable accents score 0 on this
 * component (penalizing malformed records rather than renormalizing).
 */
export function accentSimilarity(a: unknown, b: unknown): number {
	const ra = hexToRgb(a);
	const rb = hexToRgb(b);
	if (!ra || !rb) return 0;
	const d = Math.sqrt((ra.r - rb.r) ** 2 + (ra.g - rb.g) ** 2 + (ra.b - rb.b) ** 2);
	return clamp01(1 - d / MAX_RGB_DISTANCE);
}

type PreparedOutfit = {
	tags: Set<string>;
	cats: Set<string>;
	labels: Set<string>;
	accent: Rgb | null;
	handle: string;
};

function prepareTags(tags: readonly unknown[] | undefined): Set<string> {
	const out = new Set<string>();
	for (const t of Array.isArray(tags) ? tags : []) {
		const n = normalizeTag(t);
		if (n) out.add(n);
	}
	return out;
}

function preparePieces(pieces: readonly PieceLike[] | undefined): {
	cats: Set<string>;
	labels: Set<string>;
} {
	const cats = new Set<string>();
	const labels = new Set<string>();
	for (const p of Array.isArray(pieces) ? pieces : []) {
		if (!p || typeof p !== 'object') continue;
		if (typeof p.category === 'string' && p.category) cats.add(p.category);
		const label = normalizeLabel(p.label);
		if (label) labels.add(label);
	}
	return { cats, labels };
}

/** Normalize once so the per-candidate loop below never rebuilds target sets. */
function prepare(o: Outfit): PreparedOutfit {
	const { cats, labels } = preparePieces(o.pieces);
	return {
		tags: prepareTags(o.tags),
		cats,
		labels,
		accent: hexToRgb(o.accent),
		handle: normalizeHandle(o.handle)
	};
}

type ScoreParts = {
	tag: number;
	piece: number;
	accent: number;
	creator: number;
	piecesComputable: boolean;
};

function accentDistance(a: Rgb, b: Rgb): number {
	return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function components(t: PreparedOutfit, c: PreparedOutfit): ScoreParts {
	const tag = jaccard(t.tags, c.tags);
	const aUsable = t.cats.size + t.labels.size > 0;
	const bUsable = c.cats.size + c.labels.size > 0;
	const piecesComputable = aUsable && bUsable;
	const piece = piecesComputable ? (jaccard(t.cats, c.cats) + jaccard(t.labels, c.labels)) / 2 : 0;
	const accent =
		t.accent && c.accent ? clamp01(1 - accentDistance(t.accent, c.accent) / MAX_RGB_DISTANCE) : 0;
	// Blank handles never match: two missing handles are not the same creator.
	const creator = t.handle && t.handle === c.handle ? 1 : 0;
	return { tag, piece, accent, creator, piecesComputable };
}

function scoreFromParts(p: ScoreParts): number {
	const w = SIMILAR_WEIGHTS;
	if (p.piecesComputable) {
		return clamp01(w.tags * p.tag + w.pieces * p.piece + w.accent * p.accent + w.creator * p.creator);
	}
	return clamp01((w.tags * p.tag + w.accent * p.accent + w.creator * p.creator) / (1 - w.pieces));
}

/**
 * Deterministic weighted similarity in 0..1. When either side lacks usable
 * pieces (the normal v0 case: list/preview candidates have none), the piece
 * weight drops out and the score renormalizes over the remaining weights
 * (division by 1 - pieces = 0.80) so list-only candidates are not capped
 * at 0.80.
 *
 * Known v0 tradeoff (dormant: list/preview candidates carry no pieces, so
 * mixed pools do not occur in production): for identical tags/accent/creator
 * a candidate with no pieces outscores one with mismatched pieces (0.875 vs
 * 0.70), i.e. mismatched piece data penalizes vs having none. If the list API
 * ever returns pieces, renormalize per-component availability symmetrically
 * or treat the piece component as neutral-missing for both sides instead.
 */
export function similarityScore(target: Outfit, candidate: Outfit): number {
	return scoreFromParts(components(prepare(target), prepare(candidate)));
}

export type FindSimilarOptions = {
	/** Max results (default SIMILAR_LIMIT). */
	limit?: number;
	/** Minimum score (default SIMILAR_MIN_SCORE). */
	minScore?: number;
	/** Ids to skip — the viewer passes preview ids when the target is a real look. */
	excludeIds?: ReadonlySet<string>;
};

/**
 * Ranked similar outfits: excludes the target by id and by shared imageUrl
 * (self-duplicates surviving feed dedupe), dedupes candidates by id then by
 * imageUrl ?? id (mirroring feedMerge semantics), requires score >=
 * minScore AND a shared tag or piece overlap (so a color-only coincidence
 * never qualifies), and sorts deterministically by score desc, savedBy
 * desc, then id ascending by code-unit comparison (never localeCompare).
 * Never mutates the input array.
 */
export function findSimilar(
	target: Outfit,
	candidates: readonly Outfit[],
	options: FindSimilarOptions = {}
): Outfit[] {
	const limit = options.limit ?? SIMILAR_LIMIT;
	const minScore = options.minScore ?? SIMILAR_MIN_SCORE;
	const excludeIds = options.excludeIds;
	const seenIds = new Set<string>();
	const seenImages = new Set<string>();
	const scored: { outfit: Outfit; score: number }[] = [];
	// Hoisted: target sets are built once, and each candidate's components
	// are computed once and reused for both the score and the gate.
	const pt = prepare(target);
	for (const c of candidates) {
		if (!c || typeof c.id !== 'string') continue;
		if (c.id === target.id) continue;
		if (excludeIds?.has(c.id)) continue;
		if (target.imageUrl && c.imageUrl && c.imageUrl === target.imageUrl) continue;
		if (seenIds.has(c.id)) continue;
		seenIds.add(c.id);
		const imageKey = c.imageUrl ?? `id:${c.id}`;
		if (seenImages.has(imageKey)) continue;
		seenImages.add(imageKey);
		const parts = components(pt, prepare(c));
		const score = scoreFromParts(parts);
		if (score < minScore) continue;
		if (!(parts.tag > 0 || parts.piece > 0)) {
			continue;
		}
		scored.push({ outfit: c, score });
	}
	scored.sort((x, y) => {
		if (y.score !== x.score) return y.score - x.score;
		const xs = typeof x.outfit.savedBy === 'number' ? x.outfit.savedBy : 0;
		const ys = typeof y.outfit.savedBy === 'number' ? y.outfit.savedBy : 0;
		if (ys !== xs) return ys - xs;
		if (x.outfit.id < y.outfit.id) return -1;
		if (x.outfit.id > y.outfit.id) return 1;
		return 0;
	});
	return scored.slice(0, Math.max(0, limit)).map((s) => s.outfit);
}
