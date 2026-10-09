<script lang="ts">
	import { onMount } from 'svelte';
	import { previewOutfits, type Outfit } from '$lib/outfits';
	import { presetThemes, themeStyle, type Theme } from '$lib/themes';

	const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

	let outfits = $state<Outfit[]>(previewOutfits);
	let feedSource = $state<'preview' | 'api'>('preview');
	let themes = $state<Theme[]>(presetThemes);
	let themeSlug = $state(presetThemes[0].slug);
	let theme = $derived(themes.find((t) => t.slug === themeSlug) ?? themes[0]);

	$effect(() => {
		document.documentElement.style.cssText = themeStyle(theme);
	});

	function pickTheme(slug: string) {
		themeSlug = slug;
		localStorage.setItem('ootd-theme', slug);
	}

	onMount(async () => {
		themeSlug = localStorage.getItem('ootd-theme') ?? themeSlug;

		try {
			const [outfitRes, themeRes] = await Promise.all([
				fetch(`${apiBase}/v1/outfits`),
				fetch(`${apiBase}/v1/themes`)
			]);
			if (!outfitRes.ok) throw new Error('The API did not return a successful response.');

			const payload = (await outfitRes.json()) as { outfits: Outfit[] };
			if (payload.outfits.length > 0) {
				outfits = payload.outfits;
				feedSource = 'api';
			}
			if (themeRes.ok) {
				const t = (await themeRes.json()) as { themes: Theme[] };
				if (t.themes.length > 0) themes = t.themes;
			}
		} catch {
			// The API is optional, so local preview data and preset themes remain visible.
		}
	});
</script>

<svelte:head>
	<title>OoTD — Your style, your space</title>
	<meta
		name="description"
		content="Discover real outfits, save inspiration, and share your personal style on OoTD."
	/>
</svelte:head>

<header class="site-header">
	<a class="wordmark" href="/" aria-label="OoTD home">OoTD<span>•</span></a>
	<nav aria-label="Primary navigation">
		<a class="active" href="/">Discover</a>
		<a href="/">Collections</a>
		<a href="/">Profile</a>
	</nav>
	<button class="create-button" type="button">Create an OoTD</button>
</header>

