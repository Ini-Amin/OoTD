<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';

	let mode = $state<'signin' | 'signup'>('signin');
	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	onMount(() => {
		auth.init();
	});

	$effect(() => {
		if (auth.ready && auth.session && auth.profile) {
			goto('/');
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = null;
		submitting = true;

		try {
			const res =
				mode === 'signin'
					? await auth.signIn(email, password)
					: await auth.signUp(email, password);

			if (res.error) {
				errorMessage = res.error;
				return;
			}

			await auth.refreshProfile();

			if (!auth.profile) {
				goto('/welcome');
			} else {
				const next = page.url.searchParams.get('next');
				const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
				goto(target);
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{mode === 'signin' ? 'Sign in' : 'Create account'} · OoTD</title>
</svelte:head>

<main class="login-page">
	<div class="login-card">
		<header class="card-header">
			<h1 class="card-title">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
			<p class="card-subtitle">
				{mode === 'signin'
					? 'Welcome back to OoTD. Sign in to your closet.'
					: 'Join OoTD to curate looks, save outfits, and craft requests.'}
			</p>
		</header>

		<div class="toggle-track" role="tablist" aria-label="Authentication mode">
			<button
				type="button"
				role="tab"
				class="toggle-btn"
				class:active={mode === 'signin'}
				aria-selected={mode === 'signin'}
				onclick={() => {
					mode = 'signin';
					errorMessage = null;
				}}
			>
				Sign in
			</button>
			<button
				type="button"
				role="tab"
				class="toggle-btn"
				class:active={mode === 'signup'}
				aria-selected={mode === 'signup'}
				onclick={() => {
					mode = 'signup';
					errorMessage = null;
				}}
			>
				Create account
			</button>
		</div>

		{#if errorMessage}
			<div class="error-banner" role="alert">
				{errorMessage}
			</div>
		{/if}

		<form class="auth-form" onsubmit={handleSubmit}>
			<div class="field">
				<label for="auth-email">Email</label>
				<input
					id="auth-email"
					type="email"
					autocomplete="email"
					required
					bind:value={email}
					disabled={submitting}
					placeholder="you@example.com"
				/>
			</div>

			<div class="field">
				<label for="auth-password">Password</label>
				<input
					id="auth-password"
					type="password"
					autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
					required
					minlength="8"
					aria-describedby="password-hint"
					bind:value={password}
					disabled={submitting}
					placeholder="••••••••"
				/>
				<span class="hint" id="password-hint">At least 8 characters</span>
			</div>

			<button type="submit" class="submit-button" disabled={submitting}>
				{submitting
					? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
					: (mode === 'signin' ? 'Sign in' : 'Create account')}
			</button>
		</form>
	</div>
</main>

<style>
	.login-page {
		min-height: calc(100vh - 6rem);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
	}

	.login-card {
		width: 100%;
		max-width: 420px;
		background: var(--t-surface);
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		padding: 2.5rem 2rem;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
	}

	.card-header {
		margin-bottom: 1.75rem;
		text-align: center;
	}

	.card-title {
		margin: 0 0 0.5rem;
		font-family: var(--t-font);
		font-size: 1.8rem;
		font-weight: 700;
		letter-spacing: -0.04em;
		color: var(--t-fg);
	}

	.card-subtitle {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.4;
		color: var(--t-muted);
	}

	.toggle-track {
		display: flex;
		background: var(--t-tint);
		border-radius: 999px;
		padding: 0.25rem;
		margin-bottom: 1.75rem;
	}

	.toggle-btn {
		flex: 1;
		background: transparent;
		border: none;
		border-radius: 999px;
		padding: 0.5rem 0.75rem;
		font-family: var(--t-font);
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--t-muted);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.toggle-btn.active {
		background: var(--t-surface);
		color: var(--t-fg);
		font-weight: 600;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	}

	.error-banner {
		margin-bottom: 1.25rem;
		padding: 0.75rem 1rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: var(--t-tint);
		color: var(--t-fg);
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--t-fg);
	}

	input[type='email'],
	input[type='password'] {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
		color: var(--t-fg);
		font-family: var(--t-font);
		font-size: 0.95rem;
		box-sizing: border-box;
		transition: border-color 0.15s ease;
	}

	input[type='email']:focus,
	input[type='password']:focus {
		outline: 2px solid var(--t-fg);
		outline-offset: 1px;
	}

	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.hint {
		font-size: 0.78rem;
		color: var(--t-muted);
	}

	.submit-button {
		margin-top: 0.5rem;
		width: 100%;
		border: none;
		border-radius: 999px;
		background: var(--t-fg);
		color: var(--t-bg);
		padding: 0.85rem 1.5rem;
		font-family: var(--t-font);
		font-size: 0.92rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.submit-button:hover:not(:disabled) {
		opacity: 0.9;
	}

	.submit-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
