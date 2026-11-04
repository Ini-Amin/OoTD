<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';

	let username = $state('');
	let displayName = $state('');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	onMount(() => {
		auth.init();
	});

	$effect(() => {
		if (auth.ready) {
			if (!auth.session) {
				goto('/login');
			} else if (auth.profile) {
				goto('/');
			}
		}
	});

	let trimmedUsername = $derived(username.trim().toLowerCase());
	let trimmedDisplayName = $derived(displayName.trim());
	let isUsernameFormatValid = $derived(/^[a-z0-9_]{3,30}$/.test(trimmedUsername));
	let isDisplayNameValid = $derived(trimmedDisplayName.length >= 1 && trimmedDisplayName.length <= 60);
	let canSubmit = $derived(isUsernameFormatValid && isDisplayNameValid && !submitting);

	let usernameHint = $derived.by(() => {
		if (!username) {
			return '3–30 characters, lowercase letters, numbers, and underscores only';
		}
		if (trimmedUsername.length < 3) {
			return `Too short (${trimmedUsername.length}/3 min)`;
		}
		if (trimmedUsername.length > 30) {
			return `Too long (${trimmedUsername.length}/30 max)`;
		}
		if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
			return 'Only lowercase letters, numbers, and underscores allowed';
		}
		return 'Username looks great';
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!canSubmit) return;

		errorMessage = null;
		submitting = true;

		try {
			const res = await auth.createProfile(trimmedUsername, trimmedDisplayName);
			if (res.error) {
				errorMessage = res.error;
				return;
			}
			goto('/');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Create your profile · OoTD</title>
</svelte:head>

<main class="welcome-page">
	<div class="welcome-card">
		<header class="card-header">
			<h1 class="card-title">Create your profile</h1>
			<p class="card-subtitle">
				Choose a handle and display name for your OoTD closet.
			</p>
		</header>

		{#if errorMessage}
			<div class="error-banner" role="alert">
				{errorMessage}
			</div>
		{/if}

		<form class="welcome-form" onsubmit={handleSubmit}>
			<div class="field">
				<div class="field-label-row">
					<label for="username">Username</label>
					<span class="handle-preview">@{trimmedUsername || 'name'}</span>
				</div>
				<input
					id="username"
					type="text"
					autocomplete="username"
					required
					minlength="3"
					maxlength="30"
					aria-describedby="username-hint"
					bind:value={username}
					oninput={(e) => {
						username = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
					}}
					disabled={submitting}
					placeholder="your_handle"
				/>
				<span
					class="hint"
					id="username-hint"
					class:hint-error={username.length > 0 && !isUsernameFormatValid}
				>
					{usernameHint}
				</span>
			</div>

			<div class="field">
				<div class="field-label-row">
					<label for="displayName">Display name</label>
					<span class="char-count">{trimmedDisplayName.length}/60</span>
				</div>
				<input
					id="displayName"
					type="text"
					autocomplete="name"
					required
					maxlength="60"
					bind:value={displayName}
					disabled={submitting}
					placeholder="Your Name"
				/>
			</div>

			<button type="submit" class="submit-button" disabled={!canSubmit}>
				{submitting ? 'Setting up…' : 'Complete profile'}
			</button>
		</form>
	</div>
</main>

<style>
	.welcome-page {
		min-height: calc(100vh - 6rem);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
	}

	.welcome-card {
		width: 100%;
		max-width: 440px;
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

	.welcome-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--t-fg);
	}

	.handle-preview {
		font-family: var(--t-font);
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--t-accent);
	}

	.char-count {
		font-size: 0.78rem;
		color: var(--t-muted);
	}

	input[type='text'] {
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

	input[type='text']:focus {
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

	.hint-error {
		color: #e5484d;
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
