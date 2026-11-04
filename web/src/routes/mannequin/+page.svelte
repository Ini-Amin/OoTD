<script lang="ts">
	import { onMount } from 'svelte';
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
		if (closet.pieces.length === 0) return '/';
		const wornLabels = CATEGORIES
			.map((cat) => closet.wornPiece(cat)?.label)
			.filter((l): l is string => Boolean(l && l.trim()));
		const query =
			wornLabels.length > 0
				? wornLabels.join(' ')
				: (closet.pieces[0]?.label ?? '');
		return `/?q=${encodeURIComponent(query.trim())}`;
	});

	/**
	 * Which piece a craft request is about.
	 *
	 * This used to fall back to `closet.pieces[0]` — "whatever was added most
	 * recently" — so a request made while wearing three pieces silently asked
	 * about a fourth one the user was not looking at. A request form that
	 * guesses its subject is worse than one that asks: it produces a plausible
	 * order for the wrong garment. Now the subject is the last piece the user
	 * actually touched, or the single worn piece, or nothing (and the form asks).
	 */
	let lastTouchedId = $state<string | null>(null);

	let requestPiece = $derived.by(() => {
		if (lastTouchedId) {
			const hit = closet.pieces.find((p) => p.id === lastTouchedId);
			if (hit) return hit;
		}
		const wornList = CATEGORIES
			.map((c) => closet.wornPiece(c))
			.filter((p): p is ClosetPiece => Boolean(p));
		if (wornList.length === 1) {
			return wornList[0];
		}
		return undefined;
	});

	let requestLabel = $derived(
		requestPiece ? `Request: ${requestPiece.label}` : 'Request a craftsman'
	);

	/** Categories with nothing saved — shown as one compact row, not six dashes. */
	let emptyCategories = $derived(CATEGORIES.filter((c) => closet.byCategory(c).length === 0));
	let filledCategories = $derived(CATEGORIES.filter((c) => closet.byCategory(c).length > 0));
	let nothingWorn = $derived(CATEGORIES.every((c) => !closet.wornPiece(c)));

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
	<title>Mannequin — OoTD</title>
</svelte:head>

