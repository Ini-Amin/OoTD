// Pure 3D-mall world model: layout math, collision, and door proximity.
// Rendering lives in Mall3D.svelte; this module has no three.js dependency
// so the movement rules stay unit-testable (mall3d.test.ts).
import { mallStores, mallYouStart, type MallStore } from './mall.ts';

/** Map percent (0–100) → world meters. */
export const WORLD_SCALE = 0.64;
export const WORLD_HALF = 32;

export const toX = (px: number): number => (px - 50) * WORLD_SCALE;
export const toZ = (py: number): number => (py - 50) * WORLD_SCALE;

export type Vec2 = { x: number; z: number };

export type BoxCollider = {
	kind: 'box';
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
};
export type CircleCollider = { kind: 'circle'; x: number; z: number; r: number };
export type Collider = BoxCollider | CircleCollider;

export type StoreBox = {
	store: MallStore;
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
	centerX: number;
	centerZ: number;
	/** Door pad position (walkable side) and the side it faces. */
	doorX: number;
	doorZ: number;
	doorSide: 'north' | 'south';
};

function storeBox(store: MallStore): StoreBox {
	const minX = toX(store.x);
	const maxX = toX(store.x + store.w);
	const minZ = toZ(store.y);
	const maxZ = toZ(store.y + store.h);
	// Top-row stores face the atrium to their south; all others face the
	// concourse to their north.
	const south = store.y < 30;
	return {
		store,
		minX,
		maxX,
		minZ,
		maxZ,
		centerX: (minX + maxX) / 2,
		centerZ: (minZ + maxZ) / 2,
		doorX: (minX + maxX) / 2,
		doorZ: south ? maxZ + 0.7 : minZ - 0.7,
		doorSide: south ? 'south' : 'north'
	};
}

export const storeBoxes: StoreBox[] = mallStores.map(storeBox);

export function storeBoxById(id: string | null | undefined): StoreBox | undefined {
	if (!id) return undefined;
	return storeBoxes.find((b) => b.store.id === id);
}

/** Player spawn in world meters. */
export const spawnPoint: Vec2 = { x: toX(mallYouStart.x), z: toZ(mallYouStart.y) };

export const fountainSpot: Vec2 = { x: 0, z: toZ(33) };

export type PropSpot = Vec2 & { r: number };
/** Planters/benches in open floor (verified clear of stores and corridors). */
export const propSpots: PropSpot[] = [
	{ x: -10, z: -11, r: 0.7 },
	{ x: 10, z: -11, r: 0.7 },
	{ x: -20, z: -11, r: 0.7 },
	{ x: 20, z: -11, r: 0.7 },
	{ x: -12, z: 10.6, r: 0.8 },
	{ x: 12, z: 10.6, r: 0.8 },
	{ x: -24, z: 10.6, r: 0.8 },
	{ x: 24, z: 10.6, r: 0.8 }
];

export const FOUNTAIN_R = 2.3;

/** Directory totems (thin poles; verified clear of doors and spawn). */
export const TOTEM_SPOTS: PropSpot[] = [
	{ x: -3, z: 10.5, r: 0.3 },
	{ x: -3.5, z: -8, r: 0.3 }
];

export function buildColliders(): Collider[] {
	const out: Collider[] = storeBoxes.map((b) => ({
		kind: 'box' as const,
		minX: b.minX,
		maxX: b.maxX,
		minZ: b.minZ,
		maxZ: b.maxZ
	}));
	out.push({ kind: 'circle', x: fountainSpot.x, z: fountainSpot.z, r: FOUNTAIN_R });
	for (const p of propSpots) out.push({ kind: 'circle', x: p.x, z: p.z, r: p.r });
	for (const t of TOTEM_SPOTS) out.push({ kind: 'circle', x: t.x, z: t.z, r: t.r });
	return out;
}

function hitsCircleBox(x: number, z: number, r: number, b: BoxCollider): boolean {
	const cx = Math.max(b.minX, Math.min(x, b.maxX));
	const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
	const dx = x - cx;
	const dz = z - cz;
	return dx * dx + dz * dz < r * r;
}

function hitsCircleCircle(x: number, z: number, r: number, c: CircleCollider): boolean {
	const dx = x - c.x;
	const dz = z - c.z;
	const rr = r + c.r;
	return dx * dx + dz * dz < rr * rr;
}

export function hitsAny(x: number, z: number, r: number, colliders: Collider[]): boolean {
	return colliders.some((c) =>
		c.kind === 'box' ? hitsCircleBox(x, z, r, c) : hitsCircleCircle(x, z, r, c)
	);
}

/**
 * Move a circle with axis-separated sliding: try the full step, then X-only,
 * then Z-only, so walls guide instead of stopping the player.
 */
export function moveCircle(
	pos: Vec2,
	dx: number,
	dz: number,
	radius: number,
	colliders: Collider[]
): Vec2 {
	const bound = WORLD_HALF - 0.5;
	const clamp = (v: number): number => Math.max(-bound, Math.min(bound, v));
	const nx = clamp(pos.x + dx);
	const nz = clamp(pos.z + dz);
	if (!hitsAny(nx, nz, radius, colliders)) return { x: nx, z: nz };
	if (!hitsAny(nx, pos.z, radius, colliders)) return { x: nx, z: pos.z };
	if (!hitsAny(pos.x, nz, radius, colliders)) return { x: pos.x, z: nz };
	return { x: pos.x, z: pos.z };
}

export type DoorHit = { box: StoreBox; dist: number };

/** Nearest store door within `trigger` meters of the player. */
export function nearestDoor(pos: Vec2, trigger = 2.4): DoorHit | null {
	let best: DoorHit | null = null;
	for (const box of storeBoxes) {
		const dx = pos.x - box.doorX;
		const dz = pos.z - box.doorZ;
		const dist = Math.sqrt(dx * dx + dz * dz);
		if (dist <= trigger && (!best || dist < best.dist)) best = { box, dist };
	}
	return best;
}

/** Minimap edge in CSS px (square SVG overlay in Mall3D.svelte). */
export const MINIMAP_SIZE = 150;

/**
 * World meters → minimap pixels. Pure inverse of the world layout:
 * [-WORLD_HALF, +WORLD_HALF] maps to [0, size] on both axes.
 */
export function worldToMap(x: number, z: number, size = MINIMAP_SIZE): { px: number; py: number } {
	const span = WORLD_HALF * 2;
	const clamp = (v: number): number => Math.max(0, Math.min(size, v));
	return {
		px: clamp(((x + WORLD_HALF) / span) * size),
		py: clamp(((z + WORLD_HALF) / span) * size)
	};
}

/** Deterministic atrium spot for visitors with no position (ring by index). */
export function atriumSpot(index: number): Vec2 {
	const ring = Math.floor(index / 8);
	const slot = index % 8;
	const angle = (slot / 8) * Math.PI * 2 + ring * 0.4;
	const radius = 4 + ring * 1.6;
	return {
		x: fountainSpot.x + Math.cos(angle) * radius,
		z: fountainSpot.z + Math.sin(angle) * radius
	};
}
