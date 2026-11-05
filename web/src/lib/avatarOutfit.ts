// Avatar outfit tint mapping for the walkable mall (Opsi B).
//
// Rig finding (xbot.glb, parsed from the GLB JSON chunk): the avatar has TWO
// meshes and BOTH span the full body — Beta_Surface (outer body, 15901 verts,
// Y -0.00..1.81) and Beta_Joints (inner joints, 12473 verts, Y -0.00..1.59).
// There is no separate torso/legs mesh, so per-garment tinting (Opsi A) is
// impossible without vertex-group surgery. Instead the whole surface takes the
// worn TOP colour and the joints layer takes the worn BOTTOM colour, plus a
// floating label pin. Honest "coloured shirt", not fabricated geometry.
//
// Colour source priority per piece:
//  1. Mall fabric-swatch tone parsed from the SVG data-URI imageUrl
//     (sku() in mall.ts bakes the tone into stop-color/fill).
//  2. A colour word in the label (English + Indonesian).
//  3. A stable hash of the piece id -> pleasant HSL (deterministic fallback).
import type { Category, ClosetPiece } from '$lib/pieces';

/** GLB base colours (baseColorFactor), used to restore the nude avatar. */
export const DEFAULT_SURFACE = '#d64d42';
export const DEFAULT_JOINTS = '#55201a';
export const DEFAULT_CAPSULE = '#4a6fa5';

export type PieceLike = Pick<ClosetPiece, 'id' | 'label' | 'imageUrl'>;
export type AvatarOutfitTint = { surface: string | null; joints: string | null };

const HEX6 = /^#[0-9a-f]{6}$/i;

function normaliseHex(hex: string): string | null {
	let h = hex.trim().toLowerCase();
	if (/^#[0-9a-f]{3}$/i.test(h)) {
		h = '#' + [...h.slice(1)].map((c) => c + c).join('');
	}
	return HEX6.test(h) ? h : null;
}

/**
 * Mall SKUs render their tone into an SVG data URI
 * (fabricSwatch: stop-color + fill carry the tone). The first stop-color wins;
 * a plain fill is the fallback. Returns null for photos/unknown images.
 */
export function swatchColorFromImageUrl(imageUrl: string): string | null {
	if (!imageUrl || !imageUrl.startsWith('data:image/svg+xml')) return null;
	let svg = imageUrl.slice(imageUrl.indexOf(',') + 1);
	try {
		svg = decodeURIComponent(svg);
	} catch {
		// Keep the raw tail; the regexes below still match %23-encoded hex
		// only after decode, so a decode failure means no colour.
		return null;
	}
	const stop = svg.match(/stop-color\s*=\s*"([^"]+)"/i)?.[1];
	if (stop) {
		const hex = normaliseHex(stop.replace(/\\#/, '#'));
		if (hex) return hex;
	}
	for (const m of svg.matchAll(/fill\s*=\s*"([^"]+)"/gi)) {
		const hex = normaliseHex(m[1]);
		// Skip the swatch card background, not the garment tone.
		if (hex && hex !== '#f4f1ec') return hex;
	}
	return null;
}

const COLOR_WORDS: Array<[RegExp, string]> = [
	[/\b(black|hitam)\b/i, '#232323'],
	[/\b(white|putih)\b/i, '#e8e4dc'],
	[/\b(navy)\b/i, '#1f3864'],
	[/\b(blue|biru|denim)\b/i, '#2f5d8a'],
	[/\b(red|merah|maroon)\b/i, '#b03a2e'],
	[/\b(green|hijau|olive|army)\b/i, '#4a6741'],
	[/\b(yellow|kuning|mustard)\b/i, '#c9a227'],
	[/\b(orange|oranye|orens|rust)\b/i, '#b5651d'],
	[/\b(pink|pink|rose|salmon)\b/i, '#c97b8a'],
	[/\b(purple|ungu|lilac|violet)\b/i, '#6c4a8a'],
	[/\b(brown|coklat|cokelat|tan|beige|khaki|cream|krem)\b/i, '#8b6f4e'],
	[/\b(grey|gray|abu)\b/i, '#7d7d7d'],
	[/\b(gold|emas)\b/i, '#a67c2e'],
	[/\b(silver|perak)\b/i, '#a8a8a8'],
	[/\b(teal|toska|turquoise)\b/i, '#2e7d7b'],
	[/\bcamo\b/i, '#5a6142']
];

export function colorWordFromLabel(label: string): string | null {
	for (const [re, hex] of COLOR_WORDS) {
		if (re.test(label)) return hex;
	}
	return null;
}

function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;
	const k = (n: number): number => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	const to = (n: number): string =>
		Math.round(f(n) * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${to(0)}${to(8)}${to(4)}`;
}

/** Deterministic pleasant colour for pieces with no swatch and no colour word. */
export function hashColorForId(id: string): string {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
	return hslToHex(Math.abs(h) % 360, 52, 52);
}

export function colorForPiece(piece: PieceLike): string {
	return (
		swatchColorFromImageUrl(piece.imageUrl) ??
		colorWordFromLabel(piece.label) ??
		hashColorForId(piece.id)
	);
}

/**
 * Map worn closet pieces to avatar material tints. Surface (outer body) takes
 * the TOP; the joints layer takes the BOTTOM. Null = unworn, keep GLB default.
 */
export function outfitTintForWorn(
	worn: Partial<Record<Category, ClosetPiece | undefined>>
): AvatarOutfitTint {
	return {
		surface: worn.top ? colorForPiece(worn.top) : null,
		joints: worn.bottom ? colorForPiece(worn.bottom) : null
	};
}
