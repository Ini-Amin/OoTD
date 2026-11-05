// Save gate: only pieces with real AI boxes may enter the closet.
// Synthetic DEFAULT_BOX guesses put faces on the mannequin torso, so the
// viewer refuses to save them (Bug 1, 2026-11-05).

export type SaveGateInput = {
	/** Server pieces or fresh/cached auto-tag boxes exist for this outfit. */
	hasTaggedPieces: boolean;
	/** Signed in (auto-tag requires a session token). */
	authed: boolean;
	/** A /v1/analyze attempt for THIS outfit is still in flight. */
	taggingInFlight: boolean;
};

export type SaveGateDecision =
	| { action: 'save' }
	| { action: 'wait' }
	| { action: 'refuse'; reason: 'signin' | 'untaggable' };

export function decideSavePiece(input: SaveGateInput): SaveGateDecision {
	if (input.hasTaggedPieces) return { action: 'save' };
	if (!input.authed) return { action: 'refuse', reason: 'signin' };
	if (input.taggingInFlight) return { action: 'wait' };
	return { action: 'refuse', reason: 'untaggable' };
}
