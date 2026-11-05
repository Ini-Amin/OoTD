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

export type NewOutfitPiece = {
	category: string;
	label: string;
	box: { x: number; y: number; w: number; h: number };
};

export type NewOutfitPayload = {
	title: string;
	caption: string;
	tags: string[];
	accent: string;
	pieces: NewOutfitPiece[];
	imageUrl?: string;
};

export type CreateOutfitResult =
	| { ok: true; outfit: Outfit }
	| { ok: false; error: string; status: number };

/** POST /v1/outfits. Error strings mirror the /new form messages. */
export async function createOutfit(
	payload: NewOutfitPayload,
	token: string
): Promise<CreateOutfitResult> {
	try {
		const res = await fetch(`${apiBase}/v1/outfits`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(payload)
		});
		if (res.status === 201) {
			const data = (await res.json().catch(() => null)) as { outfit?: Outfit } | null;
			if (data?.outfit && typeof data.outfit.id === 'string') {
				return { ok: true, outfit: data.outfit };
			}
			return { ok: false, error: 'Server error (201).', status: 201 };
		}
		if (res.status === 401) {
			return { ok: false, error: 'Your session expired. Sign in again.', status: 401 };
		}
		if (res.status === 400 || res.status === 404) {
			const data = (await res.json().catch(() => ({}))) as { error?: string };
			return { ok: false, error: data.error ?? 'Validation failed.', status: res.status };
		}
		return { ok: false, error: `Server error (${res.status}).`, status: res.status };
	} catch {
		return { ok: false, error: 'Network error: could not submit outfit.', status: 0 };
	}
}

export type UploadImageResult =
	| { ok: true; imageUrl: string }
	| { ok: false; error: string; status: number };

