<script lang="ts">
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
	import { onMount } from 'svelte';
	import {
		atriumSpot,
		buildColliders,
		FOUNTAIN_R,
		fountainSpot,
		moveCircle,
		nearestDoor,
		propSpots,
		spawnPoint,
		storeBoxes,
		storeBoxById,
		TOTEM_SPOTS,
		WORLD_HALF,
		type Collider,
		type StoreBox,
		type Vec2
	} from '$lib/mall3d';
	import type { MallFriend } from '$lib/mall';
	import type { PresenceVisitor } from '$lib/presence.svelte';

	type Props = {
		friends: MallFriend[];
		visitors: PresenceVisitor[];
		startPos?: Vec2 | null;
		onEnter: (storeId: string) => void;
		onMove: (pos: Vec2) => void;
	};
	let { friends, visitors, startPos = null, onEnter, onMove }: Props = $props();

	let containerEl: HTMLDivElement | null = $state(null);
	let doorTarget = $state<{ id: string; name: string } | null>(null);
	let avatarReady = $state(false);
	let loadError = $state('');
	let isTouch = $state(false);
	let stick = $state({ active: false, ox: 0, oy: 0, dx: 0, dy: 0 });

	const CAM_DIST = 8.0;
	const CAM_H = 4.1;
	const LOOK_Y = 1.4;
	const WALK_SPEED = 3.4;
	const RUN_SPEED = 6.2;
	const PLAYER_R = 0.35;

	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let lastT = 0;
	let elapsed = 0;
	let mixer: THREE.AnimationMixer | null = null;
	let avatar: THREE.Group | null = null;
	let playerCapsule: THREE.Mesh | null = null;
	let clips: Record<string, THREE.AnimationClip> = {};
	let currentAction: THREE.AnimationAction | null = null;
	let currentAnim = '';
	let raf = 0;
	let destroyed = false;
	let disposables: { dispose(): void }[] = [];
	let colliders: Collider[] = [];
	// Opening framing: mid-plaza facing the atrium fountain with the north
	// storefronts (signs + glowing door pads) beyond it.
	let camYaw = 0;
	// Intentional snapshot: the component owns the position after mount;
	// startPos only seeds remounts (e.g. leaving a store).
	// svelte-ignore state_referenced_locally
	let player: Vec2 = startPos ? { ...startPos } : { ...spawnPoint };
	let facing = Math.PI;
	let keys = new Set<string>();
	let shiftHeld = false;
	let stickVec = { x: 0, y: 0 };
	let lastEmit = 0;
	let lastEmitPos: Vec2 = { ...player };
	let doorPads: THREE.Mesh[] = [];
	let occluders: THREE.Object3D[] = [];
	const _camDir = new THREE.Vector3();
	const _camHead = new THREE.Vector3();
	const _camTarget = new THREE.Vector3();
	const _camRay = new THREE.Raycaster();
	let waterMat: THREE.MeshStandardMaterial | null = null;
	let reducedMotion = false;
	let friendAvatars = new Map<string, THREE.Group>();
	let visitorAvatars = new Map<string, THREE.Group>();
	let nameSprites = new Map<string, THREE.Sprite>();
	let resizeObserver: ResizeObserver | null = null;
	let dragPointer: number | null = null;
	let dragLastX = 0;
	let stickPointer: number | null = null;
	let stickOrigin = { x: 0, y: 0 };

	function track<T extends { dispose(): void }>(d: T): T {
		disposables.push(d);
		return d;
	}

	function pillPath(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		r: number
	): void {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	}

	function canvas2d(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('2d canvas unavailable');
		return { canvas, ctx };
	}

	function makeNameSprite(text: string, hue: number): THREE.Sprite {
		const key = `${hue}|${text}`;
		const cached = nameSprites.get(key);
		if (cached) return cached.clone();
		const { canvas, ctx } = canvas2d(256, 64);
		ctx.fillStyle = 'rgba(12,14,18,0.72)';
		pillPath(ctx, 4, 8, 248, 48, 24);
		ctx.fill();
		ctx.fillStyle = `hsl(${hue} 70% 55%)`;
		ctx.beginPath();
		ctx.arc(32, 32, 13, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.font = '600 25px system-ui, sans-serif';
		ctx.textBaseline = 'middle';
		ctx.fillText(text.slice(0, 13), 54, 34);
		const tex = track(new THREE.CanvasTexture(canvas));
		tex.colorSpace = THREE.SRGBColorSpace;
		const mat = track(
			new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
		);
		const sprite = new THREE.Sprite(mat);
		sprite.scale.set(2.5, 0.625, 1);
		sprite.renderOrder = 20;
		nameSprites.set(key, sprite);
		return sprite.clone();
	}

	function makeFloorTexture(): THREE.CanvasTexture {
		const S = 1024;
		const { canvas, ctx } = canvas2d(S, S);
		const px = (v: number): number => (v / 100) * S;
		ctx.fillStyle = '#d9d2c2';
		ctx.fillRect(0, 0, S, S);
		ctx.strokeStyle = 'rgba(120,110,95,0.25)';
		ctx.lineWidth = 2;
		for (let i = 0; i <= 16; i++) {
			const p = (i / 16) * S;
			ctx.beginPath();
			ctx.moveTo(p, 0);
			ctx.lineTo(p, S);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, p);
			ctx.lineTo(S, p);
			ctx.stroke();
		}
		ctx.fillStyle = '#cfc6b2';
		ctx.fillRect(px(48.5), px(35), px(3), px(27));
		ctx.fillRect(px(4), px(62), px(92), px(5));
		ctx.fillStyle = '#c6b99f';
		ctx.beginPath();
		ctx.arc(px(50), px(33), px(9), 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = 'rgba(120,110,95,0.5)';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(px(50), px(33), px(9), 0, Math.PI * 2);
		ctx.stroke();
		const tex = track(new THREE.CanvasTexture(canvas));
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 8;
		return tex;
	}

	function makeSignTexture(name: string, brand: string, sub: string): THREE.CanvasTexture {
		const { canvas, ctx } = canvas2d(512, 104);
		ctx.fillStyle = brand;
		pillPath(ctx, 0, 0, 512, 104, 20);
		ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.textBaseline = 'middle';
		ctx.font = '700 50px system-ui, sans-serif';
		ctx.fillText(name.slice(0, 18), 28, 38);
		ctx.font = '500 28px system-ui, sans-serif';
		ctx.fillStyle = 'rgba(255,255,255,0.85)';
		ctx.fillText(sub, 28, 78);
		const tex = track(new THREE.CanvasTexture(canvas));
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 4;
		return tex;
	}

	function buildFloor(): void {
		if (!scene) return;
		const mat = track(new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.95 }));
		const floor = new THREE.Mesh(
			track(new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2)),
			mat
		);
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		scene.add(floor);
	}

	function buildLights(): void {
		if (!scene) return;
		scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f7a, 0.85));
		const sun = new THREE.DirectionalLight(0xfff2df, 1.7);
		sun.position.set(20, 30, 12);
		sun.castShadow = true;
		sun.shadow.mapSize.set(2048, 2048);
		sun.shadow.camera.left = -38;
		sun.shadow.camera.right = 38;
		sun.shadow.camera.top = 38;
		sun.shadow.camera.bottom = -38;
		sun.shadow.camera.near = 5;
		sun.shadow.camera.far = 80;
		sun.shadow.bias = -0.0004;
		scene.add(sun);
		const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
		fill.position.set(-15, 20, -18);
		scene.add(fill);
	}

	function buildWalls(): void {
		if (!scene) return;
		const mat = track(new THREE.MeshStandardMaterial({ color: '#c9c0ad', roughness: 0.9 }));
		const trimMat = track(new THREE.MeshStandardMaterial({ color: '#8f8674', roughness: 0.85 }));
		const H = 2.6;
		const L = WORLD_HALF * 2;
		const defs = [
			{ x: 0, z: -WORLD_HALF - 0.3, w: L, d: 0.6 },
			{ x: 0, z: WORLD_HALF + 0.3, w: L, d: 0.6 },
			{ x: -WORLD_HALF - 0.3, z: 0, w: 0.6, d: L },
			{ x: WORLD_HALF + 0.3, z: 0, w: 0.6, d: L }
		];
		for (const d of defs) {
			const wall = new THREE.Mesh(track(new THREE.BoxGeometry(d.w, H, d.d)), mat);
			wall.position.set(d.x, H / 2, d.z);
			wall.receiveShadow = true;
			scene.add(wall);
			occluders.push(wall);
			const trim = new THREE.Mesh(
				track(new THREE.BoxGeometry(d.w === 0.6 ? 0.9 : d.w, 0.25, d.d === 0.6 ? 0.9 : d.d)),
				trimMat
			);
			trim.position.set(d.x, H + 0.12, d.z);
			scene.add(trim);
		}
	}

	function buildStore(box: StoreBox): void {
		if (!scene) return;
		const { store } = box;
		const w = box.maxX - box.minX;
		const d = box.maxZ - box.minZ;
		const group = new THREE.Group();
		const brand = new THREE.Color(store.color);
		const body = new THREE.Mesh(
			track(new THREE.BoxGeometry(w, 4.2, d)),
			track(
				new THREE.MeshStandardMaterial({
					color: brand.clone().lerp(new THREE.Color('#ffffff'), 0.84),
					roughness: 0.9
				})
			)
		);
		body.position.set(box.centerX, 2.1, box.centerZ);
		body.castShadow = true;
		body.receiveShadow = true;
		group.add(body);
		occluders.push(body);
		// Inset parapet cap: an overhanging slab shows its unlit underside as a
		// black wedge from the lanes.
		const roof = new THREE.Mesh(
			track(new THREE.BoxGeometry(w - 0.3, 0.35, d - 0.3)),
			track(new THREE.MeshStandardMaterial({ color: '#7d7468', roughness: 0.85 }))
		);
		roof.position.set(box.centerX, 4.2 + 0.17, box.centerZ);
		roof.castShadow = true;
		group.add(roof);

		const south = box.doorSide === 'south';
		const faceZ = south ? box.maxZ : box.minZ;
		const out = south ? 1 : -1;
		const rotY = south ? 0 : Math.PI;
		const glow = new THREE.Mesh(
			track(new THREE.PlaneGeometry(w * 0.72, 2.5)),
			track(new THREE.MeshBasicMaterial({ color: '#ffedd2' }))
		);
		glow.position.set(box.centerX, 1.5, faceZ + out * 0.12);
		glow.rotation.y = rotY;
		group.add(glow);
		const glass = new THREE.Mesh(
			track(new THREE.PlaneGeometry(w * 0.72, 2.5)),
			track(
				new THREE.MeshStandardMaterial({
					color: '#b9cfdd',
					transparent: true,
					opacity: 0.45,
					roughness: 0.12,
					metalness: 0.5
				})
			)
		);
		glass.position.set(box.centerX, 1.5, faceZ + out * 0.2);
		glass.rotation.y = rotY;
		group.add(glass);
		const mullMat = track(new THREE.MeshStandardMaterial({ color: '#2c2c30', roughness: 0.6 }));
		for (const t of [-0.25, 0, 0.25]) {
			const mull = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 2.5, 0.12)), mullMat);
			mull.position.set(box.centerX + t * w, 1.5, faceZ + out * 0.22);
			group.add(mull);
		}
		const door = new THREE.Mesh(
			track(new THREE.PlaneGeometry(1.8, 2.6)),
			track(
				new THREE.MeshStandardMaterial({
					color: brand.clone().multiplyScalar(0.35),
					roughness: 0.7
				})
			)
		);
		door.position.set(box.doorX, 1.45, faceZ + out * 0.26);
		door.rotation.y = rotY;
		group.add(door);
		const fascia = new THREE.Mesh(
			track(new THREE.BoxGeometry(w * 0.86, 1.2, 0.12)),
			track(new THREE.MeshStandardMaterial({ color: brand, roughness: 0.7 }))
		);
		fascia.position.set(box.centerX, 3.55, faceZ + out * 0.18);
		group.add(fascia);
		const sign = new THREE.Mesh(
			track(new THREE.PlaneGeometry(Math.min(w * 0.8, 7), 1.05)),
			track(
				new THREE.MeshBasicMaterial({
					map: makeSignTexture(store.name, store.color, `${store.skus.length} pieces`),
					transparent: true
				})
			)
		);
		sign.position.set(box.centerX, 3.55, faceZ + out * 0.26);
		sign.rotation.y = rotY;
		group.add(sign);
		const pad = new THREE.Mesh(
			track(new THREE.CircleGeometry(0.95, 28)),
			track(new THREE.MeshBasicMaterial({ color: '#ffc93c', transparent: true, opacity: 0.7 }))
		);
		pad.rotation.x = -Math.PI / 2;
		pad.position.set(box.doorX, 0.03, box.doorZ);
		group.add(pad);
		doorPads.push(pad);
		scene.add(group);
	}

	function buildFountain(): void {
		if (!scene) return;
		const stone = track(new THREE.MeshStandardMaterial({ color: '#a49c8b', roughness: 0.85 }));
		const base = new THREE.Mesh(
			track(new THREE.CylinderGeometry(FOUNTAIN_R + 0.25, FOUNTAIN_R + 0.4, 0.75, 36)),
			stone
		);
		base.position.set(fountainSpot.x, 0.375, fountainSpot.z);
		base.castShadow = true;
		base.receiveShadow = true;
		scene.add(base);
		waterMat = track(
			new THREE.MeshStandardMaterial({
				color: '#6fb3cf',
				transparent: true,
				opacity: 0.85,
				roughness: 0.15,
				metalness: 0.35,
				emissive: '#1d4e5f',
				emissiveIntensity: 0.25
			})
		);
		const water = new THREE.Mesh(track(new THREE.CircleGeometry(FOUNTAIN_R - 0.15, 36)), waterMat);
		water.rotation.x = -Math.PI / 2;
		water.position.set(fountainSpot.x, 0.78, fountainSpot.z);
		scene.add(water);
		const column = new THREE.Mesh(track(new THREE.CylinderGeometry(0.35, 0.5, 1.6, 20)), stone);
		column.position.set(fountainSpot.x, 1.2, fountainSpot.z);
		column.castShadow = true;
		scene.add(column);
		const cap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.9, 0.7, 0.25, 20)), stone);
		cap.position.set(fountainSpot.x, 2.05, fountainSpot.z);
		cap.castShadow = true;
		scene.add(cap);
	}

	function buildProps(): void {
		if (!scene) return;
		const potMat = track(new THREE.MeshStandardMaterial({ color: '#8a5a3b', roughness: 0.9 }));
		const leafMat = track(new THREE.MeshStandardMaterial({ color: '#4e7a3e', roughness: 1 }));
		const woodMat = track(new THREE.MeshStandardMaterial({ color: '#7a5c3e', roughness: 0.85 }));
		for (const p of propSpots) {
			if (p.z < 0) {
				const pot = new THREE.Mesh(track(new THREE.CylinderGeometry(0.55, 0.42, 0.7, 16)), potMat);
				pot.position.set(p.x, 0.35, p.z);
				pot.castShadow = true;
				scene.add(pot);
				const bush = new THREE.Mesh(track(new THREE.SphereGeometry(0.62, 14, 12)), leafMat);
				bush.position.set(p.x, 1.15, p.z);
				bush.castShadow = true;
				scene.add(bush);
			} else {
				const seat = new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 0.12, 0.55)), woodMat);
				seat.position.set(p.x, 0.55, p.z);
				seat.castShadow = true;
				scene.add(seat);
				for (const lx of [-0.7, 0.7]) {
					const leg = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.55, 0.5)), woodMat);
					leg.position.set(p.x + lx, 0.275, p.z);
					scene.add(leg);
				}
			}
		}
	}

	function buildTotems(): void {
		if (!scene) return;
		const poleMat = track(new THREE.MeshStandardMaterial({ color: '#3a3a40', roughness: 0.6 }));
		for (const t of TOTEM_SPOTS) {
			const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.09, 0.12, 3, 12)), poleMat);
			pole.position.set(t.x, 1.5, t.z);
			pole.castShadow = true;
			scene.add(pole);
			const { canvas, ctx } = canvas2d(256, 384);
			ctx.fillStyle = '#22252c';
			pillPath(ctx, 0, 0, 256, 384, 24);
			ctx.fill();
			ctx.fillStyle = '#ffd34d';
			ctx.font = '700 30px system-ui, sans-serif';
			ctx.fillText('MALL', 24, 48);
			ctx.font = '500 21px system-ui, sans-serif';
			ctx.fillStyle = '#ffffff';
			const names = ['Zara · Uniqlo · H&M', 'Cotton On · Erigo', 'Buttonscarves · Nike', 'Adidas · C&K', 'Sephora · Makers'];
			names.forEach((n, i) => ctx.fillText(n, 24, 100 + i * 44));
			ctx.fillStyle = '#ffd34d';
			ctx.font = '600 22px system-ui, sans-serif';
			ctx.fillText('↑ atrium · food · exit', 24, 340);
			const tex = track(new THREE.CanvasTexture(canvas));
			tex.colorSpace = THREE.SRGBColorSpace;
			const panel = new THREE.Mesh(
				track(new THREE.PlaneGeometry(1.15, 1.7)),
				track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }))
			);
			panel.position.set(t.x, 2.4, t.z);
			scene.add(panel);
		}
	}

	async function loadAvatar(): Promise<void> {
		if (!scene) return;
		playerCapsule = new THREE.Mesh(
			track(new THREE.CapsuleGeometry(0.32, 0.85, 6, 14)),
			track(new THREE.MeshStandardMaterial({ color: '#4a6fa5', roughness: 0.8 }))
		);
		playerCapsule.position.set(player.x, 0.95, player.z);
		playerCapsule.castShadow = true;
		scene.add(playerCapsule);
		try {
			const gltf = await new GLTFLoader().loadAsync('/models/xbot.glb');
			if (destroyed || !scene) return;
			avatar = gltf.scene;
			avatar.scale.set(1.05, 1.05, 1.05);
			avatar.position.set(player.x, 0, player.z);
			avatar.rotation.y = facing;
			avatar.traverse((child) => {
				if ((child as THREE.Mesh).isMesh) {
					child.castShadow = true;
				}
			});
			for (const clip of gltf.animations ?? []) clips[clip.name] = clip;
			if ((gltf.animations ?? []).length > 0) {
				mixer = new THREE.AnimationMixer(avatar);
				playAnim('idle');
			}
			scene.add(avatar);
			if (playerCapsule) playerCapsule.visible = false;
			avatarReady = true;
		} catch {
			loadError = 'Avatar model failed to load — playing as guest capsule';
		}
	}

	function playAnim(name: 'idle' | 'walk' | 'run'): void {
		if (!mixer || currentAnim === name) return;
		const clip = clips[name];
		if (!clip) return;
		const next = mixer.clipAction(clip);
		if (currentAction) currentAction.fadeOut(0.25);
		next.reset().fadeIn(0.25).play();
		currentAction = next;
		currentAnim = name;
	}

	function hashStr(s: string): number {
		let h = 0;
		for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
		return Math.abs(h);
	}

	function doorFront(box: StoreBox, lateral: number): Vec2 {
		const outward = box.doorSide === 'south' ? 1 : -1;
		return { x: box.doorX + lateral, z: box.doorZ + outward * 1.2 };
	}

	function npcTargetForFriend(friend: MallFriend, index: number): Vec2 {
		const box = storeBoxById(friend.storeId);
		if (!box) return atriumSpot(index);
		const lateral = (hashStr(friend.id) % 5) - 2;
		return doorFront(box, lateral * 0.8);
	}

	function npcTargetForVisitor(v: PresenceVisitor): Vec2 {
		if (typeof v.x === 'number' && typeof v.z === 'number') {
			const bound = WORLD_HALF - 0.5;
			return {
				x: Math.max(-bound, Math.min(bound, v.x)),
				z: Math.max(-bound, Math.min(bound, v.z))
			};
		}
		const box = storeBoxById(v.storeId);
		if (box) return doorFront(box, 0);
		return atriumSpot(hashStr(v.clientId) % 16);
	}

	function makeNpc(name: string, hue: number, ring: boolean): THREE.Group {
		const group = new THREE.Group();
		const body = new THREE.Mesh(
			track(new THREE.CapsuleGeometry(0.32, 0.75, 6, 14)),
			track(
				new THREE.MeshStandardMaterial({
					color: new THREE.Color().setHSL(hue / 360, 0.45, 0.62),
					roughness: 0.8
				})
			)
		);
		body.position.y = 0.95;
		body.castShadow = true;
		group.add(body);
		const head = new THREE.Mesh(
			track(new THREE.SphereGeometry(0.24, 16, 12)),
			track(new THREE.MeshStandardMaterial({ color: '#caa189', roughness: 0.8 }))
		);
		head.position.y = 1.78;
		head.castShadow = true;
		group.add(head);
		if (ring) {
			const band = new THREE.Mesh(
				track(new THREE.RingGeometry(0.42, 0.58, 28)),
				track(
					new THREE.MeshBasicMaterial({
						color: new THREE.Color().setHSL(hue / 360, 0.7, 0.5),
						side: THREE.DoubleSide
					})
				)
			);
			band.rotation.x = -Math.PI / 2;
			band.position.y = 0.04;
			group.add(band);
		}
		const label = makeNameSprite(name, hue);
		label.position.y = 2.35;
		group.add(label);
		return group;
	}

	function stepNpc(
		group: THREE.Group,
		target: Vec2,
		speed: number,
		dt: number,
		t: number,
		phase: number
	): void {
		if (reducedMotion) {
			group.position.x = target.x;
			group.position.z = target.z;
			group.position.y = 0;
			return;
		}
		const dx = target.x - group.position.x;
		const dz = target.z - group.position.z;
		const dist = Math.hypot(dx, dz);
		if (dist <= 0.25) {
			group.position.y = 0;
			return;
		}
		const from = { x: group.position.x, z: group.position.z };
		const next = moveCircle(from, (dx / dist) * speed * dt, (dz / dist) * speed * dt, 0.3, colliders);
		group.position.x = next.x;
		group.position.z = next.z;
		group.position.y = Math.abs(Math.sin(t * 9 + phase)) * 0.07;
		group.rotation.y = Math.atan2(dx, dz);
	}

	function stepNpcs(dt: number, t: number): void {
		friends.forEach((f, i) => {
			const group = friendAvatars.get(f.id);
			if (!group) return;
			stepNpc(group, npcTargetForFriend(f, i), 1.7, dt, t, hashStr(f.id));
		});
		for (const v of visitors) {
			const group = visitorAvatars.get(v.clientId);
			if (!group) continue;
			stepNpc(group, npcTargetForVisitor(v), 4.5, dt, t, hashStr(v.clientId));
		}
	}

	$effect(() => {
		const currentFriends = friends;
		const currentVisitors = visitors;
		const activeScene = scene;
		if (!activeScene) return;
		const friendIds = new Set(currentFriends.map((f) => f.id));
		for (const [id, group] of friendAvatars) {
			if (!friendIds.has(id)) {
				activeScene.remove(group);
				friendAvatars.delete(id);
			}
		}
		currentFriends.forEach((f, i) => {
			if (!friendAvatars.has(f.id)) {
				const group = makeNpc(f.name, f.hue, false);
				const target = npcTargetForFriend(f, i);
				group.position.set(target.x, 0, target.z);
				activeScene.add(group);
				friendAvatars.set(f.id, group);
			}
		});
		const visitorIds = new Set(currentVisitors.map((v) => v.clientId));
		for (const [id, group] of visitorAvatars) {
			if (!visitorIds.has(id)) {
				activeScene.remove(group);
				visitorAvatars.delete(id);
			}
		}
		for (const v of currentVisitors) {
			if (!visitorAvatars.has(v.clientId)) {
				const group = makeNpc(v.name, v.hue, true);
				const target = npcTargetForVisitor(v);
				group.position.set(target.x, 0, target.z);
				activeScene.add(group);
				visitorAvatars.set(v.clientId, group);
			}
		}
	});

	const GAME_KEYS = new Set([
		'KeyW',
		'KeyA',
		'KeyS',
		'KeyD',
		'ArrowUp',
		'ArrowDown',
		'ArrowLeft',
		'ArrowRight'
	]);

	function onKeyDown(e: KeyboardEvent): void {
		if (e.target instanceof HTMLElement) {
			const el = e.target;
			if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
		}
		if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftHeld = true;
		if (GAME_KEYS.has(e.code)) {
			keys.add(e.code);
			e.preventDefault();
		}
		if (e.code === 'KeyE' && doorTarget) {
			onEnter(doorTarget.id);
		}
	}

	function onKeyUp(e: KeyboardEvent): void {
		if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftHeld = false;
		keys.delete(e.code);
	}

	function onPointerDown(e: PointerEvent): void {
		if (e.target instanceof Element && e.target.closest('button')) return;
		const el = containerEl;
		if (!el) return;
		if (e.pointerType === 'touch') {
			isTouch = true;
			const rect = el.getBoundingClientRect();
			if (e.clientX - rect.left < rect.width * 0.45 && stickPointer === null) {
				stickPointer = e.pointerId;
				stickOrigin = { x: e.clientX - rect.left, y: e.clientY - rect.top };
				stickVec = { x: 0, y: 0 };
				stick = { active: true, ox: stickOrigin.x, oy: stickOrigin.y, dx: 0, dy: 0 };
				el.setPointerCapture(e.pointerId);
				return;
			}
		}
		if (dragPointer === null) {
			dragPointer = e.pointerId;
			dragLastX = e.clientX;
			el.setPointerCapture(e.pointerId);
		}
	}

	function onPointerMove(e: PointerEvent): void {
		const el = containerEl;
		if (e.pointerId === stickPointer && el) {
			const rect = el.getBoundingClientRect();
			let dx = e.clientX - rect.left - stickOrigin.x;
			let dy = e.clientY - rect.top - stickOrigin.y;
			const len = Math.hypot(dx, dy);
			const max = 48;
			if (len > max) {
				dx = (dx / len) * max;
				dy = (dy / len) * max;
			}
			stickVec = { x: dx / max, y: dy / max };
			stick = { active: true, ox: stickOrigin.x, oy: stickOrigin.y, dx, dy };
		} else if (e.pointerId === dragPointer) {
			camYaw -= (e.clientX - dragLastX) * 0.0052;
			dragLastX = e.clientX;
		}
	}

	function onPointerUp(e: PointerEvent): void {
		if (e.pointerId === stickPointer) {
			stickPointer = null;
			stickVec = { x: 0, y: 0 };
			stick = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
		}
		if (e.pointerId === dragPointer) dragPointer = null;
	}

	function inputVector(): { x: number; z: number; mag: number } {
		let f = 0;
		let r = 0;
		if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
		if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
		if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1;
		if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
		f += -stickVec.y;
		r += stickVec.x;
		const len = Math.hypot(f, r);
		if (len > 1) {
			f /= len;
			r /= len;
		}
		const fx = -Math.sin(camYaw);
		const fz = -Math.cos(camYaw);
		const rx = Math.cos(camYaw);
		const rz = -Math.sin(camYaw);
		return { x: fx * f + rx * r, z: fz * f + rz * r, mag: Math.min(1, len) };
	}

	/**
	 * Third-person camera target with collision: raycast from the player's
	 * head toward the ideal boom position and shorten it in front of any
	 * store or wall so the camera never ends up inside geometry. Returns the
	 * boom length so tight spots can hide the player. No vertical lift: in
	 * the lanes it pushes the camera into the flanking roofs.
	 */
	function desiredCameraPos(out: THREE.Vector3): number {
		_camDir.set(Math.sin(camYaw) * CAM_DIST, CAM_H - 1.6, Math.cos(camYaw) * CAM_DIST);
		const fullLen = _camDir.length();
		_camDir.normalize();
		_camHead.set(player.x, 1.6, player.z);
		_camRay.set(_camHead, _camDir);
		_camRay.far = fullLen;
		const hits = _camRay.intersectObjects(occluders, false);
		const len = hits.length > 0 ? Math.max(0.5, hits[0].distance - 0.4) : fullLen;
		out.set(_camHead.x + _camDir.x * len, _camHead.y + _camDir.y * len, _camHead.z + _camDir.z * len);
		return len;
	}

	function animate(): void {
		if (destroyed) return;
		raf = requestAnimationFrame(animate);
		if (!renderer || !scene || !camera) return;
		const now = performance.now() / 1000;
		const dt = Math.min(lastT > 0 ? now - lastT : 0.016, 0.05);
		lastT = now;
		elapsed += dt;
		const t = elapsed;
		const input = inputVector();
		const running = shiftHeld || (stick.active && input.mag > 0.92);
		const speed = input.mag < 0.05 ? 0 : running ? RUN_SPEED : WALK_SPEED;
		if (speed > 0) {
			player = moveCircle(
				player,
				input.x * speed * dt,
				input.z * speed * dt,
				PLAYER_R,
				colliders
			);
			const targetFacing = Math.atan2(input.x, input.z);
			let d = targetFacing - facing;
			while (d > Math.PI) d -= Math.PI * 2;
			while (d < -Math.PI) d += Math.PI * 2;
			facing += d * Math.min(1, 12 * dt);
			playAnim(running ? 'run' : 'walk');
		} else {
			playAnim('idle');
		}
		if (avatar) {
			avatar.position.set(player.x, 0, player.z);
			avatar.rotation.y = facing;
		}
		if (playerCapsule) playerCapsule.position.set(player.x, 0.95, player.z);
		if (mixer) mixer.update(dt);
		const boomLen = desiredCameraPos(_camTarget);
		const showPlayer = boomLen > 2.2;
		if (avatar) avatar.visible = showPlayer;
		if (playerCapsule) playerCapsule.visible = avatar ? showPlayer : true;
		if (reducedMotion) {
			camera.position.copy(_camTarget);
		} else {
			const k = 1 - Math.exp(-8 * dt);
			camera.position.x += (_camTarget.x - camera.position.x) * k;
			camera.position.y += (_camTarget.y - camera.position.y) * k;
			camera.position.z += (_camTarget.z - camera.position.z) * k;
		}
		camera.lookAt(player.x, LOOK_Y, player.z);
		const pulse = 0.55 + 0.25 * Math.sin(t * 3);
		for (const pad of doorPads) {
			if (pad.material instanceof THREE.MeshBasicMaterial) pad.material.opacity = pulse;
		}
		if (waterMat) waterMat.emissiveIntensity = 0.2 + 0.12 * Math.sin(t * 1.7);
		stepNpcs(dt, t);
		const hit = nearestDoor(player, 2.6);
		const next = hit ? { id: hit.box.store.id, name: hit.box.store.name } : null;
		if ((next?.id ?? null) !== (doorTarget?.id ?? null)) doorTarget = next;
		if (t - lastEmit > 0.4) {
			const moved = Math.hypot(player.x - lastEmitPos.x, player.z - lastEmitPos.z);
			if (moved > 0.25) {
				lastEmit = t;
				lastEmitPos = { ...player };
				onMove({ x: Math.round(player.x * 100) / 100, z: Math.round(player.z * 100) / 100 });
			}
		}
		renderer.render(scene, camera);
	}

	function resize(): void {
		const el = containerEl;
		if (!el || !renderer || !camera) return;
		const w = el.clientWidth;
		const h = el.clientHeight;
		if (w <= 0 || h <= 0) return;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h, false);
	}

	onMount(() => {
		if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
			reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			isTouch = window.matchMedia('(pointer: coarse)').matches;
		}
		const el = containerEl;
		if (!el) return;
		try {
			colliders = buildColliders();
			renderer = new THREE.WebGLRenderer({ antialias: true });
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			renderer.shadowMap.enabled = true;
			renderer.shadowMap.type = THREE.PCFShadowMap;
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			el.prepend(renderer.domElement);
			scene = new THREE.Scene();
			scene.background = new THREE.Color('#e9e4d8');
			scene.fog = new THREE.Fog('#e9e4d8', 40, 110);
			camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
			buildFloor();
			buildLights();
			buildWalls();
			for (const box of storeBoxes) buildStore(box);
			buildFountain();
			buildProps();
			buildTotems();
			if (camera) {
				desiredCameraPos(camera.position);
				camera.lookAt(player.x, LOOK_Y, player.z);
			}
			resize();
			void loadAvatar();
			onMove({ x: Math.round(player.x * 100) / 100, z: Math.round(player.z * 100) / 100 });
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to start 3D mall';
			return;
		}
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		el.addEventListener('pointerdown', onPointerDown);
		el.addEventListener('pointermove', onPointerMove);
		el.addEventListener('pointerup', onPointerUp);
		el.addEventListener('pointercancel', onPointerUp);
		resizeObserver = new ResizeObserver(() => resize());
		resizeObserver.observe(el);
		raf = requestAnimationFrame(animate);
		return () => {
			destroyed = true;
			cancelAnimationFrame(raf);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			el.removeEventListener('pointerdown', onPointerDown);
			el.removeEventListener('pointermove', onPointerMove);
			el.removeEventListener('pointerup', onPointerUp);
			el.removeEventListener('pointercancel', onPointerUp);
			resizeObserver?.disconnect();
			for (const d of disposables) {
				try {
					d.dispose();
				} catch {
					// Already-disposed resources are fine.
				}
			}
			disposables = [];
			renderer?.dispose();
			if (renderer?.domElement.parentElement === el) el.removeChild(renderer.domElement);
			renderer = null;
			scene = null;
			camera = null;
		};
	});
