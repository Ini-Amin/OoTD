<script lang="ts">
	import { onMount } from 'svelte';
	import { CATEGORIES, CATEGORY_LABEL, DEFAULT_BOX, type Category, type Piece } from '$lib/pieces';
	import { closet } from '$lib/closet.svelte';
	import { saved } from '$lib/saved.svelte';
	import { apiBase, previewOutfits, ratioOf, type Outfit } from '$lib/outfits';
	import CategoryIcon from '$lib/CategoryIcon.svelte';

	let { id, onclose }: { id: string; onclose?: () => void } = $props();

	let outfit = $state<Outfit | null>(null);
	let loading = $state(true);
	let error = $state<'notFound' | 'network' | null>(null);
	let errorMessage = $state('');
	let imageError = $state(false);

	let hoveredCategory = $state<Category | null>(null);
	let focusedCategory = $state<Category | null>(null);
	let activeCategory = $derived(hoveredCategory ?? focusedCategory);

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | undefined;

	let toast = $state<{ message: string; link?: string; linkText?: string } | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout> | undefined;

	let currentRequestId = 0;

	let isSaved = $derived(outfit ? saved.has(outfit.id) : false);
	let saveCount = $derived(outfit ? outfit.savedBy + (isSaved ? 1 : 0) : 0);
	let username = $derived(outfit ? outfit.handle.replace(/^@/, '') : '');

	let pieces = $derived<Piece[]>(
		(() => {
			const current = outfit;
			if (!current) return [];
			if (current.pieces && current.pieces.length > 0) return current.pieces;
			return CATEGORIES.map((cat) => ({
				id: `${current.id}:${cat}`,
				category: cat,
				label: CATEGORY_LABEL[cat],
				x: DEFAULT_BOX[cat].x,
				y: DEFAULT_BOX[cat].y,
				w: DEFAULT_BOX[cat].w,
				h: DEFAULT_BOX[cat].h
			}));
		})()
	);

	let activePiece = $derived(activeCategory ? pieces.find((p) => p.category === activeCategory) : null);

	function showToast(message: string, link?: string, linkText?: string) {
		clearTimeout(toastTimeout);
		toast = { message, link, linkText };
		toastTimeout = setTimeout(() => {
			toast = null;
		}, 4000);
	}

	function togglePiece(piece: Piece) {
		if (!outfit || !outfit.imageUrl || !outfit.imageUrl.trim() || imageError) return;
		if (closet.has(piece.id)) {
			closet.remove(piece.id);
			showToast('Removed');
		} else {
			closet.add({
				...piece,
				outfitId: outfit.id,
				outfitTitle: outfit.title,
				imageUrl: outfit.imageUrl
			});
			showToast(`Saved ${piece.label} to your closet`, '/mannequin', 'Open mannequin');
		}
	}

	async function handleShare() {
		if (!outfit) return;
		const shareData = {
			title: outfit.title,
			url: typeof window !== 'undefined' ? window.location.href : ''
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
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
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
	}

	async function loadOutfit(targetId: string) {
		if (!targetId) {
			loading = false;
			error = 'notFound';
			outfit = null;
			return;
		}
		const req = ++currentRequestId;
		loading = true;
		error = null;
		errorMessage = '';
		imageError = false;

		try {
			const res = await fetch(`${apiBase}/v1/outfits/${encodeURIComponent(targetId)}`);
			if (req !== currentRequestId) return;
			if (res.status === 404) {
				error = 'notFound';
				outfit = null;
				return;
			}
			if (!res.ok) {
				throw new Error(`Failed to load look (${res.status})`);
			}
			const data = (await res.json()) as { outfit: Outfit };
			if (req !== currentRequestId) return;
			outfit = data.outfit;
		} catch (err) {
			if (req !== currentRequestId) return;
			const fallback = previewOutfits.find((o) => o.id === targetId);
			if (fallback) {
				outfit = fallback;
				error = null;
			} else {
				error = 'network';
				errorMessage = err instanceof Error ? err.message : 'Network error';
				outfit = null;
			}
		} finally {
			if (req === currentRequestId) {
				loading = false;
			}
		}
	}

	onMount(() => {
		closet.init();
		saved.init();
		return () => {
			clearTimeout(toastTimeout);
			clearTimeout(copyTimeout);
		};
	});

	$effect(() => {
		const currentId = id;
		imageError = false;
		loadOutfit(currentId);
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && onclose) {
			onclose();
		}
	}}
