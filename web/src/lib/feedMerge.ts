/** Minimal shape needed to merge API outfits with preview samples. */
export type FeedOutfit = {
	id: string;
	imageUrl?: string;
};

/**
 * API outfits first, backfilled with preview samples (deduplicated by image).
 * Keeps the feed full while real data is still sparse.
 */
export function mergeFeedOutfits<T extends FeedOutfit>(api: T[], preview: T[]): T[] {
	const seen = new Set<string>();
	const out: T[] = [];
	for (const o of [...api, ...preview]) {
		// Falsy (not just nullish): API outfits without a photo carry
		// imageUrl "" — keying them by "" would collapse all but the first
		// imageless outfit out of the feed.
		const key = o.imageUrl || `id:${o.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(o);
	}
	return out;
}
