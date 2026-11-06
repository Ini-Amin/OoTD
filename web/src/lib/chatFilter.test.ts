// Moderasi chat mall: filter kata kasar ID+EN + throttle anti-spam.
// Run: npm run test (node:test, no dependencies).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBlocked, shouldThrottle } from './chatFilter.ts';

describe('isBlocked', () => {
	it('blocks Indonesian profanity (whole words, case-insensitive)', () => {
		assert.equal(isBlocked('anjir'), true);
		assert.equal(isBlocked('ANJIR parah'), true);
		assert.equal(isBlocked('dasar bangsat!'), true);
		assert.equal(isBlocked('Goblok lu'), true);
		assert.equal(isBlocked('kontol'), true);
		assert.equal(isBlocked('tolol banget'), true);
		assert.equal(isBlocked('asu lo'), true);
		assert.equal(isBlocked('bajingan'), true);
	});

	it('blocks English profanity (whole words, case-insensitive)', () => {
		assert.equal(isBlocked('fuck you'), true);
		assert.equal(isBlocked('FUCK'), true);
		assert.equal(isBlocked('shit happens'), true);
		assert.equal(isBlocked('bitch please'), true);
		assert.equal(isBlocked('what the hell is this'), false); // mild, allowed
		assert.equal(isBlocked('asshole'), true);
		assert.equal(isBlocked('dick head'), true);
	});

	it('lets normal chat through', () => {
		assert.equal(isBlocked('halo semuanya!'), false);
		assert.equal(isBlocked('baju ini bagus banget'), false);
		assert.equal(isBlocked('hello, where is Zara?'), false);
		assert.equal(isBlocked(''), false);
		assert.equal(isBlocked('   '), false);
	});

	it('matches whole words only, not substrings', () => {
		assert.equal(isBlocked('belanja'), false); // contains "anja"? no — must not trip
		assert.equal(isBlocked('mau belanja di Zara'), false);
		assert.equal(isBlocked('classic shellfish'), false); // contains "ass" / "shit" fragments
		assert.equal(isBlocked('scunthorpe problem'), false);
		assert.equal(isBlocked('shitake mushrooms'), false);
		assert.equal(isBlocked('anjir'), true); // but the real word still hits
		assert.equal(isBlocked('eh anjir!'), true);
	});

	it('catches separator and leet evasions without new false positives', () => {
		assert.equal(isBlocked('f.u.c.k this'), true);
		assert.equal(isBlocked('F_U_C_K'), true);
		assert.equal(isBlocked('a-n-j-i-r'), true);
		assert.equal(isBlocked('sh1t happens'), true);
		assert.equal(isBlocked('@ss'), true);
		assert.equal(isBlocked('b1tch please'), true);
		assert.equal(isBlocked('scunthorpe problem'), false);
		assert.equal(isBlocked('a b c'), false);
		assert.equal(isBlocked('I love u'), false);
		assert.equal(isBlocked('from the u.s.a'), false);
	});
});

describe('shouldThrottle', () => {
	it('allows the first message (empty history)', () => {
		assert.equal(shouldThrottle([], 10_000), false);
	});

	it('rejects a second message within 2 seconds', () => {
		assert.equal(shouldThrottle([10_000], 10_000), true);
		assert.equal(shouldThrottle([10_000], 11_999), true);
	});

	it('accepts a message after 2 seconds have passed', () => {
		assert.equal(shouldThrottle([10_000], 12_000), false);
		assert.equal(shouldThrottle([10_000], 15_000), false);
	});

	it('only the most recent send matters', () => {
		assert.equal(shouldThrottle([1_000, 5_000, 10_000], 12_001), false);
		assert.equal(shouldThrottle([1_000, 5_000, 10_000], 11_000), true);
	});
});
