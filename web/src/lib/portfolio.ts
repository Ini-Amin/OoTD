// Pure maker-portfolio helpers. Split from the /makers page and the public
// profile so showcase gating and picker filtering stay unit-testable in
// node (portfolio.test.ts). No svelte/supabase imports.
import type { Outfit } from './outfits';

/** Structural slice of a craft request needed for showcase gating. */
export type ShowcaseableLike = {
	status: string;
	showcasedOutfitId?: string | null;
	/** True when ANY maker linked this request (first-wins, server-side). */
	showcased?: boolean;
};

/**
 * Only done requests with no existing link can be showcased. The global
 * `showcased` flag (true when another maker already won the request)
 * also blocks — otherwise maker B would see Add, submit, and eat a 409.
 */
export function isShowcaseable(r: ShowcaseableLike): boolean {
	return r.status === 'done' && !isShowcased(r.showcasedOutfitId) && r.showcased !== true;
}

/** An entry is showcased when the dashboard reports a linked outfit id. */
export function isShowcased(showcasedOutfitId: string | null | undefined): boolean {
	return typeof showcasedOutfitId === 'string' && showcasedOutfitId.length > 0;
}

/** True when another maker already showcased this request (lost the race). */
export function isShowcasedByOther(r: ShowcaseableLike): boolean {
	return r.showcased === true && !isShowcased(r.showcasedOutfitId);
}

/**
 * Picker candidates: only the maker's own outfits. The picker source is
 * already GET /v1/users/{ownUsername}, so this is a defense-in-depth
 * filter (server re-verifies outfit.author_id == maker).
 */
export function filterShowcaseCandidates(outfits: Outfit[], ownUsername: string): Outfit[] {
	const clean = ownUsername.replace(/^@/, '');
	const want = `@${clean}`;
	return outfits.filter((o) => o.handle === want);
}
