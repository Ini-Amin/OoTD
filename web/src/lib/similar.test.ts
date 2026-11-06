// Deterministic "Similar looks" scoring. Run: npm run test (node:test, no dependencies).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	accentSimilarity,
	findSimilar,
	hexToRgb,
	normalizeTag,
	pieceSimilarity,
	SIMILAR_LIMIT,
	SIMILAR_MIN_SCORE,
	similarityScore,
	tagSimilarity
} from './similar.ts';
import type { Outfit } from './outfits.ts';
import type { Piece } from './pieces.ts';

function makeOutfit(partial: Partial<Outfit> & { id: string }): Outfit {
	return {
		creator: 'Test',
		handle: '@test',
		title: 'Test look',
		caption: '',
		tags: [],
		accent: '#000000',
		savedBy: 0,
		...partial
	};
}

describe('normalizeTag', () => {
	it('lowercases, trims, and strips a leading hash', () => {
		assert.equal(normalizeTag('#Hijab'), 'hijab');
		assert.equal(normalizeTag('  Casual '), 'casual');
	});

	it('treats non-strings as empty so malformed API data never throws', () => {
		assert.equal(normalizeTag(undefined), '');
		assert.equal(normalizeTag(42), '');
	});
});

describe('tagSimilarity', () => {
	it("matches '#Hijab' vs 'hijab' as identical (Jaccard 1)", () => {
		assert.equal(tagSimilarity(['#Hijab'], ['hijab']), 1);
	});

	it('computes Jaccard intersection over union', () => {
		// {hijab,casual} vs {hijab,streetwear} -> 1/3.
		assert.equal(tagSimilarity(['Hijab', 'Casual'], ['hijab', '#Streetwear']), 1 / 3);
	});

	it('returns 0 when either side has no usable tags', () => {
		assert.equal(tagSimilarity([], ['hijab']), 0);
		assert.equal(tagSimilarity(undefined, undefined), 0);
	});
});

describe('hexToRgb / accentSimilarity', () => {
	it('parses #rrggbb and #rgb shorthand', () => {
		assert.deepEqual(hexToRgb('#e8b86d'), { r: 232, g: 184, b: 109 });
		assert.deepEqual(hexToRgb('#fff'), { r: 255, g: 255, b: 255 });
		assert.deepEqual(hexToRgb('abc'), { r: 170, g: 187, b: 204 });
	});

	it('returns null for invalid or missing hex', () => {
		assert.equal(hexToRgb('red'), null);
		assert.equal(hexToRgb('#12'), null);
		assert.equal(hexToRgb(undefined), null);
	});

	it('scores identical colors 1 and black-vs-white 0', () => {
		assert.equal(accentSimilarity('#000', '#000000'), 1);
		assert.equal(accentSimilarity('#000000', '#ffffff'), 0);
	});

	it('scores invalid hex 0', () => {
		assert.equal(accentSimilarity('red', '#000000'), 0);
		assert.equal(accentSimilarity(undefined, undefined), 0);
	});
});

