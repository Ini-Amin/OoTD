// Pure maker-dashboard helpers. Run: npm run test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	canDecide,
	canMarkDone,
	craftStatusLabel,
	formatBudgetIDR,
	isMakerProfile,
	isUnread,
	normalizeRole,
	partitionUnread,
	sortForMakerInbox,
	unreadCount
} from './makers.ts';

describe('isMakerProfile', () => {
	it('accepts only the maker role', () => {
		assert.equal(isMakerProfile({ role: 'maker' }), true);
		assert.equal(isMakerProfile({ role: 'user' }), false);
	});

	it('treats missing, null, and undefined profiles as plain users', () => {
		assert.equal(isMakerProfile({}), false);
		assert.equal(isMakerProfile(null), false);
		assert.equal(isMakerProfile(undefined), false);
	});

	it('rejects spoofed role values', () => {
		assert.equal(isMakerProfile({ role: 'admin' }), false);
		assert.equal(isMakerProfile({ role: 'Maker' }), false);
		assert.equal(isMakerProfile({ role: '' }), false);
	});
});

describe('normalizeRole', () => {
	it('keeps maker, coerces everything else to user', () => {
		assert.equal(normalizeRole('maker'), 'maker');
		assert.equal(normalizeRole('user'), 'user');
		assert.equal(normalizeRole(undefined), 'user');
		assert.equal(normalizeRole('admin'), 'user');
	});
});

describe('craftStatusLabel', () => {
	it('maps the DB enum to dashboard labels', () => {
		assert.equal(craftStatusLabel('open'), 'Pending');
		assert.equal(craftStatusLabel('accepted'), 'Accepted');
		assert.equal(craftStatusLabel('declined'), 'Declined');
		assert.equal(craftStatusLabel('done'), 'Done');
	});

	it('passes unknown statuses through', () => {
		assert.equal(craftStatusLabel('shipped'), 'shipped');
	});
});

describe('canDecide', () => {
	it('allows decisions only on open requests', () => {
		assert.equal(canDecide('open'), true);
		assert.equal(canDecide('accepted'), false);
		assert.equal(canDecide('declined'), false);
		assert.equal(canDecide('done'), false);
	});
});

describe('canMarkDone', () => {
	it('allows marking done only on accepted requests', () => {
		assert.equal(canMarkDone('accepted'), true);
		assert.equal(canMarkDone('open'), false);
		assert.equal(canMarkDone('declined'), false);
		assert.equal(canMarkDone('done'), false);
	});
});

describe('formatBudgetIDR', () => {
	it('formats numbers as IDR', () => {
		assert.equal(formatBudgetIDR(500000), 'Rp 500.000');
		assert.equal(formatBudgetIDR(0), 'Rp 0');
	});

	it('renders missing budgets as an em dash', () => {
		assert.equal(formatBudgetIDR(null), '—');
		assert.equal(formatBudgetIDR(undefined), '—');
	});
});

describe('isUnread', () => {
	it('is true only for explicit true', () => {
		assert.equal(isUnread({ createdAt: '2026-01-01T00:00:00Z', unread: true }), true);
		assert.equal(isUnread({ createdAt: '2026-01-01T00:00:00Z', unread: false }), false);
	});

	it('treats a missing unread field as read (old/cached API)', () => {
		assert.equal(isUnread({ createdAt: '2026-01-01T00:00:00Z' }), false);
		assert.equal(isUnread({ createdAt: '2026-01-01T00:00:00Z', unread: 1 }), false);
	});
});

describe('unreadCount', () => {
	it('counts unread requests', () => {
		assert.equal(
			unreadCount([
				{ createdAt: '2026-01-01T00:00:00Z', unread: true },
				{ createdAt: '2026-01-02T00:00:00Z', unread: false },
				{ createdAt: '2026-01-03T00:00:00Z', unread: true }
			]),
			2
		);
	});

	it('is zero for an empty list', () => {
		assert.equal(unreadCount([]), 0);
	});
});

describe('sortForMakerInbox', () => {
	it('orders unread first, newest first inside each group', () => {
		const sorted = sortForMakerInbox([
			{ id: 'old-read', createdAt: '2026-01-01T00:00:00Z', unread: false },
			{ id: 'old-unread', createdAt: '2026-01-02T00:00:00Z', unread: true },
			{ id: 'new-read', createdAt: '2026-01-04T00:00:00Z', unread: false },
			{ id: 'new-unread', createdAt: '2026-01-03T00:00:00Z', unread: true }
		]);
		assert.deepEqual(
			sorted.map((r) => r.id),
			['new-unread', 'old-unread', 'new-read', 'old-read']
		);
	});

	it('treats missing unread as read', () => {
		const sorted = sortForMakerInbox([
			{ id: 'legacy', createdAt: '2026-01-05T00:00:00Z' },
			{ id: 'fresh', createdAt: '2026-01-01T00:00:00Z', unread: true }
		]);
		assert.deepEqual(
			sorted.map((r) => r.id),
			['fresh', 'legacy']
		);
	});

	it('does not mutate the input', () => {
		const input = [
			{ id: 'a', createdAt: '2026-01-01T00:00:00Z', unread: false },
			{ id: 'b', createdAt: '2026-01-02T00:00:00Z', unread: true }
		];
		sortForMakerInbox(input);
		assert.deepEqual(
			input.map((r) => r.id),
			['a', 'b']
		);
	});
});

describe('partitionUnread', () => {
	it('splits the inbox into unread and rest, both sorted', () => {
		const { unread, rest } = partitionUnread([
			{ id: 'a', createdAt: '2026-01-01T00:00:00Z', unread: false },
			{ id: 'b', createdAt: '2026-01-03T00:00:00Z', unread: true },
			{ id: 'c', createdAt: '2026-01-02T00:00:00Z', unread: true },
			{ id: 'd', createdAt: '2026-01-04T00:00:00Z', unread: false }
		]);
		assert.deepEqual(
			unread.map((r) => r.id),
			['b', 'c']
		);
		assert.deepEqual(
			rest.map((r) => r.id),
			['d', 'a']
		);
	});

	it('handles an empty list', () => {
		assert.deepEqual(partitionUnread([]), { unread: [], rest: [] });
	});
});
