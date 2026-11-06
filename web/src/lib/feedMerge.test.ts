import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFeedOutfits } from './feedMerge.ts';

describe('mergeFeedOutfits', () => {
	it('puts API outfits first, then preview backfill', () => {
		const out = mergeFeedOutfits(
			[{ id: 'a1', imageUrl: 'x' }],
			[
				{ id: 'p1', imageUrl: 'y' },
				{ id: 'p2', imageUrl: 'z' }
			]
		);
		assert.deepEqual(
			out.map((o) => o.id),
			['a1', 'p1', 'p2']
		);
	});

	it('dedupes preview samples by imageUrl', () => {
		const out = mergeFeedOutfits(
			[{ id: 'a1', imageUrl: 'x' }],
			[
				{ id: 'p1', imageUrl: 'x' },
				{ id: 'p2', imageUrl: 'y' }
			]
		);
		assert.deepEqual(
			out.map((o) => o.id),
			['a1', 'p2']
		);
	});

	it('falls back to id when imageUrl is missing', () => {
		const out = mergeFeedOutfits([{ id: 'a1' }], [{ id: 'a1' }, { id: 'p2' }]);
		assert.deepEqual(
			out.map((o) => o.id),
			['a1', 'p2']
		);
	});

	it('keeps every imageless API outfit (empty imageUrl is not a dupe key)', () => {
		// Regression: "" keyed all imageless outfits identically, hiding
		// all but the first from the feed and the similar-looks pool.
		const out = mergeFeedOutfits(
			[
				{ id: 'a1', imageUrl: '' },
				{ id: 'a2', imageUrl: '' }
			],
			[{ id: 'p1', imageUrl: 'y' }]
		);
		assert.deepEqual(
			out.map((o) => o.id),
			['a1', 'a2', 'p1']
		);
	});

	it('returns full preview when API is empty', () => {
		const out = mergeFeedOutfits([], [{ id: 'p1' }, { id: 'p2' }]);
		assert.equal(out.length, 2);
	});
});
