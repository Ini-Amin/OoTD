export type Theme = {
	slug: string;
	name: string;
	bg: string;
	surface: string;
	fg: string;
	accent: string;
	font: 'sans' | 'serif' | 'rounded' | 'mono';
	radius: 'sharp' | 'soft' | 'round';
};

// Keep in sync with api/migrations/0002_seed.sql; the API list replaces this once it loads.
export const presetThemes: Theme[] = [
	{ slug: 'minimal', name: 'Minimal', bg: '#fafafa', surface: '#ffffff', fg: '#1c1c1c', accent: '#1c1c1c', font: 'sans', radius: 'soft' },
	{ slug: 'soft', name: 'Soft Pastel', bg: '#fff4f6', surface: '#ffffff', fg: '#3d2c33', accent: '#e58aa5', font: 'rounded', radius: 'round' },
	{ slug: 'y2k', name: 'Y2K', bg: '#eaf2ff', surface: '#ffffff', fg: '#1a1a4d', accent: '#7b4dff', font: 'rounded', radius: 'round' },
	{ slug: 'vintage', name: 'Vintage', bg: '#f6ecda', surface: '#fffaf0', fg: '#3b2a1a', accent: '#a4562a', font: 'serif', radius: 'sharp' },
	{ slug: 'street', name: 'Streetwear', bg: '#e9e9e9', surface: '#ffffff', fg: '#111111', accent: '#ff4d00', font: 'sans', radius: 'sharp' },
	{ slug: 'editorial', name: 'Dark Editorial', bg: '#141414', surface: '#1f1f1f', fg: '#f2efe9', accent: '#d8b26a', font: 'serif', radius: 'sharp' },
	{ slug: 'earthy', name: 'Earthy Thrift', bg: '#f3efe4', surface: '#fbf8f0', fg: '#2f3a2a', accent: '#7a8b4f', font: 'sans', radius: 'soft' }
];

const fonts = {
	sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
	serif: 'Georgia, "Times New Roman", serif',
	rounded: 'ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif',
	mono: 'ui-monospace, "SF Mono", Menlo, monospace'
};
const radii = { sharp: '0.25rem', soft: '1.25rem', round: '2rem' };

// Only allowlisted tokens reach CSS; muted/tint/line are derived so contrast follows fg/bg.
export function themeStyle(t: Theme): string {
	return [
		`--t-bg:${t.bg}`,
		`--t-surface:${t.surface}`,
		`--t-fg:${t.fg}`,
		`--t-accent:${t.accent}`,
		`--t-font:${fonts[t.font]}`,
		`--t-radius:${radii[t.radius]}`,
		`--t-muted:color-mix(in srgb, ${t.fg} 68%, ${t.bg})`,
		`--t-tint:color-mix(in srgb, ${t.fg} 8%, ${t.bg})`,
		`--t-line:color-mix(in srgb, ${t.fg} 16%, ${t.bg})`
	].join(';');
}
