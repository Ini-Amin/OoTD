// Pure maker-dashboard helpers. Run: npm run test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	canDecide,
	canMarkDone,
	craftStatusLabel,
	formatBudgetIDR,
	isMakerProfile,
	normalizeRole
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
