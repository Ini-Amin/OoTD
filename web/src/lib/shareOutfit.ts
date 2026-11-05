// One-click share: mall try-on -> feed post payload.
// Pure builder (no fetch, no Svelte) so it stays unit-testable (shareOutfit.test.ts).
// The output matches POST /v1/outfits (api/internal/httpapi/validate.go)
// exactly like the /new form payload.
import { CATEGORIES, DEFAULT_BOX, type Category, type ClosetPiece } from './pieces.ts';
import type { MallStore } from './mall.ts';

export type SharePiece = {
	category: string;
	label: string;
	box: { x: number; y: number; w: number; h: number };
};

export type ShareOutfitPayload = {
	title: string;
	caption: string;
	tags: string[];
	accent: string;
	pieces: SharePiece[];
	imageUrl?: string;
};

const ACCENT_FALLBACK = '#1a1a1a';
const accentPattern = /^#[0-9a-f]{6}$/;

/** Rune-safe truncation (server counts runes, not UTF-16 units). */
function takeRunes(s: string, n: number): string {
	return Array.from(s).slice(0, n).join('');
}

const utf8Encoder = new TextEncoder();

/**
 * Byte-aware truncation: longest prefix of at most n UTF-8 bytes that
 * does not split a code point. Piece labels need this because the
 * server drops pieces whose label exceeds 80 bytes
 * (api/internal/httpapi/analyze.go sanitizePieces), and 80 runes of
 * non-ASCII text can exceed 80 bytes.
 */
function takeBytes(s: string, n: number): string {
	let bytes = 0;
	let end = 0;
	for (const ch of s) {
		const w = utf8Encoder.encode(ch).length;
		if (bytes + w > n) break;
		bytes += w;
		end += ch.length;
	}
	return s.slice(0, end);
}

/**
 * Mall try-on labels carry store attribution (`Zara · Cropped blazer`).
 * Feed pieces keep only the item label; the caption keeps full attribution.
 */
function pieceLabel(label: string): string {
	const trimmed = label.trim();
	const cut = trimmed.includes('·') ? trimmed.slice(trimmed.lastIndexOf('·') + 1).trim() : trimmed;
	return takeBytes(cut || trimmed, 80);
}

/**
 * Build the POST /v1/outfits body for the current try-on, or null when
 * nothing is worn. imageUrl is attached only when it is an https URL
 * (mall swatch data-URIs are rejected server-side).
 */
export function buildShareOutfitPayload(
	worn: Partial<Record<Category, ClosetPiece | undefined>>,
	store: MallStore,
	imageUrl?: string
): ShareOutfitPayload | null {
	const pieces: SharePiece[] = [];
	const captionParts: string[] = [];
	for (const cat of CATEGORIES) {
		const piece = worn[cat];
		if (!piece) continue;
		const label = pieceLabel(piece.label);
		if (!label) continue;
		const box = DEFAULT_BOX[cat];
		pieces.push({ category: cat, label, box: { ...box } });
		captionParts.push(piece.label.trim());
	}
	if (pieces.length === 0) return null;

	const title = takeRunes(`${store.name} try-on`.trim(), 120);

	const tags: string[] = [];
	for (const raw of [store.name, store.kind]) {
		const t = takeRunes(raw.trim().toLowerCase(), 30);
		if (t && !tags.includes(t)) tags.push(t);
		if (tags.length >= 5) break;
	}

	const accent = store.color.trim().toLowerCase();
	const payload: ShareOutfitPayload = {
		title,
		caption: takeRunes(captionParts.join(' · '), 2000),
		tags,
		accent: accentPattern.test(accent) ? accent : ACCENT_FALLBACK,
		pieces
	};

	if (
		imageUrl &&
		imageUrl.startsWith('https://') &&
		imageUrl.length <= 500 &&
		!/\s/.test(imageUrl)
	) {
		payload.imageUrl = imageUrl;
	}
	return payload;
}
