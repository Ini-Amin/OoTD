// Mall wishlist pure-logic tests. Run: npm run test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	add,
	has,
	isWishlistEntry,
	parse,
	pruneOrphans,
	remove,
	serialize,
	toggle,
	type WishlistEntry
} from './wishlist.ts';
import { skuToClosetPiece, type MallSku, type MallStore } from './mall.ts';

function entry(over: Partial<WishlistEntry> = {}): WishlistEntry {
	return { skuId: 'zara-blazer', storeId: 'zara', addedAt: 1700000000000, ...over };
}

describe('wishlist pure logic', () => {
	it('adds newest-first and dedupes by skuId', () => {
		let list: WishlistEntry[] = [];
		list = add(list, entry());
		list = add(list, entry({ skuId: 'nike-pegasus', storeId: 'nike', addedAt: 2 }));
		assert.deepEqual(
			list.map((e) => e.skuId),
			['nike-pegasus', 'zara-blazer']
		);
		const before = list;
		list = add(list, entry({ addedAt: 999 }));
		assert.equal(list, before, 'duplicate add returns the same array');
		assert.equal(list[1].addedAt, 1700000000000, 'original addedAt kept');
		assert.ok(has(list, 'zara-blazer'));
		assert.ok(!has(list, 'hm-boot'));
	});

	it('toggles on and off', () => {
		let list: WishlistEntry[] = [];
		list = toggle(list, entry());
		assert.ok(has(list, 'zara-blazer'));
		list = toggle(list, entry());
		assert.deepEqual(list, []);
	});

	it('removes only the named sku and leaves worn state alone', () => {
		const list = [entry(), entry({ skuId: 'nike-pegasus', storeId: 'nike' })];
		const worn: Record<string, string> = { top: 'mall-zara-blazer' };
		const out = remove(list, 'zara-blazer');
		assert.deepEqual(
			out.map((e) => e.skuId),
			['nike-pegasus']
		);
		assert.deepEqual(worn, { top: 'mall-zara-blazer' }, 'worn map untouched');
		assert.equal(remove(list, 'missing-sku').length, 2);
	});

	it('round-trips through serialize/parse', () => {
		const list = [entry(), entry({ skuId: 'nike-pegasus', storeId: 'nike', addedAt: 3 })];
		assert.deepEqual(parse(serialize(list)), list);
	});

	it('rejects corrupt and invalid input', () => {
		assert.deepEqual(parse('not json{{{'), []);
		assert.deepEqual(parse('{"nope":true}'), []);
		assert.deepEqual(
			parse(
				JSON.stringify([
					entry(),
					{ skuId: '', storeId: 'zara', addedAt: 1 },
					{ skuId: 'x', storeId: '', addedAt: 1 },
					{ skuId: 'x', storeId: 'zara', addedAt: NaN },
					{ skuId: 'x', storeId: 'zara' },
					'plain-string',
					null,
					42,
					entry({ addedAt: 5 })
				])
			),
			[entry()],
			'invalid dropped, dupes deduped first-wins'
		);
		assert.equal(isWishlistEntry(entry()), true);
		assert.equal(isWishlistEntry(null), false);
		assert.equal(isWishlistEntry({}), false);
	});

	it('prunes orphaned catalogue entries', () => {
		const list = [
			entry(),
			entry({ skuId: 'gone-old', storeId: 'zara' }),
			entry({ skuId: 'nike-pegasus', storeId: 'nike' })
		];
		const live = new Set(['zara:zara-blazer', 'nike:nike-pegasus']);
		assert.deepEqual(
			pruneOrphans(list, (skuId, storeId) => live.has(`${storeId}:${skuId}`)).map(
				(e) => e.skuId
			),
			['zara-blazer', 'nike-pegasus']
		);
	});

	it('try-on conversion preserves mall id and category', () => {
		const store = { id: 'zara', name: 'Zara' } as MallStore;
		const sku: MallSku = {
			id: 'zara-blazer',
			label: 'Cropped blazer',
			category: 'top',
			price: 'Rp 899.000',
			imageUrl: 'data:image/svg+xml,swatch'
		};
		const piece = skuToClosetPiece(store, sku);
		assert.equal(piece.id, 'mall-zara-blazer');
		assert.equal(piece.category, 'top');
		assert.equal(piece.label, 'Zara · Cropped blazer');
		assert.deepEqual({ x: piece.x, y: piece.y, w: piece.w, h: piece.h }, { x: 0, y: 0, w: 1, h: 1 });
	});
});
