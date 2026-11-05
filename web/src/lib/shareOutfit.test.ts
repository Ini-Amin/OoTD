// Builder tests for one-click mall -> feed sharing. Run: npm run test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareOutfitPayload } from './shareOutfit.ts';
import { DEFAULT_BOX, type Category, type ClosetPiece } from './pieces.ts';
import type { MallStore } from './mall.ts';

function piece(over: Partial<ClosetPiece> & { category: Category }): ClosetPiece {
	return {
		id: `mall-test-${over.category}`,
		label: 'Test item',
		outfitId: 'mall-zara',
		outfitTitle: 'Zara',
		imageUrl: 'data:image/svg+xml,swatch',
		x: 0,
		y: 0,
		w: 1,
		h: 1,
		...over
	};
}

const store = {
	id: 'zara',
	name: 'Zara',
	kind: 'Editorial',
	blurb: '',
	color: '#1A1A1A',
	x: 0,
	y: 0,
	w: 0,
	h: 0,
	skus: []
} as MallStore;

describe('buildShareOutfitPayload', () => {
	it('returns null when nothing is worn', () => {
		assert.equal(buildShareOutfitPayload({}, store), null);
		assert.equal(
			buildShareOutfitPayload({ top: undefined, bottom: undefined }, store),
			null
		);
	});

	it('maps worn pieces to category + DEFAULT_BOX with stripped labels', () => {
		const out = buildShareOutfitPayload(
			{
				top: piece({ category: 'top', label: 'Zara · Cropped blazer' }),
				bottom: piece({ category: 'bottom', label: 'Uniqlo · Smart chinos' })
			},
			store
		);
		assert.ok(out);
		assert.equal(out.pieces.length, 2);
		assert.deepEqual(out.pieces[0], {
			category: 'top',
			label: 'Cropped blazer',
			box: { ...DEFAULT_BOX.top }
		});
		assert.deepEqual(out.pieces[1], {
			category: 'bottom',
			label: 'Smart chinos',
			box: { ...DEFAULT_BOX.bottom }
		});
	});

	it('builds title, caption, tags, and lowercased accent', () => {
		const out = buildShareOutfitPayload(
			{ top: piece({ category: 'top', label: 'Zara · Cropped blazer' }) },
			store
		);
		assert.ok(out);
		assert.equal(out.title, 'Zara try-on');
		assert.equal(out.caption, 'Zara · Cropped blazer');
		assert.deepEqual(out.tags, ['zara', 'editorial']);
		assert.equal(out.accent, '#1a1a1a');
	});

	it('falls back to a valid accent when the store color is not hex', () => {
		const out = buildShareOutfitPayload({ top: piece({ category: 'top' }) }, {
			...store,
			color: 'midnight'
		});
		assert.ok(out);
		assert.match(out.accent, /^#[0-9a-f]{6}$/);
	});

	it('attaches https image URLs and drops data-URIs', () => {
		const worn = { top: piece({ category: 'top' }) };
		const withPhoto = buildShareOutfitPayload(worn, store, 'https://cdn.example.com/snap.png');
		assert.ok(withPhoto);
		assert.equal(withPhoto.imageUrl, 'https://cdn.example.com/snap.png');

		const withSwatch = buildShareOutfitPayload(worn, store, 'data:image/svg+xml,swatch');
		assert.ok(withSwatch);
		assert.equal(withSwatch.imageUrl, undefined);

		const withHttp = buildShareOutfitPayload(worn, store, 'http://cdn.example.com/snap.png');
		assert.ok(withHttp);
		assert.equal(withHttp.imageUrl, undefined);
	});

	it('truncates long labels, titles, and captions to server limits', () => {
		const longLabel = `Zara · ${'b'.repeat(200)}`;
		const out = buildShareOutfitPayload(
			{ top: piece({ category: 'top', label: longLabel }) },
			{ ...store, name: 'S'.repeat(200) }
		);
		assert.ok(out);
		assert.ok(Array.from(out.pieces[0].label).length <= 80);
		assert.ok(Array.from(out.title).length <= 120);
		assert.ok(Array.from(out.caption).length <= 2000);
	});

	it('truncates non-ASCII piece labels to 80 UTF-8 bytes (server drops longer ones)', () => {
		// 100 CJK runes = 300 bytes; must shrink to <=80 bytes without splitting a char.
		const out = buildShareOutfitPayload(
			{ top: piece({ category: 'top', label: `Zara · ${'あ'.repeat(100)}` }) },
			store
		);
		assert.ok(out);
		const bytes = new TextEncoder().encode(out.pieces[0].label).length;
		assert.ok(bytes <= 80, `expected <=80 bytes, got ${bytes}`);
		assert.ok(!out.pieces[0].label.includes('�'));
	});
});
