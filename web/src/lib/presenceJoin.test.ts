// Merge rules for presence roster + broadcast positions. Run: npm run test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { joinVisitors, toValidPos, POS_STALE_MS } from './presenceJoin.ts';

const NOW = 1_700_000_000_000;

describe('toValidPos', () => {
	it('accepts finite numeric positions', () => {
		assert.deepEqual(toValidPos({ x: 1.5, z: -3 }), { x: 1.5, z: -3 });
	});

	it('rejects missing, non-numeric, and non-finite positions', () => {
		assert.equal(toValidPos(null), null);
		assert.equal(toValidPos(undefined), null);
		assert.equal(toValidPos({}), null);
		assert.equal(toValidPos({ x: '1', z: 2 }), null);
		assert.equal(toValidPos({ x: NaN, z: 2 }), null);
		assert.equal(toValidPos({ x: 1, z: Infinity }), null);
		assert.equal(toValidPos([]), null);
	});
});

describe('joinVisitors', () => {
	it('attaches fresh positions to roster entries', () => {
		const out = joinVisitors(
			[{ clientId: 'a', name: 'A', hue: 1, storeId: null }],
			new Map([['a', { x: 2, z: 3, at: NOW }]]),
			NOW
		);
		assert.deepEqual(out, [{ clientId: 'a', name: 'A', hue: 1, storeId: null, x: 2, z: 3 }]);
	});

	it('nulls stale positions so the view falls back', () => {
		const out = joinVisitors(
			[{ clientId: 'a', name: 'A', hue: 1, storeId: 'zara' }],
			new Map([['a', { x: 2, z: 3, at: NOW - POS_STALE_MS - 1 }]]),
			NOW
		);
		assert.deepEqual(out, [{ clientId: 'a', name: 'A', hue: 1, storeId: 'zara', x: null, z: null }]);
	});

	it('nulls positions for entries without any broadcast yet', () => {
		const out = joinVisitors(
			[{ clientId: 'a', name: 'A', hue: 1, storeId: null }],
			new Map(),
			NOW
		);
		assert.equal(out[0].x, null);
		assert.equal(out[0].z, null);
	});

	it('ignores positions from unknown ids (roster is truth)', () => {
		const out = joinVisitors(
			[{ clientId: 'a', name: 'A', hue: 1, storeId: null }],
			new Map([
				['ghost', { x: 9, z: 9, at: NOW }],
				['a', { x: 1, z: 1, at: NOW }]
			]),
			NOW
		);
		assert.equal(out.length, 1);
		assert.deepEqual([out[0].x, out[0].z], [1, 1]);
	});
});
