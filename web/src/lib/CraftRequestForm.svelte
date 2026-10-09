<script lang="ts">
	import { onMount } from 'svelte';
	import { CATEGORIES, CATEGORY_LABEL, type Category, type ClosetPiece } from '$lib/pieces';
	import { apiBase } from '$lib/outfits';

	let {
		category,
		piece,
		onclose
	}: {
		category?: Category;
		piece?: ClosetPiece;
		onclose?: () => void;
	} = $props();

	type User = {
		username: string;
		displayName: string;
	};

	let users = $state<User[]>([]);
	let usersError = $state<string | null>(null);

	// ponytail: username trusted from /v1/users until auth exists
	let username = $state('');
	let selectedCategory = $state<Category>('top');
	let description = $state('');

	let initialized = false;
	let currentPieceId = $derived(piece?.id);
	let lastPieceId: string | null = null;
	let userEditedCategory = false;
	let userEditedDescription = false;

	$effect(() => {
		const pid = currentPieceId ?? '__none__';
		const cat = category ?? piece?.category;
		if (!initialized || pid !== lastPieceId) {
			initialized = true;
			lastPieceId = pid;
			if (!userEditedCategory) {
				selectedCategory = cat ?? 'top';
			}
			if (!userEditedDescription) {
				description = piece ? `Custom ${piece.label} inspired by the piece I picked.` : '';
			}
		}
	});
	let budgetInput = $state('');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);
	let success = $state(false);

	function cropStyle(p: ClosetPiece): string {
		const safeW = p.w <= 0 ? 1 : p.w;
		const safeH = p.h <= 0 ? 1 : p.h;
		const posX = safeW >= 1 ? 0 : (p.x / (1 - safeW)) * 100;
		const posY = safeH >= 1 ? 0 : (p.y / (1 - safeH)) * 100;
		return `background-image: url('${p.imageUrl}'); background-size: calc(100% / ${safeW}) calc(100% / ${safeH}); background-position: ${posX}% ${posY}%;`;
	}

	onMount(async () => {
		try {
			const res = await fetch(`${apiBase}/v1/users`);
			if (!res.ok) throw new Error('API unreachable');
			const data = (await res.json()) as { users: User[] };
			if (!data.users || data.users.length === 0) {
				throw new Error('No users returned');
			}
			users = data.users;
			username = users[0].username;
		} catch {
			usersError = 'The API is unreachable.';
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting || Boolean(usersError) || users.length === 0) return;

		const trimmed = description.trim();
		if (trimmed.length < 10 || trimmed.length > 1000) {
			errorMessage = 'Description must be between 10 and 1000 characters.';
			return;
		}

		let budgetIdr: number | null = null;
		if (budgetInput !== '' && budgetInput !== null) {
			const num = Number(budgetInput);
			if (!Number.isFinite(num) || num < 0 || num > 1000000000) {
				errorMessage = 'Budget must be between 0 and 1,000,000,000 IDR.';
				return;
			}
			budgetIdr = Math.floor(num);
		}

		submitting = true;
		errorMessage = null;

		const payload = {
			username,
			category: selectedCategory,
			description: trimmed,
			budgetIdr,
			outfitId: piece?.outfitId ?? null,
			pieceId: piece?.id && !piece.id.includes(':') ? piece.id : null
		};

		try {
			const res = await fetch(`${apiBase}/v1/requests`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as { error?: string } | null;
				errorMessage = data?.error ?? `Request failed (${res.status})`;
				return;
			}

			success = true;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Network error';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="craft-request-container">
	{#if success}
		<div class="success-panel">
			<p class="success-message">
				Request sent. A craftsmaker will see it once marketplace accounts open.
			</p>
			{#if onclose}
				<button type="button" class="btn-primary" onclick={onclose}>Done</button>
			{/if}
		</div>
	{:else}
		<header class="form-header">
			<h2 class="form-title">Request a craftsmaker</h2>
			{#if onclose}
				<button
					type="button"
					class="close-btn"
					aria-label="Close dialog"
					onclick={onclose}
				>
					&times;
				</button>
			{/if}
		</header>

		{#if piece}
			<div class="inspired-card">
				<div
					class="inspired-thumb"
					role="img"
					aria-label={piece.label}
					style={cropStyle(piece)}
				></div>
				<p class="inspired-text">
					Inspired by: <span class="inspired-label">{piece.label}</span> from <span class="inspired-title">{piece.outfitTitle}</span>
				</p>
			</div>
		{/if}

		{#if usersError}
			<p class="error-region" role="alert">{usersError}</p>
		{/if}

		{#if errorMessage}
			<p class="error-region" role="alert">{errorMessage}</p>
		{/if}

		<form onsubmit={handleSubmit}>
			<div class="field">
				<label for="craft-username">Posting as</label>
				<select
					id="craft-username"
					bind:value={username}
					disabled={submitting || Boolean(usersError) || users.length === 0}
					required
				>
					{#each users as user}
						<option value={user.username}>
							{user.displayName} (@{user.username})
						</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label for="craft-category">Piece type</label>
				<select
					id="craft-category"
					bind:value={selectedCategory}
					onchange={() => {
						userEditedCategory = true;
					}}
					disabled={submitting}
					required
				>
					{#each CATEGORIES as cat}
						<option value={cat}>{CATEGORY_LABEL[cat]}</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label for="craft-desc">What should they make?</label>
				<textarea
					id="craft-desc"
					bind:value={description}
					oninput={() => {
						userEditedDescription = true;
					}}
					rows="4"
					minlength="10"
					maxlength="1000"
					required
					disabled={submitting}
					placeholder="Describe what you want made, materials, fit, details..."
				></textarea>
			</div>

			<div class="field">
				<label for="craft-budget">Budget (IDR, optional)</label>
				<input
					type="number"
					id="craft-budget"
					bind:value={budgetInput}
					min="0"
					max="1000000000"
					step="1"
					placeholder="e.g. 500000"
					disabled={submitting}
				/>
			</div>

			<div class="actions">
				<button
					type="submit"
					class="btn-primary"
					disabled={submitting || Boolean(usersError) || users.length === 0}
				>
					{submitting ? 'Sending...' : 'Send request'}
				</button>
				{#if onclose}
					<button
						type="button"
						class="btn-secondary"
						disabled={submitting}
						onclick={onclose}
					>
						Cancel
					</button>
				{/if}
			</div>
		</form>
	{/if}
</div>

<style>
	.craft-request-container {
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.form-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.form-title {
		margin: 0;
		font-family: var(--t-font);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--t-fg);
	}

	.close-btn {
		background: transparent;
		border: 0;
		font-size: 1.25rem;
		line-height: 1;
		color: var(--t-muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--t-radius);
		transition: color 0.15s ease;
	}

	.close-btn:hover {
		color: var(--t-fg);
	}

	.inspired-card {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-tint);
	}

	.inspired-thumb {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background-color: var(--t-surface);
		background-repeat: no-repeat;
		flex-shrink: 0;
	}

	.inspired-text {
		margin: 0;
		font-size: 0.85rem;
		color: var(--t-muted);
		line-height: 1.4;
	}

	.inspired-label {
		font-weight: 600;
		color: var(--t-fg);
	}

	.inspired-title {
		font-weight: 500;
		color: var(--t-fg);
	}

	.error-region {
		margin: 0;
		padding: 0.75rem 1rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-tint);
		color: var(--t-fg);
		font-size: 0.85rem;
		line-height: 1.4;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	label {
		font-size: 0.84rem;
		font-weight: 600;
		color: var(--t-fg);
	}

	select,
	textarea,
	input[type='number'] {
		width: 100%;
		padding: 0.65rem 0.85rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
		color: var(--t-fg);
		font-family: var(--t-font);
		font-size: 0.88rem;
		line-height: 1.4;
		box-sizing: border-box;
		transition: border-color 0.15s ease;
	}

	select:focus,
	textarea:focus,
	input[type='number']:focus {
		outline: none;
		border-color: var(--t-fg);
	}

	textarea {
		resize: vertical;
		min-height: 5.5rem;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.btn-primary {
		padding: 0.65rem 1.25rem;
		border: 1px solid var(--t-fg);
		border-radius: var(--t-radius);
		background: var(--t-fg);
		color: var(--t-bg);
		font-family: var(--t-font);
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		padding: 0.65rem 1.1rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: transparent;
		color: var(--t-muted);
		font-family: var(--t-font);
		font-size: 0.88rem;
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.btn-secondary:hover:not(:disabled) {
		color: var(--t-fg);
		border-color: var(--t-fg);
	}

	.success-panel {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		align-items: flex-start;
		padding: 1rem 0;
	}

	.success-message {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--t-fg);
	}

	@media (prefers-reduced-motion: reduce) {
		.btn-primary,
		.btn-secondary,
		.close-btn {
			transition: none;
		}
	}
</style>
