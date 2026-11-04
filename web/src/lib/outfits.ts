import type { Piece } from '$lib/pieces';

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
	/** Tagged pieces; only present on GET /v1/outfits/{id}. */
	pieces?: Piece[];
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
		title: 'Hijab street style: leather jacket',
		caption: 'Beige hijab + black leather jacket. Edgy tapi tetap modest buat jalan sore.',
		tags: ['Hijab', 'Streetwear'],
		accent: '#e8b86d',
		savedBy: 128,
		imageUrl: 'https://images.pexels.com/photos/31861865/pexels-photo-31861865.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-002',
		creator: 'Salsabila F.',
		handle: '@salsabilaf',
		title: 'Ngopi santai',
		caption: 'Hijab casual buat nongkrong di coffee shop. Simple, nyaman, tetap stylish.',
		tags: ['Hijab', 'Casual'],
		accent: '#8da8c7',
		savedBy: 94,
		imageUrl: 'https://images.pexels.com/photos/31861864/pexels-photo-31861864.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-003',
		creator: 'Aisyah R.',
		handle: '@aisyahrahm',
		title: 'White abaya elegance',
		caption: 'Abaya putih buat acara formal. Clean, anggun, effortless.',
		tags: ['Hijab', 'Formal', 'Modest'],
		accent: '#a8a56d',
		savedBy: 203,
		imageUrl: 'https://images.pexels.com/photos/31049717/pexels-photo-31049717.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-004',
		creator: 'Dinda P.',
		handle: '@dindaputri',
		title: 'Denim on denim + headscarf',
		caption: 'Denim jacket ketemu headscarf. Streetwear hijab yang nggak ngebosenin.',
		tags: ['Hijab', 'Streetwear', 'Denim'],
		accent: '#7ba7cc',
		savedBy: 87,
		imageUrl: 'https://images.pexels.com/photos/3427560/pexels-photo-3427560.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-005',
		creator: 'Maya K.',
		handle: '@mayakusuma',
		title: 'Yellow top summer mood',
		caption: 'Atasan kuning + jeans buat cuaca cerah. Anti bad mood.',
		tags: ['Casual', 'Summer'],
		accent: '#f2c94c',
		savedBy: 156,
		imageUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-006',
		creator: 'Raka Pratama',
		handle: '@rakaprata',
		title: 'Denim street fit',
		caption: 'Full denim buat jalan-jalan. Layering simpel yang selalu works.',
		tags: ['Streetwear', 'Denim'],
		accent: '#6b8cae',
		savedBy: 112,
		imageUrl: 'https://images.unsplash.com/photo-1495385794356-15371f348c31?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-007',
		creator: 'Tania W.',
		handle: '@taniawijaya',
		title: 'Shopping day energy',
		caption: 'Outfit belanja: nyaman buat jalan seharian, tetap photogenic.',
		tags: ['Streetwear', 'Casual'],
		accent: '#e8913a',
		savedBy: 78,
		imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-008',
		creator: 'Rani S.',
		handle: '@ranisafitri',
		title: 'Kondangan: floral maxi dress',
		caption: 'Maxi dress floral pink-hitam + heels. Siap kondangan tanpa ribet.',
		tags: ['Formal', 'Kondangan', 'Dress'],
		accent: '#d4728e',
		savedBy: 245,
		imageUrl: 'https://images.unsplash.com/photo-1622122201714-77da0ca8e5d2?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-009',
		creator: 'Elena M.',
		handle: '@elenamarsh',
		title: 'City coat editorial',
		caption: 'Long coat + white boots. Buat yang suka tampil statement.',
		tags: ['Formal', 'Editorial'],
		accent: '#9db8d2',
		savedBy: 189,
		imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-010',
		creator: 'Bagas A.',
		handle: '@bagasarya',
		title: 'White tee minimal',
		caption: 'Kaos putih polos. Kadang yang paling simpel itu yang paling susah dikalahin.',
		tags: ['Casual', 'Menswear', 'Minimal'],
		accent: '#b0b0b0',
		savedBy: 67,
		imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-011',
		creator: 'Dimas R.',
		handle: '@dimasramadhan',
		title: 'Streetwear harian',
		caption: 'Black jacket + sneakers putih. Uniform anak kota.',
		tags: ['Streetwear', 'Menswear'],
		accent: '#555555',
		savedBy: 134,
		imageUrl: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-012',
		creator: 'Fajar N.',
		handle: '@fajarnugroho',
		title: 'Suit up: kondangan formal',
		caption: 'Dark suit + dasi merah. Rapi maksimal buat acara resmi.',
		tags: ['Formal', 'Menswear', 'Kondangan'],
		accent: '#8b2e2e',
		savedBy: 178,
		imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-013',
		creator: 'Galih P.',
		handle: '@galihpermana',
		title: 'Three-piece checkered suit',
		caption: 'Setelan kotak-kotak biru. Buat yang mau beda dari suit hitam pasaran.',
		tags: ['Formal', 'Menswear', 'Suit'],
		accent: '#4a6fa5',
		savedBy: 91,
		imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-014',
		creator: 'Laras A.',
		handle: '@larasati',
		title: 'Summer yellow casual',
		caption: 'Atasan kuning cerah buat weekend. Simpel tapi standout.',
		tags: ['Casual', 'Summer'],
		accent: '#f5d547',
		savedBy: 103,
		imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	}
];
