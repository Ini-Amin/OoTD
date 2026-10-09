<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { apiBase, type Outfit } from '$lib/outfits';
	import OutfitCard from '$lib/OutfitCard.svelte';
	import { saved } from '$lib/saved.svelte';
	import { themeStyle, type Theme } from '$lib/themes';

	type UserProfile = {
		username: string;
		displayName: string;
		bio: string;
		theme: Theme | null;
	};

	let user = $state<UserProfile | null>(null);
	let outfits = $state<Outfit[]>([]);
	let loading = $state(true);
	let error = $state<'notFound' | 'network' | null>(null);
	let errorMessage = $state('');

	let handle = $derived(page.params.handle ?? '');

	async function loadUser(rawHandle: string) {
		if (!rawHandle) return;
		loading = true;
		error = null;
		errorMessage = '';
		const cleanHandle = rawHandle.replace(/^@/, '');
		try {
			const res = await fetch(`${apiBase}/v1/users/${encodeURIComponent(cleanHandle)}`);
			if (res.status === 404) {
				error = 'notFound';
				user = null;
				outfits = [];
				return;
			}
			if (!res.ok) {
				error = 'network';
				errorMessage = `Failed to load creator (${res.status})`;
				user = null;
				outfits = [];
				return;
			}
			const data = (await res.json()) as { user: UserProfile; outfits?: Outfit[] };
			user = data.user;
			outfits = Array.isArray(data.outfits) ? data.outfits : [];
		} catch {
			error = 'network';
			errorMessage = 'Network error: could not connect to server.';
			user = null;
			outfits = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		saved.init();
	});

	$effect(() => {
		const currentHandle = handle;
		if (currentHandle) {
			loadUser(currentHandle);
		}
	});
</script>

<svelte:head>
	<title>{user ? `${user.displayName} (@${user.username}) — OoTD` : error === 'notFound' ? 'Creator not found — OoTD' : 'OoTD'}</title>
</svelte:head>

<div
	class="profile-scope"
	style={user?.theme ? themeStyle(user.theme) : undefined}
>
	<main class="page-container">
		{#if loading}
			<div class="skeleton-header" aria-busy="true" aria-label="Loading creator profile">
				<div class="skeleton-avatar"></div>
				<div class="skeleton-details">
					<div class="skeleton-line skeleton-name"></div>
					<div class="skeleton-line skeleton-handle"></div>
					<div class="skeleton-line skeleton-bio"></div>
				</div>
			</div>
		{:else if error === 'notFound'}
			<div class="state-container">
				<p class="state-message">Creator not found.</p>
				<a href="/" class="home-link">Back to Discover</a>
			</div>
		{:else if error === 'network'}
			<div class="state-container">
				<p class="state-message">{errorMessage}</p>
				<button type="button" class="retry-button" onclick={() => loadUser(handle)}>Retry</button>
			</div>
		{:else if user}
			<header class="profile-header">
				<div
					class="avatar"
					style={`--profile-accent: ${user.theme?.accent ?? 'var(--t-accent)'};`}
					aria-hidden="true"
				>
					{user.displayName ? user.displayName.slice(0, 1) : user.username.slice(0, 1)}
				</div>
				<div class="profile-details">
					<h1 class="display-name">{user.displayName}</h1>
					<p class="handle">@{user.username}</p>
					{#if user.bio}
						<p class="bio">{user.bio}</p>
					{/if}
					<p class="outfit-count">{outfits.length} {outfits.length === 1 ? 'look' : 'looks'}</p>
				</div>
			</header>

			{#if outfits.length === 0}
				<div class="empty-state">
					<p>No looks yet.</p>
				</div>
			{:else}
				<div class="masonry">
					{#each outfits as outfit (outfit.id)}
						<div class="masonry-item">
							<OutfitCard {outfit} />
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.profile-scope {
		background: var(--t-bg);
		color: var(--t-fg);
		min-height: calc(100vh - 65px);
		width: 100%;
		transition: background 0.2s ease, color 0.2s ease;
	}

	.page-container {
		width: min(1180px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 3rem 0 5rem;
		display: flex;
		flex-direction: column;
		gap: 3rem;
	}

	.profile-header {
		display: flex;
		align-items: center;
		gap: 1.75rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--t-line);
	}

	.avatar {
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 50%;
		background: var(--profile-accent);
		color: var(--t-bg);
		font-size: 1.85rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%);
	}

	.profile-details {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.display-name {
		margin: 0;
		font-family: var(--t-font);
		font-size: clamp(1.6rem, 3vw, 2.25rem);
		font-weight: 400;
		letter-spacing: -0.04em;
		line-height: 1.15;
		color: var(--t-fg);
	}

	.handle {
		margin: 0;
		font-size: 0.95rem;
		color: var(--t-muted);
	}

	.bio {
		margin: 0.5rem 0 0.25rem;
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--t-fg);
		max-width: 40rem;
	}

	.outfit-count {
		margin: 0.25rem 0 0;
		font-size: 0.82rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--t-muted);
		font-weight: 500;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 1rem;
		color: var(--t-muted);
		font-size: 1.05rem;
	}

	.masonry {
		column-width: 16rem;
		column-gap: 1.25rem;
		width: 100%;
	}

	.masonry-item {
		break-inside: avoid;
		margin-bottom: 1.25rem;
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

	.skeleton-header {
		display: flex;
		align-items: center;
		gap: 1.75rem;
		opacity: 0.6;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--t-line);
	}

	.skeleton-avatar {
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 50%;
		background: var(--t-tint);
		flex-shrink: 0;
	}

	.skeleton-details {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		max-width: 25rem;
	}

	.skeleton-line {
		background: var(--t-tint);
		border-radius: 0.25rem;
	}

	.skeleton-name {
		height: 1.8rem;
		width: 60%;
	}

	.skeleton-handle {
		height: 1rem;
		width: 35%;
	}

	.skeleton-bio {
		height: 1.2rem;
		width: 90%;
	}

	:focus-visible {
		outline: 2px solid var(--t-fg);
		outline-offset: 2px;
	}
</style>
