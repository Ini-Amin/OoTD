import { apiBase } from './outfits';
import { auth } from './auth.svelte';

export type Board = {
	id: string;
	title: string;
	description: string;
	visibility: string;
	outfitIds: string[];
};

function isValidBoard(item: unknown): item is Board {
	if (!item || typeof item !== 'object') return false;
	const b = item as Record<string, unknown>;
	return (
		typeof b.id === 'string' &&
		typeof b.title === 'string' &&
		typeof b.description === 'string' &&
		typeof b.visibility === 'string' &&
		Array.isArray(b.outfitIds) &&
		b.outfitIds.every((v) => typeof v === 'string')
	);
}

class CollectionsStore {
	boards = $state<Board[]>([]);

	async load(): Promise<void> {
		const token = auth.token;
		if (typeof window === 'undefined' || !token) return;
		try {
			const res = await fetch(`${apiBase}/v1/collections`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) return;
			const data = (await res.json()) as { collections?: unknown };
			if (!Array.isArray(data.collections)) return;
			this.boards = data.collections.filter(isValidBoard);
		} catch {
			// keep current state
		}
	}

	async create(title: string): Promise<Board | null> {
		const token = auth.token;
		if (typeof window === 'undefined' || !token) return null;
		try {
			const res = await fetch(`${apiBase}/v1/collections`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ title })
			});
			if (!res.ok) return null;
			const data = (await res.json()) as { collection?: unknown };
			if (!isValidBoard(data.collection)) return null;
			this.boards = [data.collection, ...this.boards];
			return data.collection;
		} catch {
			return null;
		}
	}

	async remove(id: string): Promise<boolean> {
		const token = auth.token;
		if (typeof window === 'undefined' || !token) return false;
		try {
			const res = await fetch(`${apiBase}/v1/collections/${encodeURIComponent(id)}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) return false;
			this.boards = this.boards.filter((b) => b.id !== id);
			return true;
		} catch {
			return false;
		}
	}

	async addItem(id: string, outfitId: string): Promise<boolean> {
		const token = auth.token;
		if (typeof window === 'undefined' || !token) return false;
		try {
			const res = await fetch(`${apiBase}/v1/collections/${encodeURIComponent(id)}/items`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ outfitId })
			});
			if (!res.ok) return false;
			this.boards = this.boards.map((b) =>
				b.id === id && !b.outfitIds.includes(outfitId)
					? { ...b, outfitIds: [...b.outfitIds, outfitId] }
					: b
			);
			return true;
		} catch {
			return false;
		}
	}

	async removeItem(id: string, outfitId: string): Promise<boolean> {
		const token = auth.token;
		if (typeof window === 'undefined' || !token) return false;
		try {
			const res = await fetch(
				`${apiBase}/v1/collections/${encodeURIComponent(id)}/items/${encodeURIComponent(outfitId)}`,
				{ method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
			);
			if (!res.ok) return false;
			this.boards = this.boards.map((b) =>
				b.id === id ? { ...b, outfitIds: b.outfitIds.filter((o) => o !== outfitId) } : b
			);
			return true;
		} catch {
			return false;
		}
	}
}

export const collections = new CollectionsStore();
export const collectionsStore = collections;
export default collections;
