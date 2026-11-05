// Mall wishlist: save tried-on mall pieces for later.
// Pure module (no Svelte, no localStorage) so it stays unit-testable
// (wishlist.test.ts). Entries are ids-only; display fields (label, price,
// image) resolve live from mallStores so they never go stale and storage
// stays tiny. Persistence lives in wishlist.svelte.ts (localStorage-only,
// mirroring closet.svelte.ts) — the feed-saves backend only accepts feed
// Outfit UUIDs and cannot store mall SKUs.

export type WishlistEntry = {
	skuId: string;
	storeId: string;
	addedAt: number;
};

export function isWishlistEntry(v: unknown): v is WishlistEntry {
	if (typeof v !== 'object' || v === null) return false;
	const e = v as Record<string, unknown>;
	return (
		typeof e.skuId === 'string' &&
		e.skuId.length > 0 &&
		typeof e.storeId === 'string' &&
		e.storeId.length > 0 &&
		typeof e.addedAt === 'number' &&
		Number.isFinite(e.addedAt)
	);
}

export function has(entries: WishlistEntry[], skuId: string): boolean {
	return entries.some((e) => e.skuId === skuId);
}

/** Newest first. Adding an existing skuId is a no-op (keeps original addedAt). */
export function add(entries: WishlistEntry[], entry: WishlistEntry): WishlistEntry[] {
	if (!isWishlistEntry(entry) || has(entries, entry.skuId)) return entries;
	return [entry, ...entries];
}

export function remove(entries: WishlistEntry[], skuId: string): WishlistEntry[] {
	return entries.filter((e) => e.skuId !== skuId);
}

export function toggle(entries: WishlistEntry[], entry: WishlistEntry): WishlistEntry[] {
	return has(entries, entry.skuId) ? remove(entries, entry.skuId) : add(entries, entry);
}

export function serialize(entries: WishlistEntry[]): string {
	return JSON.stringify(entries);
}

/** Corrupt storage parses to []. Invalid entries are dropped, dupes deduped (first wins). */
export function parse(raw: string): WishlistEntry[] {
	try {
		const data: unknown = JSON.parse(raw);
		if (!Array.isArray(data)) return [];
		const out: WishlistEntry[] = [];
		for (const v of data) {
			if (isWishlistEntry(v) && !has(out, v.skuId)) out.push(v);
		}
		return out;
	} catch {
		return [];
	}
}

/** Drop entries whose SKU no longer exists in the catalogue (static mall.ts drifts). */
export function pruneOrphans(
	entries: WishlistEntry[],
	exists: (skuId: string, storeId: string) => boolean
): WishlistEntry[] {
	return entries.filter((e) => exists(e.skuId, e.storeId));
}
