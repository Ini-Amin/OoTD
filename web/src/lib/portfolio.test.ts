// Pure maker-portfolio helpers. Run: npm run test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	filterShowcaseCandidates,
	isShowcaseable,
	isShowcased,
	isShowcasedByOther
} from './portfolio.ts';
import type { Outfit } from './outfits.ts';

function outfit(handle: string, id = 'o1'): Outfit {
	return {
		id,
		creator: 'Maker',
		handle,
		title: 'Result',
		caption: '',
		tags: [],
		accent: '#123456',
		savedBy: 0
	};
}

describe('isShowcased', () => {
	it('is true only for a non-empty outfit id', () => {
		assert.equal(isShowcased('a0000000-0000-0000-0000-000000000001'), true);
		assert.equal(isShowcased(''), false);
		assert.equal(isShowcased(null), false);
		assert.equal(isShowcased(undefined), false);
	});
});

describe('isShowcaseable', () => {
	it('allows showcasing only done requests without a link', () => {
		assert.equal(isShowcaseable({ status: 'done', showcasedOutfitId: null }), true);
		assert.equal(isShowcaseable({ status: 'done' }), true);
		assert.equal(
			isShowcaseable({ status: 'done', showcasedOutfitId: 'a0000000-0000-0000-0000-000000000001' }),
			false
		);
	});

	it('rejects non-done requests even without a link', () => {
		assert.equal(isShowcaseable({ status: 'open', showcasedOutfitId: null }), false);
		assert.equal(isShowcaseable({ status: 'accepted', showcasedOutfitId: null }), false);
		assert.equal(isShowcaseable({ status: 'declined', showcasedOutfitId: null }), false);
	});

	it('rejects done requests another maker already showcased', () => {
		assert.equal(
			isShowcaseable({ status: 'done', showcasedOutfitId: null, showcased: true }),
			false
		);
		assert.equal(isShowcaseable({ status: 'done', showcasedOutfitId: null, showcased: false }), true);
	});
});

describe('isShowcasedByOther', () => {
	it('is true only when someone else won the race', () => {
		assert.equal(
			isShowcasedByOther({ status: 'done', showcasedOutfitId: null, showcased: true }),
			true
		);
		assert.equal(
			isShowcasedByOther({
				status: 'done',
				showcasedOutfitId: 'a0000000-0000-0000-0000-000000000001',
				showcased: true
			}),
			false
		);
		assert.equal(
			isShowcasedByOther({ status: 'done', showcasedOutfitId: null, showcased: false }),
			false
		);
	});
});

describe('filterShowcaseCandidates', () => {
	it('keeps only the maker\u2019s own outfits', () => {
		const mine = outfit('@bima', 'o1');
		const other = outfit('@rani', 'o2');
		assert.deepEqual(filterShowcaseCandidates([mine, other], 'bima'), [mine]);
	});

	it('tolerates a leading @ on the username', () => {
		const mine = outfit('@bima', 'o1');
		assert.deepEqual(filterShowcaseCandidates([mine], '@bima'), [mine]);
	});

	it('returns an empty list when nothing matches', () => {
		assert.deepEqual(filterShowcaseCandidates([outfit('@rani', 'o2')], 'bima'), []);
	});
});
