<script lang="ts">
	import { ratioOf, type Outfit } from '$lib/outfits';
	import { saved } from '$lib/saved.svelte';

	let { outfit }: { outfit: Outfit } = $props();

	let imageError = $state(false);

	$effect(() => {
		outfit.imageUrl;
		imageError = false;
	});

	let isSaved = $derived(saved.has(outfit.id));
	let username = $derived(outfit.handle.replace(/^@/, ''));
	let displayCount = $derived(outfit.savedBy + (isSaved ? 1 : 0));

	function handleSave(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		saved.toggle(outfit);
	}
</script>

<article class="outfit-card">
	<a href={`/o/${outfit.id}`} class="photo-link" aria-label={outfit.title}>
		{#if outfit.imageUrl && !imageError}
			<img
				src={outfit.imageUrl}
				alt={outfit.title}
				loading="lazy"
				style={`aspect-ratio: ${ratioOf(outfit)};`}
				onerror={() => (imageError = true)}
			/>
		{:else}
			<div
				class="visual-block"
				style={`aspect-ratio: ${ratioOf(outfit)}; --card-accent: ${outfit.accent};`}
				role="img"
				aria-label={`${outfit.title} outfit visual`}
			>
				<span class="mark">OoTD</span>
			</div>
		{/if}
	</a>

	<div class="card-meta">
		<h3 class="card-title">
			<a href={`/o/${outfit.id}`} class="title-link">{outfit.title}</a>
		</h3>

		<div class="creator-line">
			<a href={`/u/${username}`} class="creator-link">
				<span
					class="avatar"
					style={`--avatar-accent: ${outfit.accent}`}
					aria-hidden="true"
				>
					{outfit.creator.slice(0, 1)}
				</span>
				<span class="handle">{outfit.handle}</span>
			</a>
		</div>

		{#if outfit.tags && outfit.tags.length > 0}
			<p class="card-tags">{outfit.tags.join(' · ')}</p>
		{/if}

		<div class="card-footer">
			<span class="save-count">
				<span class="count-heart" aria-hidden="true">{isSaved ? '♥' : '♡'}</span>
				{displayCount}
			</span>
			<button
				type="button"
				class="save-button"
				class:saved={isSaved}
				aria-pressed={isSaved}
				aria-label={isSaved ? 'Saved' : 'Save look'}
				onclick={handleSave}
			>
				<span class="btn-heart" aria-hidden="true">{isSaved ? '♥' : '♡'}</span>
				<span>{isSaved ? 'Saved' : 'Save look'}</span>
			</button>
		</div>
	</div>
</article>

<style>
	.outfit-card {
		break-inside: avoid;
		margin-bottom: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.photo-link {
		display: block;
		width: 100%;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		overflow: hidden;
		position: relative;
		text-decoration: none;
		transition: transform 0.2s ease, border-color 0.2s ease;
	}

	.photo-link img {
		display: block;
		width: 100%;
		height: auto;
		object-fit: cover;
		transition: transform 0.25s ease;
	}

	.visual-block {
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(
			160deg,
			var(--card-accent) 0%,
			color-mix(in srgb, var(--card-accent) 40%, var(--t-surface)) 100%
		);
		overflow: hidden;
		transition: transform 0.25s ease;
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

	@media (prefers-reduced-motion: no-preference) {
		.outfit-card:hover .photo-link {
			transform: translateY(-2px);
			border-color: var(--t-muted);
		}

		.outfit-card:hover .photo-link img,
		.outfit-card:hover .visual-block {
			transform: scale(1.02);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.photo-link,
		.photo-link img,
		.visual-block,
		.outfit-card,
		.save-button {
			transition: none !important;
			transform: none !important;
			animation: none !important;
		}
	}

	.photo-link:focus-visible,
	.title-link:focus-visible,
	.creator-link:focus-visible,
	.save-button:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
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

	.title-link {
		color: inherit;
		text-decoration: none;
	}

	.title-link:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.creator-line {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.creator-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		text-decoration: none;
		color: inherit;
		min-width: 0;
	}

	.creator-link:hover .handle {
		color: var(--t-fg);
		text-decoration: underline;
		text-underline-offset: 2px;
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
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.count-heart {
		font-size: 0.74rem;
	}

	.save-button {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: transparent;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		color: var(--t-fg);
		font-size: 0.74rem;
		font-weight: 400;
		padding: 0.38rem 0.75rem;
		cursor: pointer;
		line-height: 1;
		transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
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

	.btn-heart {
		font-size: 0.8rem;
		line-height: 1;
	}
</style>
