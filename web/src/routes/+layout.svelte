<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { themeStyle } from '$lib/themes';
	import { theme } from '$lib/theme.svelte';

	let { children } = $props();

	const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
	let current = $derived(theme.current);

	onMount(() => {
		theme.init(apiBase);
	});

	$effect(() => {
		document.documentElement.style.cssText = themeStyle(current);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>


<header class="site-header">
	<a class="wordmark" href="/" aria-label="OoTD home">OoTD<span>•</span></a>
	<nav aria-label="Primary navigation">
		<a class:active={page.url.pathname === '/'} href="/">Discover</a>
		<a href="/">Collections</a>
		<a href="/">Profile</a>
	</nav>
	<a class="create-button" href="/new">Create an OoTD</a>
</header>

{@render children()}

<aside class="theme-picker" aria-label="Choose a theme">
	{#each theme.themes as t}
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
	}

	:global(button),
	:global(a) {
		font: inherit;
	}

	:global(button) {
		cursor: pointer;
	}

	button,
	a {
		font: inherit;
	}

	button {
		cursor: pointer;
	}

	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		width: min(1180px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--t-line);
	}

	.wordmark {
		color: var(--t-fg);
		font-family: Georgia, serif;
		font-size: 1.35rem;
		font-weight: 400;
		letter-spacing: -0.05em;
		text-decoration: none;
	}

	.wordmark span {
		color: var(--t-accent);
	}

	nav {
		display: flex;
		gap: 1.5rem;
	}

	nav a {
		color: var(--t-muted);
		font-size: 0.85rem;
		font-weight: 350;
		text-decoration: none;
		transition: color 0.15s ease;
	}

	nav a.active,
	nav a:hover {
		color: var(--t-fg);
		font-weight: 500;
	}

	.create-button {
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-fg);
		color: var(--t-bg);
		font-weight: 450;
		padding: 0.45rem 0.9rem;
		font-size: 0.82rem;
		text-decoration: none;
		display: inline-block;
		transition: opacity 0.15s ease;
	}

	.create-button:hover {
		opacity: 0.9;
	}

	.theme-picker {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-surface);
		box-shadow: 0 6px 24px rgb(0 0 0 / 12%);
		z-index: 100;
	}

	.theme-picker button {
		width: 1.6rem;
		height: 1.6rem;
		border: 2px solid var(--sw-accent);
		border-radius: 50%;
		background: linear-gradient(135deg, var(--sw-bg) 50%, var(--sw-accent) 50%);
		padding: 0;
	}

	.theme-picker button.selected {
		outline: 2px solid var(--t-fg);
		outline-offset: 2px;
	}

	@media (max-width: 760px) {
		.site-header {
			width: min(100% - 1.5rem, 1180px);
			padding: 0.75rem 0;
		}

		nav {
			display: none;
		}

		.create-button {
			padding: 0.4rem 0.8rem;
			font-size: 0.8rem;
		}
	}
</style>
