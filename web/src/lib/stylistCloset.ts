// Stylist closet context: serialize owned pieces for the AI Stylist.
// Pure module (no Svelte, no localStorage) so it stays unit-testable
// (stylistCloset.test.ts), mirroring wishlist.ts/shareOutfit.ts.
//
// Only category+label cross the wire: imageUrl (often a data-URI), id,
// outfitId/outfitTitle, and boxes stay local. The piece/label caps mirror
// the backend sanitizer (api/internal/httpapi/analyze.go); the 2000-char
// serialized-block cap is enforced backend-side only, so the payload never
// surprises the 128KiB stylist body limit.
import { isCategory, type Category, type ClosetPiece } from './pieces.ts';

export type StylistClosetPiece = {
	category: Category;
	label: string;
};

export const MAX_STYLIST_CLOSET_PIECES = 30;
export const MAX_STYLIST_CLOSET_LABEL = 80; // runes, like the backend cap

/** Rune-safe truncation (a UTF-16 slice can split an emoji into a lone surrogate). */
function takeRunes(s: string, n: number): string {
	return Array.from(s).slice(0, n).join('');
}

/** Worn pieces first, then most-recent (closet.pieces is newest-first). [] for an empty closet. */
export function serializeClosetForStylist(
	pieces: ClosetPiece[],
	worn: Partial<Record<Category, string>>
): StylistClosetPiece[] {
	if (!Array.isArray(pieces) || pieces.length === 0) return [];
	const wornIds = new Set(
		Object.values(worn ?? {}).filter((v): v is string => typeof v === 'string')
	);
	// Stable sort: worn first, original (newest-first) order kept within each group.
	const ordered = [...pieces].sort((a, b) => Number(wornIds.has(b.id)) - Number(wornIds.has(a.id)));
	const seen = new Set<string>();
	const out: StylistClosetPiece[] = [];
	for (const p of ordered) {
		if (typeof p !== 'object' || p === null) continue;
		if (!isCategory(p.category)) continue;
		let label = typeof p.label === 'string' ? p.label.replace(/\s+/g, ' ').trim() : '';
		if (!label) continue;
		if (Array.from(label).length > MAX_STYLIST_CLOSET_LABEL) {
			label = takeRunes(label, MAX_STYLIST_CLOSET_LABEL).trimEnd();
		}
		if (!label) continue;
		const key = p.category + "\0" + label;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ category: p.category, label });
		if (out.length >= MAX_STYLIST_CLOSET_PIECES) break;
	}
	return out;
}