describe('similarityScore', () => {
	// Hand-computed fixture: tags 1/3, pieces 1/3, accent 0, same creator 1.
	// Score = 0.5/3 + 0.2/3 + 0.2*0 + 0.1*1 = 1/3.
	const target = makeOutfit({
		id: 'target',
		handle: '@Nadya',
		tags: ['Hijab', 'Casual'],
		accent: '#000000',
		pieces: [
			{ id: 'p1', category: 'top', label: 'Tee', x: 0, y: 0, w: 1, h: 1 },
			{ id: 'p2', category: 'bottom', label: 'Jeans', x: 0, y: 0, w: 1, h: 1 }
		]
	});
	const candidate = makeOutfit({
		id: 'cand',
		handle: '@nadya',
		tags: ['hijab', '#Streetwear'],
		accent: '#ffffff',
		savedBy: 3,
		pieces: [
			{ id: 'p3', category: 'top', label: 'tee', x: 0, y: 0, w: 1, h: 1 },
			{ id: 'p4', category: 'shoes', label: 'Sneakers', x: 0, y: 0, w: 1, h: 1 }
		]
	});

	it('applies the documented weights (tags .50 / pieces .20 / accent .20 / creator .10)', () => {
		assert.equal(pieceSimilarity(target.pieces, candidate.pieces), 1 / 3);
		assert.ok(Math.abs(similarityScore(target, candidate) - 1 / 3) < 1e-9);
	});

	it('renormalizes over 0.80 when one side lacks pieces', () => {
		const noPieces = makeOutfit({ ...candidate, id: 'nop', pieces: undefined });
		const expected = (0.5 * (1 / 3) + 0.2 * 0 + 0.1 * 1) / 0.8;
		assert.ok(Math.abs(similarityScore(target, noPieces) - expected) < 1e-9);
		// Without renormalization the same pair would score 0.5/3 + 0.1.
		assert.notEqual(similarityScore(target, noPieces), 0.5 * (1 / 3) + 0.1);
	});

	it('renormalizes when both sides lack pieces', () => {
		const a = makeOutfit({ id: 'a', tags: ['Hijab'], accent: '#111111', handle: '@x' });
		const b = makeOutfit({ id: 'b', tags: ['hijab'], accent: '#111111', handle: '@y' });
		assert.ok(Math.abs(similarityScore(a, b) - (0.5 * 1 + 0.2 * 1 + 0.1 * 0) / 0.8) < 1e-9);
	});

	it('stays within 0..1', () => {
		const s = similarityScore(target, candidate);
		assert.ok(s >= 0 && s <= 1);
	});

	it('gives no creator boost when either handle is blank', () => {
		// Identical tags + accent, both handles blank: (0.5 + 0.2) / 0.8.
		// Two missing handles are not the same creator.
		const a = makeOutfit({ id: 'a', handle: '', tags: ['Hijab'], accent: '#111111' });
		const b = makeOutfit({ id: 'b', handle: '  ', tags: ['hijab'], accent: '#111111' });
		assert.ok(Math.abs(similarityScore(a, b) - 0.7 / 0.8) < 1e-9);
		const c = makeOutfit({ id: 'c', handle: '@x', tags: ['hijab'], accent: '#111111' });
		assert.ok(Math.abs(similarityScore(a, c) - 0.7 / 0.8) < 1e-9);
	});

	it('renormalizes when pieces exist but carry no usable data', () => {
		// Blank category+label counts as missing, not as a zero component:
		// same expectation as the undefined-pieces renormalization case.
		const blank: Piece[] = [
			{ id: 'e', category: '', label: '', x: 0, y: 0, w: 1, h: 1 } as unknown as Piece
		];
		const noPieces = makeOutfit({ ...candidate, id: 'blankp', pieces: blank });
		const expected = (0.5 * (1 / 3) + 0.2 * 0 + 0.1 * 1) / 0.8;
		assert.ok(Math.abs(similarityScore(target, noPieces) - expected) < 1e-9);
	});
});

