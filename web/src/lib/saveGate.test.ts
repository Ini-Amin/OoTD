// Regression test for Bug 1 (2026-11-05): synthetic DEFAULT_BOX guesses must
// never be saved to the closet — they render faces on the mannequin torso.
// Run: npm run test (node:test, no dependencies).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideSavePiece } from './saveGate.ts';

describe('decideSavePiece', () => {
	it('saves immediately when real tagged boxes exist', () => {
		assert.deepEqual(
			decideSavePiece({ hasTaggedPieces: true, authed: true, taggingInFlight: false }),
			{ action: 'save' }
		);
		assert.deepEqual(
			decideSavePiece({ hasTaggedPieces: true, authed: false, taggingInFlight: false }),
			{ action: 'save' }
		);
	});

	it('asks anonymous users to sign in instead of saving guesses', () => {
		assert.deepEqual(
			decideSavePiece({ hasTaggedPieces: false, authed: false, taggingInFlight: false }),
			{ action: 'refuse', reason: 'signin' }
		);
	});

	it('waits for an in-flight tagging attempt', () => {
		assert.deepEqual(
			decideSavePiece({ hasTaggedPieces: false, authed: true, taggingInFlight: true }),
			{ action: 'wait' }
		);
	});

	it('refuses when tagging failed or never ran (no guesses stored)', () => {
		assert.deepEqual(
			decideSavePiece({ hasTaggedPieces: false, authed: true, taggingInFlight: false }),
			{ action: 'refuse', reason: 'untaggable' }
		);
	});
});
