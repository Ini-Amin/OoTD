<script lang="ts">
	import { ratioOf, type Outfit } from '$lib/outfits';
	import { saved } from '$lib/saved.svelte';

	let { outfit, onopen }: { outfit: Outfit; onopen?: (id: string) => void } = $props();

	let imageError = $state(false);

	$effect(() => {
		outfit.imageUrl;
		imageError = false;
	});

	let isSaved = $derived(saved.has(outfit.id));
	let username = $derived(outfit.handle.replace(/^@/, ''));

	function handlePhotoClick(event: MouseEvent): void {
		if (!onopen) return;
		if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		onopen(outfit.id);
	}

	function handleSave(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		saved.toggle(outfit);
	}
</script>

<article class="outfit-card">
	<a
		href={`/o/${outfit.id}`}
		class="photo-link"
		aria-label={outfit.title}
		onclick={handlePhotoClick}
	>
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

	<div class="card-overlay">
		<div class="card-info">
			<a href={`/o/${outfit.id}`} class="card-title" onclick={handlePhotoClick}>{outfit.title}</a>
			<a href={`/u/${username}`} class="card-handle">{outfit.handle}</a>
		</div>
		<button
			type="button"
			class="save-button"
			class:saved={isSaved}
			aria-pressed={isSaved}
			aria-label={isSaved ? 'Saved' : 'Save look'}
			title={isSaved ? 'Saved' : 'Save look'}
			onclick={handleSave}
		>
			<svg viewBox="0 0 24 24" class="heart-icon" aria-hidden="true" width="14" height="14">
				<path
					d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
					fill={isSaved ? 'currentColor' : 'none'}
					stroke="currentColor"
					stroke-width="2"
				/>
			</svg>
		</button>
	</div>
</article>

<style>
	.outfit-card {
		break-inside: avoid;
		margin-bottom: 0.75rem;
		position: relative;
		border-radius: var(--t-radius);
		overflow: hidden;
		isolation: isolate;
		background: var(--t-surface);
	}

	.photo-link {
		display: block;
		width: 100%;
		text-decoration: none;
		border-radius: var(--t-radius);
		overflow: hidden;
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

	.card-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 2.2rem 0.65rem 0.65rem;
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--t-bg) 96%, transparent) 0%,
			color-mix(in srgb, var(--t-bg) 65%, transparent) 60%,
			transparent 100%
		);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
		z-index: 2;
	}

	.outfit-card:hover .card-overlay,
	.outfit-card:focus-within .card-overlay {
		opacity: 1;
		pointer-events: auto;
	}

	.card-info {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.card-title {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 450;
		color: var(--t-fg);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.3;
	}

	.card-title:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.card-handle {
		font-size: 0.72rem;
		color: var(--t-muted);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
	}

	.card-handle:hover {
		color: var(--t-fg);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.save-button {
		flex-shrink: 0;
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 50%;
		border: 1px solid var(--t-line);
		background: color-mix(in srgb, var(--t-surface) 92%, transparent);
		color: var(--t-fg);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
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

	.save-button:focus-visible,
	.photo-link:focus-visible,
	.card-title:focus-visible,
	.card-handle:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: no-preference) {
		.outfit-card:hover .photo-link img,
		.outfit-card:hover .visual-block {
			transform: scale(1.02);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.photo-link img,
		.visual-block,
		.outfit-card,
		.card-overlay,
		.save-button {
			transition: none !important;
			transform: none !important;
			animation: none !important;
		}
	}

	@media (hover: none) {
		.card-overlay {
			opacity: 1;
			pointer-events: auto;
			padding: 1.5rem 0.5rem 0.5rem;
			gap: 0.35rem;
		}

		.save-button {
			width: 1.7rem;
			height: 1.7rem;
		}
	}
</style>
