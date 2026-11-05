// Pure maker-dashboard helpers. Split from the /makers page so the role gate
// and status labels stay unit-testable in node (makers.test.ts).
// Modul murni — tanpa dependensi svelte/supabase agar unit-testable.
export type MakerRole = 'user' | 'maker';

export type CraftRequestStatus = 'open' | 'accepted' | 'declined' | 'done';

/** Structural slice of Profile (auth.svelte) needed for the role gate. */
export type ProfileLike = { role?: unknown } | null | undefined;

/** Server-side truth lives in users.role; missing role means a plain user. */
export function isMakerProfile(profile: ProfileLike): boolean {
	return profile?.role === 'maker';
}

export function normalizeRole(role: unknown): MakerRole {
	return role === 'maker' ? 'maker' : 'user';
}

/** DB enum 'open' reads as "Pending" in the dashboard. */
export function craftStatusLabel(status: string): string {
	switch (status) {
		case 'open':
			return 'Pending';
		case 'accepted':
			return 'Accepted';
		case 'declined':
			return 'Declined';
		case 'done':
			return 'Done';
		default:
			return status;
	}
}

/** Only open requests accept an accept/decline decision (mirrors Go validateRequestStatus). */
export function canDecide(status: string): boolean {
	return status === 'open';
}

/** Accepted requests can be marked done once the work is completed. */
export function canMarkDone(status: string): boolean {
	return status === 'accepted';
}

/** Structural slice of a craft request needed for inbox ordering/badges. */
export type InboxRequestLike = { createdAt: string; unread?: unknown };

export function isUnread(r: InboxRequestLike): boolean {
	return r.unread === true;
}

export function unreadCount(requests: InboxRequestLike[]): number {
	let n = 0;
	for (const r of requests) if (isUnread(r)) n++;
	return n;
}

/** Unread first, then newest first. Missing unread reads as read (old/cached API). */
export function sortForMakerInbox<T extends InboxRequestLike>(requests: T[]): T[] {
	return [...requests].sort((a, b) => {
		const au = isUnread(a) ? 0 : 1;
		const bu = isUnread(b) ? 0 : 1;
		if (au !== bu) return au - bu;
		return Date.parse(b.createdAt) - Date.parse(a.createdAt);
	});
}

export function partitionUnread<T extends InboxRequestLike>(
	requests: T[]
): { unread: T[]; rest: T[] } {
	const sorted = sortForMakerInbox(requests);
	const unread = sorted.filter(isUnread);
	const rest = sorted.filter((r) => !isUnread(r));
	return { unread, rest };
}

export function formatBudgetIDR(budget: number | null | undefined): string {
	if (budget === null || budget === undefined) return '—';
	try {
		return `Rp ${new Intl.NumberFormat('id-ID').format(budget)}`;
	} catch {
		return `Rp ${budget}`;
	}
}
