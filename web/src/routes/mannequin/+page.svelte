<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Mannequin3D from '$lib/Mannequin3D.svelte';
	import CraftRequestForm from '$lib/CraftRequestForm.svelte';
	import CategoryIcon from '$lib/CategoryIcon.svelte';
	import { closet } from '$lib/closet.svelte';
	import {
		CATEGORIES,
		CATEGORY_LABEL,
		type Category,
		type ClosetPiece
	} from '$lib/pieces';

	let dialogEl = $state<HTMLDialogElement>();
	let isDialogOpen = $state(false);

	onMount(() => {
		closet.init();
	});

	let worn = $derived.by(() => {
		const map: Partial<Record<Category, ClosetPiece | undefined>> = {};
		for (const cat of CATEGORIES) {
			map[cat] = closet.wornPiece(cat);
		}
		return map;
	});

	function clearMannequin(): void {
		for (const cat of CATEGORIES) {
			closet.unwear(cat);
		}
	}

	function cropStyle(p: ClosetPiece): string {
		const safeW = p.w <= 0 ? 1 : p.w;
		const safeH = p.h <= 0 ? 1 : p.h;
		const posX = safeW >= 1 ? 0 : (p.x / (1 - safeW)) * 100;
		const posY = safeH >= 1 ? 0 : (p.y / (1 - safeH)) * 100;
		return `background-image: url('${p.imageUrl}'); background-size: calc(100% / ${safeW}) calc(100% / ${safeH}); background-position: ${posX}% ${posY}%;`;
	}

	let isClosetEmpty = $derived(closet.pieces.length === 0);

	let aiSearchHref = $derived.by(() => {
		if (closet.pieces.length === 0) return resolve('/');
		const wornLabels = CATEGORIES
			.map((cat) => closet.wornPiece(cat)?.label)
			.filter((l): l is string => Boolean(l && l.trim()));
		const query =
			wornLabels.length > 0
				? wornLabels.join(' ')
				: (closet.pieces[0]?.label ?? '');
		return `${resolve('/')}?q=${encodeURIComponent(query.trim())}`;
	});

	let requestPiece = $derived.by(() => {
		const wornList = CATEGORIES
			.map((c) => closet.wornPiece(c))
			.filter((p): p is ClosetPiece => Boolean(p));
		if (wornList.length === 1) {
			return wornList[0];
		}
		if (closet.pieces.length > 0) {
			return closet.pieces[0];
		}
		return undefined;
	});

	function openDialog(): void {
		isDialogOpen = true;
		dialogEl?.showModal();
	}

	function closeDialog(): void {
		dialogEl?.close();
		isDialogOpen = false;
	}

	function handleDialogClick(e: MouseEvent): void {
		if (!dialogEl) return;
		const rect = dialogEl.getBoundingClientRect();
		const isInDialog =
			rect.top <= e.clientY &&
			e.clientY <= rect.top + rect.height &&
			rect.left <= e.clientX &&
			e.clientX <= rect.left + rect.width;
		if (!isInDialog) {
			closeDialog();
		}
	}
</script>

<svelte:head>
	<title>Fitting room — OoTD</title>
	<meta name="description" content="Combine your saved outfit pieces on an interactive 3D mannequin. Explore every angle in your personal OoTD fitting room." />
</svelte:head>

<header class="studio-header">
	<div>
		<p class="studio-eyebrow">YOUR PERSONAL FITTING ROOM</p>
		<h1>Make the look yours.</h1>
		<p>Mix your saved pieces. See every angle.</p>
	</div>
	<a href={resolve('/')}>Discover more looks &rarr;</a>
