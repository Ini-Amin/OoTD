import { mallStores } from '$lib/mall';
import {
	add,
	has,
	parse,
	pruneOrphans,
	remove,
	serialize,
	toggle,
	type WishlistEntry
} from '$lib/wishlist';

// localStorage-only until a wishlist table + /v1/me/wishlist endpoint exist;
// mirrors closet.svelte.ts (the feed-saves backend only accepts feed Outfit UUIDs).
const KEY = 'ootd-wishlist-v1';

class Wishlist {
	entries = $state<WishlistEntry[]>([]);
	#ready = false;

	init() {
		if (this.#ready || typeof localStorage === 'undefined') return;
		this.#ready = true;
		try {
			const parsed = parse(localStorage.getItem(KEY) ?? '[]');
			const live = new Set(mallStores.flatMap((s) => s.skus.map((k) => `${s.id}:${k.id}`)));
			this.entries = pruneOrphans(parsed, (skuId, storeId) =>
				live.has(`${storeId}:${skuId}`)
			);
			this.#save();
		} catch {
			// corrupt storage: start empty
		}
	}

	has(skuId: string): boolean {
		return has(this.entries, skuId);
	}

	get count(): number {
		return this.entries.length;
	}

	add(skuId: string, storeId: string) {
		this.entries = add(this.entries, { skuId, storeId, addedAt: Date.now() });
		this.#save();
	}

	remove(skuId: string) {
		// Wishlist-remove never touches the closet or what is worn.
		this.entries = remove(this.entries, skuId);
		this.#save();
	}

	toggle(skuId: string, storeId: string) {
		this.entries = toggle(this.entries, { skuId, storeId, addedAt: Date.now() });
		this.#save();
	}

	#save() {
		// Private mode / quota: in-memory state still updates, like closet.
		try {
			localStorage.setItem(KEY, serialize(this.entries));
		} catch {
			// Persistence failed; the session copy remains usable.
		}
	}
}

export const wishlist = new Wishlist();
