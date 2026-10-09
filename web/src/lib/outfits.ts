export type Outfit = {
	id: string;
	creator: string;
	handle: string;
	title: string;
	caption: string;
	tags: string[];
	accent: string;
	savedBy: number;
	match?: number;
	imageUrl?: string;
	imageWidth?: number;
	imageHeight?: number;
};

export const apiBase: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export function ratioOf(o: Outfit): number {
	if (o.imageWidth && o.imageHeight && o.imageWidth > 0 && o.imageHeight > 0) {
		return o.imageWidth / o.imageHeight;
	}
	const fallbackRatios = [0.75, 0.8, 1, 0.667, 0.8, 0.6];
	let hash = 0;
	const id = o.id ?? '';
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
	}
	return fallbackRatios[hash % fallbackRatios.length];
}

export const previewOutfits: Outfit[] = [
	{
		id: 'look-001',
		creator: 'Nadya Aulia',
		handle: '@nadyaaulia',
		title: 'Soft layers for a rainy campus day',
		caption: 'Comfort first: oversized shirt, wide-leg trousers, and one bright detail.',
		tags: ['Campus', 'Minimal', 'Rainy day'],
		accent: '#e8b86d',
		savedBy: 128,
		imageUrl: 'https://picsum.photos/seed/rainy-campus/600/800',
		imageWidth: 600,
		imageHeight: 800
	},
	{
		id: 'look-002',
		creator: 'Raka Pratama',
		handle: '@rakaprata',
		title: 'One jacket, three moods',
		caption: 'A relaxed vintage layer that works for coffee, class, and a night out.',
		tags: ['Vintage', 'Streetwear', 'Layering'],
		accent: '#8da8c7',
		savedBy: 94,
		imageUrl: 'https://picsum.photos/seed/vintage-jacket/800/1000',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-003',
		creator: 'Salsabila F.',
		handle: '@salsabilaf',
		title: 'Everyday earth tones',
		caption: 'A calm palette for an easy, polished look without buying anything new.',
		tags: ['Modest', 'Earth tones', 'Everyday'],
		accent: '#a8a56d',
		savedBy: 203,
		imageUrl: 'https://picsum.photos/seed/earth-tones/600/900',
		imageWidth: 600,
		imageHeight: 900
	}
];
