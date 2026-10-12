export const styles = ['All styles', 'Streetwear', 'Minimal', 'Sport', 'Luxury'] as const;
export type Style = (typeof styles)[number];
export interface Destination {
 id: string; name: string; style: Style; description: string; url: string;
 x: number; z: number; height: number; sign: string;
}
// Editorial waypoints, not an inventory feed or an affiliation with these brands.
export const destinations: Destination[] = [
 { id: 'nike', name: 'Nike', style: 'Sport', description: 'Performance meets everyday movement. Explore sportswear, technical layers, and iconic footwear.', url: 'https://www.nike.com', x: -7, z: -6, height: 3.4, sign: 'NIKE' },
 { id: 'uniqlo', name: 'Uniqlo', style: 'Minimal', description: 'Thoughtful essentials for everyday life. Build a wardrobe around simple shapes and versatile layers.', url: 'https://www.uniqlo.com', x: 0, z: -8, height: 4.1, sign: 'UNIQLO' },
 { id: 'acne', name: 'Acne Studios', style: 'Luxury', description: 'A Stockholm perspective on modern dressing, expressive proportions, denim, and experimental details.', url: 'https://www.acnestudios.com', x: 7, z: -6, height: 3.2, sign: 'ACNE STUDIOS' },
 { id: 'carhartt', name: 'Carhartt WIP', style: 'Streetwear', description: 'Utility with a cultural point of view. Discover workwear silhouettes reinterpreted for everyday wear.', url: 'https://www.carhartt-wip.com', x: -7, z: 5, height: 2.7, sign: 'CARHARTT WIP' },
 { id: 'cos', name: 'COS', style: 'Minimal', description: 'Modern silhouettes and considered design. Discover clean lines, sculptural shapes, and enduring essentials.', url: 'https://www.cos.com', x: 7, z: 5, height: 3.7, sign: 'COS' }
];
export type Person = { id: string; name: string; style: string; x: number; z: number; wave: number };
export const WORLD_COLORS = { ink: '#17232f', slate: '#52677c', pale: '#dce4eb', white: '#f7f9fb', blue: '#4169e1' };
export function validPerson(value: unknown): Person | null {
 if (!value || typeof value !== 'object') return null;
 const p = value as Record<string, unknown>;
 if (typeof p.id !== 'string' || !/^[a-f0-9-]{36}$/.test(p.id) || typeof p.name !== 'string' || p.name.length > 24 || typeof p.x !== 'number' || typeof p.z !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.abs(p.x) > 12 || Math.abs(p.z) > 12) return null;
 return { id: p.id, name: p.name.replace(/[\u0000-\u001f<>]/g, '').trim() || 'Guest', style: styles.includes(p.style as Style) ? String(p.style) : 'Minimal', x: p.x, z: p.z, wave: typeof p.wave === 'number' && Number.isFinite(p.wave) ? p.wave : 0 };
}
export function walkable(x: number, z: number): boolean {
 return Math.abs(x) <= 11 && Math.abs(z) <= 11 && !destinations.some(d => Math.abs(x - d.x) < 2.5 && Math.abs(z - d.z) < 2.2);
}
export function route(start: { x: number; z: number }, end: { x: number; z: number }): { x: number; z: number }[] {
 const sx = Math.round(start.x), sz = Math.round(start.z), ex = Math.round(end.x), ez = Math.round(end.z);
 if (!walkable(ex, ez)) return [];
 const key = (x: number, z: number) => `${x},${z}`;
 const queue = [{ x: sx, z: sz }];
 const previous = new Map<string, { x: number; z: number } | null>([[key(sx, sz), null]]);
 for (let i = 0; i < queue.length; i++) {
  const p = queue[i];
  if (p.x === ex && p.z === ez) {
   const points = [p]; let parent = previous.get(key(p.x, p.z));
   while (parent) { points.unshift(parent); parent = previous.get(key(parent.x, parent.z)); }
   return points.slice(1);
  }
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
   const x = p.x + dx, z = p.z + dz;
   if (!walkable(x, z) || previous.has(key(x, z))) continue;
   previous.set(key(x, z), p); queue.push({ x, z });
  }
 }
 return [];
}
