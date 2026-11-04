export const CATEGORIES = ['hat', 'top', 'bottom', 'shoes', 'bag', 'accessory'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
	hat: 'Hat',
	top: 'Top',
	bottom: 'Bottom',
	shoes: 'Shoes',
	bag: 'Bag',
	accessory: 'Accessory'
};

/** A clothing piece tagged inside an outfit photo. x/y/w/h are fractions (0..1) of the photo. */
export type Piece = {
	id: string;
	category: Category;
	label: string;
	x: number;
	y: number;
	w: number;
	h: number;
};

/** A piece saved to the user's closet, with enough of the source photo to render it offline. */
export type ClosetPiece = Piece & {
	outfitId: string;
	outfitTitle: string;
	imageUrl: string;
};

export function isCategory(v: unknown): v is Category {
	return typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);
}

/** Where each category usually sits in a full-body photo. Used when an outfit has no tagged pieces. */
export const DEFAULT_BOX: Record<Category, Pick<Piece, 'x' | 'y' | 'w' | 'h'>> = {
	hat: { x: 0.25, y: 0.0, w: 0.5, h: 0.16 },
	top: { x: 0.15, y: 0.16, w: 0.7, h: 0.34 },
	bottom: { x: 0.2, y: 0.5, w: 0.6, h: 0.3 },
	shoes: { x: 0.2, y: 0.82, w: 0.6, h: 0.18 },
	bag: { x: 0.0, y: 0.4, w: 0.35, h: 0.25 },
	accessory: { x: 0.3, y: 0.1, w: 0.4, h: 0.15 }
};

export type AvatarCustomization = {
	height: number;
	shoulders: number;
	chest: number;
	waist: number;
	hips: number;
	headSize: number;
	skinTone: string;
	animation: 'idle' | 'walk' | 'pose' | 'stand';
};

export const DEFAULT_AVATAR_CUSTOMIZATION: AvatarCustomization = {
	height: 1.0,
	shoulders: 1.0,
	chest: 1.0,
	waist: 1.0,
	hips: 1.0,
	headSize: 1.0,
	skinTone: '#b98870',
	animation: 'idle'
};