/>

<article class="viewer-card">
	{#if onclose}
		<button type="button" class="close-button" onclick={onclose} aria-label="Close">
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
	{/if}

	{#if toast}
		<aside class="toast" role="status" aria-live="polite">
			<span>{toast.message}</span>
			{#if toast.link && toast.linkText}
				<a href={toast.link} class="toast-link">{toast.linkText}</a>
			{/if}
		</aside>
	{/if}

	{#if loading}
		<div class="card-loading" aria-busy="true" aria-label="Loading look">
			<div class="skeleton-photo"></div>
			<div class="skeleton-meta">
				<div class="skeleton-line skeleton-title"></div>
				<div class="skeleton-line skeleton-creator"></div>
				<div class="skeleton-line skeleton-caption"></div>
				<div class="skeleton-line skeleton-caption-short"></div>
			</div>
		</div>
	{:else if error === 'notFound'}
		<div class="card-state">
			<p class="state-message">This look is gone or private.</p>
		</div>
	{:else if error === 'network'}
		<div class="card-state">
			<p class="state-message">{errorMessage || 'Network error: could not connect to server.'}</p>
			<button type="button" class="retry-btn" onclick={() => loadOutfit(id)}>Retry</button>
		</div>
	{:else if outfit}
		<div class="card-content">
			<div class="photo-pane">
				<div class="photo-wrapper">
					{#if outfit.imageUrl && outfit.imageUrl.trim() && !imageError}
						<div class="photo-frame">
							<img
								src={outfit.imageUrl}
								alt={outfit.title}
								width={outfit.imageWidth}
								height={outfit.imageHeight}
								class="photo-img"
								onerror={() => {
									imageError = true;
								}}
							/>
							{#if activePiece}
								<div
									class="piece-highlight"
									style={`left: ${activePiece.x * 100}%; top: ${activePiece.y * 100}%; width: ${activePiece.w * 100}%; height: ${activePiece.h * 100}%;`}
								></div>
							{/if}
						</div>
					{:else}
						<div
							class="photo-fallback"
							style={`aspect-ratio: ${ratioOf(outfit)}; --card-accent: ${outfit.accent};`}
							role="img"
							aria-label={`${outfit.title} visual`}
						>
							<span class="fallback-mark">OoTD</span>
						</div>
					{/if}

					<aside class="category-strip" aria-label="Pieces">
						{#each CATEGORIES as cat (cat)}
							{@const piece = pieces.find((p) => p.category === cat)}
							{@const isPieceSaved = piece ? closet.has(piece.id) : false}
							{@const hasImage = Boolean(outfit.imageUrl && outfit.imageUrl.trim() && !imageError)}
							{@const isDisabled = !piece || !hasImage}
							{@const buttonTitle = !hasImage
								? 'No photo to crop from'
								: !piece
									? `No ${CATEGORY_LABEL[cat]} tagged`
									: isPieceSaved
										? `Remove ${piece.label}`
										: `Save ${piece.label} to closet`}
							<div class="strip-item">
								<button
									type="button"
									class="category-btn"
									class:saved={isPieceSaved}
									class:dimmed={!piece}
									disabled={isDisabled}
									title={buttonTitle}
									aria-pressed={isPieceSaved}
									aria-label={piece ? piece.label : CATEGORY_LABEL[cat]}
									onmouseenter={() => {
										if (piece) hoveredCategory = cat;
									}}
									onmouseleave={() => {
										if (hoveredCategory === cat) hoveredCategory = null;
									}}
									onfocus={() => {
										if (piece) focusedCategory = cat;
									}}
									onblur={() => {
										if (focusedCategory === cat) focusedCategory = null;
									}}
									onclick={() => {
										if (piece && hasImage) togglePiece(piece);
									}}
								>
									<CategoryIcon category={cat} size={20} />
								</button>
								{#if activeCategory === cat && piece}
									<div class="tooltip" role="tooltip">
										{piece.label}
									</div>
								{/if}
							</div>
						{/each}
					</aside>
				</div>
			</div>

			<div class="meta-pane">
				<div class="meta-header">
					<h1 class="outfit-title">{outfit.title}</h1>
					<a href={`/u/${username}`} class="creator-link">
						<span class="creator-avatar" style={`--avatar-accent: ${outfit.accent}`} aria-hidden="true">
							{outfit.creator ? outfit.creator.slice(0, 1) : ''}
						</span>
						<span class="creator-info">
							<span class="creator-name">{outfit.creator}</span>
							<span class="creator-handle">{outfit.handle}</span>
						</span>
					</a>
				</div>

				{#if outfit.caption}
					<p class="caption">{outfit.caption}</p>
				{/if}

				{#if outfit.tags && outfit.tags.length > 0}
					<p class="tags">{outfit.tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')}</p>
				{/if}

				<div class="meta-footer">
					<div class="counts-row">
						<span class="save-count">♡ {saveCount}</span>
					</div>
					<div class="actions-row">
						<button
							type="button"
							class="save-look-btn"
							class:saved={isSaved}
							aria-pressed={isSaved}
							onclick={() => outfit && saved.toggle(outfit)}
						>
							<span aria-hidden="true" class="heart-icon">{isSaved ? '♥' : '♡'}</span>
							<span>{isSaved ? 'Saved look' : 'Save look'}</span>
						</button>

						<button type="button" class="share-btn" onclick={handleShare}>
							Share
						</button>

						{#if copied}
							<span class="copy-notice" role="status">Link copied</span>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</article>

<style>
	.viewer-card {
		position: relative;
		width: 100%;
		max-width: 72rem;
		max-height: 90vh;
		background: var(--t-surface);
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-sizing: border-box;
		font-family: var(--t-font);
		color: var(--t-fg);
	}

	.close-button {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 25;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 9999px;
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.close-button:hover {
		background: var(--t-tint);
		border-color: var(--t-muted);
	}

	.close-button:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.toast {
		position: absolute;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 40;
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1rem;
		background: var(--t-surface);
		color: var(--t-fg);
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.toast-link {
		color: var(--t-accent);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.toast-link:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.card-loading {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		width: 100%;
		min-height: 24rem;
	}

	.skeleton-photo {
		flex: 1;
		min-height: 24rem;
		background: var(--t-tint);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.skeleton-meta {
		width: 22rem;
		padding: 2.25rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border-left: 1px solid var(--t-line);
	}

	.skeleton-line {
		height: 1rem;
		background: var(--t-tint);
		border-radius: var(--t-radius);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.skeleton-title {
		height: 1.75rem;
		width: 75%;
	}

	.skeleton-creator {
		width: 45%;
	}

	.skeleton-caption {
		width: 90%;
	}

	.skeleton-caption-short {
		width: 60%;
	}

	.card-state {
		padding: 5rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		text-align: center;
	}

	.state-message {
		font-size: 1rem;
		color: var(--t-muted);
		margin: 0;
	}

	.retry-btn {
		padding: 0.5rem 1.25rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.retry-btn:hover {
		background: var(--t-tint);
		border-color: var(--t-muted);
	}

	.retry-btn:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.card-content {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		width: 100%;
		max-height: 90vh;
		overflow: hidden;
	}

	.photo-pane {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: var(--t-bg);
		position: relative;
	}

	.photo-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		max-width: 100%;
		max-height: 80vh;
	}

	.photo-frame {
		position: relative;
		display: inline-block;
		line-height: 0;
		max-height: 80vh;
		max-width: 100%;
		border-radius: var(--t-radius);
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.photo-img {
		display: block;
		max-height: 80vh;
		max-width: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		border-radius: var(--t-radius);
	}

	.photo-fallback {
		width: 100%;
		min-width: 18rem;
		max-width: 32rem;
		max-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: linear-gradient(
			160deg,
			var(--card-accent) 0%,
			color-mix(in srgb, var(--card-accent) 40%, var(--t-surface)) 100%
		);
	}

	.fallback-mark {
		font-size: 1.25rem;
		font-weight: 500;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: #ffffff;
		opacity: 0.9;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
	}

	.piece-highlight {
		position: absolute;
		border: 1.5px solid var(--t-accent);
		background: color-mix(in srgb, var(--t-accent) 22%, transparent);
		border-radius: var(--t-radius);
		pointer-events: none;
		box-sizing: border-box;
		z-index: 2;
		transition: all 0.15s ease;
	}

	.category-strip {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.375rem;
		background: var(--t-surface);
		border: 1px solid var(--t-line);
		border-radius: 9999px;
		align-items: center;
		flex-shrink: 0;
		z-index: 5;
	}

	.strip-item {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.category-btn {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 9999px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--t-fg);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
	}

	.category-btn:hover:not(:disabled) {
		background: var(--t-tint);
		border-color: var(--t-line);
		transform: scale(1.05);
	}

	.category-btn:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.category-btn.saved {
		background: var(--t-fg);
		color: var(--t-bg);
		border-color: var(--t-fg);
	}

	.category-btn.saved:hover:not(:disabled) {
		background: var(--t-fg);
		color: var(--t-bg);
		opacity: 0.9;
	}

	.category-btn:disabled,
	.category-btn.dimmed {
		opacity: 0.25;
		cursor: not-allowed;
	}

	.tooltip {
		position: absolute;
		left: calc(100% + 8px);
		top: 50%;
		transform: translateY(-50%);
		background: var(--t-fg);
		color: var(--t-bg);
		padding: 0.25rem 0.5rem;
		border-radius: var(--t-radius);
		font-size: 0.75rem;
		font-weight: 500;
		white-space: nowrap;
		pointer-events: none;
		z-index: 30;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.meta-pane {
		width: 22rem;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 2.25rem 2rem;
		border-left: 1px solid var(--t-line);
		background: var(--t-surface);
		overflow-y: auto;
		box-sizing: border-box;
	}

	.meta-header {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.outfit-title {
		font-size: 1.35rem;
		font-weight: 500;
		line-height: 1.3;
		margin: 0;
		color: var(--t-fg);
		letter-spacing: -0.01em;
	}

	.creator-link {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		text-decoration: none;
		color: inherit;
		width: fit-content;
	}

	.creator-link:hover .creator-name {
		text-decoration: underline;
	}

	.creator-link:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
		border-radius: var(--t-radius);
	}

	.creator-avatar {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 9999px;
		background: var(--avatar-accent, var(--t-tint));
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.creator-info {
		display: flex;
		flex-direction: column;
		font-size: 0.8rem;
		line-height: 1.25;
	}

	.creator-name {
		font-weight: 500;
		color: var(--t-fg);
	}

	.creator-handle {
		color: var(--t-muted);
		font-size: 0.75rem;
	}

	.caption {
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--t-fg);
		margin: 0;
		opacity: 0.9;
	}

	.tags {
		font-size: 0.8rem;
		color: var(--t-muted);
		line-height: 1.4;
		margin: 0;
		font-family: var(--t-font);
	}

	.meta-footer {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--t-line);
	}

	.counts-row {
		display: flex;
		align-items: center;
		font-size: 0.85rem;
		color: var(--t-muted);
	}

	.actions-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
		position: relative;
	}

	.save-look-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.875rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}

	.save-look-btn:hover {
		background: var(--t-tint);
		border-color: var(--t-muted);
	}

	.save-look-btn.saved {
		background: var(--t-fg);
		color: var(--t-bg);
		border-color: var(--t-fg);
	}

	.save-look-btn:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.share-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 0.875rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.share-btn:hover {
		background: var(--t-tint);
		border-color: var(--t-muted);
	}

	.share-btn:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.copy-notice {
		font-size: 0.8rem;
		color: var(--t-muted);
		animation: fadeIn 0.2s ease;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.9;
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (max-width: 860px) {
		.viewer-card {
			max-height: none;
			height: auto;
		}

		.card-content {
			flex-direction: column;
			max-height: none;
		}

		.photo-pane {
			padding: 1.25rem 1rem;
			flex: none;
		}

		.photo-wrapper {
			flex-direction: column;
			gap: 0.75rem;
			max-height: none;
		}

		.photo-frame {
			max-height: 55vh;
		}

		.photo-img {
			max-height: 55vh;
		}

		.photo-fallback {
			max-height: 55vh;
		}

		.category-strip {
			flex-direction: row;
			padding: 0.375rem 0.5rem;
		}

		.tooltip {
			left: 50%;
			top: auto;
			bottom: calc(100% + 8px);
			transform: translateX(-50%);
		}

		.meta-pane {
			width: 100%;
			border-left: none;
			border-top: 1px solid var(--t-line);
			padding: 1.5rem 1.25rem;
			overflow-y: visible;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.category-btn,
		.save-look-btn,
		.share-btn,
		.close-button,
		.retry-btn,
		.piece-highlight,
		.skeleton-photo,
		.skeleton-line {
			transition: none !important;
			transform: none !important;
			animation: none !important;
		}
	}
</style>
