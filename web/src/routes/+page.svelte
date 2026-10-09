<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { apiBase, previewOutfits, type Outfit } from '$lib/outfits';
	import OutfitCard from '$lib/OutfitCard.svelte';
	import OutfitViewer from '$lib/OutfitViewer.svelte';

	let outfits = $state<Outfit[]>(previewOutfits);
	let interpreted = $state<{
		styles?: string[];
		categories?: string[];
		words?: string[];
	} | null>(null);
	let feedSource = $state<'preview' | 'api'>('preview');
	let loading = $state(false);
	let requestSeq = 0;
	let dialogEl = $state<HTMLDivElement | null>(null);

	let q = $derived(page.url.searchParams.get('q')?.trim() ?? '');

	function filterPreview(query: string): Outfit[] {
		const lower = query.toLowerCase();
		const tokens = lower.split(/\s+/).filter(Boolean);
		if (tokens.length === 0) return previewOutfits;
		return previewOutfits.filter((o) => {
			const text = `${o.title} ${o.caption} ${o.tags.join(' ')}`.toLowerCase();
			return text.includes(lower) || tokens.some((token) => text.includes(token));
		});
	}

	$effect(() => {
		const currentQ = q;
		const seq = ++requestSeq;
		loading = true;

		if (!currentQ) {
			interpreted = null;
			fetch(`${apiBase}/v1/outfits`)
				.then(async (res) => {
					if (!res.ok) throw new Error('API request failed');
					const data = (await res.json()) as { outfits?: Outfit[] };
					if (seq !== requestSeq) return;
					outfits = Array.isArray(data.outfits) ? data.outfits : [];
					feedSource = 'api';
					loading = false;
				})
				.catch(() => {
					if (seq !== requestSeq) return;
					outfits = previewOutfits;
					feedSource = 'preview';
					loading = false;
				});
		} else {
			fetch(`${apiBase}/v1/search?q=${encodeURIComponent(currentQ)}`)
				.then(async (res) => {
					if (!res.ok) throw new Error('API request failed');
					const data = (await res.json()) as {
						outfits?: Outfit[];
						interpreted?: { styles?: string[]; categories?: string[]; words?: string[] };
					};
					if (seq !== requestSeq) return;
					outfits = Array.isArray(data.outfits) ? data.outfits : [];
					interpreted = data.interpreted ?? null;
					feedSource = 'api';
					loading = false;
				})
				.catch(() => {
					if (seq !== requestSeq) return;
					outfits = filterPreview(currentQ);
					interpreted = null;
					feedSource = 'preview';
					loading = false;
				});
		}
	});

	function handleOpen(id: string): void {
		pushState('/o/' + id, { outfitId: id });
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			history.back();
		}
	}

	function handleDialogKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			history.back();
			return;
		}
		// ponytail: basic focus trap; upgrade to floating-ui or svelte-focus-trap if complex modals needed.
		if (event.key === 'Tab' && dialogEl) {
			const focusable = dialogEl.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
			);
			if (focusable.length > 0) {
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			}
		}
	}

	$effect(() => {
		if (page.state.outfitId) {
			dialogEl?.focus();
			const prevOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = prevOverflow;
			};
		}
	});
</script>

<svelte:head>
	<title>{q ? `${q} — Search OoTD` : 'OoTD — Your style, your space'}</title>
</svelte:head>

<svelte:window
	onkeydown={(e) => {
		if (page.state.outfitId && e.key === 'Escape') {
			e.preventDefault();
			history.back();
		}
	}}
/>

<main class="page-container">
	{#if q}
		<div class="search-meta">
			<div class="search-header-row">
				<h1 class="results-line">Results for &ldquo;{q}&rdquo;</h1>
				<a href="/" class="clear-link">Clear</a>
			</div>
			{#if interpreted && ((interpreted.styles && interpreted.styles.length > 0) || (interpreted.categories && interpreted.categories.length > 0) || (interpreted.words && interpreted.words.length > 0))}
				<div class="interpreted-chips">
					{#each interpreted.styles ?? [] as s}
						<span class="chip chip-style">{s}</span>
					{/each}
					{#each interpreted.categories ?? [] as c}
						<span class="chip chip-category">{c}</span>
					{/each}
					{#each interpreted.words ?? [] as w}
						<span class="chip chip-word">{w}</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if outfits.length === 0 && !loading}
		<div class="empty-state">
			<p>Nothing matched. Try a style (vintage, y2k), a piece (sneakers, tote) or a mood.</p>
		</div>
	{:else}
		<div class="masonry-grid">
			{#each outfits as outfit (outfit.id)}
				<OutfitCard {outfit} onopen={handleOpen} />
			{/each}
		</div>
	{/if}

	<footer class="page-footer">
		<p class:connected={feedSource === 'api'} class="data-status">
			<span aria-hidden="true">●</span>
			{feedSource === 'api' ? 'Live from Go API' : 'Local preview data'}
		</p>
	</footer>
</main>

{#if page.state.outfitId}
	<div
		class="modal-backdrop"
		role="presentation"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Escape' && history.back()}
	>
		<div
			class="modal-dialog"
			role="dialog"
			aria-modal="true"
			aria-label="Outfit viewer"
			tabindex="-1"
			bind:this={dialogEl}
			onkeydown={handleDialogKeyDown}
		>
			<OutfitViewer id={page.state.outfitId} onclose={() => history.back()} />
		</div>
	</div>
{/if}

<style>
	.page-container {
		width: 100%;
		max-width: 1440px;
		margin: 0 auto;
		padding: 0.5rem 1.5rem 3rem;
	}

	.search-meta {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--t-line);
	}

	.search-header-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.results-line {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 450;
		color: var(--t-fg);
	}

	.clear-link {
		font-size: 0.8rem;
		color: var(--t-muted);
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: color 0.15s ease;
	}

	.clear-link:hover {
		color: var(--t-fg);
	}

	.interpreted-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		font-size: 0.72rem;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		background: var(--t-tint);
		border: 1px solid var(--t-line);
		color: var(--t-muted);
		line-height: 1.3;
		user-select: none;
	}

	.empty-state {
		padding: 4rem 1rem;
		text-align: center;
		color: var(--t-muted);
		font-size: 0.92rem;
		max-width: 480px;
		margin: 0 auto;
		line-height: 1.5;
	}

	.masonry-grid {
		column-width: 11rem;
		column-gap: 0.75rem;
		width: 100%;
	}

	.page-footer {
		display: flex;
		justify-content: center;
		padding: 3.5rem 0 1.5rem;
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

	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--t-bg) 82%, transparent);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		padding: 1.5rem;
		overflow-y: auto;
		outline: none;
	}

	.modal-dialog {
		max-width: min(960px, 100%);
		width: 100%;
		outline: none;
	}

	@media (max-width: 639px) {
		.page-container {
			padding: 0.5rem 1rem 3rem;
		}

		.modal-backdrop {
			padding: 0.5rem;
		}
	}
</style>
