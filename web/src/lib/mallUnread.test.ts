// Whisper unread persistence: serialize/parse round-trip + thread ordering.
// Run: npm run test (node:test, no dependencies).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	MALL_UNREAD_KEY,
	computeRestoredState,
	parsePersistedUnread,
	serializeUnread,
	sortThreadIds
} from './mallUnread.ts';

describe('serializeUnread/parsePersistedUnread', () => {
	it('round-trips unread counts + thread metadata', () => {
		const raw = serializeUnread(
			{ mall: 2, 'peer-a': 1 },
			[{ peerId: 'peer-a', name: 'Rani', at: 1700000000000 }]
		);
		assert.deepEqual(parsePersistedUnread(raw), {
			unread: { mall: 2, 'peer-a': 1 },
			threads: [{ peerId: 'peer-a', name: 'Rani', at: 1700000000000 }]
		});
	});

	it('never persists message text (whispers stay ephemeral)', () => {
		const raw = serializeUnread(
			{ 'peer-a': 1 },
			[{ peerId: 'peer-a', name: 'Rani', at: 1 }]
		);
		assert.ok(!raw.includes('preview'));
		assert.ok(!raw.includes('halo kak'));
	});

	it('ignores legacy preview fields when parsing', () => {
		const parsed = parsePersistedUnread(
			JSON.stringify({
				unread: { 'peer-a': 1 },
				threads: [{ peerId: 'peer-a', name: 'Rani', preview: 'old', at: 5 }]
			})
		);
		assert.deepEqual(parsed, {
			unread: { 'peer-a': 1 },
			threads: [{ peerId: 'peer-a', name: 'Rani', at: 5 }]
		});
	});

	it('drops non-positive and non-finite counts', () => {
		const parsed = parsePersistedUnread(
			JSON.stringify({ unread: { a: 0, b: -3, c: 'x', d: 2.7 }, threads: [] })
		);
		assert.deepEqual(parsed.unread, { d: 2 });
	});

	it('drops threads without unread counts', () => {
		const raw = serializeUnread({ mall: 1 }, [{ peerId: 'stale', name: 'X', at: 1 }]);
		assert.deepEqual(parsePersistedUnread(raw).threads, []);
	});

	it('collapses corrupt payloads to empty state instead of throwing', () => {
		assert.deepEqual(parsePersistedUnread('not-json{'), { unread: {}, threads: [] });
		assert.deepEqual(parsePersistedUnread(''), { unread: {}, threads: [] });
		assert.deepEqual(parsePersistedUnread(null), { unread: {}, threads: [] });
		assert.deepEqual(parsePersistedUnread('[]'), { unread: {}, threads: [] });
		assert.deepEqual(parsePersistedUnread('42'), { unread: {}, threads: [] });
		assert.deepEqual(parsePersistedUnread(JSON.stringify({ unread: [], threads: {} })), {
			unread: {},
			threads: []
		});
	});

	it('uses a versioned storage key', () => {
		assert.equal(MALL_UNREAD_KEY, 'ootd-mall-unread-v1');
	});
});

describe('computeRestoredState', () => {
	it('replaces live counts with persisted ones instead of adding', () => {
		// Regression: additive merge inflated 1 unread to 2, 3, ... on
		// every /map remount. Restore must be replacement.
		const out = computeRestoredState(
			{
				unread: { mall: 1, 'peer-a': 2 },
				threads: [{ peerId: 'peer-a', name: 'Rani', at: 9 }]
			},
			[],
			{}
		);
		assert.deepEqual(out.unread, { mall: 1, 'peer-a': 2 });
		assert.deepEqual(out.meta, { 'peer-a': { peerId: 'peer-a', name: 'Rani', at: 9 } });
		assert.deepEqual(out.names, { 'peer-a': 'Rani' });
	});

	it('skips meta for peers that already have a live thread', () => {
		const out = computeRestoredState(
			{
				unread: { 'peer-a': 1, 'peer-b': 1 },
				threads: [
					{ peerId: 'peer-a', name: 'Rani', at: 1 },
					{ peerId: 'peer-b', name: 'Budi', at: 2 }
				]
			},
			['peer-a'],
			{ 'peer-a': 'Rani Live' }
		);
		assert.deepEqual(Object.keys(out.meta), ['peer-b']);
		assert.equal(out.names['peer-a'], 'Rani Live');
		assert.equal(out.names['peer-b'], 'Budi');
	});

	it('restoring twice over the same result does not inflate', () => {
		// Simulates remount-after-restore at the pure level: feeding the
		// restored state back through restore must be a fixed point.
		const persisted = {
			unread: { mall: 1 },
			threads: [] as { peerId: string; name: string; at: number }[]
		};
		const first = computeRestoredState(persisted, [], {});
		const second = computeRestoredState(
			{ unread: first.unread, threads: [] },
			[],
			first.names
		);
		assert.deepEqual(second.unread, { mall: 1 });
	});
});

describe('sortThreadIds', () => {
	it('orders unread first, then most recent', () => {
		const lastAt: Record<string, number> = { a: 3000, b: 1000, c: 2000, d: 4000 };
		const sorted = sortThreadIds(['a', 'b', 'c', 'd'], { b: 1, c: 2 }, (id) => lastAt[id]);
		assert.deepEqual(sorted, ['c', 'b', 'd', 'a']);
	});

	it('handles no unread', () => {
		const sorted = sortThreadIds(['a', 'b'], {}, (id) => (id === 'a' ? 1 : 2));
		assert.deepEqual(sorted, ['b', 'a']);
	});
});
