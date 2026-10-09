import { presetThemes, type Theme } from './themes';

class ThemeStore {
	themes = $state<Theme[]>(presetThemes);
	slug = $state<string>(presetThemes[0].slug);

	get current(): Theme {
		return this.themes.find((t) => t.slug === this.slug) ?? this.themes[0];
	}

	pick = (slug: string): void => {
		this.slug = slug;
		try {
			if (typeof localStorage !== 'undefined') {
				localStorage['ootd-theme'] = slug;
				localStorage.setItem('ootd-theme', slug);
			}
		} catch {
			// ignore storage errors
		}
	};

	init = async (apiBase: string): Promise<void> => {
		try {
			if (typeof localStorage !== 'undefined') {
				const saved = localStorage.getItem('ootd-theme') ?? localStorage['ootd-theme'];
				if (saved && typeof saved === 'string') {
					this.slug = saved;
				}
			}
		} catch {
			// ignore storage errors
		}

		try {
			const res = await fetch(`${apiBase}/v1/themes`);
			if (res.ok) {
				const data = (await res.json()) as { themes?: Theme[] };
				if (Array.isArray(data.themes) && data.themes.length > 0) {
					this.themes = data.themes;
				}
			}
		} catch {
			// swallow fetch errors
		}
	};
}

export const theme = new ThemeStore();
export const themeStore = theme;
export default theme;
