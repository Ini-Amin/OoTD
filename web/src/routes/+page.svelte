<script lang="ts">
	import { onMount } from 'svelte';
	import { previewOutfits, type Outfit } from '$lib/outfits';
	import { styles } from '$lib/styles.svelte';

	const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

	let outfits = $state<Outfit[]>(previewOutfits);
	let feedSource = $state<'preview' | 'api'>('preview');
	let savedIds = $state<Set<string>>(new Set());
	let requestSeq = 0;

	const ASPECT_RATIOS = ['3/4', '4/5', '1/1', '2/3', '4/5', '3/5'];

	function getAspectRatio(id: string): string {
		let hash = 0;
		for (let i = 0; i < id.length; i++) {
			hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
		}
		return ASPECT_RATIOS[hash % ASPECT_RATIOS.length];
	}

	function filterPreview(pickedSlugs: string[]): Outfit[] {
		if (pickedSlugs.length === 0) {
			return previewOutfits.map((o) => ({ ...o, match: 0 }));
		}
		const pickedSet = new Set(pickedSlugs.map((s) => s.trim().toLowerCase()).filter(Boolean));
		const scored = previewOutfits.map((o) => {
			const match = o.tags.reduce((acc, tag) => {
				const slug = tag.toLowerCase().replace(/\s+/g, '-');
				return acc + (pickedSet.has(slug) ? 1 : 0);
			}, 0);
			return { ...o, match };
		});
		return scored
			.filter((o) => (o.match ?? 0) > 0)
			.sort((a, b) => (b.match ?? 0) - (a.match ?? 0));
	}

	function toggleSave(id: string): void {
		const next = new Set(savedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		savedIds = next;
	}

	onMount(() => {
		styles.init(apiBase);
	});

	$effect(() => {
		const currentPicked = [...styles.picked];
		const seq = ++requestSeq;

		let url = `${apiBase}/v1/outfits`;
		if (currentPicked.length > 0) {
			const query = currentPicked.map((slug) => encodeURIComponent(slug)).join(',');
			url += `?styles=${query}`;
		}

		fetch(url)
			.then(async (res) => {
				if (!res.ok) throw new Error('API request failed');
				const data = (await res.json()) as { outfits?: Outfit[] };
				if (seq !== requestSeq) return;
				outfits = Array.isArray(data.outfits) ? data.outfits : [];
				feedSource = 'api';
			})
			.catch(() => {
				if (seq !== requestSeq) return;
				outfits = filterPreview(currentPicked);
				feedSource = 'preview';
			});
	});
</script>

<svelte:head>
	<title>OoTD — Your style, your space</title>
	<meta
		name="description"
		content="Discover real outfits, save inspiration, and share your personal style on OoTD."
	/>
</svelte:head>

<main class="page-container">
	<section class="intro" aria-label="Introduction">
		<div class="intro-main">
			<p class="eyebrow">Creator-first fashion discovery</p>
			<h1>Your style has a home.</h1>
			<p class="intro-copy">
				Find outfits from real people. Save ideas, follow creators, and make your profile feel like you.
			</p>
		</div>
		<p class:connected={feedSource === 'api'} class="data-status">
			<span aria-hidden="true">●</span>
			{feedSource === 'api' ? 'Live from Go API' : 'Local preview data'}
		</p>
	</section>

	<section class="chips-row" aria-label="Filter by style">
		{#each styles.available as s (s.slug)}
			{@const active = styles.picked.includes(s.slug)}
			<button
				type="button"
				class="chip"
				class:selected={active}
				aria-pressed={active}
				onclick={() => styles.toggle(s.slug)}
			>
				{s.name}
			</button>
		{/each}
		{#if styles.picked.length > 0}
			<button
				type="button"
				class="clear-button"
				onclick={() => styles.clear()}
			>
				Clear
			</button>
		{/if}
	</section>

	<section class="feed-section" aria-label="Outfits feed">
		{#if outfits.length === 0}
			<div class="empty-state">
				<p class="empty-message">No looks match these styles yet.</p>
				{#if styles.picked.length > 0}
					<button
						type="button"
						class="empty-clear-button"
						onclick={() => styles.clear()}
					>
						Clear
					</button>
				{/if}
			</div>
		{:else}
			<div class="masonry">
				{#each outfits as outfit (outfit.id)}
					<article class="outfit-card">
						<div
							class="visual-block"
							style={`aspect-ratio: ${getAspectRatio(outfit.id)}; --card-accent: ${outfit.accent};`}
							role="img"
							aria-label={`${outfit.title} outfit visual`}
						>
							<span class="mark">OoTD</span>
						</div>
						<div class="card-meta">
							<h3 class="card-title">{outfit.title}</h3>
							<div class="creator-line">
								<span
									class="avatar"
									style={`--avatar-accent: ${outfit.accent}`}
									aria-hidden="true"
								>
									{outfit.creator.slice(0, 1)}
								</span>
								<span class="handle">{outfit.handle}</span>
							</div>
							{#if outfit.tags && outfit.tags.length > 0}
								<p class="card-tags">{outfit.tags.join(' · ')}</p>
							{/if}
							<div class="card-footer">
								<span class="save-count">♡ {outfit.savedBy + (savedIds.has(outfit.id) ? 1 : 0)}</span>
								<button
									type="button"
									class="save-button"
									class:saved={savedIds.has(outfit.id)}
									onclick={() => toggleSave(outfit.id)}
									aria-label={savedIds.has(outfit.id) ? `Unsave ${outfit.title}` : `Save ${outfit.title}`}
								>
									{savedIds.has(outfit.id) ? 'Saved' : 'Save'}
								</button>
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</main>

<style>
	.page-container {
		width: min(1180px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 0 0 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.intro {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding: 1.5rem 0 0.25rem;
	}

	.intro-main {
		max-width: 40rem;
	}

	.eyebrow {
		font-size: 0.72rem;
		font-weight: 400;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--t-muted);
		margin: 0 0 0.45rem;
	}

	h1 {
		font-size: 2.15rem;
		font-weight: 300;
		line-height: 1.15;
		letter-spacing: -0.03em;
		color: var(--t-fg);
		margin: 0 0 0.6rem;
	}

	.intro-copy {
		font-size: 0.92rem;
		font-weight: 350;
		line-height: 1.5;
		color: var(--t-muted);
		margin: 0;
	}

	.data-status {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.72rem;
		font-weight: 400;
		color: var(--t-muted);
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		line-height: 1;
		user-select: none;
		margin: 0;
	}

	.data-status span {
		font-size: 0.5rem;
		color: var(--t-muted);
		line-height: 1;
	}

	.data-status.connected span {
		color: #10b981;
	}

	.chips-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.25rem 0;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}

	.chips-row::-webkit-scrollbar {
		display: none;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		white-space: nowrap;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-surface);
		color: var(--t-fg);
		padding: 0.38rem 0.9rem;
		font-size: 0.82rem;
		font-weight: 400;
		line-height: 1;
		cursor: pointer;
		user-select: none;
		transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
	}

	.chip:hover {
		border-color: var(--t-fg);
	}

	.chip.selected {
		background: var(--t-fg);
		color: var(--t-bg);
		border-color: var(--t-fg);
	}

	.clear-button {
		background: transparent;
		border: none;
		color: var(--t-muted);
		font-size: 0.82rem;
		font-weight: 400;
		padding: 0.38rem 0.6rem;
		cursor: pointer;
		white-space: nowrap;
		text-decoration: underline;
		text-underline-offset: 3px;
		user-select: none;
	}

	.clear-button:hover {
		color: var(--t-fg);
	}

	.feed-section {
		width: 100%;
	}

	.empty-state {
		padding: 4rem 1rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.85rem;
	}

	.empty-message {
		font-size: 0.92rem;
		font-weight: 350;
		color: var(--t-muted);
		margin: 0;
	}

	.empty-clear-button {
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-surface);
		color: var(--t-fg);
		font-size: 0.8rem;
		font-weight: 400;
		padding: 0.4rem 0.9rem;
		cursor: pointer;
	}

	.empty-clear-button:hover {
		border-color: var(--t-fg);
	}

	.masonry {
		column-width: 16rem;
		column-gap: 1.25rem;
		width: 100%;
	}

	.outfit-card {
		break-inside: avoid;
		margin-bottom: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.visual-block {
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: linear-gradient(160deg, var(--card-accent) 0%, color-mix(in srgb, var(--card-accent) 40%, var(--t-surface)) 100%);
		overflow: hidden;
		transition: transform 0.2s ease;
	}

	@media (prefers-reduced-motion: no-preference) {
		.outfit-card:hover .visual-block {
			transform: scale(1.015);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.visual-block,
		.outfit-card,
		.chip,
		.save-button {
			transition: none !important;
			transform: none !important;
			animation: none !important;
		}
	}

	.mark {
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #ffffff;
		opacity: 0.85;
		text-shadow: 0 1px 2px rgb(0 0 0 / 25%);
		user-select: none;
	}

	.card-meta {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0 0.15rem;
	}

	.card-title {
		margin: 0;
		font-size: 0.88rem;
		font-weight: 400;
		line-height: 1.35;
		color: var(--t-fg);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.creator-line {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.avatar {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: var(--avatar-accent);
		color: #ffffff;
		font-size: 0.65rem;
		font-weight: 500;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		line-height: 1;
	}

	.handle {
		font-size: 0.76rem;
		color: var(--t-muted);
		font-weight: 350;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-tags {
		margin: 0;
		font-size: 0.74rem;
		color: var(--t-muted);
		font-weight: 350;
		line-height: 1.35;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.15rem;
	}

	.save-count {
		font-size: 0.76rem;
		color: var(--t-muted);
		font-weight: 400;
		user-select: none;
	}

	.save-button {
		background: transparent;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		color: var(--t-fg);
		font-size: 0.74rem;
		font-weight: 400;
		padding: 0.4rem 0.75rem;
		cursor: pointer;
		line-height: 1;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.save-button:hover {
		background: var(--t-tint);
		border-color: var(--t-fg);
	}

	.save-button.saved {
		background: var(--t-fg);
		color: var(--t-bg);
		border-color: var(--t-fg);
	}

	@media (max-width: 760px) {
		.page-container {
			width: min(100% - 1.5rem, 1180px);
			gap: 1.5rem;
		}

		h1 {
			font-size: 1.75rem;
		}
	}
</style>
