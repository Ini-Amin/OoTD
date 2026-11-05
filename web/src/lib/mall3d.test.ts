// Movement rules for the playable 3D mall. Run: npm run test.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	atriumSpot,
	buildColliders,
	fountainSpot,
	hitsAny,
	moveCircle,
	nearestDoor,
	spawnPoint,
	storeBoxes,
	storeBoxById,
	TOTEM_SPOTS,
	toX,
	toZ,
	WORLD_HALF,
	worldToMap
} from './mall3d.ts';

const R = 0.35;

describe('mall3d layout', () => {
	it('maps all 11 stores to boxes with doors outside the footprint', () => {
		assert.equal(storeBoxes.length, 11);
		for (const b of storeBoxes) {
			const inside =
				b.doorX > b.minX && b.doorX < b.maxX && b.doorZ > b.minZ && b.doorZ < b.maxZ;
			assert.equal(inside, false, `${b.store.id} door must be outside the store`);
		}
	});

	it('spawns in the open, clear of every collider', () => {
		assert.equal(hitsAny(spawnPoint.x, spawnPoint.z, R, buildColliders()), false);
	});

	it('keeps every door pad walkable', () => {
		const colliders = buildColliders();
		for (const b of storeBoxes) {
			assert.equal(
				hitsAny(b.doorX, b.doorZ, R, colliders),
				false,
				`${b.store.id} door pad must be walkable`
			);
		}
	});

	it('keeps totems clear of spawn and every door pad', () => {
		for (const t of TOTEM_SPOTS) {
			const ds = Math.hypot(t.x - spawnPoint.x, t.z - spawnPoint.z);
			assert.ok(ds > 2, 'totem clear of spawn');
			for (const b of storeBoxes) {
				const dd = Math.hypot(t.x - b.doorX, t.z - b.doorZ);
				assert.ok(dd > 1.5, `totem clear of ${b.store.id} door`);
			}
		}
	});

	it('resolves store boxes by id', () => {
		assert.equal(storeBoxById('zara')?.store.name, 'Zara');
		assert.equal(storeBoxById(null), undefined);
		assert.equal(storeBoxById('nope'), undefined);
	});
});

describe('moveCircle', () => {
	it('moves freely in the open', () => {
		const next = moveCircle(spawnPoint, 1, 0, R, buildColliders());
		assert.ok(Math.abs(next.x - (spawnPoint.x + 1)) < 1e-9);
		assert.ok(Math.abs(next.z - spawnPoint.z) < 1e-9);
	});

	it('stops at store walls instead of entering', () => {
		const zara = storeBoxById('zara')!;
		// Stand just south of Zara and push north in per-frame steps.
		let pos = { x: zara.doorX, z: zara.maxZ + R + 0.05 };
		const colliders = buildColliders();
		for (let i = 0; i < 60; i++) pos = moveCircle(pos, 0, -0.05, R, colliders);
		assert.ok(pos.z >= zara.maxZ + R - 1e-9, 'must not cross the wall');
		assert.ok(pos.z <= zara.maxZ + R + 0.06, 'moves until contact');
	});

	it('slides along walls on the free axis', () => {
		const zara = storeBoxById('zara')!;
		const start = { x: zara.doorX, z: zara.maxZ + R + 0.05 };
		const next = moveCircle(start, 1.5, -2, R, buildColliders());
		assert.ok(next.x > start.x, 'slides along X');
		assert.ok(next.z >= zara.maxZ + R - 1e-9, 'still outside the wall');
	});

	it('collides with the fountain circle', () => {
		const start = { x: fountainSpot.x + 3.4, z: fountainSpot.z };
		const next = moveCircle(start, -3, 0, R, buildColliders());
		const dist = Math.hypot(next.x - fountainSpot.x, next.z - fountainSpot.z);
		assert.ok(dist >= 2.3 + R - 1e-9, 'stays outside the fountain');
	});

	it('clamps to the world bounds', () => {
		const next = moveCircle({ x: 31, z: 0 }, 5, 0, R, buildColliders());
		assert.ok(next.x <= 31.5);
	});
});

describe('nearestDoor', () => {
	it('finds the door the player stands on', () => {
		const hit = nearestDoor({ x: spawnPoint.x, z: spawnPoint.z }, 99);
		assert.ok(hit, 'some door is nearest');
		assert.ok(hit.dist > 2.4, 'spawn is clear of every door trigger');
		const ck = storeBoxById('charleskeith')!;
		const at = nearestDoor({ x: ck.doorX, z: ck.doorZ });
		assert.equal(at?.box.store.id, 'charleskeith');
		assert.ok((at?.dist ?? 9) < 0.01);
	});

	it('returns null in the open atrium', () => {
		assert.equal(nearestDoor({ x: fountainSpot.x + 4.5, z: fountainSpot.z + 4.5 }), null);
	});
});

describe('worldToMap', () => {
	it('maps the world center to the map center', () => {
		assert.deepEqual(worldToMap(0, 0, 150), { px: 75, py: 75 });
	});

	it('maps world corners to map corners', () => {
		assert.deepEqual(worldToMap(-WORLD_HALF, -WORLD_HALF, 150), { px: 0, py: 0 });
		assert.deepEqual(worldToMap(WORLD_HALF, WORLD_HALF, 150), { px: 150, py: 150 });
	});

	it('defaults to a 150px map', () => {
		assert.deepEqual(worldToMap(0, 0), { px: 75, py: 75 });
	});

	it('round-trips with toX/toZ at the mall center', () => {
		const { px, py } = worldToMap(toX(50), toZ(50), 100);
		assert.ok(Math.abs(px - 50) < 1e-9);
		assert.ok(Math.abs(py - 50) < 1e-9);
	});

	it('clamps out-of-bounds coordinates to the map edge', () => {
		assert.deepEqual(worldToMap(-999, 999, 150), { px: 0, py: 150 });
	});
});

describe('atriumSpot', () => {
	it('spreads visitors around the fountain, outside it', () => {
		const seen = new Set<string>();
		for (let i = 0; i < 16; i++) {
			const s = atriumSpot(i);
			const dist = Math.hypot(s.x - fountainSpot.x, s.z - fountainSpot.z);
			assert.ok(dist >= 3.9, `spot ${i} clear of the fountain`);
			seen.add(`${s.x.toFixed(2)},${s.z.toFixed(2)}`);
		}
		assert.equal(seen.size, 16);
	});
});