<main class="mannequin-page">
	<section class="mannequin-col" aria-label="3D Mannequin">
		<div class="mannequin-viewport">
			<!-- Height comes from a CSS variable so the page can shrink the
			     viewport on phones without the component knowing about
			     breakpoints. At 72vh on a 390x844 screen the model ran under the
			     fixed theme picker and the bottom nav. -->
			<Mannequin3D {worn} height="var(--mannequin-h, 72vh)" />
			{#if nothingWorn && !isClosetEmpty}
				<p class="viewport-hint">Tap a piece on the right to dress the mannequin</p>
			{/if}
		</div>
		{#if !nothingWorn}
			<div class="mannequin-underbar">
				<button
					type="button"
					class="clear-mannequin-button"
					onclick={clearMannequin}
				>
					Clear mannequin
				</button>
			</div>
		{/if}
	</section>

	<section class="closet-col" aria-label="Your closet">
		<h1 class="closet-title">Your closet</h1>

		{#if closet.pieces.length === 0}
			<div class="empty-closet">
				<p class="empty-title">Your closet is empty.</p>
				<p class="empty-line">
					Open any look and tap a piece icon (hat, top, shoes...) to save it here.
					Saved pieces can be layered on the mannequin one at a time.
				</p>
				<a href="/" class="empty-link">Browse looks &rarr;</a>
			</div>
			<ol class="empty-steps">
				<li><span class="step-n">1</span> Save a piece from any look</li>
				<li><span class="step-n">2</span> Tap it here to put it on</li>
				<li><span class="step-n">3</span> Request a custom version of what you see</li>
			</ol>
		{/if}

		{#if !isClosetEmpty}
			<div class="categories-list">
				{#each filledCategories as cat (cat)}
					<section class="category-section" aria-labelledby={`cat-${cat}`}>
						<div class="category-header">
							<CategoryIcon category={cat} size={16} />
							<h2 id={`cat-${cat}`} class="category-name">{CATEGORY_LABEL[cat]}</h2>
							<span class="category-count">{closet.byCategory(cat).length}</span>
						</div>
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
											lastTouchedId = piece.id;
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
											if (lastTouchedId === piece.id) lastTouchedId = null;
											closet.remove(piece.id);
										}}
									>
										&times;
									</button>
								</div>
							{/each}
						</div>
					</section>
				{/each}
			</div>

			{#if emptyCategories.length > 0}
				<div class="empty-slots">
					<span class="empty-slots-label">Nothing saved yet</span>
					{#each emptyCategories as cat (cat)}
						<span class="slot-chip">
							<CategoryIcon category={cat} size={12} />
							{CATEGORY_LABEL[cat]}
						</span>
					{/each}
				</div>
			{/if}
		{/if}

		<div class="closet-actions">
			<div class="actions-row">
				<a
					href={isClosetEmpty ? undefined : aiSearchHref}
					class="btn-action ai-link"
					class:disabled={isClosetEmpty}
					aria-disabled={isClosetEmpty}
					tabindex={isClosetEmpty ? -1 : 0}
				>
					Find similar with AI
				</a>
				<button
					type="button"
					class="btn-action request-btn"
					onclick={openDialog}
				>
					{requestLabel}
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
	.mannequin-page {
		--mannequin-h: 72vh;
		width: min(1380px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 2rem 0 4rem;
		display: grid;
		/* The closet is capped at 30rem (see .closet-col), so a 1.1fr second
		   column left ~200px of dead space at 1440px and pushed the two halves
		   apart. Sizing the second track to the cap and centring the pair keeps
		   the viewport and the closet visually adjacent at every width. */
		grid-template-columns: minmax(320px, 1fr) minmax(360px, 30rem);
		gap: 2.5rem;
		align-items: start;
		justify-content: center;
	}

	@media (max-width: 860px) {
		.mannequin-page {
			--mannequin-h: 54vh;
			grid-template-columns: 1fr;
			gap: 1.5rem;
			/* The theme picker is fixed above the bottom nav, so the last row of
			   the closet scrolls underneath it unless we reserve its height. */
			padding: 1rem 0 7.5rem;
		}
	}

	/* Landscape phones: 54vh of a 390px-tall viewport is unusably short, and
	   72vh pushes the closet off-screen entirely. */
	@media (max-width: 860px) and (max-height: 520px) {
		.mannequin-page {
			--mannequin-h: 78vh;
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
		position: relative;
	}

	/* The mannequin is the point of the page, but an undressed one looks like a
	   failed render. Say what to do, inside the frame, in the muted token. */
	.viewport-hint {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		top: 1rem;
		margin: 0;
		padding: 0.3rem 0.7rem;
		white-space: nowrap;
		border-radius: 999px;
		background: var(--t-surface);
		border: 1px solid var(--t-line);
		font-size: 0.76rem;
		color: var(--t-muted);
		pointer-events: none;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
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
		/* Without a cap the category rows stretch to the full column and the
		   count/label drift hundreds of pixels apart, which reads as a table
		   that lost its columns rather than as a list of garments. */
		max-width: 30rem;
		width: 100%;
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

	.empty-steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.empty-steps li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
		color: var(--t-muted);
	}

	.step-n {
		flex: 0 0 auto;
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 50%;
		border: 1px solid var(--t-line);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--t-fg);
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

	.category-count {
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		color: var(--t-muted);
		padding: 0.05rem 0.4rem;
		border-radius: 999px;
		background: var(--t-tint);
	}

	/* Six "—" rows for six empty categories was the loudest thing on the page
	   while carrying zero information. One chip row does the same job quietly. */
	.empty-slots {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		padding-top: 0.25rem;
	}

	.empty-slots-label {
		font-size: 0.75rem;
		color: var(--t-muted);
		margin-right: 0.15rem;
	}

	.slot-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.22rem 0.5rem;
		border: 1px dashed var(--t-line);
		border-radius: 999px;
		font-size: 0.72rem;
		color: var(--t-muted);
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
