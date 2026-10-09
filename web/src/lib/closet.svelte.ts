import { isCategory, type Category, type ClosetPiece } from '$lib/pieces';

const PIECES_KEY = 'ootd-closet';
const WORN_KEY = 'ootd-worn';

function isPiece(v: unknown): v is ClosetPiece {
	if (typeof v !== 'object' || v === null) return false;
	const p = v as Record<string, unknown>;
	return (
		typeof p.id === 'string' &&
		isCategory(p.category) &&
		typeof p.label === 'string' &&
		typeof p.outfitId === 'string' &&
		typeof p.outfitTitle === 'string' &&
		typeof p.imageUrl === 'string' &&
		[p.x, p.y, p.w, p.h].every((n) => typeof n === 'number' && Number.isFinite(n))
	);
}

// ponytail: closet lives in localStorage until auth exists; move to a closet_pieces table then.
class Closet {
	pieces = $state<ClosetPiece[]>([]);
	/** category -> piece id currently on the mannequin */
	worn = $state<Partial<Record<Category, string>>>({});
	#ready = false;

	init() {
		if (this.#ready || typeof localStorage === 'undefined') return;
		this.#ready = true;
		try {
			const raw = JSON.parse(localStorage.getItem(PIECES_KEY) ?? '[]');
			if (Array.isArray(raw)) this.pieces = raw.filter(isPiece);
			const worn = JSON.parse(localStorage.getItem(WORN_KEY) ?? '{}');
			if (worn && typeof worn === 'object') {
				for (const [cat, id] of Object.entries(worn)) {
					if (isCategory(cat) && typeof id === 'string' && this.has(id)) this.worn[cat] = id;
				}
			}
		} catch {
			// corrupt storage: start empty
		}
	}

	has(id: string): boolean {
		return this.pieces.some((p) => p.id === id);
	}

	byCategory(cat: Category): ClosetPiece[] {
		return this.pieces.filter((p) => p.category === cat);
	}

	add(piece: ClosetPiece) {
		if (this.has(piece.id)) return;
		this.pieces = [piece, ...this.pieces];
		this.#save();
	}

	remove(id: string) {
		this.pieces = this.pieces.filter((p) => p.id !== id);
		for (const cat of Object.keys(this.worn) as Category[]) {
			if (this.worn[cat] === id) delete this.worn[cat];
		}
		this.#save();
	}

	wear(piece: ClosetPiece) {
		this.worn[piece.category] = piece.id;
		this.#save();
	}

	unwear(cat: Category) {
		delete this.worn[cat];
		this.#save();
	}

	wornPiece(cat: Category): ClosetPiece | undefined {
		const id = this.worn[cat];
		return id ? this.pieces.find((p) => p.id === id) : undefined;
	}

	#save() {
		localStorage.setItem(PIECES_KEY, JSON.stringify(this.pieces));
		localStorage.setItem(WORN_KEY, JSON.stringify(this.worn));
	}
}

export const closet = new Closet();
