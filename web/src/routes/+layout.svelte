<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { themeStyle } from '$lib/themes';
	import { theme } from '$lib/theme.svelte';
	import { saved } from '$lib/saved.svelte';
	import { closet } from '$lib/closet.svelte';
	import { apiBase } from '$lib/outfits';
	import StylistChat from '$lib/StylistChat.svelte';
	import { auth } from '$lib/auth.svelte';

	let { children } = $props();

	let current = $derived(theme.current);
	let pathname = $derived(page.url.pathname);
	let isDiscover = $derived(pathname === '/');
	let isMap = $derived(pathname.startsWith('/map'));
	let isMannequin = $derived(pathname.startsWith('/mannequin'));
	let isSaved = $derived(pathname.startsWith('/saved'));

	let q = $state('');
	let themesOpen = $state(false);
	let themeWrapEl = $state<HTMLDivElement>();

	onMount(() => {
		auth.init();
		theme.init(apiBase);
		saved.init();
		closet.init();
	});

	// Close the theme menu on any pointer press outside it, or on Escape.
	$effect(() => {
		if (!themesOpen) return;
		const onPointerDown = (e: PointerEvent) => {
			const t = e.target as Node | null;
			if (t && !themeWrapEl?.contains(t)) themesOpen = false;
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') themesOpen = false;
		};
		window.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('keydown', onKeyDown);
		};
	});

	$effect(() => {
		document.documentElement.style.cssText = themeStyle(current);
	});

	$effect(() => {
		if (page.url.pathname === '/') {
			q = page.url.searchParams.get('q') ?? '';
		}
	});

	function handleSearch(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = q.trim();
		if (trimmed) {
			goto('/?q=' + encodeURIComponent(trimmed));
		} else {
			goto('/');
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-layout">
	<header class="site-header">
		<div class="header-left">
			<a class="wordmark" href="/" aria-label="OoTD home">OoTD</a>
		</div>

		<form class="search-form" role="search" onsubmit={handleSearch}>
			<input
				type="search"
				class="search-input"
				placeholder="What do you want to search?"
				aria-label="Search outfits"
				bind:value={q}
			/>
			<button type="submit" class="search-submit" aria-label="Search" title="Search">
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
					<path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
				</svg>
			</button>
		</form>

		<div class="header-right">
			{#if auth.ready}
				{#if auth.session && auth.profile}
					<a
						class="avatar-btn"
						href={`/u/${auth.profile.username}`}
						title={`@${auth.profile.username}`}
						aria-label={`Profile @${auth.profile.username}`}
					>
						{(auth.profile.displayName?.trim() || auth.profile.username).charAt(0).toUpperCase()}
					</a>
					<button type="button" class="sign-out-btn" onclick={() => auth.signOut()}>
						Sign out
					</button>
					<a class="create-link" href="/new">+ Create</a>
				{:else if auth.session && !auth.profile}
					<a class="finish-setup-link" href="/welcome">Finish setup</a>
				{:else}
					<a class="sign-in-link" href="/login">Sign in</a>
					<a class="create-link" href="/new">+ Create</a>
				{/if}
			{:else}
				<a class="create-link" href="/new">+ Create</a>
			{/if}
		</div>
	</header>

	<nav class="right-rail" aria-label="Primary navigation">
		<a
			href="/"
			class="rail-item"
			class:active={isDiscover}
			aria-current={isDiscover ? 'page' : undefined}
			aria-label="Discover"
			title="Discover"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="12" cy="12" r="10" />
				<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" />
			</svg>
		</a>
		<a
			href="/map"
			class="rail-item"
			class:active={isMap}
			aria-current={isMap ? 'page' : undefined}
			aria-label="Mall map"
			title="Mall map"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" />
				<line x1="9" y1="3" x2="9" y2="18" />
				<line x1="15" y1="6" x2="15" y2="21" />
			</svg>
		</a>
		<a
			href="/mannequin"
			class="rail-item"
			class:active={isMannequin}
			aria-current={isMannequin ? 'page' : undefined}
			aria-label="Mannequin"
			title="Mannequin"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M9 3h6l2 4-2 7 2 4H7l2-4-2-7 2-4z" />
				<path d="M12 18v4" />
				<path d="M8 22h8" />
			</svg>
		</a>
		<a
			href="/saved"
			class="rail-item"
			class:active={isSaved}
			aria-current={isSaved ? 'page' : undefined}
			aria-label="Saved"
			title="Saved"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		</a>
	</nav>

	<div class="content-wrapper">
		{@render children()}
	</div>

	<div class="theme-picker-wrap" bind:this={themeWrapEl}>
		<button
			type="button"
			class="theme-toggle"
			aria-expanded={themesOpen}
			aria-label={`Theme: ${current.name}. Change theme`}
			onclick={() => (themesOpen = !themesOpen)}
			style={`--sw-bg:${current.bg};--sw-accent:${current.accent}`}
		>
			<span class="theme-dot" aria-hidden="true"></span>
			<span class="theme-name">{current.name}</span>
		</button>
		{#if themesOpen}
			<div class="theme-menu" role="group" aria-label="Choose a theme">
				{#each theme.themes as t}
					<button
						type="button"
						class:selected={t.slug === current.slug}
						aria-pressed={t.slug === current.slug}
						aria-label={`${t.name} theme`}
						title={t.name}
						style={`--sw-bg:${t.bg};--sw-accent:${t.accent}`}
						onclick={() => {
							theme.pick(t.slug);
							themesOpen = false;
						}}
					>
						<span class="theme-menu-dot" aria-hidden="true"></span>
						<span class="theme-menu-name">{t.name}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
	<StylistChat />
</div>

<style>
	:global(:root) {
		/* SSR/first-paint fallback = the "minimal" preset */
		--t-bg: #fafafa;
		--t-surface: #ffffff;
		--t-fg: #1c1c1c;
		--t-accent: #1c1c1c;
		--t-font: Inter, ui-sans-serif, system-ui, sans-serif;
		--t-radius: 1.25rem;
		--t-muted: color-mix(in srgb, #1c1c1c 68%, #fafafa);
		--t-tint: color-mix(in srgb, #1c1c1c 8%, #fafafa);
		--t-line: color-mix(in srgb, #1c1c1c 16%, #fafafa);
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		min-width: 320px;
		background: var(--t-bg);
		color: var(--t-fg);
		font-family: var(--t-font);
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	:global(button),
	:global(a) {
		font: inherit;
	}

	:global(button) {
		cursor: pointer;
	}

	.app-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		width: 100%;
		max-width: 1440px;
		margin: 0 auto;
		padding: 1rem 1.5rem;
	}

	.header-left {
		flex: 0 0 auto;
	}

	.header-right {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.sign-in-link {
		color: var(--t-muted);
		font-size: 0.85rem;
		font-weight: 450;
		text-decoration: none;
		padding: 0.4rem 0.65rem;
		border-radius: 999px;
		transition: color 0.15s ease;
	}

	.sign-in-link:hover {
		color: var(--t-fg);
	}

	.finish-setup-link {
		color: var(--t-bg);
		background: var(--t-accent);
		font-size: 0.85rem;
		font-weight: 500;
		text-decoration: none;
		padding: 0.4rem 0.85rem;
		border-radius: 999px;
		transition: opacity 0.15s ease;
	}

	.finish-setup-link:hover {
		opacity: 0.85;
	}

	.avatar-btn {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--t-tint);
		border: 1px solid var(--t-line);
		color: var(--t-fg);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;
		text-transform: uppercase;
		transition: border-color 0.15s ease;
	}

	.avatar-btn:hover {
		border-color: var(--t-fg);
	}

	.sign-out-btn {
		background: transparent;
		border: none;
		color: var(--t-muted);
		font-family: inherit;
		font-size: 0.82rem;
		cursor: pointer;
		padding: 0.25rem 0.4rem;
		transition: color 0.15s ease;
	}

	.sign-out-btn:hover {
		color: var(--t-fg);
	}

	.wordmark {
		color: var(--t-fg);
		font-family: Georgia, serif;
		font-size: 1.4rem;
		font-weight: 400;
		letter-spacing: -0.05em;
		text-decoration: none;
	}

	.search-form {
		flex: 1 1 540px;
		max-width: 540px;
		display: flex;
		align-items: center;
		position: relative;
		background: var(--t-surface);
		border: 1px solid var(--t-line);
		border-radius: 999px;
		padding: 0.28rem 0.35rem 0.28rem 1.1rem;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.search-form:focus-within {
		border-color: var(--t-accent);
	}

	.search-input {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		color: var(--t-fg);
		font: inherit;
		font-size: 0.9rem;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--t-muted);
		opacity: 0.8;
	}

	.search-submit {
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: none;
		background: var(--t-accent);
		color: var(--t-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition: opacity 0.15s ease;
	}

	.search-submit:hover {
		opacity: 0.85;
	}

	.create-link {
		color: var(--t-muted);
		font-size: 0.85rem;
		font-weight: 450;
		text-decoration: none;
		padding: 0.4rem 0.85rem;
		border-radius: 999px;
		border: 1px solid var(--t-line);
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.create-link:hover {
		color: var(--t-fg);
		border-color: var(--t-fg);
	}

	.right-rail {
		position: fixed;
		right: 1.25rem;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		z-index: 50;
	}

	.rail-item {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--t-surface);
		color: var(--t-muted);
		border: 1px solid var(--t-line);
		text-decoration: none;
		transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
	}

	.rail-item:hover {
		color: var(--t-fg);
		border-color: var(--t-muted);
	}

	.rail-item.active {
		background: var(--t-fg);
		color: var(--t-bg);
		border-color: var(--t-fg);
	}

	.content-wrapper {
		flex: 1;
		width: 100%;
		padding-right: 5rem;
	}

	.theme-picker-wrap {
		position: fixed;
		left: 1rem;
		bottom: 1rem;
		z-index: 60;
	}

	.theme-toggle {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-surface);
		color: var(--t-fg);
		font-family: var(--t-font);
		font-size: 0.78rem;
		cursor: pointer;
		box-shadow: 0 4px 16px color-mix(in srgb, var(--t-fg) 8%, transparent);
	}

	.theme-dot {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		border: 1px solid var(--sw-accent);
		background: linear-gradient(135deg, var(--sw-bg) 50%, var(--sw-accent) 50%);
	}

	.theme-menu {
		position: absolute;
		left: 0;
		bottom: calc(100% + 0.5rem);
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 11rem;
		padding: 0.3rem;
		border: 1px solid var(--t-line);
		border-radius: 0.7rem;
		background: var(--t-surface);
		box-shadow: 0 8px 28px color-mix(in srgb, var(--t-fg) 14%, transparent);
	}

	.theme-menu button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.35rem 0.5rem;
		border: 0;
		border-radius: 0.45rem;
		background: none;
		color: var(--t-fg);
		font-family: var(--t-font);
		font-size: 0.78rem;
		text-align: left;
		cursor: pointer;
	}

	.theme-menu button:hover {
		background: var(--t-tint);
	}

	.theme-menu button.selected {
		font-weight: 600;
	}

	.theme-menu-dot {
		width: 0.85rem;
		height: 0.85rem;
		flex: none;
		border-radius: 50%;
		border: 1px solid var(--sw-accent);
		background: linear-gradient(135deg, var(--sw-bg) 50%, var(--sw-accent) 50%);
	}

	.rail-item:focus-visible,
	.create-link:focus-visible,
	.sign-in-link:focus-visible,
	.finish-setup-link:focus-visible,
	.avatar-btn:focus-visible,
	.sign-out-btn:focus-visible,
	.search-submit:focus-visible,
	.wordmark:focus-visible,
	.theme-toggle:focus-visible,
	.theme-menu button:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	@media (max-width: 639px) {
		.site-header {
			flex-wrap: wrap;
			gap: 0.75rem 1rem;
			padding: 0.75rem 1rem;
		}

		.header-left {
			order: 1;
		}

		.header-right {
			order: 2;
		}

		.search-form {
			order: 3;
			width: 100%;
			max-width: 100%;
			flex-basis: 100%;
		}

		.content-wrapper {
			padding-right: 0;
			padding-bottom: 5rem;
		}

		.right-rail {
			right: 0;
			left: 0;
			bottom: 0;
			top: auto;
			transform: none;
			flex-direction: row;
			justify-content: center;
			gap: 2rem;
			padding: 0.6rem 1rem calc(0.6rem + env(safe-area-inset-bottom, 0px));
			background: color-mix(in srgb, var(--t-surface) 92%, transparent);
			backdrop-filter: blur(12px);
			-webkit-backdrop-filter: blur(12px);
			border-top: 1px solid var(--t-line);
		}

		.theme-picker-wrap {
			left: 0.75rem;
			bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px));
		}

		.theme-toggle {
			padding: 0.35rem 0.55rem;
			font-size: 0.72rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(body),
		.search-form,
		.search-submit,
		.create-link,
		.sign-in-link,
		.finish-setup-link,
		.avatar-btn,
		.sign-out-btn,
		.rail-item {
			transition: none !important;
		}
	}
</style>
