import { previewOutfits } from './outfits';

export type StyleTag = {
	slug: string;
	name: string;
	count: number;
};
function initialAvailable(): StyleTag[] {
	const bySlug: Record<string, StyleTag> = {};
	for (const outfit of previewOutfits) {
		for (const tag of outfit.tags) {
			const slug = tag.toLowerCase().replace(/\s+/g, '-');
			if (bySlug[slug]) {
				bySlug[slug].count += 1;
			} else {
				bySlug[slug] = { slug, name: tag, count: 1 };
			}
		}
	}
	return Object.values(bySlug);
}

class StyleStore {
	available = $state<StyleTag[]>(initialAvailable());
	picked = $state<string[]>([]);

	private persist(): void {
		try {
			if (typeof localStorage !== 'undefined') {
				const json = JSON.stringify(this.picked);
				localStorage['ootd-styles'] = json;
				localStorage.setItem('ootd-styles', json);
			}
		} catch {
			// ignore storage errors
		}
	}

	toggle = (slug: string): void => {
		if (this.picked.includes(slug)) {
			this.picked = this.picked.filter((s) => s !== slug);
		} else {
			this.picked = [...this.picked, slug];
		}
		this.persist();
	};

	clear = (): void => {
		this.picked = [];
		this.persist();
	};

	init = async (apiBase: string): Promise<void> => {
		try {
			if (typeof localStorage !== 'undefined') {
				const raw = localStorage.getItem('ootd-styles') ?? localStorage['ootd-styles'];
				if (raw && typeof raw === 'string') {
					const parsed = JSON.parse(raw);
					if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
						this.picked = parsed;
					}
				}
			}
		} catch {
			// ignore storage errors
		}

		try {
			const res = await fetch(`${apiBase}/v1/tags`);
			if (res.ok) {
				const data = (await res.json()) as { tags?: StyleTag[] };
				if (Array.isArray(data.tags) && data.tags.length > 0) {
					this.available = data.tags;
				}
			}
		} catch {
			// swallow fetch errors
		}
	};
}

export const styles = new StyleStore();
export const styleStore = styles;
export default styles;
