// Pure mapping tests: worn closet pieces -> avatar tint colours.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	colorForPiece,
	colorWordFromLabel,
	hashColorForId,
	outfitTintForWorn,
	swatchColorFromImageUrl
} from './avatarOutfit.ts';

function swatch(tone: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g-x"><stop offset="0%" stop-color="${tone}"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0.28"/></linearGradient></defs><rect width="400" height="520" fill="#f4f1ec"/><rect x="36" y="48" width="328" height="424" rx="28" fill="${tone}" opacity="0.55"/></svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

describe('swatchColorFromImageUrl', () => {
	it('parses the mall fabric-swatch tone', () => {
		assert.equal(swatchColorFromImageUrl(swatch('#2c2c2c')), '#2c2c2c');
		assert.equal(swatchColorFromImageUrl(swatch('#cbb79a')), '#cbb79a');
	});

	it('returns null for photos and non-SVG urls', () => {
		assert.equal(swatchColorFromImageUrl('https://x.test/photo.jpg'), null);
		assert.equal(swatchColorFromImageUrl(''), null);
		assert.equal(swatchColorFromImageUrl('data:image/png;base64,aaaa'), null);
	});
});

describe('colorWordFromLabel', () => {
	it('matches English colour words', () => {
		assert.equal(colorWordFromLabel('Cropped blazer'), null);
		assert.equal(colorWordFromLabel('Navy blazer'), '#1f3864');
		assert.equal(colorWordFromLabel('Red dress'), '#b03a2e');
	});

	it('matches Indonesian colour words', () => {
		assert.equal(colorWordFromLabel('Kemeja hijau'), '#4a6741');
		assert.equal(colorWordFromLabel('Celana hitam'), '#232323');
		assert.equal(colorWordFromLabel('Rok merah marun'), '#b03a2e');
	});
});

describe('hashColorForId', () => {
	it('is deterministic and valid hex', () => {
		const a = hashColorForId('mall-zara-blazer');
		assert.match(a, /^#[0-9a-f]{6}$/);
		assert.equal(a, hashColorForId('mall-zara-blazer'));
	});

	it('differs across ids (spot check)', () => {
		const colours = new Set(
			['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => hashColorForId(`mall-x-${id}`))
		);
		assert.ok(colours.size >= 6);
	});
});

describe('colorForPiece', () => {
	it('prefers swatch tone over label words', () => {
		assert.equal(
			colorForPiece({ id: 'mall-x', label: 'Red blazer', imageUrl: swatch('#2c2c2c') }),
			'#2c2c2c'
		);
	});

	it('falls back to label, then hash', () => {
		assert.equal(
			colorForPiece({ id: 'p1', label: 'Navy blazer', imageUrl: 'https://x/p.jpg' }),
			'#1f3864'
		);
		assert.equal(
			colorForPiece({ id: 'p1', label: 'Cropped blazer', imageUrl: 'https://x/p.jpg' }),
			hashColorForId('p1')
		);
	});
});

describe('outfitTintForWorn', () => {
	it('maps top->surface and bottom->joints', () => {
		const top = {
			id: 'mall-zara-blazer',
			category: 'top',
			label: 'Zara · Cropped blazer',
			outfitId: 'mall-zara',
			outfitTitle: 'Zara',
			imageUrl: swatch('#2c2c2c'),
			x: 0,
			y: 0,
			w: 1,
			h: 1
		} as const;
		const bottom = {
			id: 'mall-zara-trouser',
			category: 'bottom',
			label: 'Zara · Wide trousers',
			outfitId: 'mall-zara',
			outfitTitle: 'Zara',
			imageUrl: swatch('#cbb79a'),
			x: 0,
			y: 0,
			w: 1,
			h: 1
		} as const;
		assert.deepEqual(outfitTintForWorn({ top, bottom }), {
			surface: '#2c2c2c',
			joints: '#cbb79a'
		});
	});

	it('returns null slots for unworn categories', () => {
		assert.deepEqual(outfitTintForWorn({}), { surface: null, joints: null });
	});
});
