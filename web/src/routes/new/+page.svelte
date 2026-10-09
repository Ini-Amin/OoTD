<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	type User = {
		username: string;
		displayName: string;
	};

	const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
	const accentColors = [
		'#e8b86d',
		'#8da8c7',
		'#a8a56d',
		'#e58aa5',
		'#7b4dff',
		'#ff4d00'
	];

	let users = $state<User[]>([]);
	let usersError = $state<string | null>(null);

	let username = $state('');
	let title = $state('');
	let caption = $state('');
	let tagsInput = $state('');
	let accent = $state(accentColors[0]);

	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

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
		if (submitting || usersError || users.length === 0) return;

		submitting = true;
		errorMessage = null;

		const tags = tagsInput
			.split(',')
			.map((t) => t.trim())
			.filter((t) => t.length > 0);

		// ponytail: username is trusted until auth phase replaces this with session auth
		const payload = {
			username,
			title: title.trim(),
			caption: caption.trim(),
			tags,
			accent: accent.toLowerCase()
		};

		try {
			const res = await fetch(`${apiBase}/v1/outfits`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (res.status === 201) {
				await goto('/');
				return;
			}

			if (res.status === 400 || res.status === 404) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				errorMessage = data.error ?? 'Validation failed.';
			} else {
				errorMessage = `Server error (${res.status}).`;
			}
		} catch {
			errorMessage = 'Network error: could not submit outfit.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Create an OoTD — OoTD</title>
	<meta name="description" content="Share your outfit with the OoTD community." />
</svelte:head>

<main>
	<section class="form-container">
		<p class="eyebrow">Share your style</p>
		<h1>Create an OoTD</h1>

		{#if usersError}
			<p class="error-region" role="alert">{usersError}</p>
		{/if}

		{#if errorMessage}
			<p class="error-region" role="alert">{errorMessage}</p>
		{/if}

		<form onsubmit={handleSubmit}>
			<div class="field">
				<label for="creator">Posting as</label>
				<select
					id="creator"
					name="username"
					bind:value={username}
					disabled={submitting || users.length === 0}
				>
					{#each users as u}
						<option value={u.username}>{u.displayName} (@{u.username})</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label for="title">Title</label>
				<input
					id="title"
					type="text"
					name="title"
					bind:value={title}
					required
					maxlength={120}
					placeholder="Give your look a name"
					disabled={submitting}
				/>
			</div>

			<div class="field">
				<label for="caption">Caption</label>
				<textarea
					id="caption"
					name="caption"
					bind:value={caption}
					maxlength={2000}
					rows="4"
					placeholder="Describe the pieces, styling choices, or mood"
					disabled={submitting}
				></textarea>
			</div>

			<div class="field">
				<label for="tags">
					Tags <span class="hint">(up to 5)</span>
				</label>
				<input
					id="tags"
					type="text"
					name="tags"
					bind:value={tagsInput}
					placeholder="streetwear, monochrome, thrift"
					disabled={submitting}
				/>
			</div>

			<fieldset class="field accent-field">
				<legend>Accent color</legend>
				<div class="swatch-row" role="radiogroup" aria-label="Accent color">
					{#each accentColors as color}
						<label class="swatch-label">
							<input
								type="radio"
								name="accent"
								value={color}
								bind:group={accent}
								disabled={submitting}
							/>
							<span
								class="swatch"
								style={`--swatch-color:${color}`}
								title={color}
							></span>
							<span class="sr-only">{color}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<div class="form-actions">
				<button
					type="submit"
					class="primary-button"
					disabled={submitting || usersError !== null || users.length === 0}
				>
					{submitting ? 'Publishing...' : 'Publish OoTD'}
				</button>
			</div>
		</form>
	</section>
</main>

<style>
	main {
		width: min(1180px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 3.5rem 0 5rem;
	}

	.form-container {
		max-width: 580px;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--t-accent);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1 {
		margin-top: 0;
		margin-bottom: 2rem;
		font-family: var(--t-font);
		font-size: clamp(2.4rem, 5vw, 3.8rem);
		letter-spacing: -0.06em;
		line-height: 0.96;
	}

	.error-region {
		margin: 0 0 1.5rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-tint);
		color: var(--t-fg);
		font-size: 0.88rem;
		line-height: 1.4;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		border: 0;
		padding: 0;
		margin: 0;
	}

	label,
	legend {
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--t-fg);
	}

	.hint {
		font-weight: 400;
		color: var(--t-muted);
		font-size: 0.8rem;
	}

	input[type='text'],
	select,
	textarea {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
		color: var(--t-fg);
		font-family: var(--t-font);
		font-size: 0.95rem;
	}

	input[type='text']:focus,
	select:focus,
	textarea:focus {
		outline: 2px solid var(--t-fg);
		outline-offset: 1px;
	}

	input[type='text']:disabled,
	select:disabled,
	textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	textarea {
		resize: vertical;
		min-height: 110px;
	}

	.swatch-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.swatch-label {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.swatch-label input[type='radio'] {
		position: absolute;
		opacity: 0;
		width: 2rem;
		height: 2rem;
		margin: 0;
		cursor: pointer;
	}

	.swatch {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background-color: var(--swatch-color);
		border: 2px solid transparent;
		display: block;
	}

	.swatch-label input[type='radio']:checked + .swatch {
		border-color: var(--t-surface);
		outline: 2px solid var(--t-fg);
		outline-offset: 2px;
	}

	.swatch-label input[type='radio']:focus-visible + .swatch {
		outline: 2px solid var(--t-fg);
		outline-offset: 3px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	.form-actions {
		margin-top: 0.5rem;
	}

	.primary-button {
		border: 0;
		border-radius: 999px;
		background: var(--t-fg);
		color: var(--t-bg);
		font-weight: 700;
		padding: 0.85rem 1.6rem;
		font-size: 0.92rem;
	}

	.primary-button:focus-visible {
		outline: 2px solid var(--t-fg);
		outline-offset: 3px;
	}

	.primary-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 760px) {
		main {
			width: min(100% - 1.5rem, 1180px);
			padding: 2.5rem 0 4rem;
		}

		.primary-button {
			width: 100%;
		}
	}
</style>