/** POST /v1/uploads (multipart `file` field). Error strings mirror the /new form. */
export async function uploadOutfitImage(
	blob: Blob,
	token: string
): Promise<UploadImageResult> {
	try {
		const form = new FormData();
		form.append('file', blob, 'try-on.png');
		const res = await fetch(`${apiBase}/v1/uploads`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}` },
			body: form
		});
		if (res.status === 503) {
			return { ok: false, error: 'Uploads are not configured on the server.', status: 503 };
		}
		if (res.status === 401) {
			return { ok: false, error: 'Your session expired. Sign in again.', status: 401 };
		}
		if (res.status === 429) {
			return { ok: false, error: 'Too many uploads. Try again in a bit.', status: 429 };
		}
		if (!res.ok) {
			const data = (await res.json().catch(() => null)) as { error?: string } | null;
			return { ok: false, error: data?.error ?? `Upload failed (${res.status}).`, status: res.status };
		}
		const data = (await res.json()) as { imageUrl?: string };
		if (typeof data.imageUrl === 'string' && data.imageUrl.length > 0) {
			return { ok: true, imageUrl: data.imageUrl };
		}
		return { ok: false, error: 'Upload failed.', status: res.status };
	} catch {
		return { ok: false, error: 'Upload failed. Check your connection and try again.', status: 0 };
	}
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
,
	{
		id: 'look-015',
		creator: 'Fitri E.',
		handle: '@fitrie',
		title: 'Hijab casual harian',
		caption: 'Woman in hijab sitting on a wooden bench in a tranquil park,.',
		tags: ['Hijab', 'Casual'],
		accent: '#7ba7cc',
		savedBy: 32,
		imageUrl: 'https://images.pexels.com/photos/12055314/pexels-photo-12055314.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-016',
		creator: 'Nabila R.',
		handle: '@nabilar',
		title: 'Hijab casual harian',
		caption: 'Confident woman in stylish hijab posing outdoors.',
		tags: ['Hijab', 'Casual'],
		accent: '#9db8d2',
		savedBy: 145,
		imageUrl: 'https://images.pexels.com/photos/33519724/pexels-photo-33519724.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-017',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Hijab street look',
		caption: 'Stylish woman in hijab standing on an escalator in a modern .',
		tags: ['Hijab', 'Streetwear'],
		accent: '#f2c94c',
		savedBy: 72,
		imageUrl: 'https://images.pexels.com/photos/20433552/pexels-photo-20433552.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-018',
		creator: 'Fitri E.',
		handle: '@fitrie',
		title: 'Elegant hijab formal',
		caption: 'Elegant woman in hijab standing on stone steps.',
		tags: ['Hijab', 'Elegant'],
		accent: '#a8a56d',
		savedBy: 236,
		imageUrl: 'https://images.pexels.com/photos/36168986/pexels-photo-36168986.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-019',
		creator: 'Nadia S.',
		handle: '@nadiastyle',
		title: 'Hijab casual harian',
		caption: 'Fashionable woman in hijab against a rustic wooden backdrop.',
		tags: ['Hijab', 'Casual'],
		accent: '#e8b86d',
		savedBy: 67,
		imageUrl: 'https://images.pexels.com/photos/39221178/pexels-photo-39221178.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-020',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Hijab casual harian',
		caption: 'Woman in red hijab and floral garment, elegant traditional f.',
		tags: ['Hijab', 'Traditional'],
		accent: '#d4728e',
		savedBy: 278,
		imageUrl: 'https://images.pexels.com/photos/36204399/pexels-photo-36204399.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-021',
		creator: 'Lina H.',
		handle: '@linah',
		title: 'Hijab casual harian',
		caption: 'Two young women in hijabs enjoying coffee in a city park.',
		tags: ['Hijab', 'Casual'],
		accent: '#e8b86d',
		savedBy: 121,
		imageUrl: 'https://images.pexels.com/photos/8640242/pexels-photo-8640242.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-022',
		creator: 'Nabila R.',
		handle: '@nabilar',
		title: 'Hijab casual harian',
		caption: 'Portrait of two women in colorful hijabs.',
		tags: ['Hijab', 'Portrait'],
		accent: '#f5d547',
		savedBy: 132,
		imageUrl: 'https://images.pexels.com/photos/38244095/pexels-photo-38244095.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-023',
		creator: 'Rina K.',
		handle: '@rinak',
		title: 'Hijab street look',
		caption: 'Two stylish women in hijabs enjoying a day out, urban fashio.',
		tags: ['Hijab', 'Streetwear'],
		accent: '#9db8d2',
		savedBy: 23,
		imageUrl: 'https://images.pexels.com/photos/17299345/pexels-photo-17299345.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-024',
		creator: 'Zahra Q.',
		handle: '@zahraq',
		title: 'Hijab street look',
		caption: 'Two fashionable women in hijabs posing confidently in an urb.',
		tags: ['Hijab', 'Streetwear'],
		accent: '#6b8cae',
		savedBy: 236,
		imageUrl: 'https://images.pexels.com/photos/8744534/pexels-photo-8744534.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-025',
		creator: 'Dewi L.',
		handle: '@dewil',
		title: 'Hijab casual harian',
		caption: 'Elegant portrait of two women in hijabs and stylish outfits,.',
		tags: ['Hijab', 'Studio'],
		accent: '#9db8d2',
		savedBy: 99,
		imageUrl: 'https://images.pexels.com/photos/8217881/pexels-photo-8217881.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-026',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Hijab casual harian',
		caption: 'Woman in hijab selecting clothes from a rack, stylish room.',
		tags: ['Hijab', 'Casual'],
		accent: '#555555',
		savedBy: 72,
		imageUrl: 'https://images.pexels.com/photos/9218421/pexels-photo-9218421.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-027',
		creator: 'Putri A.',
		handle: '@putriaw',
		title: 'Hijab street look',
		caption: 'Stylish individual in contemporary fashion with hijab, indoo.',
		tags: ['Hijab', 'Streetwear'],
		accent: '#4a6fa5',
		savedBy: 69,
		imageUrl: 'https://images.pexels.com/photos/8070633/pexels-photo-8070633.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-028',
		creator: 'Dewi L.',
		handle: '@dewil',
		title: 'Hijab casual harian',
		caption: 'Smiling woman in hijab sitting on a park bench, modern fashi.',
		tags: ['Hijab', 'Casual'],
		accent: '#8b2e2e',
		savedBy: 155,
		imageUrl: 'https://images.pexels.com/photos/12055317/pexels-photo-12055317.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-029',
		creator: 'Zahra Q.',
		handle: '@zahraq',
		title: 'Street fit',
		caption: 'Stylish woman in leather jacket strutting on a bustling urba.',
		tags: ['Streetwear', 'Casual'],
		accent: '#8da8c7',
		savedBy: 255,
		imageUrl: 'https://images.pexels.com/photos/19269886/pexels-photo-19269886.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-030',
		creator: 'Maya T.',
		handle: '@mayat',
		title: 'Street fit',
		caption: 'Young woman in red coat posing confidently in an urban setti.',
		tags: ['Streetwear', 'Formal'],
		accent: '#7ba7cc',
		savedBy: 213,
		imageUrl: 'https://images.pexels.com/photos/6190297/pexels-photo-6190297.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-031',
		creator: 'Putri A.',
		handle: '@putriaw',
		title: 'Street fit',
		caption: 'Woman in black coat walking confidently on a street in Istan.',
		tags: ['Streetwear', 'Casual'],
		accent: '#b0b0b0',
		savedBy: 205,
		imageUrl: 'https://images.pexels.com/photos/20064883/pexels-photo-20064883.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-032',
		creator: 'Lina H.',
		handle: '@linah',
		title: 'Street fit',
		caption: 'Stylish woman in urban street fashion setting.',
		tags: ['Streetwear', 'Casual'],
		accent: '#e8913a',
		savedBy: 55,
		imageUrl: 'https://images.pexels.com/photos/29336548/pexels-photo-29336548.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-033',
		creator: 'Nadia S.',
		handle: '@nadiastyle',
		title: 'Street fit',
		caption: 'Woman with bucket hat and leopard print bag, street fashion.',
		tags: ['Streetwear', 'Casual'],
		accent: '#d4728e',
		savedBy: 168,
		imageUrl: 'https://images.pexels.com/photos/5030327/pexels-photo-5030327.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-034',
		creator: 'Putri A.',
		handle: '@putriaw',
		title: 'Street fit',
		caption: 'Woman in black dress crossing a street in New York City.',
		tags: ['Streetwear', 'Formal'],
		accent: '#d4728e',
		savedBy: 71,
		imageUrl: 'https://images.pexels.com/photos/20601205/pexels-photo-20601205.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-035',
		creator: 'Ayu N.',
		handle: '@ayun',
		title: 'Street fit',
		caption: 'Elegant woman in sunglasses posing in an urban setting.',
		tags: ['Streetwear', 'Casual'],
		accent: '#9db8d2',
		savedBy: 252,
		imageUrl: 'https://images.pexels.com/photos/7060330/pexels-photo-7060330.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-036',
		creator: 'Fitri E.',
		handle: '@fitrie',
		title: 'Street fit',
		caption: 'Confident woman in modern attire walking outdoors, chic vibe.',
		tags: ['Streetwear', 'Casual'],
		accent: '#8b2e2e',
		savedBy: 103,
		imageUrl: 'https://images.pexels.com/photos/11311403/pexels-photo-11311403.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-037',
		creator: 'Dewi L.',
		handle: '@dewil',
		title: 'Editorial look',
		caption: 'Woman in red suit posing with St. Petersburg architecture.',
		tags: ['Formal', 'Editorial'],
		accent: '#8b2e2e',
		savedBy: 127,
		imageUrl: 'https://images.pexels.com/photos/4937443/pexels-photo-4937443.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-038',
		creator: 'Fitri E.',
		handle: '@fitrie',
		title: 'Summer casual',
		caption: 'Smiling woman in pink shirt and white skirt on a sunny day.',
		tags: ['Casual', 'Summer'],
		accent: '#9db8d2',
		savedBy: 56,
		imageUrl: 'https://images.pexels.com/photos/39030338/pexels-photo-39030338.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-039',
		creator: 'Lina H.',
		handle: '@linah',
		title: 'Summer casual',
		caption: 'Young woman in denim shorts and sunglasses on a city sidewal.',
		tags: ['Casual', 'Summer'],
		accent: '#6b8cae',
		savedBy: 293,
		imageUrl: 'https://images.pexels.com/photos/6372116/pexels-photo-6372116.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-040',
		creator: 'Nabila R.',
		handle: '@nabilar',
		title: 'Summer casual',
		caption: 'Young woman in green dress with brown sling bag on a sunny s.',
		tags: ['Casual', 'Summer'],
		accent: '#d4728e',
		savedBy: 103,
		imageUrl: 'https://images.pexels.com/photos/12572689/pexels-photo-12572689.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-041',
		creator: 'Rina K.',
		handle: '@rinak',
		title: 'Street fit',
		caption: 'Young woman in trendy outfit posing outdoors.',
		tags: ['Casual', 'Streetwear'],
		accent: '#4a6fa5',
		savedBy: 158,
		imageUrl: 'https://images.pexels.com/photos/15910674/pexels-photo-15910674.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-042',
		creator: 'Sekar J.',
		handle: '@sekarj',
		title: 'Summer casual',
		caption: 'Woman in dress sitting on a wooden pier over water.',
		tags: ['Casual', 'Summer'],
		accent: '#d4728e',
		savedBy: 186,
		imageUrl: 'https://images.pexels.com/photos/17128273/pexels-photo-17128273.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-043',
		creator: 'Kirana W.',
		handle: '@kiranaw',
		title: 'Daily outfit',
		caption: 'Woman in casual dress near a contemporary building entrance.',
		tags: ['Casual'],
		accent: '#8da8c7',
		savedBy: 137,
		imageUrl: 'https://images.pexels.com/photos/4219913/pexels-photo-4219913.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-044',
		creator: 'Kirana W.',
		handle: '@kiranaw',
		title: 'Summer casual',
		caption: 'Woman posing confidently on a sunny city sidewalk.',
		tags: ['Casual', 'Summer'],
		accent: '#8da8c7',
		savedBy: 181,
		imageUrl: 'https://images.pexels.com/photos/4945037/pexels-photo-4945037.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-045',
		creator: 'Irfan D.',
		handle: '@irfand',
		title: 'Sharp suit',
		caption: 'Man adjusting dark jacket, wristwatch visible.',
		tags: ['Menswear', 'Formal'],
		accent: '#9db8d2',
		savedBy: 53,
		imageUrl: 'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-046',
		creator: 'Fajar H.',
		handle: '@fajarh',
		title: 'Office ready',
		caption: 'Man in light blue shirt and dark tie holding grey blazer.',
		tags: ['Menswear', 'Formal', 'Office'],
		accent: '#555555',
		savedBy: 128,
		imageUrl: 'https://images.unsplash.com/photo-1594938291221-94f18cbb5660?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-047',
		creator: 'Joko S.',
		handle: '@jokos',
		title: 'Street fit',
		caption: 'Man in black leather jacket and sunglasses crouching on roof.',
		tags: ['Menswear', 'Streetwear'],
		accent: '#4a6fa5',
		savedBy: 254,
		imageUrl: 'https://images.unsplash.com/photo-1520975954732-35dd22299614?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-048',
		creator: 'Eko R.',
		handle: '@ekor',
		title: 'Sharp suit',
		caption: 'Man in navy blue suit walking, full body.',
		tags: ['Menswear', 'Formal', 'Suit'],
		accent: '#9db8d2',
		savedBy: 91,
		imageUrl: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-049',
		creator: 'Fajar H.',
		handle: '@fajarh',
		title: 'Mens casual',
		caption: 'Man in denim jacket over floral shirt.',
		tags: ['Menswear', 'Casual', 'Denim'],
		accent: '#9db8d2',
		savedBy: 239,
		imageUrl: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-050',
		creator: 'Yoga P.',
		handle: '@yogap',
		title: 'Sharp suit',
		caption: 'Flat lay: dark jeans, white shirt, black tie, tan blazer.',
		tags: ['Menswear', 'Formal'],
		accent: '#4a6fa5',
		savedBy: 205,
		imageUrl: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-051',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Siap kondangan',
		caption: 'Woman twirling in flowing red evening gown outdoors.',
		tags: ['Formal', 'Kondangan', 'Gown'],
		accent: '#f2c94c',
		savedBy: 280,
		imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-052',
		creator: 'Rina K.',
		handle: '@rinak',
		title: 'Siap kondangan',
		caption: 'Woman in purple off-shoulder evening gown.',
		tags: ['Formal', 'Kondangan', 'Gown'],
		accent: '#a8a56d',
		savedBy: 44,
		imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-053',
		creator: 'Kirana W.',
		handle: '@kiranaw',
		title: 'Street fit',
		caption: 'Woman in yellow cropped hoodie and matching sweatpants.',
		tags: ['Streetwear', 'Casual'],
		accent: '#7ba7cc',
		savedBy: 98,
		imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-054',
		creator: 'Fitri E.',
		handle: '@fitrie',
		title: 'Street fit',
		caption: 'Woman in white top and striped wide-leg trousers.',
		tags: ['Casual', 'Streetwear'],
		accent: '#6b8cae',
		savedBy: 236,
		imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-055',
		creator: 'Lina H.',
		handle: '@linah',
		title: 'Summer casual',
		caption: 'Woman in white floral summer dress by the sea.',
		tags: ['Casual', 'Summer', 'Dress'],
		accent: '#a8a56d',
		savedBy: 217,
		imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-056',
		creator: 'Ayu N.',
		handle: '@ayun',
		title: 'Daily outfit',
		caption: 'Woman in dark plaid coat with burgundy handbag.',
		tags: ['Casual'],
		accent: '#c97b84',
		savedBy: 290,
		imageUrl: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-057',
		creator: 'Sinta M.',
		handle: '@sintam',
		title: 'Daily outfit',
		caption: 'Dusty pink jogger pants with strappy heels.',
		tags: ['Casual'],
		accent: '#e8b86d',
		savedBy: 78,
		imageUrl: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-058',
		creator: 'Fitri E.',
		handle: '@fitrie',
		title: 'Daily outfit',
		caption: 'Woman in pink ruffled off-shoulder dress in a field.',
		tags: ['Formal', 'Dress'],
		accent: '#9db8d2',
		savedBy: 194,
		imageUrl: 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-059',
		creator: 'Bimo S.',
		handle: '@bimos',
		title: 'Street fit',
		caption: 'Man in black leather jacket leaning on vintage red car.',
		tags: ['Menswear', 'Streetwear'],
		accent: '#b0b0b0',
		savedBy: 242,
		imageUrl: 'https://images.unsplash.com/photo-1520975661595-6453be3f7070?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-060',
		creator: 'Eko R.',
		handle: '@ekor',
		title: 'Sharp suit',
		caption: 'Man adjusting dark suit jacket and tie.',
		tags: ['Menswear', 'Formal', 'Suit'],
		accent: '#c97b84',
		savedBy: 21,
		imageUrl: 'https://images.unsplash.com/photo-1610652492500-ded49ceeb378?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-061',
		creator: 'Gilang T.',
		handle: '@gilangt',
		title: 'Street fit',
		caption: 'Man in black and yellow track jacket, streetwear.',
		tags: ['Menswear', 'Streetwear'],
		accent: '#6b8cae',
		savedBy: 279,
		imageUrl: 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-062',
		creator: 'Bimo S.',
		handle: '@bimos',
		title: 'Street fit',
		caption: 'Man in white hoodie and black pants against orange wall.',
		tags: ['Menswear', 'Streetwear', 'Casual'],
		accent: '#b0b0b0',
		savedBy: 279,
		imageUrl: 'https://images.unsplash.com/photo-1550246140-29f40b909e5a?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-063',
		creator: 'Yoga P.',
		handle: '@yogap',
		title: 'Street fit',
		caption: 'Man in black leather jacket and white t-shirt.',
		tags: ['Menswear', 'Streetwear', 'Casual'],
		accent: '#e8913a',
		savedBy: 98,
		imageUrl: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-064',
		creator: 'Dewi L.',
		handle: '@dewil',
		title: 'Siap kondangan',
		caption: 'Woman in black strapless evening gown.',
		tags: ['Formal', 'Kondangan', 'Gown'],
		accent: '#6b8cae',
		savedBy: 296,
		imageUrl: 'https://images.pexels.com/photos/32651798/pexels-photo-32651798.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-065',
		creator: 'Zahra Q.',
		handle: '@zahraq',
		title: 'Siap kondangan',
		caption: 'Woman in flowing yellow evening gown.',
		tags: ['Formal', 'Kondangan', 'Gown'],
		accent: '#e8b86d',
		savedBy: 185,
		imageUrl: 'https://images.pexels.com/photos/13715663/pexels-photo-13715663.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-066',
		creator: 'Rina K.',
		handle: '@rinak',
		title: 'Siap kondangan',
		caption: 'Woman in pink off-shoulder slit evening gown.',
		tags: ['Formal', 'Kondangan', 'Gown'],
		accent: '#e8b86d',
		savedBy: 77,
		imageUrl: 'https://images.pexels.com/photos/19316404/pexels-photo-19316404.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-067',
		creator: 'Sekar J.',
		handle: '@sekarj',
		title: 'Siap kondangan',
		caption: 'Woman in burgundy formal dress with shawl.',
		tags: ['Formal', 'Kondangan'],
		accent: '#8b2e2e',
		savedBy: 177,
		imageUrl: 'https://images.pexels.com/photos/34011662/pexels-photo-34011662.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-068',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Siap kondangan',
		caption: 'Woman in purple embellished gown with tiara.',
		tags: ['Formal', 'Kondangan', 'Gown'],
		accent: '#8da8c7',
		savedBy: 143,
		imageUrl: 'https://images.pexels.com/photos/29352052/pexels-photo-29352052.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-069',
		creator: 'Sekar J.',
		handle: '@sekarj',
		title: 'Siap kondangan',
		caption: 'Woman in pink lavish gown under stone archway.',
		tags: ['Formal', 'Kondangan', 'Gown'],
		accent: '#a8a56d',
		savedBy: 63,
		imageUrl: 'https://images.pexels.com/photos/31646628/pexels-photo-31646628.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-070',
		creator: 'Nabila R.',
		handle: '@nabilar',
		title: 'Siap kondangan',
		caption: 'Woman in yellow luxury gown with bow detail.',
		tags: ['Formal', 'Kondangan', 'Gown'],
		accent: '#7d9b76',
		savedBy: 55,
		imageUrl: 'https://images.pexels.com/photos/13364868/pexels-photo-13364868.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-071',
		creator: 'Rizky A.',
		handle: '@rizkya',
		title: 'Batik modern',
		caption: 'Young man in blue traditional batik shirt.',
		tags: ['Menswear', 'Batik', 'Formal'],
		accent: '#f2c94c',
		savedBy: 85,
		imageUrl: 'https://images.pexels.com/photos/34402673/pexels-photo-34402673.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-072',
		creator: 'Joko S.',
		handle: '@jokos',
		title: 'Batik modern',
		caption: 'Young man in batik shirt with arms crossed.',
		tags: ['Menswear', 'Batik', 'Formal'],
		accent: '#6b8cae',
		savedBy: 155,
		imageUrl: 'https://images.pexels.com/photos/34402660/pexels-photo-34402660.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-073',
		creator: 'Rizky A.',
		handle: '@rizkya',
		title: 'Siap kondangan',
		caption: 'Couple in traditional batik attire in pine forest.',
		tags: ['Batik', 'Formal', 'Kondangan'],
		accent: '#f5d547',
		savedBy: 128,
		imageUrl: 'https://images.pexels.com/photos/7440040/pexels-photo-7440040.jpeg?auto=compress&cs=tinysrgb&w=800',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-074',
		creator: 'Rizky A.',
		handle: '@rizkya',
		title: 'Sharp suit',
		caption: 'Man in dark suit with red tie.',
		tags: ['Menswear', 'Formal'],
		accent: '#e8913a',
		savedBy: 179,
		imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-075',
		creator: 'Ayu N.',
		handle: '@ayun',
		title: 'Street fit',
		caption: 'Woman in 80s-style outfit with rollerskates, retro vibe.',
		tags: ['Vintage', 'Retro', 'Streetwear'],
		accent: '#8b2e2e',
		savedBy: 244,
		imageUrl: 'https://images.unsplash.com/photo-1531923361649-96d191cf56ae?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-076',
		creator: 'Sekar J.',
		handle: '@sekarj',
		title: 'Less is more',
		caption: 'Minimalist neutral-tone outfit, clean aesthetic.',
		tags: ['Minimalist', 'Casual'],
		accent: '#c97b84',
		savedBy: 81,
		imageUrl: 'https://images.unsplash.com/photo-1541377182189-74e4a4ea12e5?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-077',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Editorial look',
		caption: 'Two women in bold tiger-print African dresses, runway editor.',
		tags: ['Editorial', 'Formal'],
		accent: '#d4728e',
		savedBy: 52,
		imageUrl: 'https://images.unsplash.com/photo-1628941607952-84545ea86e46?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-078',
		creator: 'Dewi L.',
		handle: '@dewil',
		title: 'Summer casual',
		caption: 'Woman in floral summer dress, fashion shoot.',
		tags: ['Summer', 'Dress', 'Casual'],
		accent: '#e8b86d',
		savedBy: 137,
		imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-079',
		creator: 'Lina H.',
		handle: '@linah',
		title: 'Street fit',
		caption: 'Woman with sunglasses in stylish outfit against yellow backg.',
		tags: ['Editorial', 'Streetwear'],
		accent: '#d4728e',
		savedBy: 23,
		imageUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-080',
		creator: 'Putri A.',
		handle: '@putriaw',
		title: 'Summer casual',
		caption: 'Woman twirling in a dress, joyful motion shot.',
		tags: ['Dress', 'Casual', 'Summer'],
		accent: '#8da8c7',
		savedBy: 137,
		imageUrl: 'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-081',
		creator: 'Putri A.',
		handle: '@putriaw',
		title: 'Street fit',
		caption: 'Woman in mustard yellow coat, minimalist street style.',
		tags: ['Minimalist', 'Streetwear'],
		accent: '#8da8c7',
		savedBy: 189,
		imageUrl: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-082',
		creator: 'Putri A.',
		handle: '@putriaw',
		title: 'Street fit',
		caption: 'Woman in yellow coat, vintage-inspired street fashion.',
		tags: ['Vintage', 'Streetwear'],
		accent: '#d4728e',
		savedBy: 162,
		imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-083',
		creator: 'Fitri E.',
		handle: '@fitrie',
		title: 'Vintage vibes',
		caption: 'Woman in autumn coat, classic fall fashion look.',
		tags: ['Vintage', 'Formal'],
		accent: '#7d9b76',
		savedBy: 129,
		imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-084',
		creator: 'Maya T.',
		handle: '@mayat',
		title: 'Vintage vibes',
		caption: 'Woman in red floral vintage-style dress with wide belt.',
		tags: ['Vintage', 'Formal', 'Dress'],
		accent: '#f2c94c',
		savedBy: 262,
		imageUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-085',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Daily outfit',
		caption: 'Denim button-front shirt dress, casual.',
		tags: ['Denim', 'Dress', 'Casual'],
		accent: '#7d9b76',
		savedBy: 228,
		imageUrl: 'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-086',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Vintage vibes',
		caption: 'Woman in black ruffled coat and wide-brimmed hat.',
		tags: ['Editorial', 'Vintage'],
		accent: '#7ba7cc',
		savedBy: 69,
		imageUrl: 'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-087',
		creator: 'Fitri E.',
		handle: '@fitrie',
		title: 'Editorial look',
		caption: 'Woman in royal blue lace dress with side cutouts.',
		tags: ['Formal', 'Dress', 'Editorial'],
		accent: '#f5d547',
		savedBy: 201,
		imageUrl: 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-088',
		creator: 'Ayu N.',
		handle: '@ayun',
		title: 'Vintage vibes',
		caption: 'Woman in chevron knit sweater and knee-high boots.',
		tags: ['Vintage', 'Casual'],
		accent: '#f5d547',
		savedBy: 259,
		imageUrl: 'https://images.unsplash.com/photo-1475180098004-ca77a66827be?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-089',
		creator: 'Kirana W.',
		handle: '@kiranaw',
		title: 'Editorial look',
		caption: 'Two women in sparkling red sequin outfits, desert editorial.',
		tags: ['Formal', 'Editorial'],
		accent: '#8da8c7',
		savedBy: 70,
		imageUrl: 'https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-090',
		creator: 'Nadia S.',
		handle: '@nadiastyle',
		title: 'Less is more',
		caption: 'Woman in white crop top and jeans against pink wall.',
		tags: ['Minimalist', 'Casual', 'Denim'],
		accent: '#4a6fa5',
		savedBy: 193,
		imageUrl: 'https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-091',
		creator: 'Zahra Q.',
		handle: '@zahraq',
		title: 'Street fit',
		caption: 'Woman in oversized red sweatshirt.',
		tags: ['Streetwear', 'Casual'],
		accent: '#7ba7cc',
		savedBy: 147,
		imageUrl: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-092',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Less is more',
		caption: 'Woman in white off-shoulder ruffle dress and sneakers.',
		tags: ['Minimalist', 'Dress', 'Summer'],
		accent: '#e8913a',
		savedBy: 294,
		imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-093',
		creator: 'Rina K.',
		handle: '@rinak',
		title: 'Less is more',
		caption: 'Business woman in grey blazer holding laptop.',
		tags: ['Formal', 'Office', 'Minimalist'],
		accent: '#f2c94c',
		savedBy: 236,
		imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-094',
		creator: 'Intan P.',
		handle: '@intanp',
		title: 'Vintage vibes',
		caption: 'Woman in red polka-dot midi dress in golden field.',
		tags: ['Vintage', 'Dress'],
		accent: '#9db8d2',
		savedBy: 256,
		imageUrl: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-095',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Vintage vibes',
		caption: 'Woman in white shirt and pleated beige skirt, vintage studio.',
		tags: ['Vintage', 'Editorial', 'Formal'],
		accent: '#a8a56d',
		savedBy: 246,
		imageUrl: 'https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-096',
		creator: 'Zahra Q.',
		handle: '@zahraq',
		title: 'Editorial look',
		caption: 'Black-and-white editorial, woman in dark dress.',
		tags: ['Editorial', 'Dress'],
		accent: '#7ba7cc',
		savedBy: 45,
		imageUrl: 'https://images.unsplash.com/photo-1633381521050-26bb467d9d5a?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-097',
		creator: 'Fitri E.',
		handle: '@fitrie',
		title: 'Siap kondangan',
		caption: 'Woman in striking red long-sleeve dress, studio.',
		tags: ['Formal', 'Editorial', 'Gown'],
		accent: '#e8b86d',
		savedBy: 67,
		imageUrl: 'https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-098',
		creator: 'Sekar J.',
		handle: '@sekarj',
		title: 'Less is more',
		caption: 'Woman in black crop top and beige wrap midi skirt.',
		tags: ['Minimalist', 'Summer', 'Casual'],
		accent: '#d4728e',
		savedBy: 105,
		imageUrl: 'https://images.unsplash.com/photo-1592301933927-35b597393c0a?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-099',
		creator: 'Ayu N.',
		handle: '@ayun',
		title: 'Siap kondangan',
		caption: 'Woman twirling in dramatic red evening gown.',
		tags: ['Formal', 'Gown', 'Elegant'],
		accent: '#7d9b76',
		savedBy: 266,
		imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-100',
		creator: 'Wulan D.',
		handle: '@wuland',
		title: 'Less is more',
		caption: 'Woman in flowing white dress, elegant.',
		tags: ['Formal', 'Dress', 'Minimalist'],
		accent: '#4a6fa5',
		savedBy: 50,
		imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-101',
		creator: 'Intan P.',
		handle: '@intanp',
		title: 'Street fit',
		caption: 'Woman in white top and striped wide-leg pants, red bag.',
		tags: ['Editorial', 'Streetwear'],
		accent: '#4a6fa5',
		savedBy: 21,
		imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-102',
		creator: 'Ayu N.',
		handle: '@ayun',
		title: 'Editorial look',
		caption: 'Woman in pink ruffled dress in golden field.',
		tags: ['Editorial', 'Dress'],
		accent: '#9db8d2',
		savedBy: 252,
		imageUrl: 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-103',
		creator: 'Sinta M.',
		handle: '@sintam',
		title: 'Street fit',
		caption: 'Woman in dark plaid coat with burgundy bag.',
		tags: ['Vintage', 'Streetwear'],
		accent: '#f5d547',
		savedBy: 269,
		imageUrl: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
	{
		id: 'look-104',
		creator: 'Intan P.',
		handle: '@intanp',
		title: 'Less is more',
		caption: 'Dusty pink joggers with heeled sandals.',
		tags: ['Minimalist', 'Casual'],
		accent: '#e8913a',
		savedBy: 171,
		imageUrl: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&q=80&auto=format&fit=crop',
		imageWidth: 800,
		imageHeight: 1000
	},
];
