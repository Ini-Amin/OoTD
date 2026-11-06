// Comment delete-visibility predicate.
// Run: npm run test (node:test, no dependencies).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteComment } from './comments.ts';

describe('canDeleteComment', () => {
	it('allows the comment author', () => {
		assert.equal(canDeleteComment('nadya', '@salsa', 'nadya'), true);
	});

	it('allows the outfit owner on others comments', () => {
		assert.equal(canDeleteComment('nadya', '@salsa', 'salsa'), true);
	});

	it('denies strangers', () => {
		assert.equal(canDeleteComment('nadya', '@salsa', 'rani'), false);
	});

	it('denies logged-out viewers', () => {
		assert.equal(canDeleteComment('nadya', '@salsa', null), false);
		assert.equal(canDeleteComment('nadya', '@salsa', undefined), false);
	});

	it('denies empty profile usernames', () => {
		assert.equal(canDeleteComment('nadya', '@salsa', ''), false);
	});

	it('compares case-sensitively (usernames are lowercase)', () => {
		assert.equal(canDeleteComment('Nadya', '@salsa', 'nadya'), false);
	});
});
