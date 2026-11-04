import type { Category, ClosetPiece } from '$lib/pieces';

export type MallSku = {
	id: string;
	label: string;
	category: Category;
	price: string;
	imageUrl: string;
};

export type MallStore = {
	id: string;
	name: string;
	kind: string;
	blurb: string;
	color: string;
	/** Floor-plan box in percent (0–100). */
	x: number;
	y: number;
	w: number;
	h: number;
	skus: MallSku[];
};

export type MallFriend = {
	id: string;
	name: string;
	storeId: string;
	note: string;
	hue: number;
};

function fabricSwatch(id: string, color: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
		<defs>
			<linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stop-color="${color}"/>
				<stop offset="100%" stop-color="#ffffff" stop-opacity="0.28"/>
			</linearGradient>
		</defs>
		<rect width="400" height="520" fill="#f4f1ec"/>
		<rect x="36" y="48" width="328" height="424" rx="28" fill="url(#g-${id})"/>
		<rect x="36" y="48" width="328" height="424" rx="28" fill="${color}" opacity="0.55"/>
	</svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function sku(
	storeId: string,
	id: string,
	label: string,
	category: Category,
	price: string,
	tone: string
): MallSku {
	const skuId = `${storeId}-${id}`;
	return {
		id: skuId,
		label,
		category,
		price,
		imageUrl: fabricSwatch(skuId, tone)
	};
}

export const mallStores: MallStore[] = [
	{
		id: 'zara',
		name: 'Zara',
		kind: 'Editorial',
		blurb: 'Tailored layers and city-ready silhouettes.',
		color: '#1a1a1a',
		x: 4,
		y: 6,
		w: 28,
		h: 20,
		skus: [
			sku('zara', 'blazer', 'Cropped blazer', 'top', 'Rp 899.000', '#2c2c2c'),
			sku('zara', 'trouser', 'Wide trousers', 'bottom', 'Rp 699.000', '#cbb79a'),
			sku('zara', 'heel', 'Sculpted heel', 'shoes', 'Rp 799.000', '#1f1f1f'),
			sku('zara', 'tote', 'Structured tote', 'bag', 'Rp 599.000', '#8a6a4b')
		]
	},
	{
		id: 'uniqlo',
		name: 'Uniqlo',
		kind: 'Basics',
		blurb: 'Everyday pieces you can restyle all week.',
		color: '#e10600',
		x: 36,
		y: 6,
		w: 28,
		h: 20,
		skus: [
			sku('uniqlo', 'airism', 'Airism tee', 'top', 'Rp 199.000', '#ece7dc'),
			sku('uniqlo', 'chino', 'Smart chinos', 'bottom', 'Rp 399.000', '#5c6b4a'),
			sku('uniqlo', 'sneaker', 'Canvas sneakers', 'shoes', 'Rp 449.000', '#f2f0ea'),
			sku('uniqlo', 'cap', 'Washed cap', 'hat', 'Rp 199.000', '#3d5a80')
		]
	},
	{
		id: 'hm',
		name: 'H&M',
		kind: 'Trend',
		blurb: 'Fast seasonal drops for campus and nights out.',
		color: '#e50010',
		x: 68,
		y: 6,
		w: 28,
		h: 20,
		skus: [
			sku('hm', 'cardigan', 'Soft cardigan', 'top', 'Rp 349.000', '#d9a5b3'),
			sku('hm', 'skirt', 'Pleated midi', 'bottom', 'Rp 429.000', '#2b2b2b'),
			sku('hm', 'boot', 'Chunky boots', 'shoes', 'Rp 549.000', '#4a3728'),
			sku('hm', 'scarf', 'Printed scarf', 'accessory', 'Rp 149.000', '#c45c26')
		]
	},
	{
		id: 'cottonon',
		name: 'Cotton On',
		kind: 'Casual',
		blurb: 'Relaxed denim, tees, and weekend layers.',
		color: '#1f4e79',
		x: 4,
		y: 40,
		w: 22,
		h: 18,
		skus: [
			sku('cottonon', 'hoodie', 'Campus hoodie', 'top', 'Rp 429.000', '#6b8cae'),
			sku('cottonon', 'jean', 'Mom jeans', 'bottom', 'Rp 499.000', '#3d4f6f'),
			sku('cottonon', 'slide', 'Soft slides', 'shoes', 'Rp 229.000', '#e8d9c8'),
			sku('cottonon', 'bucket', 'Bucket hat', 'hat', 'Rp 179.000', '#c4a35a')
		]
	},
	{
		id: 'erigo',
		name: 'Erigo',
		kind: 'Street',
		blurb: 'Indonesian streetwear for hangouts and travel.',
		color: '#111827',
		x: 29,
		y: 40,
		w: 20,
		h: 18,
		skus: [
			sku('erigo', 'overshirt', 'Park overshirt', 'top', 'Rp 329.000', '#1f2933'),
			sku('erigo', 'cargo', 'Cargo pants', 'bottom', 'Rp 359.000', '#4b5563'),
			sku('erigo', 'runner', 'City runners', 'shoes', 'Rp 389.000', '#111111'),
			sku('erigo', 'sling', 'Sling bag', 'bag', 'Rp 249.000', '#9a3412')
		]
	},
	{
		id: 'buttonscarves',
		name: 'Buttonscarves',
		kind: 'Modest',
		blurb: 'Hijab, modest sets, and polished accessories.',
		color: '#8b5e3c',
		x: 53,
		y: 40,
		w: 22,
		h: 18,
		skus: [
			sku('buttonscarves', 'blouse', 'Satin blouse', 'top', 'Rp 459.000', '#d7c4a3'),
			sku('buttonscarves', 'palazzo', 'Palazzo pants', 'bottom', 'Rp 429.000', '#3f2e22'),
			sku('buttonscarves', 'scarf', 'Square hijab', 'hat', 'Rp 249.000', '#8b5e3c'),
			sku('buttonscarves', 'brooch', 'Pearl brooch', 'accessory', 'Rp 129.000', '#e8dcc8')
		]
	},
	{
		id: 'nike',
		name: 'Nike',
		kind: 'Sport',
		blurb: 'Trainers and easy sport layers that still style out.',
		color: '#111111',
		x: 78,
		y: 40,
		w: 18,
		h: 18,
		skus: [
			sku('nike', 'tee', 'Dri-FIT tee', 'top', 'Rp 449.000', '#111111'),
			sku('nike', 'short', 'Training shorts', 'bottom', 'Rp 399.000', '#525252'),
			sku('nike', 'pegasus', 'Pegasus', 'shoes', 'Rp 1.799.000', '#f5f5f5'),
			sku('nike', 'cap', 'Heritage cap', 'hat', 'Rp 329.000', '#1c1c1c')
		]
	},
	{
		id: 'adidas',
		name: 'Adidas',
		kind: 'Sport',
		blurb: 'Sambas, track pieces, and stadium energy.',
		color: '#003087',
		x: 4,
		y: 72,
		w: 22,
		h: 22,
		skus: [
			sku('adidas', 'track', 'Track jacket', 'top', 'Rp 1.199.000', '#003087'),
			sku('adidas', 'joggers', 'Firebird pants', 'bottom', 'Rp 899.000', '#111111'),
			sku('adidas', 'samba', 'Samba OG', 'shoes', 'Rp 1.899.000', '#f3efe6'),
			sku('adidas', 'duffel', 'Gym duffel', 'bag', 'Rp 649.000', '#1f4e79')
		]
	},
	{
		id: 'charleskeith',
		name: 'Charles & Keith',
		kind: 'Accessories',
		blurb: 'Bags and shoes for dates, work, and weddings.',
		color: '#4a3728',
		x: 29,
		y: 72,
		w: 22,
		h: 22,
		skus: [
			sku('charleskeith', 'kitten', 'Kitten heel', 'shoes', 'Rp 799.000', '#2b2118'),
			sku('charleskeith', 'shoulder', 'Shoulder bag', 'bag', 'Rp 899.000', '#c6a27a'),
			sku('charleskeith', 'belt', 'Slim belt', 'accessory', 'Rp 299.000', '#5c4033'),
			sku('charleskeith', 'mule', 'Soft mule', 'shoes', 'Rp 699.000', '#ead9c8')
		]
	},
	{
		id: 'sephora',
		name: 'Sephora',
		kind: 'Beauty',
		blurb: 'Finishing details — clips, fragrance, glow.',
		color: '#d90b1c',
		x: 54,
		y: 72,
		w: 20,
		h: 22,
		skus: [
			sku('sephora', 'clip', 'Hair clips', 'accessory', 'Rp 189.000', '#f2c6d4'),
			sku('sephora', 'pouch', 'Beauty pouch', 'bag', 'Rp 329.000', '#111111'),
			sku('sephora', 'scarf', 'Silk ribbon', 'accessory', 'Rp 249.000', '#d90b1c'),
			sku('sephora', 'hat', 'Sun visor', 'hat', 'Rp 279.000', '#f5e6a8')
		]
	},
	{
		id: 'makers',
		name: 'Local Makers',
		kind: 'Craft',
		blurb: 'Independent Indonesian labels and craftsmaker drops.',
		color: '#3f5e3a',
		x: 77,
		y: 72,
		w: 19,
		h: 22,
		skus: [
			sku('makers', 'batik', 'Batik overshirt', 'top', 'Rp 375.000', '#7a3e1d'),
			sku('makers', 'tenun', 'Tenun wrap', 'accessory', 'Rp 225.000', '#c45c26'),
			sku('makers', 'sandal', 'Leather sandals', 'shoes', 'Rp 285.000', '#6b4226'),
			sku('makers', 'tote', 'Canvas tote', 'bag', 'Rp 165.000', '#d9cbb3')
		]
	}
];

export const mallFriends: MallFriend[] = [
	{ id: 'maya', name: 'Maya', storeId: 'uniqlo', note: 'Building a campus capsule', hue: 330 },
	{ id: 'raka', name: 'Raka', storeId: 'nike', note: 'Trying runners for a trip', hue: 210 },
	{ id: 'salsa', name: 'Salsa', storeId: 'buttonscarves', note: 'Wedding guest look', hue: 32 }
];

export const mallYouStart = { x: 50, y: 32 };

export function storeById(id: string | null | undefined): MallStore | undefined {
	if (!id) return undefined;
	return mallStores.find((s) => s.id === id);
}

export function friendsInStore(storeId: string): MallFriend[] {
	return mallFriends.filter((f) => f.storeId === storeId);
}

export function skuToClosetPiece(store: MallStore, item: MallSku): ClosetPiece {
	return {
		id: `mall-${item.id}`,
		category: item.category,
		label: `${store.name} · ${item.label}`,
		outfitId: `mall-${store.id}`,
		outfitTitle: store.name,
		imageUrl: item.imageUrl,
		x: 0,
		y: 0,
		w: 1,
		h: 1
	};
}
