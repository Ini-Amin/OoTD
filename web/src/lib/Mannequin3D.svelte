<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
	import {
		CATEGORIES,
		CATEGORY_LABEL,
		type Category,
		type ClosetPiece,
		type AvatarCustomization,
		DEFAULT_AVATAR_CUSTOMIZATION
	} from '$lib/pieces';

	let {
		worn = {},
		height = '70vh',
		model = 'xbot',
		customization = DEFAULT_AVATAR_CUSTOMIZATION
	}: {
		worn: Partial<Record<Category, ClosetPiece | undefined>>;
		height?: string;
		model?: 'mannequin' | 'michelle' | 'xbot';
		customization?: AvatarCustomization;
	} = $props();

	type ShellEntry = {
		pieceId: string;
		object: THREE.Object3D;
		material: THREE.Material[];
		textures: THREE.Texture[];
		geometries: THREE.BufferGeometry[];
		disposed: boolean;
	};

	let containerEl: HTMLDivElement | undefined = $state();
	let webglError = $state(false);
	let mounted = $state(false);

	let destroyed = false;
	let animating = false;
	let rafId: number | null = null;

	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let controls: OrbitControls | null = null;
	let textureLoader: THREE.TextureLoader | null = null;
	let lineColor = new THREE.Color('#e5e5e5');
	let mannequinColor = new THREE.Color('#d8d4cf');

	const activeShells = new Map<Category, ShellEntry>();
	const mannequinGeometries: THREE.BufferGeometry[] = [];
	let mannequinMaterial: THREE.MeshStandardMaterial | null = null;
	let mannequinGroup: THREE.Group | null = null;
	let avatarGroup: THREE.Group | null = null;
	let gltfLoader: GLTFLoader | null = null;
	let mixer: THREE.AnimationMixer | null = null;
	let activeGltfClips: THREE.AnimationClip[] = [];
	let currentAction: THREE.AnimationAction | null = null;
	const clock = new THREE.Clock();

	const ariaLabel = $derived.by(() => {
		const active = CATEGORIES.filter((cat) => !!worn?.[cat]).map((cat) => CATEGORY_LABEL[cat]);
		if (active.length === 0) {
			return 'Mannequin wearing no pieces';
		}
		return `Mannequin wearing ${active.join(', ')}`;
	});

	function requestFrame(): void {
		if (destroyed || !renderer || !scene || !camera || !controls) return;
		if (!animating) {
			animating = true;
			rafId = requestAnimationFrame(loop);
		}
	}

	function loop(): void {
		if (destroyed || !renderer || !scene || !camera || !controls) {
			animating = false;
			rafId = null;
			return;
		}
		if (mixer) {
			const delta = clock.getDelta();
			mixer.update(delta);
		}
		const stillMoving = controls.update();
		renderer.render(scene, camera);
		if (stillMoving || mixer !== null) {
			rafId = requestAnimationFrame(loop);
		} else {
			animating = false;
			rafId = null;
		}
	}

	/**
	 * Snapshot the current frame for feed sharing. Renders synchronously and
	 * captures in the same task, so no preserveDrawingBuffer is needed.
	 * Returns null when WebGL is unavailable or the capture fails.
	 */
	export function captureSnapshot(): Promise<Blob | null> {
		if (webglError || destroyed || !renderer || !scene || !camera) {
			return Promise.resolve(null);
		}
		try {
			renderer.render(scene, camera);
			const canvas = renderer.domElement;
			return new Promise((resolve) => {
				canvas.toBlob((blob) => resolve(blob), 'image/png');
			});
		} catch {
			return Promise.resolve(null);
		}
	}

	/**
	 * Resolve ANY CSS colour (including `color-mix(...)`, which the theme tokens
	 * use) to concrete sRGB components.
	 *
	 * Why this exists: the theme tokens resolve to `color(srgb 0.91 0.91 0.91)`.
	 * three.js r186 does not parse that syntax — it logs
	 * "THREE.Color: Unknown color model" and silently keeps the previous value.
	 * Every themed colour therefore fell back to a constant, and the mannequin
	 * ended up painted the SAME colour as the panel behind it (#e8e8e8 on
	 * #e8e8e8), so the 3D view looked like an empty grey box. A 2D canvas
	 * understands every CSS colour the browser can produce, so we ask it.
	 */
	function resolveCssColor(css: string, fallback: string): THREE.Color {
		const probe = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });
		if (!probe) return new THREE.Color(fallback);
		probe.fillStyle = '#000';
		probe.fillStyle = css; // ignored if the browser cannot parse it
		probe.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
		if (a === 0) return new THREE.Color(fallback);
		return new THREE.Color(r / 255, g / 255, b / 255);
	}

	/** Read a theme token and convert it to a real THREE colour. */
	function tokenColor(container: HTMLElement, token: string, fallback: string): THREE.Color {
		try {
			const probe = document.createElement('span');
			probe.style.color = `var(${token})`;
			probe.style.display = 'none';
			container.appendChild(probe);
			const css = window.getComputedStyle(probe).color;
			container.removeChild(probe);
			if (css && css !== 'rgba(0, 0, 0, 0)' && css !== 'transparent') {
				return resolveCssColor(css, fallback);
			}
		} catch {
			// fall through to the literal fallback
		}
		return new THREE.Color(fallback);
	}

	/**
	 * The mannequin must READ as an object against the viewport, not blend into
	 * it. The mix is fg-into-surface (22%), deliberately NOT derived from
	 * --t-tint: --t-tint is the viewport background, so anything based on it
	 * lands within a few percent of the panel and the body vanishes. A theme
	 * that sets its own --t-mannequin still wins.
	 */
	function getMannequinColor(container: HTMLElement): THREE.Color {
		try {
			const probe = document.createElement('span');
			// 28%: at 22% the figure sat ~10% away from the panel luminance,
			// which is visible in a screenshot but marginal on a dim laptop
			// screen. 28% keeps it a soft neutral while clearing the panel.
			probe.style.color = 'var(--t-mannequin, color-mix(in srgb, var(--t-fg) 28%, var(--t-surface)))';
			probe.style.display = 'none';
			container.appendChild(probe);
			const css = window.getComputedStyle(probe).color;
			container.removeChild(probe);
			if (css && css !== 'rgba(0, 0, 0, 0)') return resolveCssColor(css, '#b9b4ae');
		} catch {
			// fall through
		}
		return new THREE.Color('#b9b4ae');
	}

	function getLineColor(container: HTMLElement): THREE.Color {
		return tokenColor(container, '--t-line', '#d6d6d6');
	}

	function disposeShell(entry: ShellEntry): void {
		entry.disposed = true;
		if (scene) {
			scene.remove(entry.object);
		}
		for (const g of entry.geometries) {
			g.dispose();
		}
		for (const m of entry.material) {
			m.dispose();
		}
		for (const t of entry.textures) {
			t.dispose();
		}
	}

	/**
	 * Body measurements, in metres, as ONE object.
	 *
	 * Every garment used to hardcode its own Y offsets, so changing the torso
	 * left the trousers floating and the shoes buried. The result was a body
	 * assembled from numbers that each looked reasonable in isolation. The
	 * build functions below derive their positions from these values, so a
	 * proportion change is a one-line edit here and nothing drifts.
	 *
	 * Reference: 1.78 m figure, 7.5 heads. floor = 0.
	 */
	const BODY = {
		floor: 0,
		ankle: 0.115,
		knee: 0.48,
		hip: 0.86,
		waist: 1.02,
		chest: 1.24,
		shoulder: 1.40,
		neckBase: 1.42,
		neckTop: 1.505,
		headCenter: 1.60,
		headTop: 1.735,
		legX: 0.105,
		legRadius: 0.075,
		hipRadius: 0.185,
		waistRadius: 0.155,
		chestRadius: 0.215,
		shoulderRadius: 0.225,
		armX: 0.245,
		armRadius: 0.043,
	};

	// Measured GLB head-top heights in model units (bind pose, unscaled).
	// Static GLB parse and a headless Box3 render agree: xbot 1.8061,
	// michelle 1.6616. The rendered top is this times avatarScale().
	const GLB_HEAD_TOP: Record<'xbot' | 'michelle', number> = {
		xbot: 1.8061,
		michelle: 1.6616
	};

	// The model actually on screen. Intentionally snapshots the `model` prop:
	// updateModel() keeps it in sync, and the GLTF error path flips it to
	// the procedural fallback.
	// svelte-ignore state_referenced_locally
	let resolvedModel: 'mannequin' | 'michelle' | 'xbot' = model;

	function avatarScale(): number {
		return 1.05 * (customization.height ?? 1.0);
	}

	// Y of the hat brim: 4.2cm below the RENDERED head top of the active
	// model. A fixed BODY value puts the xbot hat 20cm low (through the
	// eyes) — proven by headless Box3 probe, bbox.max.y=1.8964 at h=1.0.
	function hatBrimY(): number {
		if (resolvedModel === 'mannequin') return BODY.headTop - 0.042;
		return GLB_HEAD_TOP[resolvedModel] * avatarScale() - 0.042 * avatarScale();
	}

	function seatHat(): void {
		const hat = activeShells.get('hat');
		if (!hat || !scene) return;
		hat.object.position.set(0, hatBrimY(), 0.012);
		requestFrame();
	}

	function buildShell(cat: Category, piece: ClosetPiece): ShellEntry {
		const material = new THREE.MeshStandardMaterial({
			color: lineColor.clone(),
			roughness: 0.7,
			metalness: 0.05,
			side: THREE.DoubleSide
		});

		const entry: ShellEntry = {
			pieceId: piece.id,
			object: new THREE.Object3D(),
			material: [material],
			textures: [],
			geometries: [],
			disposed: false
		};

		if (piece.imageUrl && textureLoader) {
			try {
				const texture = textureLoader.load(
					piece.imageUrl,
					(tex) => {
						if (entry.disposed || destroyed) {
							tex.dispose();
							return;
						}
						material.color.setHex(0xffffff);
						material.map = tex;
						material.needsUpdate = true;
						requestFrame();
					},
					undefined,
					() => {
						// Error: keep flat colour, do not throw
					}
				);
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.wrapS = THREE.ClampToEdgeWrapping;
				texture.wrapT = THREE.ClampToEdgeWrapping;
				const repeatW = typeof piece.w === 'number' && piece.w > 0 ? piece.w : 1;
				const repeatH = typeof piece.h === 'number' && piece.h > 0 ? piece.h : 1;
				const posX = typeof piece.x === 'number' ? piece.x : 0;
				const posY = typeof piece.y === 'number' ? piece.y : 0;
				texture.repeat.set(repeatW, repeatH);
				texture.offset.set(posX, 1 - posY - repeatH);
				entry.textures.push(texture);
			} catch {
				// TextureLoader catch fallback
			}
		}

		switch (cat) {
			case 'hat': {
				// A tapered cylinder alone reads as a bucket. A hat is crown +
				// brim: without the brim the silhouette has no horizontal edge
				// at the widest point, which is what the eye uses to recognise
				// headwear at this scale.
				const hatGroup = new THREE.Group();

				const crownGeo = new THREE.CylinderGeometry(
					0.075,
					0.105,
					0.11,
					24,
					1,
					false,
					-0.85 * Math.PI,
					1.7 * Math.PI
				);
				const crown = new THREE.Mesh(crownGeo, material);
				crown.position.set(0, 0.05, 0);
				hatGroup.add(crown);
				entry.geometries.push(crownGeo);

				// Brim: a very flat, wide disc. Slightly tilted so it catches
				// the key light instead of disappearing edge-on.
				const brimGeo = new THREE.CylinderGeometry(0.175, 0.185, 0.012, 32);
				const brim = new THREE.Mesh(brimGeo, material);
				brim.position.set(0, -0.002, 0);
				brim.rotation.z = 0.03;
				hatGroup.add(brim);
				entry.geometries.push(brimGeo);

				hatGroup.position.set(0, hatBrimY(), 0.012);
				hatGroup.rotation.x = 0.06;
				entry.object = hatGroup;
				break;
			}
			case 'top': {
				// A truncated cone has a hard rim at the shoulders that reads as
				// a bucket, and because it is open you see the inside of the
				// garment. A lathe with a shoulder slope and a neck opening is
				// the same cost and produces a silhouette the eye accepts.
				const hemY = BODY.waist - 0.08;
				const topPoints = [
					new THREE.Vector2(BODY.waistRadius * 1.2, hemY),
					new THREE.Vector2(BODY.waistRadius * 1.17, BODY.waist + 0.04),
					new THREE.Vector2(BODY.chestRadius * 1.02, BODY.chest),
					new THREE.Vector2(BODY.chestRadius * 1.05, BODY.chest + 0.07),
					new THREE.Vector2(BODY.shoulderRadius * 1.02, BODY.shoulder - 0.02),
					// Shoulder slope inward toward the neck opening.
					new THREE.Vector2(BODY.shoulderRadius * 0.72, BODY.shoulder + 0.035),
					new THREE.Vector2(0.075, BODY.shoulder + 0.045)
				];
				const topGeo = new THREE.LatheGeometry(topPoints, 32, -0.85 * Math.PI, 1.7 * Math.PI);
				const topMesh = new THREE.Mesh(topGeo, material);
				topMesh.scale.set(1, 1, 0.82);
				entry.object = topMesh;
				entry.geometries.push(topGeo);
				break;
			}
			case 'bottom': {
				const bottomGroup = new THREE.Group();

				// Waistband: overlaps the top's hem so no skin shows at the seam.
				const bandH = 0.13;
				const hipGeo = new THREE.CylinderGeometry(
					BODY.hipRadius * 1.1,
					BODY.hipRadius * 1.06,
					bandH,
					28,
					1,
					true,
					-0.85 * Math.PI,
					1.7 * Math.PI
				);
				const hipMesh = new THREE.Mesh(hipGeo, material);
				hipMesh.position.set(0, BODY.hip + 0.045, 0);
				hipMesh.scale.set(1, 1, 0.84);
				bottomGroup.add(hipMesh);
				entry.geometries.push(hipGeo);

				// Trousers run from the waistband to the ankle, derived so they
				// always meet the shoe opening.
				// Hem sits above the shoe opening (ankle + 0.055) so the boot is
				// not swallowed by the trouser leg.
				const hemY = BODY.ankle + 0.055;
				const shellH = BODY.hip - hemY;
				const legShellGeo = new THREE.CylinderGeometry(
					BODY.legRadius * 1.28,
					BODY.legRadius * 0.92,
					shellH,
					20,
					1,
					true,
					-0.85 * Math.PI,
					1.7 * Math.PI
				);
				const leftLegShell = new THREE.Mesh(legShellGeo, material);
				leftLegShell.position.set(-BODY.legX, hemY + shellH / 2, 0);
				const rightLegShell = new THREE.Mesh(legShellGeo, material);
				rightLegShell.position.set(BODY.legX, hemY + shellH / 2, 0);
				rightLegShell.scale.set(-1, 1, 1);
				bottomGroup.add(leftLegShell, rightLegShell);
				entry.geometries.push(legShellGeo);

				entry.object = bottomGroup;
				break;
			}
			case 'shoes': {
				// A shoe is a sole plus an upper that reaches the ankle. The old
				// single 0.07-tall box sat entirely below the calf cylinder and
				// was invisible from the front. Two parts also give the piece a
				// toe direction, which a plain box does not.
				// Sole + upper + a rounded toe cap. The previous single flat box
				// read as a dark chip under the trouser hem, which is why every
				// saved pair of shoes looked like a rendering error.
				const shoeGroup = new THREE.Group();
				const soleGeo = new THREE.BoxGeometry(0.095, 0.026, 0.235);
				const upperGeo = new THREE.BoxGeometry(0.088, 0.095, 0.145);
				const toeGeo = new THREE.CapsuleGeometry(0.038, 0.075, 4, 12);

				for (const side of [-1, 1]) {
					const sole = new THREE.Mesh(soleGeo, material);
					sole.position.set(side * BODY.legX, BODY.floor + 0.013, 0.042);

					const upper = new THREE.Mesh(upperGeo, material);
					// Upper rises to the trouser hem (ankle + 0.055) so the two
					// meet without the shoe swallowing the calf.
					upper.position.set(side * BODY.legX, BODY.floor + 0.075, 0.0);

					// Toe: capsule lying along Z, front of the sole.
					const toe = new THREE.Mesh(toeGeo, material);
					toe.rotation.x = Math.PI / 2;
					toe.position.set(side * BODY.legX, BODY.floor + 0.052, 0.128);

					shoeGroup.add(sole, upper, toe);
				}
				entry.object = shoeGroup;
				entry.geometries.push(soleGeo, upperGeo, toeGeo);
				break;
			}
			case 'bag': {
				const bagGroup = new THREE.Group();
				const shape = new THREE.Shape();
				const bw = 0.155;
				const bh = 0.125;
				const br = 0.026;
				const bx = -bw / 2;
				const by = -bh / 2;
				shape.moveTo(bx + br, by);
				shape.lineTo(bx + bw - br, by);
				shape.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
				shape.lineTo(bx + bw, by + bh - br);
				shape.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
				shape.lineTo(bx + br, by + bh);
				shape.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
				shape.lineTo(bx, by + br);
				shape.quadraticCurveTo(bx, by, bx + br, by);

				const bagGeo = new THREE.ShapeGeometry(shape);
				const posAttr = bagGeo.attributes.position;
				const uvAttr = bagGeo.attributes.uv;
				if (posAttr instanceof THREE.BufferAttribute && uvAttr instanceof THREE.BufferAttribute) {
					for (let i = 0; i < uvAttr.count; i++) {
						const px = posAttr.getX(i);
						const py = posAttr.getY(i);
						uvAttr.setXY(i, (px - bx) / bw, (py - by) / bh);
					}
					uvAttr.needsUpdate = true;
				}

				// A bag hangs at the hand, i.e. BELOW the hip line, slightly
				// forward of the body. At hip height it collided with the top's
				// hem and read as a red patch on the garment.
				const bagX = -(BODY.hipRadius + 0.055);
				const bagY = BODY.hip - 0.10;
				const bagMesh = new THREE.Mesh(bagGeo, material);
				bagMesh.position.set(bagX, bagY, 0.085);
				bagMesh.rotation.y = 0.15;
				bagGroup.add(bagMesh);
				entry.geometries.push(bagGeo);

				// A strap has to read as ONE band from the bag, over the near
				// shoulder, to the back. The previous control points looped
				// around the torso centre, so the line cut straight across the
				// chest and looked like a scratch on the render. These follow
				// the shoulder line on the bag's own side (x = -0.24) and stay
				// on the body surface: front (z>0) up, over the shoulder, then
				// down the back (z<0).
				const strapPoints = [
					new THREE.Vector3(bagX + 0.004, bagY + 0.075, 0.085),
					new THREE.Vector3(bagX + 0.02, BODY.waist - 0.02, 0.105),
					new THREE.Vector3(bagX + 0.05, BODY.chest, 0.075),
					new THREE.Vector3(bagX + 0.085, BODY.shoulder + 0.005, 0.0),
					new THREE.Vector3(bagX + 0.07, BODY.chest - 0.07, -0.075),
					new THREE.Vector3(bagX + 0.03, BODY.waist - 0.09, -0.10),
					new THREE.Vector3(bagX + 0.004, bagY + 0.06, -0.05)
				];
				const strapGeo = new THREE.BufferGeometry().setFromPoints(strapPoints);
				// A 1px LineBasicMaterial disappears at any distance. Tube
				// geometry costs nothing here and survives zooming.
				const strapMat = new THREE.MeshStandardMaterial({
					color: lineColor.clone(),
					roughness: 0.8,
					metalness: 0.05
				});
				const strapCurve = new THREE.CatmullRomCurve3(strapPoints);
				const strapTubeGeo = new THREE.TubeGeometry(strapCurve, 32, 0.012, 8, false);
				const strapLine = new THREE.Mesh(strapTubeGeo, strapMat);
				entry.geometries.push(strapTubeGeo);
				bagGroup.add(strapLine);
				entry.geometries.push(strapGeo);
				entry.material.push(strapMat);

				entry.object = bagGroup;
				break;
			}
			case 'accessory': {
				const accGeo = new THREE.CylinderGeometry(
					0.14,
					0.15,
					0.12,
					20,
					1,
					true,
					-0.45 * Math.PI,
					0.9 * Math.PI
				);
				const accMesh = new THREE.Mesh(accGeo, material);
				accMesh.position.set(0, BODY.neckBase - 0.02, 0.035);
				accMesh.scale.set(1.02, 1, 0.85);
				entry.object = accMesh;
				entry.geometries.push(accGeo);
				break;
			}
		}

		return entry;
	}

	function syncWorn(current: Partial<Record<Category, ClosetPiece | undefined>>): void {
		if (!scene) return;
		let changed = false;

		for (const cat of CATEGORIES) {
			const piece = current[cat];
			const existing = activeShells.get(cat);

			if (!piece) {
				if (existing) {
					disposeShell(existing);
					activeShells.delete(cat);
					changed = true;
				}
				continue;
			}

			if (existing && existing.pieceId === piece.id) {
				continue;
			}

			if (existing) {
				disposeShell(existing);
				activeShells.delete(cat);
			}

			const entry = buildShell(cat, piece);
			activeShells.set(cat, entry);
			scene.add(entry.object);
			changed = true;
		}

		if (changed) {
			requestFrame();
		}
	}

	$effect(() => {
		const currentWorn: Partial<Record<Category, ClosetPiece | undefined>> = {
			hat: worn?.hat,
			top: worn?.top,
			bottom: worn?.bottom,
			shoes: worn?.shoes,
			bag: worn?.bag,
			accessory: worn?.accessory
		};

		if (!mounted || destroyed || !scene) return;
		syncWorn(currentWorn);
	});

	function applyCustomizationToModel(): void {
		if (!avatarGroup || !avatarGroup.children.length) return;
		const root = avatarGroup.children[0];
		if (!root) return;

		// 1. Overall height & base scale
		const h = customization.height ?? 1.0;
		root.scale.set(1.05 * h, 1.05 * h, 1.05 * h);

		// Helper to find bones with or without Mixamo prefix
		const findBone = (name: string): THREE.Object3D | undefined => {
			return (
				root.getObjectByName(name) ||
				root.getObjectByName(`mixamorig${name}`) ||
				root.getObjectByName(`mixamorig:${name}`)
			);
		};

		// 2. Bone scaling
		const hips = findBone('Hips');
		const spine = findBone('Spine');
		const spine2 = findBone('Spine2');
		const leftShoulder = findBone('LeftShoulder');
		const rightShoulder = findBone('RightShoulder');
		const leftArm = findBone('LeftArm');
		const rightArm = findBone('RightArm');
		const head = findBone('Head');

		const sHips = customization.hips ?? 1.0;
		const sWaist = customization.waist ?? 1.0;
		const sChest = customization.chest ?? 1.0;
		const sShoulders = customization.shoulders ?? 1.0;
		const sHead = customization.headSize ?? 1.0;

		if (hips) {
			hips.scale.set(sHips, 1, sHips);
		}
		if (spine) {
			const factor = sWaist / (sHips || 1.0);
			spine.scale.set(factor, 1, factor);
		}
		if (spine2) {
			const factor = sChest / (sWaist || 1.0);
			spine2.scale.set(factor, 1, factor);
		}
		if (leftShoulder && rightShoulder) {
			leftShoulder.scale.set(sShoulders, sShoulders, sShoulders);
			rightShoulder.scale.set(sShoulders, sShoulders, sShoulders);
			const inv = 1 / (sShoulders || 1.0);
			if (leftArm) leftArm.scale.set(inv, inv, inv);
			if (rightArm) rightArm.scale.set(inv, inv, inv);
		}
		if (head) {
			head.scale.set(sHead, sHead, sHead);
		}

		// 3. Skin tone / Material tint (Joints darker accent, body surface skin tone)
		if (customization.skinTone) {
			const tone = new THREE.Color(customization.skinTone);
			const jointTone = tone.clone().multiplyScalar(0.42);

			root.traverse((child) => {
				if ((child as THREE.Mesh).isMesh) {
					const mesh = child as THREE.Mesh;
					if (mesh.material) {
						const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
						for (const m of mats) {
							if ('color' in m && (m as THREE.MeshStandardMaterial).color) {
								const stdMat = m as THREE.MeshStandardMaterial;
								const isJoint =
									mesh.name.toLowerCase().includes('joint') ||
									(m.name && m.name.toLowerCase().includes('joint'));
								if (isJoint) {
									stdMat.color.copy(jointTone);
									stdMat.roughness = 0.55;
									stdMat.metalness = 0.35;
								} else {
									stdMat.color.copy(tone);
									stdMat.roughness = 0.8;
									stdMat.metalness = 0.05;
								}
								stdMat.needsUpdate = true;
							}
						}
					}
				}
			});
		}

		// 4. Animation
		if (mixer && activeGltfClips.length > 0) {
			const targetAnim = customization.animation ?? 'idle';
			if (targetAnim === 'stand') {
				mixer.stopAllAction();
				currentAction = null;
			} else {
				let clipToPlay: THREE.AnimationClip | undefined;
				if (targetAnim === 'walk') {
					clipToPlay = activeGltfClips.find((c) => c.name.toLowerCase().includes('walk'));
				} else if (targetAnim === 'pose') {
					clipToPlay = activeGltfClips.find(
						(c) =>
							c.name.toLowerCase().includes('agree') ||
							c.name.toLowerCase().includes('pose') ||
							c.name.toLowerCase().includes('headshake')
					);
				} else {
					clipToPlay = activeGltfClips.find(
						(c) =>
							c.name.toLowerCase().includes('idle') ||
							c.name.toLowerCase().includes('samba')
					);
				}
				if (!clipToPlay) {
					clipToPlay = activeGltfClips[0];
				}

				if (clipToPlay) {
					const nextAction = mixer.clipAction(clipToPlay);
					if (currentAction !== nextAction) {
						if (currentAction) {
							currentAction.fadeOut(0.3);
						}
						nextAction.reset().fadeIn(0.3).play();
						currentAction = nextAction;
					}
				}
			}
		}

		seatHat();
		requestFrame();
	}

	function updateModel(currentModel: 'mannequin' | 'michelle' | 'xbot'): void {
		if (!scene || !avatarGroup) return;
		resolvedModel = currentModel;
		seatHat();
		if (mannequinGroup) {
			mannequinGroup.visible = currentModel === 'mannequin';
		}
		if (currentModel === 'mannequin') {
			avatarGroup.clear();
			if (mixer) {
				mixer.stopAllAction();
				mixer = null;
			}
			currentAction = null;
			activeGltfClips = [];
			requestFrame();
			return;
		}

		if (!gltfLoader) {
			gltfLoader = new GLTFLoader();
		}

		avatarGroup.clear();
		if (mixer) {
			mixer.stopAllAction();
			mixer = null;
		}
		currentAction = null;
		activeGltfClips = [];

		const modelPath = currentModel === 'michelle' ? '/models/michelle.glb' : '/models/xbot.glb';
		gltfLoader.load(
			modelPath,
			(gltf) => {
				if (destroyed || !scene || !avatarGroup || model !== currentModel) return;
				const currentGroup = avatarGroup;
				const obj = gltf.scene;
				obj.position.set(0, 0, 0);

				obj.traverse((child) => {
					if ((child as THREE.Mesh).isMesh) {
						child.castShadow = true;
						child.receiveShadow = true;
					}
				});

				// Strip scale tracks so animations don't clobber custom bone scaling
				for (const clip of gltf.animations || []) {
					clip.tracks = clip.tracks.filter((t) => !t.name.endsWith('.scale'));
				}
				activeGltfClips = gltf.animations || [];
				if (activeGltfClips.length > 0) {
					mixer = new THREE.AnimationMixer(obj);
				}

				currentGroup.clear();
				currentGroup.add(obj);
				applyCustomizationToModel();
				requestFrame();
			},
			undefined,
			(err) => {
				console.error('Failed to load GLTF avatar:', err);
				if (mannequinGroup) mannequinGroup.visible = true;
				resolvedModel = 'mannequin';
				seatHat();
				requestFrame();
			}
		);
	}

	$effect(() => {
		const m = model;
		if (mounted && scene) {
			updateModel(m);
		}
	});

	$effect(() => {
		void customization.height;
		void customization.shoulders;
		void customization.chest;
		void customization.waist;
		void customization.hips;
		void customization.headSize;
		void customization.skinTone;
		void customization.animation;

		if (mounted && scene && avatarGroup) {
			applyCustomizationToModel();
		}
	});

	onMount(() => {
		if (!containerEl) return;

		try {
			renderer = new THREE.WebGLRenderer({
				alpha: true,
				antialias: true,
				powerPreference: 'high-performance'
			});
			if (!renderer.getContext()) {
				throw new Error('WebGL context unavailable');
			}
		} catch {
			webglError = true;
			return;
		}

		const activeRenderer = renderer;
		activeRenderer.setClearColor(0x000000, 0);
		activeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

		mannequinColor = getMannequinColor(containerEl);
		lineColor = getLineColor(containerEl);
		// The garment shells are built with `lineColor` at build time, so any
		// piece already worn when the theme changes keeps the OLD colour. The
		// viewport must be re-themed as a unit, not per-piece.
		void mannequinColor;

		scene = new THREE.Scene();
		const activeScene = scene;
		const initialWidth = containerEl.clientWidth || 300;
		const initialHeight = containerEl.clientHeight || 500;

		// Frame the whole figure: the model spans y=0..1.74 and the old camera
		// sat at y=1.1 looking at y=0.9, which cropped the base on short
		// viewports and left a third of the frame empty on tall ones.
		camera = new THREE.PerspectiveCamera(40, initialWidth / initialHeight, 0.1, 20);
		camera.position.set(0, 0.97, 3.05);
		camera.lookAt(0, 0.88, 0);

		renderer.setSize(initialWidth, initialHeight, false);
		renderer.domElement.style.width = '100%';
		renderer.domElement.style.height = '100%';
		renderer.domElement.style.display = 'block';
		containerEl.appendChild(renderer.domElement);

		textureLoader = new THREE.TextureLoader();
		textureLoader.setCrossOrigin('anonymous');

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		controls = new OrbitControls(camera, activeRenderer.domElement);
		const activeControls = controls;
		controls.dampingFactor = prefersReducedMotion ? 0.2 : 0.05;
		controls.enablePan = false;
		controls.autoRotate = false;
		controls.minDistance = 1.0;
		controls.maxDistance = 4.0;
		controls.maxPolarAngle = Math.PI / 2;
		controls.minPolarAngle = 0.1;
		controls.target.set(0, 0.88, 0);
		controls.update();

		controls.addEventListener('start', requestFrame);
		controls.addEventListener('change', requestFrame);
		controls.addEventListener('end', requestFrame);

		const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.1);
		hemiLight.position.set(0, 3, 0);
		scene.add(hemiLight);

		const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
		dirLight.position.set(2, 3, 3);
		scene.add(dirLight);

		mannequinMaterial = new THREE.MeshStandardMaterial({
			color: mannequinColor,
			roughness: 0.85,
			metalness: 0.05
		});

		mannequinGroup = new THREE.Group();

		// Base plate (sits below y=0 so it never covers feet/shoes)
		const baseGeo = new THREE.CylinderGeometry(0.26, 0.27, 0.018, 40);
		const baseMesh = new THREE.Mesh(baseGeo, mannequinMaterial);
		baseMesh.position.set(0, -0.02, 0);
		mannequinGeometries.push(baseGeo);
		mannequinGroup.add(baseMesh);

		// Two legs. They stop at ankle height (y=0.12) instead of reaching the
		// floor: the old 0.84-long cylinder swallowed the shoe geometry, so
		// every saved pair of shoes rendered as a dark sliver inside the calf.
		const legH = BODY.hip - BODY.ankle;
		const legGeo = new THREE.CylinderGeometry(BODY.legRadius, BODY.legRadius * 0.7, legH, 20);
		const leftLeg = new THREE.Mesh(legGeo, mannequinMaterial);
		leftLeg.position.set(-BODY.legX, BODY.ankle + legH / 2, 0);
		const rightLeg = new THREE.Mesh(legGeo, mannequinMaterial);
		rightLeg.position.set(BODY.legX, BODY.ankle + legH / 2, 0);
		mannequinGeometries.push(legGeo);
		mannequinGroup.add(leftLeg, rightLeg);

		// Torso (LatheGeometry with hips, waist, chest, shoulders)
		const torsoPoints = [
			new THREE.Vector2(BODY.hipRadius, BODY.hip),
			new THREE.Vector2(BODY.hipRadius, BODY.hip + 0.06),
			new THREE.Vector2(BODY.waistRadius, BODY.waist),
			new THREE.Vector2(BODY.chestRadius * 0.93, BODY.chest - 0.06),
			new THREE.Vector2(BODY.chestRadius, BODY.chest + 0.06),
			new THREE.Vector2(BODY.shoulderRadius, BODY.shoulder),
			new THREE.Vector2(0.10, BODY.neckBase)
		];
		const torsoGeo = new THREE.LatheGeometry(torsoPoints, 28);
		const torsoMesh = new THREE.Mesh(torsoGeo, mannequinMaterial);
		torsoMesh.scale.set(1, 1, 0.75);
		mannequinGeometries.push(torsoGeo);
		mannequinGroup.add(torsoMesh);

		// Neck. The torso lathe closes at y=1.42 with radius 0.10, so the neck
		// has to start inside that opening and the head must overlap its top.
		// Previously there was a 20mm air gap: the head visibly floated.
		const neckH = BODY.neckTop - BODY.neckBase + 0.02;
		const neckGeo = new THREE.CylinderGeometry(0.058, 0.078, neckH, 20);
		const neckMesh = new THREE.Mesh(neckGeo, mannequinMaterial);
		neckMesh.position.set(0, BODY.neckBase - 0.01 + neckH / 2, 0);
		mannequinGeometries.push(neckGeo);
		mannequinGroup.add(neckMesh);

		// Head (slightly ovoid — a perfect sphere reads as a pinhead on a
		// 1.8m body at this camera distance)
		const headGeo = new THREE.SphereGeometry(0.118, 28, 22);
		headGeo.scale(0.9, 1.12, 0.96);
		const headMesh = new THREE.Mesh(headGeo, mannequinMaterial);
		headMesh.position.set(0, BODY.headCenter, 0);
		mannequinGeometries.push(headGeo);
		mannequinGroup.add(headMesh);
		// Two arms (capsules angled slightly out)
		// Arms hang from the shoulder joint down past the hip. Length is derived
		// from the shoulder height so they always end near mid-thigh.
		// The capsule must start INSIDE the shoulder mass, otherwise the arm
		// floats beside the body with a visible seam. armTop is below the
		// shoulder line by one arm radius, and the x offset is reduced so the
		// capsule's inner surface overlaps the torso lathe.
		// The capsule TOP must sit at the shoulder line (inside the garment's
		// shoulder slope) and its bottom at mid-thigh. Sizing it from armLen
		// alone left the top 26 mm below the shoulder, which is the gap that
		// made the arms look bolted on beside the body.
		const armBottomY = BODY.hip - 0.055;
		const armTop = BODY.shoulder + 0.004;
		const armLen = Math.max(0.1, armTop - armBottomY - 2 * BODY.armRadius);
		const armGeo = new THREE.CapsuleGeometry(BODY.armRadius, armLen, 6, 14);

		// No separate shoulder ball: it either hides inside the torso (and does
		// nothing) or pokes out of the garment as a bead. The arm capsule is
		// positioned so its TOP HEMISPHERE is inside the torso lathe — the
		// silhouette then shows an arm emerging from the body, which is what the
		// eye reads as a shoulder.
		const armX = BODY.shoulderRadius - BODY.armRadius * 0.45;
		const armCenterY = armTop - (armLen / 2 + BODY.armRadius);
		const leftArm = new THREE.Mesh(armGeo, mannequinMaterial);
		leftArm.position.set(-armX, armCenterY, 0);
		leftArm.rotation.z = 0.035;
		const rightArm = new THREE.Mesh(armGeo, mannequinMaterial);
		rightArm.position.set(armX, armCenterY, 0);
		rightArm.rotation.z = -0.035;
		mannequinGeometries.push(armGeo);
		mannequinGroup.add(leftArm, rightArm);

		scene.add(mannequinGroup);
		avatarGroup = new THREE.Group();
		scene.add(avatarGroup);
		const resizeObserver = new ResizeObserver((entries) => {
			if (destroyed || !renderer || !camera) return;
			for (const entry of entries) {
				const { width, height: h } = entry.contentRect;
				if (width <= 0 || h <= 0) continue;
				camera.aspect = width / h;
				camera.updateProjectionMatrix();
				renderer.setSize(width, h, false);
				requestFrame();
			}
		});
		resizeObserver.observe(containerEl);

		mounted = true;

		syncWorn({
			hat: worn?.hat,
			top: worn?.top,
			bottom: worn?.bottom,
			shoes: worn?.shoes,
			bag: worn?.bag,
			accessory: worn?.accessory
		});
		requestFrame();

		return () => {
			destroyed = true;
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			resizeObserver.disconnect();
			activeControls.removeEventListener('start', requestFrame);
			activeControls.removeEventListener('change', requestFrame);
			activeControls.removeEventListener('end', requestFrame);
			activeControls.dispose();

			for (const [, entry] of activeShells) {
				disposeShell(entry);
			}
			activeShells.clear();

			if (avatarGroup) {
				avatarGroup.clear();
				activeScene.remove(avatarGroup);
				avatarGroup = null;
			}
			if (mixer) {
				mixer.stopAllAction();
				mixer = null;
			}
			if (mannequinGroup) {
				activeScene.remove(mannequinGroup);
			}
			for (const g of mannequinGeometries) {
				g.dispose();
			}
			mannequinMaterial?.dispose();

			activeRenderer.dispose();
			if (activeRenderer.domElement.parentElement === containerEl) {
				containerEl.removeChild(activeRenderer.domElement);
			}
		};
	});
</script>

<div
	bind:this={containerEl}
	class="mannequin-container"
	style:height
	role="img"
	aria-label={ariaLabel}
>
	{#if webglError}
		<div class="webgl-fallback">
			<p>3D preview needs WebGL. Your pieces are still saved.</p>
		</div>
	{/if}
</div>

<style>
	.mannequin-container {
		position: relative;
		width: 100%;
		height: 70vh;
		display: block;
		overflow: hidden;
		user-select: none;
		touch-action: none;
		outline: none;
	}

	.mannequin-container :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}

	.webgl-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 2rem;
		text-align: center;
		border: 1px dashed var(--t-line, #e5e5e5);
		border-radius: var(--t-radius, 8px);
		background-color: var(--t-surface, transparent);
	}

	.webgl-fallback p {
		margin: 0;
		font-family: var(--t-font, inherit);
		font-size: 0.875rem;
		color: var(--t-muted, #737373);
		line-height: 1.5;
	}

	@media (prefers-reduced-motion: reduce) {
		.mannequin-container {
			transition: none;
		}
	}
</style>
