// Riwayat chat mall: parsing baris DB + merge histori/live dengan dedup.
// Run: npm run test (node:test, no dependencies).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_LIMIT, mergeHistory, parseHistoryRow } from './mallChatHistory.ts';

describe('parseHistoryRow', () => {
	it('parses a valid PostgREST row', () => {
		const row = parseHistoryRow({
			id: 'abc-123',
			name: 'Guest-1000',
			text: 'halo mall',
			created_at: '2026-11-05T04:00:00.000Z'
		});
		assert.deepEqual(row, {
			id: 'abc-123',
			name: 'Guest-1000',
			text: 'halo mall',
			at: Date.parse('2026-11-05T04:00:00.000Z')
		});
	});

	it('truncates overlong name/text like the live path', () => {
		const row = parseHistoryRow({
			id: 'x',
			name: 'n'.repeat(100),
			text: 't'.repeat(900),
			created_at: '2026-11-05T04:00:00.000Z'
		});
		assert.equal(row?.name.length, 40);
		assert.equal(row?.text.length, 500);
	});

	it('rejects malformed rows', () => {
		assert.equal(parseHistoryRow(null), null);
		assert.equal(parseHistoryRow('nope'), null);
		assert.equal(
			parseHistoryRow({ id: 'x', name: 'A', text: 'hi', created_at: 'not-a-date' }),
			null
		);
		assert.equal(parseHistoryRow({ id: 'x', name: 'A', text: '   ' }), null);
		assert.equal(parseHistoryRow({ id: 'x', name: '', text: 'hi' }), null);
		assert.equal(parseHistoryRow({ id: 42, name: 'A', text: 'hi' }), null);
	});
});

describe('mergeHistory', () => {
	it('merges live + history in chronological order', () => {
		const merged = mergeHistory(
			[{ id: 'live-1', name: 'Me', text: 'new', mine: true, at: 3000 }],
			[
				{ id: 'h-1', name: 'A', text: 'old', at: 1000 },
				{ id: 'h-2', name: 'B', text: 'mid', at: 2000 }
			],
			100
		);
		assert.deepEqual(
			merged.map((m) => m.id),
			['h-1', 'h-2', 'live-1']
		);
		assert.equal(merged[2].mine, true);
	});

	it('dedups by id with live winning (keeps mine flag)', () => {
		const merged = mergeHistory(
			[{ id: 'same', name: 'Me', text: 'echo', mine: true, at: 2000 }],
			[{ id: 'same', name: 'Me', text: 'echo', at: 2000 }],
			100
		);
		assert.equal(merged.length, 1);
		assert.equal(merged[0].mine, true);
	});

	it('marks history-only messages as not mine', () => {
		const merged = mergeHistory([], [{ id: 'h', name: 'A', text: 'hi', at: 1000 }], 100);
		assert.equal(merged[0].mine, false);
	});

	it('caps to the newest max entries', () => {
		const history = Array.from({ length: 10 }, (_, i) => ({
			id: `h-${i}`,
			name: 'A',
			text: `m${i}`,
			at: 1000 + i
		}));
		const merged = mergeHistory([], history, 3);
		assert.deepEqual(
			merged.map((m) => m.id),
			['h-7', 'h-8', 'h-9']
		);
	});

	it('loads 50 rows per spec', () => {
		assert.equal(HISTORY_LIMIT, 50);
	});
});