describe('findSimilar', () => {
	const target = makeOutfit({
		id: '11111111-1111-4111-8111-111111111111',
		handle: '@nadya',
		tags: ['Hijab', 'Casual'],
		accent: '#123456',
		savedBy: 10,
		imageUrl: 'https://img.test/target.jpg'
	});

	it('returns [] for an empty pool', () => {
		assert.deepEqual(findSimilar(target, []), []);
	});

	it('excludes the target by id and by shared imageUrl', () => {
		const self = makeOutfit({ id: target.id, tags: ['Hijab'] });
		const dupImage = makeOutfit({ id: 'other-id', tags: ['Hijab'], imageUrl: target.imageUrl });
		const valid = makeOutfit({ id: 'valid-id', tags: ['Hijab'] });
		assert.deepEqual(
			findSimilar(target, [self, dupImage, valid]).map((o) => o.id),
			['valid-id']
		);
	});

	it('dedupes candidates by id, then by imageUrl', () => {
		const first = makeOutfit({ id: 'dup', tags: ['Hijab'], savedBy: 1 });
		const second = makeOutfit({ id: 'dup', tags: ['Hijab'], savedBy: 99 });
		const imgA = makeOutfit({ id: 'img-a', tags: ['Hijab'], imageUrl: 'https://img.test/same.jpg' });
		const imgB = makeOutfit({ id: 'img-b', tags: ['Hijab'], imageUrl: 'https://img.test/same.jpg' });
		assert.deepEqual(
			findSimilar(target, [first, second, imgA, imgB]).map((o) => o.id),
			['dup', 'img-a']
		);
	});

	it('does not dedupe imageless candidates against each other', () => {
		// Regression: imageUrl "" (API outfits without a photo) keyed every
		// imageless candidate identically, hiding all but the first.
		const noImg = (id: string) => makeOutfit({ id, tags: ['Hijab'], imageUrl: '' });
		const undefImg = (id: string) => makeOutfit({ id, tags: ['Hijab'], imageUrl: undefined });
		assert.deepEqual(
			findSimilar(target, [noImg('n1'), noImg('n2'), undefImg('n3')]).map((o) => o.id),
			['n1', 'n2', 'n3']
		);
	});

	it('drops preview candidates for a real target but allows preview peers', () => {
		const preview = makeOutfit({ id: 'look-001', tags: ['Hijab'], savedBy: 5 });
		const real = makeOutfit({ id: '22222222-2222-4222-8222-222222222222', tags: ['Hijab'] });
		const excludeIds = new Set(['look-001']);
		assert.deepEqual(
			findSimilar(target, [preview, real], { excludeIds }).map((o) => o.id),
			[real.id]
		);
		const previewTarget = makeOutfit({ id: 'look-009', tags: ['Hijab'] });
		assert.deepEqual(
			findSimilar(previewTarget, [preview, real], { excludeIds: new Set() }).map((o) => o.id),
			['look-001', real.id]
		);
	});

	it('rejects accent-only matches via the shared-tag/piece gate', () => {
		// Same accent, disjoint tags: score 0.25 clears the 0.20 threshold,
		// but tag and piece overlap are both 0.
		const accentOnly = makeOutfit({ id: 'accent-only', tags: ['Formal'], accent: '#123456' });
		assert.ok(similarityScore(target, accentOnly) >= SIMILAR_MIN_SCORE);
		assert.deepEqual(findSimilar(target, [accentOnly]), []);
	});

	it('admits piece-overlap matches with disjoint tags', () => {
		const piecePeer = makeOutfit({
			id: 'piece-peer',
			tags: ['Formal'],
			accent: '#123456',
			pieces: [{ id: 'p', category: 'top', label: 'Tee', x: 0, y: 0, w: 1, h: 1 }]
		});
		const pieceTarget = makeOutfit({
			...target,
			tags: ['Hijab'],
			pieces: [{ id: 'q', category: 'top', label: 'tee', x: 0, y: 0, w: 1, h: 1 }]
		});
		assert.equal(tagSimilarity(pieceTarget.tags, piecePeer.tags), 0);
		assert.deepEqual(
			findSimilar(pieceTarget, [piecePeer]).map((o) => o.id),
			['piece-peer']
		);
	});

	it('breaks ties by savedBy desc, then id asc — independent of input order', () => {
		// All three score identically: tags 1, accent 1, other creator.
		const mk = (id: string, savedBy: number) =>
			makeOutfit({ id, tags: ['Hijab', 'Casual'], accent: '#123456', handle: '@other', savedBy });
		const pool = [mk('c2', 5), mk('c3', 9), mk('c1', 5)];
		assert.deepEqual(
			findSimilar(target, pool).map((o) => o.id),
			['c3', 'c1', 'c2']
		);
		assert.deepEqual(
			findSimilar(target, [...pool].reverse()).map((o) => o.id),
			['c3', 'c1', 'c2']
		);
	});

	it('caps results at SIMILAR_LIMIT (6)', () => {
		assert.equal(SIMILAR_LIMIT, 6);
		const pool = Array.from({ length: 8 }, (_, i) =>
			makeOutfit({ id: `rank-${i}`, tags: ['Hijab'], savedBy: i })
		);
		const out = findSimilar(target, pool);
		assert.equal(out.length, 6);
		assert.deepEqual(
			out.map((o) => o.id),
			['rank-7', 'rank-6', 'rank-5', 'rank-4', 'rank-3', 'rank-2']
		);
	});

	it('never mutates the input array', () => {
		const pool = [
			makeOutfit({ id: 'b', tags: ['Hijab'], savedBy: 1 }),
			makeOutfit({ id: 'a', tags: ['Hijab'], savedBy: 2 })
		];
		const before = JSON.stringify(pool);
		findSimilar(target, pool);
		assert.equal(JSON.stringify(pool), before);
	});
});