</script>

<div class="mall3d" bind:this={containerEl}>
	{#if !avatarReady && !loadError}
		<p class="badge">Loading avatar…</p>
	{/if}
	{#if loadError}
		<p class="badge error">{loadError}</p>
	{/if}
	<p class="hint">
		{isTouch
			? 'Left thumb to walk · drag right side to look · tap Enter at a glowing door'
			: 'WASD / arrows walk · Shift runs · drag to look · E enters a store'}
	</p>
	{#if doorTarget}
		<button
			type="button"
			class="enter"
			data-testid="enter-store"
			onclick={() => doorTarget && onEnter(doorTarget.id)}
		>
			Enter {doorTarget.name} →
		</button>
	{/if}
	{#if stick.active}
		<div class="stick" style={`left:${stick.ox}px;top:${stick.oy}px`}>
			<div class="knob" style={`transform:translate(${stick.dx}px,${stick.dy}px)`}></div>
		</div>
	{/if}
</div>

<style>
	.mall3d {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		border-radius: inherit;
		touch-action: none;
		background: #e9e4d8;
		user-select: none;
		-webkit-user-select: none;
	}

	.mall3d :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.badge {
		position: absolute;
		left: 0.8rem;
		top: 0.8rem;
		z-index: 5;
		margin: 0;
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		background: rgba(12, 14, 18, 0.72);
		color: #fff;
		font-size: 0.75rem;
		pointer-events: none;
	}

	.badge.error {
		background: rgba(140, 30, 30, 0.88);
	}

	.hint {
		position: absolute;
		right: 0.8rem;
		bottom: 0.7rem;
		z-index: 5;
		margin: 0;
		max-width: min(32rem, calc(100% - 1.6rem));
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		background: rgba(12, 14, 18, 0.6);
		color: #fff;
		font-size: 0.72rem;
		pointer-events: none;
	}

	.enter {
		position: absolute;
		left: 50%;
		bottom: 3rem;
		transform: translateX(-50%);
		z-index: 6;
		border: none;
		border-radius: 999px;
		padding: 0.65rem 1.4rem;
		background: var(--t-fg);
		color: var(--t-bg);
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
	}

	.stick {
		position: absolute;
		z-index: 6;
		width: 110px;
		height: 110px;
		margin: -55px 0 0 -55px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.25);
		border: 2px solid rgba(255, 255, 255, 0.6);
		pointer-events: none;
	}

	.knob {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 48px;
		height: 48px;
		margin: -24px 0 0 -24px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.85);
	}
</style>
