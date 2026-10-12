import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { destinations, route, walkable, WORLD_COLORS as C, type Person } from './district';

export function createWorld(canvas: HTMLCanvasElement, onSelect: (id: string) => void, onMove: (x: number, z: number) => void) {
 const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
 renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
 renderer.shadowMap.enabled = true;
 renderer.shadowMap.type = THREE.PCFSoftShadowMap;
 const scene = new THREE.Scene();
 scene.background = new THREE.Color(C.pale);
 const camera = new THREE.OrthographicCamera(-17, 17, 13, -13, 0.1, 120);
 camera.position.set(24, 29, 32);
 const controls = new OrbitControls(camera, canvas);
 controls.target.set(0, 0, -1);
 controls.enablePan = false;
 controls.enableDamping = false;
 controls.minZoom = 0.65; controls.maxZoom = 2;
 controls.minPolarAngle = 0.3; controls.maxPolarAngle = Math.PI / 2.6;
 controls.mouseButtons.LEFT = null as unknown as THREE.MOUSE;
 controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
 controls.touches.ONE = null as unknown as THREE.TOUCH;
 controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
 controls.update();
 scene.add(new THREE.HemisphereLight(C.white, C.slate, 2.3));
 const sun = new THREE.DirectionalLight(C.white, 3);
 sun.position.set(-12, 28, 18); sun.castShadow = true;
 sun.shadow.mapSize.set(2048, 2048);
 Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 80 });
 sun.shadow.normalBias = 0.06;
 scene.add(sun);
 const resources: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
 const mats = Object.fromEntries(Object.entries(C).map(([name, color]) => {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85 }); resources.push(material); return [name, material];
 })) as Record<keyof typeof C, THREE.MeshStandardMaterial>;
 const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = scene) => {
  const geo = new THREE.BoxGeometry(w, h, d); resources.push(geo);
  const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
 };
 const label = (text: string, width: number, color = C.ink, bg = C.white) => {
  const image = document.createElement('canvas'); image.width = 1024; image.height = 192;
  const ctx = image.getContext('2d')!;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, image.width, image.height);
  ctx.fillStyle = color; ctx.font = '600 62px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 100, 960);
  const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace; resources.push(texture);
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false }); resources.push(mat);
  const sprite = new THREE.Sprite(mat); sprite.scale.set(width, width * 192 / 1024, 1); return sprite;
 };
 box(25, 0.5, 25, 0, -0.3, 0, mats.slate);
 const ground = box(24, 0.14, 24, 0, 0, 0, mats.pale);
 box(4.6, 0.02, 24, 0, 0.09, 0, mats.white);
 box(24, 0.02, 4.4, 0, 0.1, 0, mats.white);
 const circleGeo = new THREE.CylinderGeometry(3.4, 3.4, 0.08, 64); resources.push(circleGeo);
 const circle = new THREE.Mesh(circleGeo, mats.white); circle.position.y = 0.16; circle.receiveShadow = true; scene.add(circle);
 const ringGeo = new THREE.RingGeometry(2.45, 2.49, 80); resources.push(ringGeo);
 const ring = new THREE.Mesh(ringGeo, mats.blue); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.21; scene.add(ring);
 const floorText = label('MEET IN THE MIDDLE', 4.4, C.slate, C.white); floorText.position.set(0, 0.6, 1.5); scene.add(floorText);
 const buildings: THREE.Object3D[] = [];
 const markers = new Map<string, THREE.Mesh>();
 destinations.forEach((d, index) => {
  const group = new THREE.Group(); group.position.set(d.x, 0, d.z); scene.add(group);
  const body = box(4.2, d.height, 3.5, 0, d.height / 2 + 0.13, 0, index % 2 ? mats.white : mats.slate, group);
  body.userData.brand = d.id; buildings.push(body);
  box(4.5, 0.15, 3.8, 0, d.height + 0.2, 0, mats.ink, group);
  box(4.65, 0.18, 4, 0, 0.17, 0, mats.white, group);
  const front = d.z < 0 ? 1 : -1;
  box(3.5, d.height * 0.58, 0.08, 0, d.height * 0.36, front * 1.78, mats.ink, group);
  for (const x of [-1.15, 0, 1.15]) box(0.06, d.height * 0.6, 0.13, x, d.height * 0.36, front * 1.84, mats.pale, group);
  box(4.5, 0.13, 0.8, 0, d.height * 0.76, front * 1.85, mats.blue, group);
  for (let n = 0; n < 4; n++) box(0.09, 0.09, 3.2, -1.5 + n, d.height + 0.31, 0, mats.slate, group);
  const sign = label(d.sign, d.name.length > 9 ? 4.4 : 3.1); sign.position.set(0, d.height + 0.95, 0); group.add(sign); sign.userData.brand = d.id; buildings.push(sign);
  const markerGeo = new THREE.RingGeometry(0.42, 0.53, 32); resources.push(markerGeo);
  const marker = new THREE.Mesh(markerGeo, mats.blue); marker.rotation.x = -Math.PI / 2; marker.position.set(d.x, 0.23, d.z + front * 3); scene.add(marker); markers.set(d.id, marker);
 });
 for (const [x, z] of [[-10, -1], [-10, 2], [10, -1], [10, 2], [-4, 9], [4, 9], [-4, -10], [4, -10]]) {
  box(0.8, 0.45, 0.8, x, 0.28, z, mats.white);
  box(0.15, 1.5, 0.15, x, 1, z, mats.ink);
  const geo = new THREE.IcosahedronGeometry(0.9, 1); resources.push(geo);
  const tree = new THREE.Mesh(geo, mats.slate); tree.position.set(x, 2, z); tree.castShadow = true; scene.add(tree);
 }
 for (const x of [-3.7, 3.7]) {
  box(0.65, 0.2, 2, x, 0.55, 0, mats.slate);
  box(0.12, 0.5, 1.5, x, 0.3, 0, mats.ink);
 }
 const avatar = (own: boolean) => {
  const group = new THREE.Group();
  const bodyGeo = new THREE.CapsuleGeometry(0.18, 0.4, 5, 12); resources.push(bodyGeo);
  const body = new THREE.Mesh(bodyGeo, own ? mats.blue : mats.slate); body.position.y = 0.8; body.castShadow = true; group.add(body);
  const headGeo = new THREE.SphereGeometry(0.18, 16, 12); resources.push(headGeo);
  const head = new THREE.Mesh(headGeo, mats.white); head.position.y = 1.35; group.add(head);
  for (const side of [-1, 1]) {
   box(0.13, 0.45, 0.16, side * 0.12, 0.33, 0, mats.ink, group);
   box(0.12, 0.44, 0.12, side * 0.29, 0.83, 0, own ? mats.blue : mats.slate, group);
  }
  scene.add(group); return group;
 };
 const me = avatar(true); me.position.set(0, 0.15, 4);
 const you = label('YOU', 1.05, C.white, C.blue); you.position.set(0, 1.95, 0); me.add(you);
 const others = new Map<string, THREE.Group>();
 let path: { x: number; z: number }[] = [];
 let last = performance.now(); let frame = 0; let disposed = false; let lastMove = 0;
 const keys = new Set<string>();
 function navigate(x: number, z: number) { path = route({ x: me.position.x, z: me.position.z }, { x, z }); }
 function visit(id: string) {
  const d = destinations.find(d => d.id === id); if (!d) return;
  onSelect(id); navigate(d.x, d.z + (d.z < 0 ? 3 : -3));
  markers.forEach((marker, key) => marker.scale.setScalar(key === id ? 1.5 : 1));
 }
 const raycaster = new THREE.Raycaster();
 let down: { x: number; y: number } | null = null;
 const pointerDown = (e: PointerEvent) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY }; };
 const pointerUp = (e: PointerEvent) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down = null; return; }
  down = null;
  const rect = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
  const hit = raycaster.intersectObjects(buildings, false)[0];
  if (hit) { visit(hit.object.userData.brand); return; }
  const floor = raycaster.intersectObject(ground)[0]; if (floor) navigate(floor.point.x, floor.point.z);
 };
 const keydown = (e: KeyboardEvent) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) { e.preventDefault(); keys.add(e.key); path = []; }
 };
 const keyup = (e: KeyboardEvent) => { keys.delete(e.key); };
 const blur = () => keys.clear();
 canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp);
 canvas.addEventListener('keydown', keydown); canvas.addEventListener('keyup', keyup); canvas.addEventListener('blur', blur);
 const resize = new ResizeObserver(() => {
  const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
  const aspect = rect.width / rect.height;
  const size = aspect < 1 ? 19 / aspect : 16;
  camera.left = -size * aspect; camera.right = size * aspect; camera.top = size; camera.bottom = -size;
  camera.updateProjectionMatrix(); renderer.setSize(rect.width, rect.height, false);
 }); resize.observe(canvas);
 const animate = (time: number) => {
  if (disposed) return; frame = requestAnimationFrame(animate);
  const dt = Math.min((time - last) / 1000, 0.05); last = time;
  if (document.hidden) return;
  let dx = Number(keys.has('d') || keys.has('ArrowRight')) - Number(keys.has('a') || keys.has('ArrowLeft'));
  let dz = Number(keys.has('s') || keys.has('ArrowDown')) - Number(keys.has('w') || keys.has('ArrowUp'));
  if (path.length) {
   const target = path[0]; dx = target.x - me.position.x; dz = target.z - me.position.z;
   if (Math.hypot(dx, dz) < 0.09) { path.shift(); dx = 0; dz = 0; }
  }
  const length = Math.hypot(dx, dz);
  if (length > 0) {
   const step = Math.min(length, dt * 3.6);
   const x = me.position.x + dx / length * step, z = me.position.z + dz / length * step;
   if (walkable(x, z)) { me.position.x = x; me.position.z = z; me.rotation.y = Math.atan2(dx, dz); }
   else path = [];
   if (time - lastMove > 100) { onMove(me.position.x, me.position.z); lastMove = time; }
  }
  renderer.render(scene, camera);
 };
 frame = requestAnimationFrame(animate);
 return {
  visit,
  move(dx: number, dz: number) { navigate(me.position.x + dx * 2, me.position.z + dz * 2); },
  reset() { camera.position.set(24, 29, 32); camera.zoom = 1; camera.updateProjectionMatrix(); controls.target.set(0, 0, -1); controls.update(); },
  zoom(factor: number) { camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, 0.65, 2); camera.updateProjectionMatrix(); },
  people(people: Person[], ownId: string) {
   const ids = new Set(people.filter(p => p.id !== ownId).map(p => p.id));
   for (const [id, group] of others) if (!ids.has(id)) {
    scene.remove(group); others.delete(id);
    const release = (resource: THREE.BufferGeometry | THREE.Material | THREE.Texture) => { resource.dispose(); const i = resources.indexOf(resource); if (i >= 0) resources.splice(i, 1); };
    group.traverse(object => {
     if (object instanceof THREE.Mesh) release(object.geometry);
     if (object instanceof THREE.Sprite) { if (object.material.map) release(object.material.map); release(object.material); }
    });
   }
   for (const p of people) {
    if (p.id === ownId) continue;
    let group = others.get(p.id);
    if (!group) { group = avatar(false); const tag = label(p.name, 2.2); tag.position.y = 1.95; group.add(tag); others.set(p.id, group); }
    group.position.set(p.x, 0.15, p.z);
   }
  },
  destroy() {
   disposed = true; cancelAnimationFrame(frame); resize.disconnect(); controls.dispose();
   canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp);
   canvas.removeEventListener('keydown', keydown); canvas.removeEventListener('keyup', keyup); canvas.removeEventListener('blur', blur);
   resources.forEach(resource => resource.dispose()); renderer.dispose();
  }
 };
}
