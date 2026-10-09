<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { CATEGORIES, CATEGORY_LABEL, type Category, type ClosetPiece } from '$lib/pieces';

	let {
		worn = {},
		height = '70vh'
	}: {
		worn: Partial<Record<Category, ClosetPiece | undefined>>;
		height?: string;
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
		const stillMoving = controls.update();
		renderer.render(scene, camera);
		if (stillMoving) {
			rafId = requestAnimationFrame(loop);
		} else {
			animating = false;
			rafId = null;
		}
	}

	function getMannequinColor(container: HTMLElement): THREE.Color {
		try {
			const probe = document.createElement('span');
			probe.style.color = 'var(--t-tint)';
			probe.style.backgroundColor = 'var(--t-muted)';
			probe.style.display = 'none';
			container.appendChild(probe);
			const style = window.getComputedStyle(probe);
			const tint = style.color;
			const muted = style.backgroundColor;
			container.removeChild(probe);
			if (tint && tint !== 'rgba(0, 0, 0, 0)' && tint !== 'transparent') {
				return new THREE.Color(tint);
			}
			if (muted && muted !== 'rgba(0, 0, 0, 0)' && muted !== 'transparent') {
				return new THREE.Color(muted);
			}
		} catch {
			// Fallback
		}

		try {
			const style = window.getComputedStyle(container);
			const tint = style.getPropertyValue('--t-tint').trim();
			if (tint) return new THREE.Color(tint);
			const muted = style.getPropertyValue('--t-muted').trim();
			if (muted) return new THREE.Color(muted);
		} catch {
			// Fallback
		}

		return new THREE.Color('#d8d4cf');
	}

	function getLineColor(container: HTMLElement): THREE.Color {
		try {
			const probe = document.createElement('span');
			probe.style.color = 'var(--t-line)';
			probe.style.display = 'none';
			container.appendChild(probe);
			const style = window.getComputedStyle(probe);
			const line = style.color;
			container.removeChild(probe);
			if (line && line !== 'rgba(0, 0, 0, 0)' && line !== 'transparent') {
				return new THREE.Color(line);
			}
		} catch {
			// Fallback
		}

		try {
			const style = window.getComputedStyle(container);
			const line = style.getPropertyValue('--t-line').trim();
			if (line) return new THREE.Color(line);
		} catch {
			// Fallback
		}

		return new THREE.Color('#e5e5e5');
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
				const hatGeo = new THREE.CylinderGeometry(
					0.06,
					0.16,
					0.13,
					24,
					1,
					false,
					-0.85 * Math.PI,
					1.7 * Math.PI
				);
				const hatMesh = new THREE.Mesh(hatGeo, material);
				hatMesh.position.set(0, 1.74, 0.02);
				hatMesh.rotation.x = 0.08;
				entry.object = hatMesh;
				entry.geometries.push(hatGeo);
				break;
			}
			case 'top': {
				const topGeo = new THREE.CylinderGeometry(
					0.235,
					0.19,
					0.52,
					28,
					1,
					true,
					-0.85 * Math.PI,
					1.7 * Math.PI
				);
				const topMesh = new THREE.Mesh(topGeo, material);
				topMesh.position.set(0, 1.14, 0);
				topMesh.scale.set(1.03, 1, 0.82);
				entry.object = topMesh;
				entry.geometries.push(topGeo);
				break;
			}
			case 'bottom': {
				const bottomGroup = new THREE.Group();

				// Hip waistband shell: starts at hip line y=0.90, slightly outside top hem
				const hipGeo = new THREE.CylinderGeometry(
					0.22,
					0.21,
					0.1,
					28,
					1,
					true,
					-0.85 * Math.PI,
					1.7 * Math.PI
				);
				const hipMesh = new THREE.Mesh(hipGeo, material);
				hipMesh.position.set(0, 0.85, 0);
				hipMesh.scale.set(1.05, 1, 0.84);
				bottomGroup.add(hipMesh);
				entry.geometries.push(hipGeo);

				// Two tapered leg shells down to ankles with visible gap between them
				const legShellGeo = new THREE.CylinderGeometry(
					0.1,
					0.065,
					0.76,
					20,
					1,
					true,
					-0.85 * Math.PI,
					1.7 * Math.PI
				);
				const leftLegShell = new THREE.Mesh(legShellGeo, material);
				leftLegShell.position.set(-0.11, 0.44, 0);
				const rightLegShell = new THREE.Mesh(legShellGeo, material);
				rightLegShell.position.set(0.11, 0.44, 0);
				rightLegShell.scale.set(-1, 1, 1);
				bottomGroup.add(leftLegShell, rightLegShell);
				entry.geometries.push(legShellGeo);

				entry.object = bottomGroup;
				break;
			}
			case 'shoes': {
				const shoeGroup = new THREE.Group();
				const shoeGeo = new THREE.BoxGeometry(0.09, 0.07, 0.18);
				const leftShoe = new THREE.Mesh(shoeGeo, material);
				leftShoe.position.set(-0.11, 0.035, 0.05);
				const rightShoe = new THREE.Mesh(shoeGeo, material);
				rightShoe.position.set(0.11, 0.035, 0.05);
				rightShoe.scale.set(-1, 1, 1);
				shoeGroup.add(leftShoe);
				shoeGroup.add(rightShoe);
				entry.object = shoeGroup;
				entry.geometries.push(shoeGeo);
				break;
			}
			case 'bag': {
				const bagGroup = new THREE.Group();
				const shape = new THREE.Shape();
				const bw = 0.2;
				const bh = 0.16;
				const br = 0.03;
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

				const bagMesh = new THREE.Mesh(bagGeo, material);
				bagMesh.position.set(-0.25, 0.85, 0.06);
				bagMesh.rotation.y = 0.15;
				bagGroup.add(bagMesh);
				entry.geometries.push(bagGeo);

				const strapPoints = [
					new THREE.Vector3(-0.24, 0.93, 0.06),
					new THREE.Vector3(-0.08, 1.15, 0.18),
					new THREE.Vector3(0.18, 1.41, 0.04),
					new THREE.Vector3(0.16, 1.38, -0.06),
					new THREE.Vector3(0.02, 1.15, -0.16),
					new THREE.Vector3(-0.24, 0.93, -0.02),
					new THREE.Vector3(-0.24, 0.93, 0.06)
				];
				const strapGeo = new THREE.BufferGeometry().setFromPoints(strapPoints);
				const strapMat = new THREE.LineBasicMaterial({ color: lineColor.clone() });
				const strapLine = new THREE.Line(strapGeo, strapMat);
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
				accMesh.position.set(0, 1.39, 0.04);
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

		scene = new THREE.Scene();
		const activeScene = scene;
		const initialWidth = containerEl.clientWidth || 300;
		const initialHeight = containerEl.clientHeight || 500;

		camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight, 0.1, 20);
		camera.position.set(0, 1.1, 2.5);
		camera.lookAt(0, 0.9, 0);

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
		controls.target.set(0, 0.9, 0);
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
		const baseGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.02, 32);
		const baseMesh = new THREE.Mesh(baseGeo, mannequinMaterial);
		baseMesh.position.set(0, -0.02, 0);
		mannequinGeometries.push(baseGeo);
		mannequinGroup.add(baseMesh);

		// Two legs (about 46.7% of total height, feet on y=0)
		const legGeo = new THREE.CylinderGeometry(0.075, 0.05, 0.84, 20);
		const leftLeg = new THREE.Mesh(legGeo, mannequinMaterial);
		leftLeg.position.set(-0.11, 0.42, 0);
		const rightLeg = new THREE.Mesh(legGeo, mannequinMaterial);
		rightLeg.position.set(0.11, 0.42, 0);
		mannequinGeometries.push(legGeo);
		mannequinGroup.add(leftLeg, rightLeg);

		// Torso (LatheGeometry with hips, waist, chest, shoulders)
		const torsoPoints = [
			new THREE.Vector2(0.18, 0.84),
			new THREE.Vector2(0.19, 0.95),
			new THREE.Vector2(0.16, 1.1),
			new THREE.Vector2(0.21, 1.28),
			new THREE.Vector2(0.23, 1.38),
			new THREE.Vector2(0.1, 1.42)
		];
		const torsoGeo = new THREE.LatheGeometry(torsoPoints, 28);
		const torsoMesh = new THREE.Mesh(torsoGeo, mannequinMaterial);
		torsoMesh.scale.set(1, 1, 0.75);
		mannequinGeometries.push(torsoGeo);
		mannequinGroup.add(torsoMesh);

		// Neck
		const neckGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.1, 20);
		const neckMesh = new THREE.Mesh(neckGeo, mannequinMaterial);
		neckMesh.position.set(0, 1.47, 0);
		mannequinGeometries.push(neckGeo);
		mannequinGroup.add(neckMesh);

		// Head (sphere)
		const headGeo = new THREE.SphereGeometry(0.12, 24, 20);
		const headMesh = new THREE.Mesh(headGeo, mannequinMaterial);
		headMesh.position.set(0, 1.66, 0);
		mannequinGeometries.push(headGeo);
		mannequinGroup.add(headMesh);
		// Two arms (capsules angled slightly out)
		const armGeo = new THREE.CapsuleGeometry(0.045, 0.44, 8, 16);
		const leftArm = new THREE.Mesh(armGeo, mannequinMaterial);
		leftArm.position.set(-0.22, 1.13, 0);
		leftArm.rotation.z = 0.1;
		const rightArm = new THREE.Mesh(armGeo, mannequinMaterial);
		rightArm.position.set(0.22, 1.13, 0);
		rightArm.rotation.z = -0.1;
		mannequinGeometries.push(armGeo);
		mannequinGroup.add(leftArm, rightArm);

		scene.add(mannequinGroup);

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
