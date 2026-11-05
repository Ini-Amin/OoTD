<script lang="ts">
	import { page } from '$app/state';
	import { apiBase } from '$lib/outfits';
	import { auth, authHeaders } from '$lib/auth.svelte';
	import {
		canDecide,
		canMarkDone,
		craftStatusLabel,
		formatBudgetIDR,
		isMakerProfile,
		type CraftRequestStatus
	} from '$lib/makers';

	type IncomingRequest = {
		id: string;
		category: string;
		description: string;
		budgetIdr: number | null;
		status: CraftRequestStatus;
		createdAt: string;
		username: string;
		displayName: string;
		outfitLabel: string;
		pieceLabel: string;
	};

	let requests = $state<IncomingRequest[]>([]);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let deciding = $state<Record<string, boolean>>({});
	let decideError = $state<string | null>(null);

	let maker = $derived(isMakerProfile(auth.profile));
	let next = $derived(page.url.pathname);

	$effect(() => {
		if (auth.ready && auth.session && maker && requests.length === 0 && !loading && !loadError) {
			void load();
		}
	});

	async function load(): Promise<void> {
		loading = true;
		loadError = null;
		try {
			const res = await fetch(`${apiBase}/v1/requests`, { headers: { ...authHeaders() } });
			if (res.status === 401) {
				loadError = 'Your session expired. Sign in again.';
				return;
			}
			if (res.status === 403) {
				loadError = 'This dashboard is for maker accounts only.';
				return;
			}
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as { error?: string } | null;
				loadError = data?.error ?? `Request failed (${res.status})`;
				return;
			}
			const data = (await res.json()) as { requests?: IncomingRequest[] };
			requests = data.requests ?? [];
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Network error';
		} finally {
			loading = false;
		}
	}

	async function decide(id: string, status: 'accepted' | 'declined' | 'done'): Promise<void> {
		if (deciding[id]) return;
		deciding = { ...deciding, [id]: true };
		decideError = null;
		try {
			const res = await fetch(`${apiBase}/v1/requests/${encodeURIComponent(id)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', ...authHeaders() },
				body: JSON.stringify({ status })
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as { error?: string } | null;
				decideError = data?.error ?? `Request failed (${res.status})`;
				return;
			}
			const data = (await res.json()) as { request?: { id: string; status: CraftRequestStatus } };
			if (data.request) {
				requests = requests.map((r) =>
					r.id === data.request!.id ? { ...r, status: data.request!.status } : r
				);
			}
		} catch (err) {
			decideError = err instanceof Error ? err.message : 'Network error';
		} finally {
			const nextDeciding = { ...deciding };
			delete nextDeciding[id];
			deciding = nextDeciding;
		}
	}

	function referenceLabel(r: IncomingRequest): string | null {
		if (r.pieceLabel && r.outfitLabel) return `${r.pieceLabel} · from ${r.outfitLabel}`;
		if (r.pieceLabel) return r.pieceLabel;
		if (r.outfitLabel) return `From ${r.outfitLabel}`;
		return null;
	}
</script>

<svelte:head>
	<title>Maker dashboard — OoTD</title>
</svelte:head>

<main class="makers-page">
	<p class="eyebrow">Marketplace</p>
	<h1>Maker dashboard</h1>

	{#if !auth.ready}
		<p class="quiet-state">Loading...</p>
	{:else if !auth.session}
		<p class="quiet-state">
			<a href={`/login?next=${encodeURIComponent(next)}`}>Sign in to open your maker dashboard.</a>
		</p>
	{:else if auth.profile === null}
		<p class="quiet-state">
			<a href="/welcome">Finish setting up your profile first.</a>
		</p>
	{:else if auth.profile && !maker}
		<p class="quiet-state" data-testid="makers-guard">
			This dashboard is for maker accounts only. Maker roles are assigned by the OoTD team —
			this account is a regular user account.
		</p>
	{:else if auth.profile}
		<p class="posting-as">Signed in as @{auth.profile.username} · maker</p>

		{#if decideError}
			<p class="error-region" role="alert">{decideError}</p>
		{/if}

		{#if loading}
			<p class="quiet-state">Loading incoming requests...</p>
		{:else if loadError}
			<p class="error-region" role="alert">{loadError}</p>
			<button type="button" class="btn-secondary" onclick={() => void load()}>Try again</button>
		{:else if requests.length === 0}
			<p class="quiet-state" data-testid="makers-empty">
				No craft requests yet. New requests from the mannequin studio will appear here.
			</p>
		{:else}
			<ul class="request-list">
				{#each requests as r (r.id)}
					<li class="request-card" data-testid="maker-request">
						<div class="request-head">
							<strong class="requester">{r.displayName} <span class="handle">@{r.username}</span></strong>
							<span class="status-pill" data-status={r.status}>{craftStatusLabel(r.status)}</span>
						</div>
						<p class="request-meta">{r.category} · {formatBudgetIDR(r.budgetIdr)}</p>
						{#if referenceLabel(r)}
							<p class="request-ref">Inspired by: {referenceLabel(r)}</p>
						{/if}
						<p class="request-desc">{r.description}</p>
						{#if canDecide(r.status)}
							<div class="request-actions">
								<button
									type="button"
									class="btn-primary"
									disabled={deciding[r.id]}
									onclick={() => void decide(r.id, 'accepted')}
								>
									{deciding[r.id] ? 'Saving...' : 'Accept'}
								</button>
								<button
									type="button"
									class="btn-secondary"
									disabled={deciding[r.id]}
									onclick={() => void decide(r.id, 'declined')}
								>
									Decline
								</button>
							</div>
						{:else if canMarkDone(r.status)}
							<div class="request-actions">
								<button
									type="button"
									class="btn-primary"
									disabled={deciding[r.id]}
									onclick={() => void decide(r.id, 'done')}
								>
									{deciding[r.id] ? 'Saving...' : 'Mark done'}
								</button>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</main>

<style>
	.makers-page {
		max-width: 44rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--t-muted);
	}

	h1 {
		margin: 0;
		font-family: var(--t-font);
		font-size: 1.6rem;
		letter-spacing: -0.02em;
		color: var(--t-fg);
	}

	.quiet-state {
		margin: 0;
		color: var(--t-muted);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.quiet-state a {
		color: var(--t-fg);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.posting-as {
		margin: 0;
		color: var(--t-muted);
		font-size: 0.84rem;
		font-weight: 500;
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

	.request-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.request-card {
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
		padding: 1.1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.request-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.requester {
		font-size: 0.92rem;
		color: var(--t-fg);
	}

	.handle {
		font-weight: 500;
		color: var(--t-muted);
	}

	.status-pill {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--t-line);
		color: var(--t-muted);
		white-space: nowrap;
	}

	.status-pill[data-status='accepted'] {
		color: #1a9e54;
		border-color: #1a9e54;
	}

	.status-pill[data-status='declined'] {
		color: #b3261e;
		border-color: #b3261e;
	}

	.status-pill[data-status='done'] {
		color: var(--t-fg);
		border-color: var(--t-fg);
	}

	.request-meta {
		margin: 0;
		font-size: 0.82rem;
		color: var(--t-muted);
	}

	.request-ref {
		margin: 0;
		font-size: 0.82rem;
		color: var(--t-muted);
		font-style: italic;
	}

	.request-desc {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--t-fg);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.request-actions {
		display: flex;
		gap: 0.6rem;
		margin-top: 0.35rem;
	}

	.btn-primary {
		padding: 0.6rem 1.1rem;
		border: 1px solid var(--t-fg);
		border-radius: var(--t-radius);
		background: var(--t-fg);
		color: var(--t-bg);
		font-family: var(--t-font);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		padding: 0.6rem 1.1rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: transparent;
		color: var(--t-muted);
		font-family: var(--t-font);
		font-size: 0.85rem;
		cursor: pointer;
	}

	.btn-secondary:hover:not(:disabled) {
		color: var(--t-fg);
		border-color: var(--t-fg);
	}
</style>