<main>
	<section class="hero">
		<p class="eyebrow">Creator-first fashion discovery</p>
		<h1>Your style has a home.</h1>
		<p class="hero-copy">
			Find outfits from real people. Save ideas, follow creators, and make your profile feel like you.
		</p>
		<div class="hero-actions">
			<button class="primary-button" type="button">Explore looks</button>
			<button class="text-button" type="button">Customize your space <span aria-hidden="true">↗</span></button>
		</div>
	</section>

	<section class="feed" aria-labelledby="feed-title">
		<div class="section-heading">
			<div>
				<p class="eyebrow">The daily edit</p>
				<h2 id="feed-title">Fresh from the community</h2>
			</div>
			<p class:connected={feedSource === 'api'} class="data-status">
				<span aria-hidden="true">●</span>
				{feedSource === 'api' ? 'Live from Go API' : 'Local preview data'}
			</p>
		</div>

		<div class="outfit-grid">
			{#each outfits as outfit}
				<article class="outfit-card">
					<div class="outfit-visual" style={`--accent: ${outfit.accent}`} aria-label={`${outfit.title} visual placeholder`} role="img">
						<span>OoTD</span>
						<p>LOOK</p>
					</div>
					<div class="outfit-content">
						<div class="creator-row">
							<div class="avatar" style={`--accent: ${outfit.accent}`}>{outfit.creator.slice(0, 1)}</div>
							<div>
								<p class="creator-name">{outfit.creator}</p>
								<p class="handle">{outfit.handle}</p>
							</div>
							<button class="more-button" type="button" aria-label={`More options for ${outfit.title}`}>•••</button>
						</div>
						<h3>{outfit.title}</h3>
						<p class="caption">{outfit.caption}</p>
						<div class="tag-list" aria-label="Outfit tags">
							{#each outfit.tags as tag}
								<span>{tag}</span>
							{/each}
						</div>
						<div class="card-footer">
							<span>♡ {outfit.savedBy} saves</span>
							<button type="button">Save look</button>
						</div>
					</div>
				</article>
			{/each}
		</div>
	</section>
</main>

<aside class="theme-picker" aria-label="Choose a theme">
	{#each themes as t}
		<button
			type="button"
			class:selected={t.slug === theme.slug}
			aria-pressed={t.slug === theme.slug}
			aria-label={`${t.name} theme`}
			title={t.name}
			style={`--sw-bg:${t.bg};--sw-accent:${t.accent}`}
			onclick={() => pickTheme(t.slug)}
		></button>
	{/each}
</aside>

<style>
	:global(:root) {
		/* SSR/first-paint fallback = the "minimal" preset */
		--t-bg: #fafafa;
		--t-surface: #ffffff;
		--t-fg: #1c1c1c;
		--t-accent: #1c1c1c;
		--t-font: Inter, ui-sans-serif, system-ui, sans-serif;
		--t-radius: 1.25rem;
		--t-muted: color-mix(in srgb, #1c1c1c 68%, #fafafa);
		--t-tint: color-mix(in srgb, #1c1c1c 8%, #fafafa);
		--t-line: color-mix(in srgb, #1c1c1c 16%, #fafafa);
	}

	.theme-picker {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-surface);
		box-shadow: 0 6px 24px rgb(0 0 0 / 12%);
	}

	.theme-picker button {
		width: 1.6rem;
		height: 1.6rem;
		border: 2px solid var(--sw-accent);
		border-radius: 50%;
		background: linear-gradient(135deg, var(--sw-bg) 50%, var(--sw-accent) 50%);
		padding: 0;
	}

	.theme-picker button.selected {
		outline: 2px solid var(--t-fg);
		outline-offset: 2px;
	}
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		min-width: 320px;
		background: var(--t-bg);
		color: var(--t-fg);
		font-family: var(--t-font);
	}

	button,
	a {
		font: inherit;
	}

	button {
		cursor: pointer;
	}

	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		width: min(1180px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 1.4rem 0;
	}

	.wordmark {
		color: var(--t-fg);
		font-family: Georgia, serif;
		font-size: 1.65rem;
		font-weight: 700;
		letter-spacing: -0.08em;
		text-decoration: none;
	}

	.wordmark span {
		color: var(--t-accent);
	}

	nav {
		display: flex;
		gap: 1.75rem;
	}

	nav a {
		color: var(--t-muted);
		font-size: 0.9rem;
		text-decoration: none;
	}

	nav a.active,
	nav a:hover {
		color: var(--t-fg);
		font-weight: 700;
	}

	.create-button,
	.primary-button {
		border: 0;
		border-radius: 999px;
		background: var(--t-fg);
		color: var(--t-bg);
		font-weight: 700;
	}

	.create-button {
		padding: 0.72rem 1.1rem;
		font-size: 0.86rem;
	}

	main {
		width: min(1180px, calc(100% - 2.5rem));
		margin: 0 auto;
	}

	.hero {
		max-width: 700px;
		padding: 5.3rem 0 5rem;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--t-accent);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}

	h1,
	h2 {
		font-family: var(--t-font);
		letter-spacing: -0.06em;
	}

	h1 {
		max-width: 620px;
		margin-bottom: 1rem;
		font-size: clamp(3.1rem, 8vw, 6.8rem);
		line-height: 0.94;
	}

	.hero-copy {
		max-width: 550px;
		color: var(--t-muted);
		font-size: 1.15rem;
		line-height: 1.65;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
	}

	.primary-button {
		padding: 0.9rem 1.35rem;
	}

	.text-button {
		border: 0;
		background: transparent;
		color: var(--t-fg);
		font-weight: 700;
	}

	.feed {
		padding: 2rem 0 5rem;
	}

	.section-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	h2 {
		margin-bottom: 0;
		font-size: clamp(2rem, 4vw, 3.5rem);
		line-height: 1;
	}

	.data-status {
		margin: 0;
		border-radius: 999px;
		background: var(--t-tint);
		color: var(--t-muted);
		padding: 0.5rem 0.8rem;
		font-size: 0.76rem;
		font-weight: 700;
	}

	.data-status span {
		margin-right: 0.3rem;
		color: var(--t-line);
	}

	.data-status.connected {
		background: #e7f0e2;
		color: #3e6333;
	}

	.data-status.connected span {
		color: #579447;
	}

	.outfit-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.25rem;
	}

	.outfit-card {
		overflow: hidden;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
	}

	.outfit-visual {
		display: grid;
		min-height: 260px;
		place-content: center;
		background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 72%, white), var(--accent));
		color: rgb(35 31 32 / 75%);
		text-align: center;
	}

	.outfit-visual span {
		font-family: Georgia, serif;
		font-size: 3.5rem;
		font-weight: 700;
		letter-spacing: -0.13em;
	}

	.outfit-visual p {
		margin: 0;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.23em;
	}

	.outfit-content {
		padding: 1.1rem;
	}

	.creator-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.avatar {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border-radius: 50%;
		background: var(--accent);
		color: #231f20;
		font-size: 0.8rem;
		font-weight: 800;
	}

	.creator-name,
	.handle {
		margin: 0;
		line-height: 1.1;
	}

	.creator-name {
		font-size: 0.8rem;
		font-weight: 800;
	}

	.handle {
		margin-top: 0.2rem;
		color: var(--t-muted);
		font-size: 0.73rem;
	}

	.more-button {
		margin-left: auto;
		border: 0;
		background: transparent;
		color: var(--t-muted);
		letter-spacing: 0.05em;
	}

	h3 {
		margin: 1.2rem 0 0.55rem;
		font-family: var(--t-font);
		font-size: 1.35rem;
		letter-spacing: -0.04em;
		line-height: 1.05;
	}

	.caption {
		min-height: 4.2em;
		margin-bottom: 1rem;
		color: var(--t-muted);
		font-size: 0.86rem;
		line-height: 1.5;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.tag-list span {
		border-radius: 999px;
		background: var(--t-tint);
		color: var(--t-muted);
		padding: 0.35rem 0.55rem;
		font-size: 0.68rem;
		font-weight: 700;
	}

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 1.15rem;
		padding-top: 0.85rem;
		border-top: 1px solid var(--t-line);
		color: var(--t-muted);
		font-size: 0.75rem;
	}

	.card-footer button {
		border: 0;
		background: transparent;
		color: var(--t-fg);
		font-size: 0.75rem;
		font-weight: 800;
	}

	@media (max-width: 760px) {
		.site-header {
			width: min(100% - 1.5rem, 1180px);
		}

		nav {
			display: none;
		}

		.create-button {
			padding: 0.65rem 0.9rem;
		}

		main {
			width: min(100% - 1.5rem, 1180px);
		}

		.hero {
			padding: 3.5rem 0 3rem;
		}

		.outfit-grid {
			grid-template-columns: 1fr;
		}

		.outfit-visual {
			min-height: 220px;
		}
	}
</style>
