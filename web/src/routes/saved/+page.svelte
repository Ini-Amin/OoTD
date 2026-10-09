<script lang="ts">
	import { onMount } from 'svelte';
	import OutfitCard from '$lib/OutfitCard.svelte';
	import { saved } from '$lib/saved.svelte';

	onMount(() => {
		saved.init();
	});

	function handleClear(): void {
		if (typeof window !== 'undefined' && window.confirm('Remove all saved looks?')) {
			saved.clear();
		}
	}
</script>

<svelte:head>
	<title>Saved looks — OoTD</title>
	<meta
		name="description"
		content="Your saved outfit inspiration on OoTD."
	/>
</svelte:head>

<main class="page-container">
	<header class="saved-header">
		<div class="header-main">
			<p class="eyebrow">Your collection</p>
			<h1>Saved looks</h1>
			<p class="header-copy">
				Outfits you have saved for personal inspiration.
			</p>
		</div>
		{#if saved.items.length > 0}
			<button type="button" class="clear-all-button" onclick={handleClear}>
				Clear all
			</button>
		{/if}
	</header>

	<section class="saved-feed" aria-label="Saved outfits">
		{#if saved.items.length === 0}
			<div class="empty-state">
				<p class="empty-title">Nothing saved yet.</p>
				<p class="empty-hint">Saves live in this browser until you sign in.</p>
				<a href="/" class="discover-link">Discover looks</a>
			</div>
		{:else}
			<div class="masonry">
				{#each saved.items as outfit (outfit.id)}
					<OutfitCard {outfit} />
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

	.saved-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding: 1.5rem 0 0.25rem;
	}

	.header-main {
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

	.header-copy {
		font-size: 0.92rem;
		font-weight: 350;
		line-height: 1.5;
		color: var(--t-muted);
		margin: 0;
	}

	.clear-all-button {
		background: transparent;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		color: var(--t-muted);
		font-size: 0.8rem;
		font-weight: 400;
		padding: 0.38rem 0.85rem;
		cursor: pointer;
		line-height: 1;
		user-select: none;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.clear-all-button:hover {
		color: var(--t-fg);
		border-color: var(--t-fg);
	}

	.clear-all-button:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.saved-feed {
		width: 100%;
	}

	.empty-state {
		padding: 5rem 1rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
	}

	.empty-title {
		font-size: 1.15rem;
		font-weight: 400;
		color: var(--t-fg);
		margin: 0;
	}

	.empty-hint {
		font-size: 0.88rem;
		font-weight: 350;
		color: var(--t-muted);
		margin: 0 0 0.75rem;
	}

	.discover-link {
		display: inline-flex;
		align-items: center;
		padding: 0.45rem 1rem;
		border-radius: 999px;
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		font-size: 0.84rem;
		text-decoration: none;
		transition: border-color 0.15s ease, background 0.15s ease;
	}

	.discover-link:hover {
		border-color: var(--t-fg);
		background: var(--t-tint);
	}

	.discover-link:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.masonry {
		column-width: 16rem;
		column-gap: 1.25rem;
		width: 100%;
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
