import { apiBase, type Outfit } from './outfits';
import { auth } from './auth.svelte';

const STORAGE_KEY = 'ootd-saved';

/** Persist one save-state change server-side. False on network error or logged out. */
async function serverSave(id: string, shouldSave: boolean): Promise<boolean> {
	const token = auth.token;
	if (typeof window === 'undefined' || !token) return false;
	try {
		const res = await fetch(`${apiBase}/v1/outfits/${encodeURIComponent(id)}/save`, {
			method: shouldSave ? 'POST' : 'DELETE',
			headers: { Authorization: `Bearer ${token}` }
		});
		return res.ok;
	} catch {
		return false;
	}
}

function isValidOutfit(item: unknown): item is Outfit {
	if (!item || typeof item !== 'object') return false;
	const o = item as Record<string, unknown>;
	return (
		typeof o.id === 'string' &&
		typeof o.creator === 'string' &&
		typeof o.handle === 'string' &&
		typeof o.title === 'string' &&
		typeof o.caption === 'string' &&
		Array.isArray(o.tags) &&
		o.tags.every((t) => typeof t === 'string') &&
		typeof o.accent === 'string' &&
		typeof o.savedBy === 'number' &&
		(o.commentCount === undefined || typeof o.commentCount === 'number') &&
		(o.match === undefined || typeof o.match === 'number') &&
		(o.imageUrl === undefined || typeof o.imageUrl === 'string') &&
		(o.imageWidth === undefined || typeof o.imageWidth === 'number') &&
		(o.imageHeight === undefined || typeof o.imageHeight === 'number')
	);
}

class SavedStore {
	ids = $state<string[]>([]);
	#items = $state<Outfit[]>([]);
	#initialized = false;

	get items(): Outfit[] {
		return this.#items;
	}

	has(id: string): boolean {
		return this.ids.includes(id);
	}

	toggle(outfit: Outfit): void {
		const index = this.#items.findIndex((o) => o.id === outfit.id);
		const willSave = index < 0;
		if (index >= 0) {
			this.#items = this.#items.filter((o) => o.id !== outfit.id);
		} else {
			this.#items = [outfit, ...this.#items];
		}
		this.ids = this.#items.map((o) => o.id);
		this.#persist();
		// Server sync when logged in (fire-and-forget); local state is the
		// fallback when logged out or on network error.
		if (typeof window !== 'undefined' && auth.token) {
			void serverSave(outfit.id, willSave);
		}
	}

	clear(): void {
		this.#items = [];
		this.ids = [];
		this.#persist();
	}

	/** Merge the server save list with anonymous local saves (union, no dupes): local-only ids are pushed up first so signing in never loses them, then everything is hydrated. No-op when logged out or on network error (local fallback kept). */
	async loadFromServer(): Promise<void> {
		const token = auth.token;
		if (typeof window === 'undefined' || !token) return;
		try {
			const res = await fetch(`${apiBase}/v1/me/saves`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) return;
			const data = (await res.json()) as { outfitIds?: unknown };
			if (!Array.isArray(data.outfitIds)) return;
			const serverIds = data.outfitIds
				.filter((v): v is string => typeof v === 'string')
				.slice(0, 50);
			const serverSet = new Set(serverIds);
			// Push anonymous local saves up. Idempotent; preview/deleted ids
			// simply fail server-side and stay local-only.
			const localOnly = this.ids.filter((id) => !serverSet.has(id));
			await Promise.all(localOnly.map((id) => serverSave(id, true)));
			// Follow-up: add a batch endpoint (e.g. GET /v1/outfits?ids=...) to
			// avoid N+1 per-id fetches here.
			const needBodies = serverIds.filter((id) => !this.#items.some((o) => o.id === id));
			const results = await Promise.all(
				needBodies.map(async (outfitId): Promise<Outfit | null> => {
					try {
						const r = await fetch(`${apiBase}/v1/outfits/${encodeURIComponent(outfitId)}`);
						if (!r.ok) return null;
						const body = (await r.json()) as { outfit?: unknown };
						return isValidOutfit(body.outfit) ? body.outfit : null;
					} catch {
						return null;
					}
				})
			);
			const byId = new Map(this.#items.map((o) => [o.id, o]));
			for (const o of results) {
				if (o !== null && !byId.has(o.id)) byId.set(o.id, o);
			}
			const merged = [...serverIds, ...localOnly]
				.map((id) => byId.get(id))
				.filter((o): o is Outfit => o !== undefined);
			this.#items = merged;
			this.ids = merged.map((o) => o.id);
			this.#persist();
		} catch {
			// keep local fallback
		}
	}

	init(): void {
		if (typeof window === 'undefined' || this.#initialized) return;
		this.#initialized = true;

		try {
			const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage[STORAGE_KEY];
			if (raw && typeof raw === 'string') {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					const valid = parsed.filter(isValidOutfit);
					this.#items = valid;
					this.ids = valid.map((o) => o.id);
				}
			}
		} catch {
			// ignore corrupt localStorage data
		}
	}

	#persist(): void {
		try {
			if (typeof localStorage !== 'undefined') {
				const json = JSON.stringify(this.#items);
				localStorage[STORAGE_KEY] = json;
				localStorage.setItem(STORAGE_KEY, json);
			}
		} catch {
			// ignore storage errors
		}
	}
}

export const saved = new SavedStore();
export const savedStore = saved;
export default saved;
