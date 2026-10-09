<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { apiBase, type Outfit, ratioOf } from '$lib/outfits';
	import { saved } from '$lib/saved.svelte';

	let outfit = $state<Outfit | null>(null);
	let loading = $state(true);
	let error = $state<'notFound' | 'network' | null>(null);
	let errorMessage = $state('');
	let imageError = $state(false);
	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | undefined;

	let id = $derived(page.params.id ?? '');
	let isSaved = $derived(outfit ? saved.has(outfit.id) : false);
	let saveCount = $derived(outfit ? outfit.savedBy + (isSaved ? 1 : 0) : 0);
	let creatorUsername = $derived(outfit ? outfit.handle.replace(/^@/, '') : '');

	async function loadOutfit(targetId: string) {
		if (!targetId) return;
		loading = true;
		error = null;
		errorMessage = '';
		imageError = false;
		try {
			const res = await fetch(`${apiBase}/v1/outfits/${encodeURIComponent(targetId)}`);
			if (res.status === 404) {
				error = 'notFound';
				outfit = null;
				return;
			}
			if (!res.ok) {
				error = 'network';
				errorMessage = `Failed to load outfit (${res.status})`;
				outfit = null;
				return;
			}
			const data = (await res.json()) as { outfit: Outfit };
			outfit = data.outfit;
		} catch {
			error = 'network';
			errorMessage = 'Network error: could not connect to server.';
			outfit = null;
		} finally {
			loading = false;
		}
	}

	async function handleShare() {
		const shareData = {
			title: outfit?.title ?? 'OoTD',
			url: window.location.href
		};
		if (
			typeof navigator !== 'undefined' &&
			navigator.share &&
			navigator.canShare &&
			navigator.canShare(shareData)
		) {
			try {
				await navigator.share(shareData);
				return;
			} catch (err: unknown) {
				if (err instanceof Error && err.name === 'AbortError') return;
			}
		}
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			// clipboard fallback
		}
	}

	onMount(() => {
		saved.init();
	});

	$effect(() => {
		const currentId = id;
		if (currentId) {
			loadOutfit(currentId);
		}
	});
</script>

<svelte:head>
	<title>{outfit ? `${outfit.title} — OoTD` : error === 'notFound' ? 'Not Found — OoTD' : 'OoTD'}</title>
</svelte:head>

