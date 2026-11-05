// Pure join of the presence roster with live broadcast positions.
// Split out of presence.svelte.ts (which uses runes) so the merge rules stay
// unit-testable in node (presenceJoin.test.ts).
import type { MakerRole } from './makers';

export type RosterEntry = {
	clientId: string;
	name: string;
	hue: number;
	storeId: string | null;
	/**
	 * Self-reported chat role from the track payload. Display hint only —
	 * never authorization (the maker dashboard and API enforce server-side).
	 */
	role: MakerRole;
};

export type PosEntry = { x: number; z: number; at: number };

export type JoinedVisitor = RosterEntry & {
	x: number | null;
	z: number | null;
};

/** Positions older than this fall back to the store door / atrium spot. */
export const POS_STALE_MS = 15000;

/**
 * Strict role parse for inbound presence payloads. Only the exact string
 * 'maker' is honored; everything else (missing, tampered, old clients)
 * falls back to 'user'.
 */
export function parsePresenceRole(role: unknown): MakerRole {
	return role === 'maker' ? 'maker' : 'user';
}

function isValidPos(p: unknown): p is { x: number; z: number } {
	if (typeof p !== 'object' || p === null) return false;
	const { x, z } = p as { x?: unknown; z?: unknown };
	return typeof x === 'number' && Number.isFinite(x) && typeof z === 'number' && Number.isFinite(z);
}

/** Validate an inbound broadcast `pos` payload. Returns null when unusable. */
export function toValidPos(payload: unknown): { x: number; z: number } | null {
	if (!isValidPos(payload)) return null;
	return { x: payload.x, z: payload.z };
}

/**
 * Merge roster with positions. A visitor only gets live x/z when its position
 * is fresh; otherwise x/z are null and the 3D view falls back to the store
 * door (storeId) or an atrium spot. Unknown position ids are ignored —
 * the roster is the source of truth for WHO is here.
 */
export function joinVisitors(
	roster: RosterEntry[],
	positions: Map<string, PosEntry>,
	now: number = Date.now()
): JoinedVisitor[] {
	return roster.map((entry) => {
		const pos = positions.get(entry.clientId);
		const fresh = pos && now - pos.at <= POS_STALE_MS;
		return {
			...entry,
			x: fresh ? pos.x : null,
			z: fresh ? pos.z : null
		};
	});
}
