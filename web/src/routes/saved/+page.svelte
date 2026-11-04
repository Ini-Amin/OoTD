<script lang="ts">
	import { onMount } from 'svelte';
	import OutfitCard from '$lib/OutfitCard.svelte';
	import { saved } from '$lib/saved.svelte';
	import { collections, type Board } from '$lib/collections.svelte';
	import { auth } from '$lib/auth.svelte';

	let newBoardTitle = $state('');
	let addPick: Record<string, string> = $state({});

	onMount(() => {
		saved.init();
	});

	$effect(() => {
		const token = auth.token;
		if (token) {
			void saved.loadFromServer();
			void collections.load();
		}
	});

	function handleClear(): void {
		if (typeof window !== 'undefined' && window.confirm('Remove all saved looks?')) {
			saved.clear();
		}
	}

	async function handleCreateBoard(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const title = newBoardTitle.trim();
		if (!title) return;
		const created = await collections.create(title.slice(0, 60));
		if (created) newBoardTitle = '';
	}

	function handleDeleteBoard(board: Board): void {
		if (typeof window !== 'undefined' && window.confirm(`Delete board "${board.title}"?`)) {
			void collections.remove(board.id);
		}
	}

	function boardOutfits(board: Board): { id: string; title: string }[] {
		return board.outfitIds.map((id) => {
			const match = saved.items.find((o) => o.id === id);
			return { id, title: match ? match.title : `Look ${id.slice(0, 8)}` };
		});
	}

	function addCandidates(board: Board) {
		return saved.items.filter((o) => !board.outfitIds.includes(o.id));
	}

	function handleAddToBoard(board: Board): void {
		const outfitId = addPick[board.id];
		if (!outfitId) return;
		void collections.addItem(board.id, outfitId);
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

	<section class="boards" aria-label="Boards">
		<h2>Boards</h2>
		{#if !auth.token}
			<p class="boards-hint">Sign in to organize your saves into boards.</p>
		{:else}
			<form class="board-create" onsubmit={handleCreateBoard}>
				<input
					type="text"
					placeholder="New board name…"
					maxlength="60"
					bind:value={newBoardTitle}
					aria-label="New board name"
				/>
				<button type="submit" disabled={newBoardTitle.trim().length === 0}>Create</button>
			</form>
			{#if collections.boards.length === 0}
				<p class="boards-hint">No boards yet — create one above, then add saved looks to it.</p>
			{:else}
				<ul class="board-list">
					{#each collections.boards as board (board.id)}
						<li class="board-card">
							<div class="board-head">
								<div class="board-title-wrap">
									<span class="board-title">{board.title}</span>
									<span class="board-count">
										{board.outfitIds.length}
										{board.outfitIds.length === 1 ? 'look' : 'looks'}
									</span>
								</div>
								<button
									type="button"
									class="board-delete"
									onclick={() => handleDeleteBoard(board)}
									aria-label={`Delete board ${board.title}`}
								>
									Delete
								</button>
							</div>
							{#if board.outfitIds.length > 0}
								<ul class="board-items">
									{#each boardOutfits(board) as item (item.id)}
										<li class="board-item">
											<span class="board-item-title">{item.title}</span>
											<button
												type="button"
												class="board-item-remove"
												onclick={() => void collections.removeItem(board.id, item.id)}
												aria-label={`Remove ${item.title} from ${board.title}`}
											>
												Remove
											</button>
										</li>
									{/each}
								</ul>
							{/if}
							{#if addCandidates(board).length > 0}
								<div class="board-add">
									<select
										bind:value={addPick[board.id]}
										aria-label={`Add a saved look to ${board.title}`}
									>
										<option value="">Add a saved look…</option>
										{#each addCandidates(board) as outfit (outfit.id)}
											<option value={outfit.id}>{outfit.title}</option>
										{/each}
									</select>
									<button
										type="button"
										disabled={!addPick[board.id]}
										onclick={() => handleAddToBoard(board)}
									>
										Add
									</button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</section>

	<section class="saved-feed" aria-label="Saved outfits">
		{#if saved.items.length === 0}
			<div class="empty-state">
				<p class="empty-title">Nothing saved yet.</p>
				<p class="empty-hint">
					{auth.token
						? 'Looks you save will appear here on every device.'
						: 'Saves live in this browser until you sign in.'}
				</p>
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

	.boards {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.boards h2 {
		font-size: 1.25rem;
		font-weight: 400;
		letter-spacing: -0.01em;
		color: var(--t-fg);
		margin: 0;
	}

	.boards-hint {
		font-size: 0.88rem;
		font-weight: 350;
		color: var(--t-muted);
		margin: 0;
	}

	.board-create {
		display: flex;
		gap: 0.6rem;
		max-width: 32rem;
	}

	.board-create input,
	.board-add select {
		flex: 1;
		min-width: 0;
		background: var(--t-surface);
		border: 1px solid var(--t-line);
		border-radius: 0.6rem;
		color: var(--t-fg);
		font-size: 0.85rem;
		padding: 0.5rem 0.75rem;
	}

	.board-create input:focus-visible,
	.board-add select:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 1px;
	}

	.board-create button,
	.board-add button {
		background: var(--t-fg);
		border: 1px solid var(--t-fg);
		border-radius: 999px;
		color: var(--t-bg);
		font-size: 0.82rem;
		font-weight: 500;
		padding: 0.45rem 1rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.board-create button:disabled,
	.board-add button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.board-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 1rem;
	}

	.board-card {
		background: var(--t-surface);
		border: 1px solid var(--t-line);
		border-radius: 0.9rem;
		padding: 1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.board-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.board-title-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.board-title {
		font-size: 1rem;
		font-weight: 500;
		color: var(--t-fg);
		overflow-wrap: anywhere;
	}

	.board-count {
		font-size: 0.78rem;
		color: var(--t-muted);
	}

	.board-delete,
	.board-item-remove {
		background: transparent;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		color: var(--t-muted);
		font-size: 0.75rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		line-height: 1;
		white-space: nowrap;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.board-delete:hover,
	.board-item-remove:hover {
		color: var(--t-fg);
		border-color: var(--t-fg);
	}

	.board-items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.board-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		font-size: 0.84rem;
	}

	.board-item-title {
		color: var(--t-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.board-add {
		display: flex;
		gap: 0.5rem;
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
