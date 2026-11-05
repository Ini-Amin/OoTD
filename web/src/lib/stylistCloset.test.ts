// Stylist closet-context serializer tests. Run: npm run test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { serializeClosetForStylist } from './stylistCloset.ts';
import type { Category, ClosetPiece } from './pieces.ts';

function piece(over: Partial<ClosetPiece> & { category: Category }): ClosetPiece {
	return {
		id: `test-${over.category}-${Math.random().toString(36).slice(2)}`,
		label: 'Test item',
		outfitId: 'outfit-1',
		outfitTitle: 'Kondangan look',
		imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
		x: 0,
		y: 0,
		w: 1,
		h: 1,
		...over
	};
}

describe('serializeClosetForStylist', () => {
	it('returns [] for an empty closet', () => {
		assert.deepEqual(serializeClosetForStylist([], {}), []);
	});

	it('sends category+label only, never imageUrl/id/outfit context', () => {
		const out = serializeClosetForStylist(
			[piece({ category: 'top', label: 'Olive trench coat' })],
			{}
		);
		assert.deepEqual(out, [{ category: 'top', label: 'Olive trench coat' }]);
		assert.deepEqual(Object.keys(out[0]).sort(), ['category', 'label']);
		assert.ok(!JSON.stringify(out).includes('data:image'), 'no data-URI leaks');
		assert.ok(!JSON.stringify(out).includes('Kondangan'), 'no outfit title leaks');
	});

	it('drops pieces whose label contains a data-URI down to the label text', () => {
		// Even a hostile label is sent as plain text; backend quotes it as data.
		const out = serializeClosetForStylist(
			[piece({ category: 'bag', label: 'Tote data:image/png;base64,AAAA' })],
			{}
		);
		assert.equal(out.length, 1);
		assert.equal(out[0].category, 'bag');
	});

	it('orders worn pieces first, keeping newest-first within each group', () => {
		const oldest = piece({ category: 'top', id: 'old-top', label: 'Old tee' });
		const newest = piece({ category: 'bottom', id: 'new-bottom', label: 'New jeans' });
		const wornOld = piece({ category: 'shoes', id: 'worn-shoes', label: 'Worn sneakers' });
		// closet.pieces is newest-first
		const out = serializeClosetForStylist([newest, wornOld, oldest], { shoes: 'worn-shoes' });
		assert.deepEqual(
			out.map((p) => p.label),
			['Worn sneakers', 'New jeans', 'Old tee']
		);
	});

	it('dedupes identical category+label pairs but keeps same label across categories', () => {
		const out = serializeClosetForStylist(
			[
				piece({ category: 'top', id: 'a', label: 'White shirt' }),
				piece({ category: 'top', id: 'b', label: 'White shirt' }),
				piece({ category: 'bottom', id: 'c', label: 'White shirt' })
			],
			{}
		);
		assert.deepEqual(out, [
			{ category: 'top', label: 'White shirt' },
			{ category: 'bottom', label: 'White shirt' }
		]);
	});

	it('collapses whitespace/newlines and skips blank or invalid rows', () => {
		const out = serializeClosetForStylist(
			[
				piece({ category: 'hat', label: 'Beanie\n  wool\r\n  black' }),
				piece({ category: 'top', label: '   ' }),
				{ ...piece({ category: 'bag' }), category: 'spaceship' as Category }
			],
			{}
		);
		assert.deepEqual(out, [{ category: 'hat', label: 'Beanie wool black' }]);
	});

	it('truncates labels over 80 chars and caps at 30 pieces', () => {
		const many = Array.from({ length: 35 }, (_, i) =>
			piece({ category: 'top', id: `p${i}`, label: `Shirt ${i} ` + 'x'.repeat(100) })
		);
		const out = serializeClosetForStylist(many, {});
		assert.equal(out.length, 30);
		for (const p of out) assert.ok(p.label.length <= 80, `label too long: ${p.label.length}`);
	});

	it('truncates by runes, never splitting an emoji (backend counts runes)', () => {
		// 79 ASCII + emoji at the cut: UTF-16 slicing would leave a lone surrogate.
		const out = serializeClosetForStylist(
			[piece({ category: 'top', label: 'a'.repeat(79) + '😀b' })],
			{}
		);
		assert.equal(out.length, 1);
		assert.equal(Array.from(out[0].label).length, 80);
		assert.ok(!out[0].label.includes('�'));
		assert.ok(!/[\ud800-\udbff]$/.test(out[0].label), 'no trailing lone surrogate');
		// 50 emoji = 50 runes < 80: must pass through untouched.
		const many = serializeClosetForStylist(
			[piece({ category: 'hat', label: '🎩'.repeat(50) })],
			{}
		);
		assert.equal(many[0].label, '🎩'.repeat(50));
	});
});
