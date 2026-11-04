<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { apiBase } from '$lib/outfits';
	import { auth, authHeaders } from '$lib/auth.svelte';

	const accentColors = [
		'#e8b86d',
		'#8da8c7',
		'#a8a56d',
		'#e58aa5',
		'#7b4dff',
		'#ff4d00'
	];
	let title = $state('');
	let caption = $state('');
	let tagsInput = $state('');
	let accent = $state(accentColors[0]);
	let imageUrl = $state('');
	let debouncedPreviewUrl = $state('');
	let imageLoadError = $state(false);
	// Local file picker state
	let file = $state<File | null>(null);
	let filePreviewUrl = $state('');
	let fileError = $state<string | null>(null);
	let dragOver = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let uploading = $state(false);
	let uploadedUrl = $state('');
	// Local file preview wins; falls back to the URL preview.
	let effectivePreviewUrl = $derived(filePreviewUrl || debouncedPreviewUrl);

	// Magic Tag (Meta AI) state
	let aiAvailable = $state(false);
	let magicLoading = $state(false);
	let magicError = $state<string | null>(null);
	let magicPieces = $state<
		Array<{ category: string; label: string; box: { x: number; y: number; w: number; h: number } }>
	>([]);
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	$effect(() => {
		const raw = imageUrl.trim();
		imageLoadError = false;

		let valid = false;
		try {
			const u = new URL(raw);
			valid = u.protocol === 'https:' && u.hostname.includes('.');
		} catch {
			valid = false;
		}

		if (!valid) {
			debouncedPreviewUrl = '';
			return;
		}

		const timer = setTimeout(() => {
			debouncedPreviewUrl = raw;
		}, 500);

		return () => {
			clearTimeout(timer);
		};
	});

	function handleFiles(files: FileList | null) {
		const f = files?.[0];
		if (!f) return;
		if (!f.type.startsWith('image/')) {
			fileError = 'Please choose an image file.';
			return;
		}
		fileError = null;
		if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
		file = f;
		filePreviewUrl = URL.createObjectURL(f);
		uploadFile(f);
	}

	async function uploadFile(f: File) {
		uploading = true;
		try {
			const form = new FormData();
			form.append('file', f);
			const res = await fetch(`${apiBase}/v1/uploads`, {
				method: 'POST',
				headers: { ...authHeaders() },
				body: form
			});
			if (file !== f) return; // user picked another file meanwhile
			if (res.status === 503) {
				fileError = 'Uploads are not configured on the server.';
				return;
			}
			if (res.status === 401) {
				fileError = 'Your session expired. Sign in again.';
				return;
			}
			if (res.status === 429) {
				fileError = 'Too many uploads. Try again in a bit.';
				return;
			}
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as { error?: string } | null;
				fileError = data?.error ?? `Upload failed (${res.status}).`;
				return;
			}
			const data = (await res.json()) as { imageUrl?: string };
			if (data.imageUrl) {
				uploadedUrl = data.imageUrl;
				imageUrl = data.imageUrl;
			}
		} catch {
			if (file === f) fileError = 'Upload failed. Check your connection and try again.';
		} finally {
			if (file === f) uploading = false;
		}
	}

	function clearFile() {
		if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
		file = null;
		filePreviewUrl = '';
		uploading = false;
		if (imageUrl === uploadedUrl) imageUrl = '';
		uploadedUrl = '';
		if (fileInput) fileInput.value = '';
	}

	onDestroy(() => {
		if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
	});

	onMount(async () => {
		auth.init();

		// Probe: 400 on empty body means AI is configured; anything else
		// (503, 401, network error) hides the Magic Tag UI. The probe never
		// reaches the model (validation fails first) and never counts
		// against the rate limit.
		try {
			const probe = await fetch(`${apiBase}/v1/analyze`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...authHeaders() },
				body: JSON.stringify({ image_url: '' })
			});
			aiAvailable = probe.status === 400;
		} catch {
			aiAvailable = false;
		}
	});

	async function runMagicTag() {
		const raw = imageUrl.trim();
		if (!raw || magicLoading) return;
		magicLoading = true;
		magicError = null;
		try {
			const res = await fetch(`${apiBase}/v1/analyze`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...authHeaders() },
				body: JSON.stringify({ image_url: raw })
			});
			if (res.status === 503) {
				aiAvailable = false;
				magicError = 'AI is not configured on the server.';
				return;
			}
			if (res.status === 401) {
				magicError = 'Your session expired. Sign in again.';
				return;
			}
			if (res.status === 429) {
				magicError = 'Too many requests. Try again in a bit.';
				return;
			}
			if (res.status === 422) {
				magicError = 'That photo does not look like an outfit.';
				return;
			}
			if (!res.ok) throw new Error(`analyze failed (${res.status})`);
			const data = (await res.json()) as {
				title?: string;
				caption?: string;
				style_tags?: string[];
				occasion_tags?: string[];
				pieces?: Array<{
					category: string;
					label: string;
					box?: { x: number; y: number; w: number; h: number };
				}>;
			};
			if (data.title) title = data.title;
			if (data.caption) caption = data.caption;
			const tags = [...(data.style_tags ?? []), ...(data.occasion_tags ?? [])];
			if (tags.length > 0) tagsInput = tags.join(', ');
			magicPieces = (data.pieces ?? []).map((p) => ({
				category: p.category,
				label: p.label,
				box: p.box ?? { x: 0, y: 0, w: 0, h: 0 }
			}));
		} catch {
			magicError = 'Magic Tag failed. Check the photo URL and try again.';
		} finally {
			magicLoading = false;
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting || uploading || !auth.session || !auth.profile) return;

		submitting = true;
		errorMessage = null;

		const tags = tagsInput
			.split(',')
			.map((t) => t.trim())
			.filter((t) => t.length > 0);

		const payload: {
			title: string;
			caption: string;
			tags: string[];
			accent: string;
			imageUrl?: string;
			pieces: typeof magicPieces;
		} = {
			title: title.trim(),
			caption: caption.trim(),
			tags,
			accent: accent.toLowerCase(),
			pieces: magicPieces
		};

		const trimmedImage = imageUrl.trim();
		if (trimmedImage.length > 0) {
			payload.imageUrl = trimmedImage;
		}

		try {
			const res = await fetch(`${apiBase}/v1/outfits`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders() },
				body: JSON.stringify(payload)
			});

			if (res.status === 201) {
				await goto('/');
				return;
			}

			if (res.status === 401) {
				errorMessage = 'Your session expired. Sign in again.';
			} else if (res.status === 400 || res.status === 404) {
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

		{#if errorMessage}
			<p class="error-region" role="alert">{errorMessage}</p>
		{/if}

		{#if !auth.ready}
			<p class="quiet-state">Loading...</p>
		{:else if !auth.session}
			<p class="quiet-state">
				<a href={`/login?next=${encodeURIComponent(page.url.pathname)}`}>Sign in to post.</a>
			</p>
		{:else if auth.profile === null}
			<p class="quiet-state">
				<a href="/welcome">Finish setting up your profile first.</a>
			</p>
		{:else if auth.profile}
			<form onsubmit={handleSubmit}>
				<p class="posting-as">Posting as @{auth.profile.username}</p>

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
					<span class="field-label" id="photo-label">
						Photo <span class="hint">(optional)</span>
					</span>
					<div
						class="dropzone"
						class:dragging={dragOver}
						role="button"
						tabindex="0"
						aria-labelledby="photo-label"
						onclick={() => fileInput?.click()}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								fileInput?.click();
							}
						}}
						ondragover={(e) => {
							e.preventDefault();
							dragOver = true;
						}}
						ondragleave={() => {
							dragOver = false;
						}}
						ondrop={(e) => {
							e.preventDefault();
							dragOver = false;
							handleFiles(e.dataTransfer?.files ?? null);
						}}
					>
						<input
							type="file"
							accept="image/*"
							hidden
							tabindex={-1}
							aria-hidden="true"
							bind:this={fileInput}
							onchange={(e) => handleFiles(e.currentTarget.files)}
						/>
						{#if effectivePreviewUrl}
							{#if !filePreviewUrl && imageLoadError}
								<span class="hint image-error-hint">Could not load that image.</span>
							{:else}
								<img
									src={effectivePreviewUrl}
									alt="Outfit preview"
									class="preview-image"
									onerror={() => {
										if (!filePreviewUrl) imageLoadError = true;
									}}
								/>
							{/if}
						{:else}
							<p class="dropzone-prompt">
								<span class="dropzone-icon" aria-hidden="true">📷</span>
								Drag &amp; drop a photo here, or <span class="linklike">browse files</span>
							</p>
						{/if}
					</div>
					{#if fileError}
						<span class="hint image-error-hint">{fileError}</span>
					{/if}
					{#if file}
						<div class="file-row">
							<span class="hint file-name">{uploading ? 'Uploading…' : file.name}</span>
							<button type="button" class="text-button" onclick={clearFile}>Remove</button>
						</div>
					{/if}
					<details class="url-fallback">
						<summary>or paste an image URL</summary>
						<input
							id="image-url"
							type="url"
							name="imageUrl"
							bind:value={imageUrl}
							oninput={() => {
								imageLoadError = false;
							}}
							placeholder="https://..."
							maxlength={500}
							disabled={submitting}
						/>
					</details>
					{#if aiAvailable}
						<button
							type="button"
							class="magic-button"
							onclick={runMagicTag}
							disabled={magicLoading || !debouncedPreviewUrl || imageLoadError}
							title="Let Meta AI tag this outfit for you"
						>
							{magicLoading ? '✨ Analyzing…' : '✨ Magic Tag with AI'}
						</button>
						{#if !debouncedPreviewUrl && filePreviewUrl}
							<span class="hint">Paste an image URL to use Magic Tag.</span>
						{/if}
						{#if magicError}
							<span class="hint image-error-hint">{magicError}</span>
						{/if}
						{#if magicPieces.length > 0}
							<ul class="magic-pieces">
								{#each magicPieces as piece}
									<li><strong>{piece.category}</strong> — {piece.label}</li>
								{/each}
							</ul>
						{/if}
					{/if}
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
						disabled={submitting || uploading}
					>
						{submitting ? 'Publishing...' : 'Publish OoTD'}
					</button>
				</div>
			</form>
		{/if}
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
	.quiet-state {
		margin: 0 0 1.5rem;
		color: var(--t-muted);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.quiet-state a {
		color: var(--t-fg);
		text-decoration: underline;
		text-underline-offset: 3px;
		transition: color 0.15s ease;
	}

	.quiet-state a:hover {
		color: var(--t-accent);
	}

	.posting-as {
		margin: 0;
		color: var(--t-muted);
		font-size: 0.88rem;
		font-weight: 500;
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
	input[type='url'],
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
	input[type='url']:focus,
	textarea:focus {
		outline: 2px solid var(--t-fg);
		outline-offset: 1px;
	}

	input[type='text']:disabled,
	input[type='url']:disabled,
	textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	textarea {
		resize: vertical;
		min-height: 110px;
	}
	.preview-image {
		max-height: 18rem;
		width: auto;
		max-width: 100%;
		object-fit: cover;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		display: block;
		margin-top: 0.25rem;
	}

	.image-error-hint {
		color: var(--t-accent);
		margin-top: 0.25rem;
	}

	.field-label {
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--t-fg);
	}

	.dropzone {
		border: 1.5px dashed var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
		padding: 1.5rem 1rem;
		text-align: center;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.dropzone.dragging {
		border-color: var(--t-fg);
		background: var(--t-tint);
	}

	.dropzone:focus-visible {
		outline: 2px solid var(--t-fg);
		outline-offset: 1px;
	}

	.dropzone-prompt {
		margin: 0;
		color: var(--t-muted);
		font-size: 0.9rem;
	}

	.dropzone-icon {
		display: block;
		font-size: 1.6rem;
		margin-bottom: 0.4rem;
	}

	.linklike {
		color: var(--t-fg);
		font-weight: 700;
		text-decoration: underline;
	}

	.dropzone .preview-image {
		margin: 0 auto;
	}

	.file-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.file-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 70%;
	}

	.text-button {
		border: 0;
		background: none;
		color: var(--t-fg);
		font-size: 0.8rem;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
	}

	.url-fallback {
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		padding: 0.6rem 0.9rem;
		background: var(--t-surface);
	}

	.url-fallback summary {
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--t-muted);
	}

	.url-fallback[open] summary {
		margin-bottom: 0.6rem;
	}

	.magic-button {
		align-self: flex-start;
		margin-top: 0.5rem;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-tint);
		color: var(--t-fg);
		font-weight: 700;
		font-size: 0.85rem;
		padding: 0.55rem 1.1rem;
		cursor: pointer;
	}

	.magic-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.magic-pieces {
		margin: 0.5rem 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
	}

	.magic-pieces li {
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
	}

	.magic-pieces strong {
		text-transform: capitalize;
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
