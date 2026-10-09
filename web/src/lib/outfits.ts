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
};

export const previewOutfits: Outfit[] = [
	{
		id: 'look-001',
		creator: 'Nadya Aulia',
		handle: '@nadyaaulia',
		title: 'Soft layers for a rainy campus day',
		caption: 'Comfort first: oversized shirt, wide-leg trousers, and one bright detail.',
		tags: ['Campus', 'Minimal', 'Rainy day'],
		accent: '#e8b86d',
		savedBy: 128
	},
	{
		id: 'look-002',
		creator: 'Raka Pratama',
		handle: '@rakaprata',
		title: 'One jacket, three moods',
		caption: 'A relaxed vintage layer that works for coffee, class, and a night out.',
		tags: ['Vintage', 'Streetwear', 'Layering'],
		accent: '#8da8c7',
		savedBy: 94
	},
	{
		id: 'look-003',
		creator: 'Salsabila F.',
		handle: '@salsabilaf',
		title: 'Everyday earth tones',
		caption: 'A calm palette for an easy, polished look without buying anything new.',
		tags: ['Modest', 'Earth tones', 'Everyday'],
		accent: '#a8a56d',
		savedBy: 203
	}
];
