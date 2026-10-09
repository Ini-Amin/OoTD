import type { Outfit } from './outfits';

const STORAGE_KEY = 'ootd-saved';

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
		if (index >= 0) {
			this.#items = this.#items.filter((o) => o.id !== outfit.id);
		} else {
			this.#items = [outfit, ...this.#items];
		}
		this.ids = this.#items.map((o) => o.id);
		this.#persist();
	}

	clear(): void {
		this.#items = [];
		this.ids = [];
		this.#persist();
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