</header>
<main class="mannequin-page">
	<section class="mannequin-col" aria-label="3D Mannequin">
		<div class="mannequin-viewport">
			<Mannequin3D {worn} height="clamp(360px, 58vh, 680px)" />
			<div class="viewer-caption">
				<p>Drag to rotate · Scroll or pinch to zoom</p>
				<p>Style preview only. Photo textures do not simulate garment fit.</p>
			</div>
		</div>
		<div class="mannequin-underbar">
			<button
				type="button"
				class="clear-mannequin-button"
				onclick={clearMannequin}
				disabled={!CATEGORIES.some((cat) => worn[cat])}
			>
				Clear mannequin
			</button>
		</div>
	</section>

	<section class="closet-col" aria-label="Your closet">
		<h2 class="closet-title">Your closet</h2>

		{#if closet.pieces.length === 0}
			<div class="empty-closet">
				<p class="empty-title">Your closet is empty.</p>
				<p class="empty-line">
					Open any look and tap a piece icon (hat, top, shoes...) to save it here.
				</p>
				<a href={resolve('/')} class="empty-link">Browse looks &rarr;</a>
			</div>
		{/if}

		<div class="categories-list">
			{#each CATEGORIES as cat (cat)}
				<section class="category-section" aria-labelledby={`cat-${cat}`}>
					<div class="category-header">
						<CategoryIcon category={cat} size={16} />
						<h2 id={`cat-${cat}`} class="category-name">{CATEGORY_LABEL[cat]}</h2>
					</div>
					{#if closet.byCategory(cat).length === 0}
						<div class="category-dash" aria-label={`No ${CATEGORY_LABEL[cat].toLowerCase()} pieces`}>—</div>
					{:else}
						<div class="category-grid">
							{#each closet.byCategory(cat) as piece (piece.id)}
								{@const isWorn = closet.worn[cat] === piece.id}
								<div class="thumbnail-wrapper" class:worn={isWorn}>
									<button
										type="button"
										class="thumbnail-btn"
										class:worn={isWorn}
										aria-pressed={isWorn}
										aria-label={`${isWorn ? 'Take off' : 'Wear'} ${piece.label}`}
										onclick={() => {
											if (isWorn) {
												closet.unwear(cat);
											} else {
												closet.wear(piece);
											}
										}}
									>
										<div
											class="piece-crop"
											role="img"
											aria-label={piece.label}
											style={cropStyle(piece)}
										></div>
									</button>
									<button
										type="button"
										class="remove-btn"
										aria-label={`Remove ${piece.label} from closet`}
										title={`Remove ${piece.label} from closet`}
										onclick={(e) => {
											e.stopPropagation();
											closet.remove(piece.id);
										}}
									>
										&times;
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/each}
		</div>

		<div class="closet-actions">
			<div class="actions-row">
				<a
					href={aiSearchHref}
					class="btn-action ai-link"
					class:disabled={isClosetEmpty}
					aria-disabled={isClosetEmpty}
				>
					Find similar with AI
				</a>
				<button
					type="button"
					class="btn-action request-btn"
					onclick={openDialog}
				>
					Request a craftsmaker
				</button>
			</div>
			<p class="actions-hint">
				AI search matches styles and pieces by keywords for now.
			</p>
		</div>
	</section>
</main>

<dialog
	bind:this={dialogEl}
	class="craft-dialog"
	onclick={handleDialogClick}
	onclose={() => {
		isDialogOpen = false;
	}}
>
	{#if isDialogOpen}
		<CraftRequestForm
			category={requestPiece?.category}
			piece={requestPiece}
			onclose={closeDialog}
		/>
	{/if}
</dialog>

<style>
	.studio-header {
		width: min(1380px, calc(100% - 2.5rem));
		margin: 1.5rem auto 0;
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}
	.studio-header h1 { font-size: clamp(1.75rem, 4vw, 2.75rem); letter-spacing: -0.05em; margin: 0.5rem 0; }
	.studio-header p { margin: 0; color: var(--t-muted); font-size: 0.875rem; line-height: 1.5; }
	.studio-header .studio-eyebrow { letter-spacing: 0.12em; }
	.studio-header a { font-size: 0.875rem; color: var(--t-fg); text-underline-offset: 4px; }
	.viewer-caption { padding: 0.75rem 1rem 1rem; text-align: center; }
	.viewer-caption p { margin: 0; color: var(--t-muted); font-size: 0.875rem; line-height: 1.6; }
	.clear-mannequin-button:disabled { opacity: 0.5; cursor: not-allowed; }
	.mannequin-page {
		width: min(1380px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 2rem 0 4rem;
		display: grid;
		grid-template-columns: minmax(320px, 1fr) minmax(360px, 1.1fr);
		gap: 2.5rem;
		align-items: start;
	}

	@media (max-width: 860px) {
		.mannequin-page {
			grid-template-columns: 1fr;
			gap: 2rem;
			padding: 1rem 0 3rem;
		}
	}

	.mannequin-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		position: sticky;
		top: 1.5rem;
	}

	@media (max-width: 860px) {
		.mannequin-col {
			position: static;
		}
	}

	.mannequin-viewport {
		width: 100%;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-tint);
		overflow: hidden;
	}

	.mannequin-underbar {
		display: flex;
		justify-content: center;
		padding: 0.25rem 0;
	}

	.clear-mannequin-button {
		background: transparent;
		border: 0;
		color: var(--t-muted);
		font-family: var(--t-font);
		font-size: 0.82rem;
		cursor: pointer;
		padding: 0.35rem 0.75rem;
		border-radius: var(--t-radius);
		transition: color 0.15s ease, background-color 0.15s ease;
	}

	.clear-mannequin-button:hover {
		color: var(--t-fg);
		background-color: var(--t-tint);
	}

	.closet-col {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.closet-title {
		margin: 0;
		font-family: var(--t-font);
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: var(--t-fg);
	}

	.empty-closet {
		padding: 1.15rem 1.35rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-tint);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.empty-title {
		margin: 0;
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--t-fg);
	}

	.empty-line {
		margin: 0;
		font-size: 0.85rem;
		color: var(--t-muted);
		line-height: 1.4;
	}

	.empty-link {
		margin-top: 0.35rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--t-accent);
		text-decoration: none;
		align-self: flex-start;
	}

	.empty-link:hover {
		text-decoration: underline;
	}

	.categories-list {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.category-section {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--t-line);
	}

	.category-section:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}

	.category-header {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--t-muted);
	}

	.category-name {
		margin: 0;
		font-family: var(--t-font);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--t-fg);
	}

	.category-dash {
		color: var(--t-muted);
		font-size: 0.9rem;
		padding-left: 0.25rem;
		line-height: 1;
	}

	.category-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.thumbnail-wrapper {
		position: relative;
		width: 4.25rem;
		height: 4.25rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: var(--t-tint);
		overflow: hidden;
		transition: box-shadow 0.15s ease, border-color 0.15s ease;
	}

	.thumbnail-wrapper.worn {
		box-shadow: 0 0 0 2px var(--t-accent);
		border-color: var(--t-accent);
	}

	.thumbnail-btn {
		width: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		display: block;
	}

	.thumbnail-btn:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: -2px;
	}

	.piece-crop {
		width: 100%;
		height: 100%;
		background-repeat: no-repeat;
	}

	.remove-btn {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 18px;
		height: 18px;
		padding: 0;
		margin: 0;
		border: 0;
		border-radius: 50%;
		background: var(--t-surface);
		color: var(--t-muted);
		font-size: 13px;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0.8;
		transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
		z-index: 2;
	}

	.remove-btn:hover {
		opacity: 1;
		color: var(--t-fg);
		background-color: var(--t-tint);
	}

	.closet-actions {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-top: 0.5rem;
	}

	.actions-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.btn-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.65rem 1.15rem;
		font-family: var(--t-font);
		font-size: 0.88rem;
		font-weight: 600;
		border-radius: var(--t-radius);
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
	}

	.ai-link {
		background: var(--t-surface);
		color: var(--t-fg);
		border: 1px solid var(--t-line);
	}

	.ai-link:hover:not(.disabled) {
		border-color: var(--t-fg);
	}

	.ai-link.disabled {
		opacity: 0.45;
		pointer-events: none;
		cursor: not-allowed;
	}

	.request-btn {
		background: var(--t-fg);
		color: var(--t-bg);
		border: 1px solid var(--t-fg);
	}

	.request-btn:hover {
		opacity: 0.9;
	}

	.actions-hint {
		margin: 0;
		font-size: 0.78rem;
		color: var(--t-muted);
		line-height: 1.4;
	}

	dialog.craft-dialog {
		margin: auto;
		padding: 0;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
		color: var(--t-fg);
		max-width: 540px;
		width: min(92vw, 540px);
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
	}

	dialog.craft-dialog::backdrop {
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.thumbnail-wrapper,
		.thumbnail-btn,
		.remove-btn,
		.clear-mannequin-button,
		.btn-action {
			transition: none;
		}
	}
</style>
