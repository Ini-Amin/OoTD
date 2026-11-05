// Shared maker-inbox unread count. The layout rail badge and the /makers
// dashboard both read this: the layout refetches on auth/navigation/focus,
// the dashboard pushes its locally-known count after every mark-read so
// the rail never shows a stale number while the inbox is being cleared.
import { apiBase } from './outfits';
import { auth, authHeaders } from './auth.svelte';
import { isMakerProfile, unreadCount } from './makers';

type RequestsPayload = {
	requests?: { createdAt: string; unread?: boolean }[];
	unreadCount?: number;
};

class MakerInboxStore {
	/** Null = unknown (logged out, non-maker, or fetch failed). */
	unread = $state<number | null>(null);
	#inflight = 0;

	async refresh(): Promise<void> {
		if (!auth.ready || !auth.session || !isMakerProfile(auth.profile)) {
			this.#inflight++;
			this.unread = null;
			return;
		}
		const epoch = ++this.#inflight;
		try {
			const res = await fetch(`${apiBase}/v1/requests`, { headers: { ...authHeaders() } });
			if (epoch !== this.#inflight) return;
			if (!res.ok) {
				this.unread = null;
				return;
			}
			const data = (await res.json()) as RequestsPayload;
			if (epoch !== this.#inflight) return;
			this.unread =
				typeof data.unreadCount === 'number'
					? data.unreadCount
					: unreadCount(data.requests ?? []);
		} catch {
			if (epoch === this.#inflight) this.unread = null;
		}
	}

	/** Instantly reflect a locally-known count (no extra fetch). */
	setLocal(n: number): void {
		this.#inflight++;
		this.unread = n;
	}
}

export const makerInbox = new MakerInboxStore();