<main class="page-container">
	{#if loading}
		<div class="layout skeleton-layout" aria-busy="true" aria-label="Loading outfit">
			<div class="skeleton-photo"></div>
			<div class="skeleton-meta">
				<div class="skeleton-line skeleton-title"></div>
				<div class="skeleton-line skeleton-creator"></div>
				<div class="skeleton-line skeleton-caption"></div>
				<div class="skeleton-line skeleton-caption-short"></div>
			</div>
		</div>
	{:else if error === 'notFound'}
		<div class="state-container">
			<p class="state-message">This look is gone or private.</p>
			<a href="/" class="home-link">Back to Discover</a>
		</div>
	{:else if error === 'network'}
		<div class="state-container">
			<p class="state-message">{errorMessage}</p>
			<button type="button" class="retry-button" onclick={() => loadOutfit(id)}>Retry</button>
		</div>
	{:else if outfit}
		<article class="layout">
			<div class="photo-column">
				{#if outfit.imageUrl && !imageError}
					<div class="photo-wrapper">
						<img
							src={outfit.imageUrl}
							alt={outfit.title}
							class="photo"
							onerror={() => {
								imageError = true;
							}}
						/>
					</div>
				{:else}
					<div
						class="photo-fallback"
						style={`--outfit-accent: ${outfit.accent}; aspect-ratio: ${ratioOf(outfit)};`}
						role="img"
						aria-label={`${outfit.title} visual placeholder`}
					>
						<span class="mark">OoTD</span>
					</div>
				{/if}
			</div>

			<div class="meta-column">
				<h1 class="outfit-title">{outfit.title}</h1>

				<a href={`/u/${creatorUsername}`} class="creator-line">
					<span
						class="avatar"
						style={`--avatar-accent: ${outfit.accent}`}
						aria-hidden="true"
					>
						{outfit.creator ? outfit.creator.slice(0, 1) : ''}
					</span>
					<span class="creator-name">{outfit.creator}</span>
					<span class="creator-handle">{outfit.handle}</span>
				</a>

				{#if outfit.caption}
					<p class="caption">{outfit.caption}</p>
				{/if}

				{#if outfit.tags && outfit.tags.length > 0}
					<div class="tags" aria-label="Tags">
						{#each outfit.tags as tag}
							<span class="tag">#{tag}</span>
						{/each}
					</div>
				{/if}

				<div class="meta-footer">
					<span class="save-count">♡ {saveCount}</span>
					<div class="actions">
						<button
							type="button"
							class="save-button"
							class:saved={isSaved}
							aria-pressed={isSaved}
							onclick={() => outfit && saved.toggle(outfit)}
						>
							<span aria-hidden="true">{isSaved ? '♥' : '♡'}</span>
							<span>{isSaved ? 'Saved' : 'Save'}</span>
						</button>

						<button
							type="button"
							class="share-button"
							onclick={handleShare}
						>
							Share
						</button>

						{#if copied}
							<span class="copy-notice" role="status">Link copied</span>
						{/if}
					</div>
				</div>
			</div>
		</article>
	{/if}
</main>

<style>
	.page-container {
		width: min(1180px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 2.5rem 0 5rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
		gap: 3.5rem;
		align-items: start;
	}

	@media (max-width: 820px) {
		.layout {
			grid-template-columns: 1fr;
			gap: 2rem;
		}
	}

	.photo-column {
		width: 100%;
	}

	.photo-wrapper {
		width: 100%;
		max-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--t-surface);
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		overflow: hidden;
	}

	.photo {
		max-height: 80vh;
		width: 100%;
		height: auto;
		object-fit: contain;
		display: block;
		border-radius: var(--t-radius);
	}

	.photo-fallback {
		width: 100%;
		max-height: 80vh;
		min-height: 380px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: linear-gradient(
			160deg,
			var(--outfit-accent) 0%,
			color-mix(in srgb, var(--outfit-accent) 40%, var(--t-surface)) 100%
		);
	}

	.mark {
		font-size: 1.5rem;
		font-weight: 500;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: #ffffff;
		opacity: 0.9;
		text-shadow: 0 1px 3px rgb(0 0 0 / 25%);
		user-select: none;
	}

	.meta-column {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.outfit-title {
		margin: 0;
		font-family: var(--t-font);
		font-size: clamp(1.8rem, 3.5vw, 2.75rem);
		font-weight: 400;
		letter-spacing: -0.04em;
		line-height: 1.15;
		color: var(--t-fg);
	}

	.creator-line {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		text-decoration: none;
		color: inherit;
		width: fit-content;
	}

	.creator-line:hover .creator-name {
		text-decoration: underline;
	}

	.avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--avatar-accent);
		color: #ffffff;
		font-size: 0.85rem;
		font-weight: 500;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.creator-name {
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--t-fg);
	}

	.creator-handle {
		font-size: 0.85rem;
		color: var(--t-muted);
	}

	.caption {
		margin: 0;
		font-size: 1rem;
		line-height: 1.6;
		color: var(--t-fg);
		white-space: pre-line;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag {
		font-size: 0.82rem;
		color: var(--t-muted);
		background: var(--t-tint);
		border: 1px solid var(--t-line);
		border-radius: 999px;
		padding: 0.25rem 0.65rem;
	}

	.meta-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--t-line);
		flex-wrap: wrap;
	}

	.save-count {
		font-size: 0.9rem;
		color: var(--t-muted);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.save-button,
	.share-button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 1rem;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 450;
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		cursor: pointer;
		transition: border-color 0.15s ease, background-color 0.15s ease;
	}

	.save-button:hover,
	.share-button:hover {
		border-color: var(--t-fg);
	}

	.save-button.saved {
		background: var(--t-fg);
		color: var(--t-bg);
		border-color: var(--t-fg);
	}

	.copy-notice {
		font-size: 0.8rem;
		color: var(--t-muted);
	}

	.state-container {
		text-align: center;
		padding: 6rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
	}

	.state-message {
		font-size: 1.15rem;
		color: var(--t-muted);
		margin: 0;
	}

	.home-link,
	.retry-button {
		padding: 0.5rem 1.1rem;
		border-radius: 999px;
		border: 1px solid var(--t-line);
		background: var(--t-fg);
		color: var(--t-bg);
		text-decoration: none;
		font-size: 0.88rem;
		font-weight: 450;
		cursor: pointer;
	}

	.skeleton-layout {
		opacity: 0.6;
	}

	.skeleton-photo {
		width: 100%;
		height: 60vh;
		min-height: 380px;
		background: var(--t-tint);
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
	}

	.skeleton-meta {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-top: 1rem;
	}

	.skeleton-line {
		background: var(--t-tint);
		border-radius: 0.25rem;
	}

	.skeleton-title {
		height: 2.5rem;
		width: 80%;
	}

	.skeleton-creator {
		height: 1.5rem;
		width: 40%;
	}

	.skeleton-caption {
		height: 1rem;
		width: 95%;
	}

	.skeleton-caption-short {
		height: 1rem;
		width: 60%;
	}

	:focus-visible {
		outline: 2px solid var(--t-fg);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.save-button,
		.share-button {
			transition: none !important;
		}
	}
</style>
