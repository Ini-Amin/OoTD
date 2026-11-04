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
		type ClosetPiece,
		type AvatarCustomization,
		DEFAULT_AVATAR_CUSTOMIZATION
	} from '$lib/pieces';

	let dialogEl = $state<HTMLDialogElement>();
	let isDialogOpen = $state(false);
	let custom = $state<AvatarCustomization>({ ...DEFAULT_AVATAR_CUSTOMIZATION });
	let showStudio = $state(true);

	const skinTones = [
		{ name: 'Porcelain', color: '#f5d0b5' },
		{ name: 'Warm Honey', color: '#e2b38f' },
		{ name: 'Golden Tan', color: '#c58c65' },
		{ name: 'Chestnut', color: '#8d5536' },
		{ name: 'Espresso', color: '#432616' },
		{ name: 'Titanium', color: '#9aa0a6' },
		{ name: 'Rose Quartz', color: '#c9928f' }
	];

	type PoseId = AvatarCustomization['animation'];

	const POSES: { id: PoseId; label: string }[] = [
		{ id: 'idle', label: 'Idle' },
		{ id: 'walk', label: 'Walk' },
		{ id: 'pose', label: 'Pose' },
		{ id: 'stand', label: 'Stand' }
	];

	type SliderKey = 'height' | 'shoulders' | 'chest' | 'waist' | 'hips' | 'headSize';

	const SLIDERS: { key: SliderKey; label: string; min: number; max: number; step: number }[] = [
		{ key: 'height', label: 'Height', min: 0.8, max: 1.2, step: 0.01 },
		{ key: 'shoulders', label: 'Shoulders', min: 0.8, max: 1.3, step: 0.02 },
		{ key: 'chest', label: 'Chest', min: 0.8, max: 1.35, step: 0.02 },
		{ key: 'waist', label: 'Waist', min: 0.75, max: 1.35, step: 0.02 },
		{ key: 'hips', label: 'Hips', min: 0.8, max: 1.35, step: 0.02 },
		{ key: 'headSize', label: 'Head', min: 0.85, max: 1.15, step: 0.02 }
	];

	function resetCustomization() {
		custom = { ...DEFAULT_AVATAR_CUSTOMIZATION };
	}

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
			<Mannequin3D {worn} model="xbot" customization={custom} height="100%" />
			{#if nothingWorn && !isClosetEmpty}
				<p class="viewport-hint">Tap a piece on the right to dress the mannequin</p>
			{/if}

			{#if !nothingWorn}
				<button
					type="button"
					class="clear-look-btn"
					onclick={clearMannequin}
					title="Remove all clothing pieces from mannequin"
				>
					Clear look
				</button>
			{/if}

			<!-- Floating Docked Avatar Studio (no page scroll needed) -->
			<section
				class="studio"
				aria-label="Avatar body studio"
				onpointerdown={(e) => e.stopPropagation()}
			>
				<div class="studio-bar">
					<button
						type="button"
						class="studio-toggle"
						aria-expanded={showStudio}
						onclick={() => (showStudio = !showStudio)}
					>
						<span class="studio-title">Avatar Studio</span>
						<svg
							class="studio-chevron"
							class:open={showStudio}
							viewBox="0 0 12 12"
							width="10"
							height="10"
							aria-hidden="true"
						>
							<path
								d="M2.5 4.5 6 8 9.5 4.5"
								fill="none"
								stroke="currentColor"
								stroke-width="1.6"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
					{#if showStudio}
						<button type="button" class="studio-reset" onclick={resetCustomization}>
							Reset
						</button>
					{/if}
				</div>

				{#if showStudio}
					<div class="studio-panel">
						<div class="field">
							<span class="field-label">Pose</span>
							<div class="segmented" role="group" aria-label="Pose">
								{#each POSES as p}
									<button
										type="button"
										class="segment"
										class:active={custom.animation === p.id}
										aria-pressed={custom.animation === p.id}
										onclick={() => (custom.animation = p.id)}
									>
										{p.label}
									</button>
								{/each}
							</div>
						</div>

						<div class="field">
							<span class="field-label">Skin Tone</span>
							<div class="swatches" role="group" aria-label="Skin tone">
								{#each skinTones as tone}
									<button
										type="button"
										class="swatch"
										class:active={custom.skinTone === tone.color}
										style:background-color={tone.color}
										title={tone.name}
										aria-label={tone.name}
										aria-pressed={custom.skinTone === tone.color}
										onclick={() => (custom.skinTone = tone.color)}
									></button>
								{/each}
							</div>
						</div>

						<div class="fields">
							{#each SLIDERS as s}
								<label class="slider">
									<span class="slider-head">
										<span class="slider-label">{s.label}</span>
										<span class="slider-value">{Math.round(custom[s.key] * 100)}%</span>
									</span>
									<input
										type="range"
										min={s.min}
										max={s.max}
										step={s.step}
										bind:value={custom[s.key]}
										aria-label={s.label}
									/>
								</label>
							{/each}
						</div>
					</div>
				{/if}
			</section>
		</div>
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
		--mannequin-h: min(760px, calc(100vh - 7.5rem));
		width: min(1380px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 1.25rem 0 2rem;
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
		height: var(--mannequin-h);
		min-height: 520px;
		max-height: 760px;
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

	.clear-look-btn {
		position: absolute;
		top: 0.85rem;
		right: 0.85rem;
		z-index: 10;
		padding: 0.32rem 0.75rem;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: color-mix(in srgb, var(--t-surface) 90%, transparent);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		color: var(--t-muted);
		font-family: var(--t-font);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: color 0.12s ease, border-color 0.12s ease, background-color 0.12s ease;
	}

	.clear-look-btn:hover {
		color: var(--t-fg);
		border-color: var(--t-fg);
		background: var(--t-surface);
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

	/* Floating Docked Avatar Studio (integrated inside viewport, zero page scroll) */
	.studio {
		position: absolute;
		bottom: 0.65rem;
		left: 0.65rem;
		right: 0.65rem;
		z-index: 15;
		border: 1px solid var(--t-line);
		border-radius: calc(var(--t-radius) - 0.25rem);
		background: color-mix(in srgb, var(--t-surface) 92%, transparent);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow: 0 8px 32px color-mix(in srgb, var(--t-fg) 10%, transparent);
		overflow: hidden;
	}

	.studio-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.35rem 0.5rem 0.35rem 0.85rem;
		background: color-mix(in srgb, var(--t-tint) 60%, transparent);
	}

	.studio-toggle {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex: 1;
		min-width: 0;
		padding: 0.25rem 0;
		border: 0;
		background: none;
		color: var(--t-fg);
		font-family: var(--t-font);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-align: left;
		cursor: pointer;
	}

	.studio-chevron {
		flex: none;
		color: var(--t-muted);
		transition: transform 0.15s ease;
	}

	.studio-chevron.open {
		transform: rotate(180deg);
	}

	.studio-reset {
		flex: none;
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: none;
		font-family: var(--t-font);
		font-size: 0.7rem;
		color: var(--t-muted);
		cursor: pointer;
		transition: color 0.12s ease, border-color 0.12s ease;
	}

	.studio-reset:hover {
		color: var(--t-fg);
		border-color: var(--t-fg);
	}

	.studio-panel {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 0.6rem 0.85rem 0.75rem;
		max-height: 240px;
		overflow-y: auto;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.field-label {
		font-size: 0.66rem;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--t-muted);
	}

	.segmented {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 2px;
		padding: 2px;
		border-radius: 999px;
		background: var(--t-tint);
	}

	.segment {
		padding: 0.32rem 0.3rem;
		border: 0;
		border-radius: 999px;
		background: none;
		font-family: var(--t-font);
		font-size: 0.74rem;
		font-weight: 500;
		color: var(--t-muted);
		white-space: nowrap;
		cursor: pointer;
		transition: background-color 0.12s ease, color 0.12s ease;
	}

	.segment:hover {
		color: var(--t-fg);
	}

	.segment.active {
		background: var(--t-surface);
		color: var(--t-fg);
		font-weight: 600;
		box-shadow: 0 1px 3px color-mix(in srgb, var(--t-fg) 14%, transparent);
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.swatch {
		width: 1.45rem;
		height: 1.45rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--t-fg) 16%, transparent);
		border-radius: 50%;
		cursor: pointer;
		transition: transform 0.12s ease, box-shadow 0.12s ease;
	}

	.swatch:hover {
		transform: scale(1.12);
	}

	.swatch.active {
		box-shadow: 0 0 0 2px var(--t-surface), 0 0 0 3px var(--t-fg);
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem 1.1rem;
	}

	.slider {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.slider-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.slider-label {
		font-size: 0.72rem;
		color: var(--t-muted);
	}

	.slider-value {
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
		color: var(--t-muted);
	}

	.slider input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 0.9rem;
		margin: 0;
		background: transparent;
		cursor: pointer;
	}

	.slider input[type='range']::-webkit-slider-runnable-track {
		height: 3px;
		border-radius: 2px;
		background: var(--t-line);
	}

	.slider input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 0.75rem;
		height: 0.75rem;
		margin-top: -0.22rem;
		border: 0;
		border-radius: 50%;
		background: var(--t-fg);
	}

	.slider input[type='range']::-moz-range-track {
		height: 3px;
		border-radius: 2px;
		background: var(--t-line);
	}

	.slider input[type='range']::-moz-range-thumb {
		width: 0.75rem;
		height: 0.75rem;
		border: 0;
		border-radius: 50%;
		background: var(--t-fg);
	}

	.slider input[type='range']:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
		border-radius: 2px;
	}
	@media (prefers-reduced-motion: reduce) {
		.thumbnail-wrapper,
		.thumbnail-btn,
		.remove-btn,
		.clear-look-btn,
		.btn-action {
			transition: none;
		}
	}
</style>
