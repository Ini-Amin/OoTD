<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { themeStyle } from '$lib/themes';
	import { theme } from '$lib/theme.svelte';
	import { saved } from '$lib/saved.svelte';
	import { closet } from '$lib/closet.svelte';
	import { apiBase } from '$lib/outfits';

	let { children } = $props();

	let current = $derived(theme.current);
	let pathname = $derived(page.url.pathname);
	let isDiscover = $derived(pathname === '/');
	let isMannequin = $derived(pathname.startsWith('/mannequin'));
	let isSaved = $derived(pathname.startsWith('/saved'));

	let q = $state('');

	onMount(() => {
		theme.init(apiBase);
		saved.init();
		closet.init();
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
			goto(resolve('/') + '?q=' + encodeURIComponent(trimmed));
		} else {
			goto(resolve('/'));
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-layout">
	<header class="site-header">
		<div class="header-left">
			<a class="wordmark" href={resolve('/')} aria-label="OoTD home">OoTD</a>
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
			<a class="create-link" href={resolve('/new')}>+ Create</a>
		</div>
	</header>

	<nav class="right-rail" aria-label="Primary navigation">
		<a href={resolve('/world')} class="rail-item" class:active={pathname.startsWith('/world')} aria-current={pathname.startsWith('/world') ? 'page' : undefined} aria-label="World" title="World">
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></svg>
		</a>
		<a
			href={resolve('/')}
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
			href={resolve('/mannequin')}
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
			href={resolve('/saved')}
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

	<aside class="theme-picker" aria-label="Choose a theme">
		{#each theme.themes as t (t.slug)}
			<button
				type="button"
				class:selected={t.slug === current.slug}
				aria-pressed={t.slug === current.slug}
				aria-label={`${t.name} theme`}
				title={t.name}
				style={`--sw-bg:${t.bg};--sw-accent:${t.accent}`}
				onclick={() => theme.pick(t.slug)}
			></button>
		{/each}
	</aside>
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

	.theme-picker {
		position: fixed;
		left: 1rem;
		bottom: 1rem;
		display: flex;
		gap: 0.5rem;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-surface);
		box-shadow: 0 4px 16px color-mix(in srgb, var(--t-fg) 8%, transparent);
		z-index: 60;
	}

	.theme-picker button {
		width: 1.35rem;
		height: 1.35rem;
		border: 2px solid var(--sw-accent);
		border-radius: 50%;
		background: linear-gradient(135deg, var(--sw-bg) 50%, var(--sw-accent) 50%);
		padding: 0;
	}

	.theme-picker button.selected {
		outline: 2px solid var(--t-fg);
		outline-offset: 2px;
	}

	.rail-item:focus-visible,
	.create-link:focus-visible,
	.search-submit:focus-visible,
	.wordmark:focus-visible,
	.theme-picker button:focus-visible {
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

		.theme-picker {
			left: 0.75rem;
			bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px));
			padding: 0.35rem 0.5rem;
			gap: 0.35rem;
		}

		.theme-picker button {
			width: 1.15rem;
			height: 1.15rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(body),
		.search-form,
		.search-submit,
		.create-link,
		.rail-item {
			transition: none !important;
		}
	}
</style>
