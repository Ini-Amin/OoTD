<script lang="ts">
	import { auth, authHeaders } from '$lib/auth.svelte';
	import { apiBase } from '$lib/outfits';
	import { closet } from '$lib/closet.svelte';
	import { serializeClosetForStylist } from '$lib/stylistCloset';

	type ChatMessage = { role: 'user' | 'assistant'; content: string };

	let open = $state(false);
	let messages = $state<ChatMessage[]>([]);
	let input = $state('');
	let sending = $state(false);
	let error = $state<string | null>(null);
	let panelEl = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		const count = messages.length;
		if (open && panelEl && count >= 0) {
			panelEl.scrollTop = panelEl.scrollHeight;
		}
		if (open) inputEl?.focus();
	});

	function toggle() {
		open = !open;
		error = null;
	}

	async function send() {
		const text = input.trim();
		if (!text || sending) return;
		if (text.length > 2000) {
			error = 'Message must be 2000 characters or less.';
			return;
		}
		sending = true;
		error = null;
		input = '';
		const prior = messages.slice(-20);
		messages = [...messages, { role: 'user', content: text }];
		// Owned-pieces context: best-effort, never blocks send().
		let closetPayload: ReturnType<typeof serializeClosetForStylist> = [];
		try {
			closet.init();
			closetPayload = serializeClosetForStylist(closet.pieces, closet.worn);
		} catch {
			closetPayload = [];
		}
		try {
			const res = await fetch(`${apiBase}/v1/stylist`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...authHeaders() },
				body: JSON.stringify({
					message: text,
					history: prior,
					...(closetPayload.length ? { closet: closetPayload } : {})
				})
			});
			if (res.status === 503) {
				error = 'AI Stylist is not configured on the server.';
				return;
			}
			if (res.status === 401) {
				error = 'Your session expired. Sign in again.';
				return;
			}
			if (res.status === 429) {
				error = 'Too many messages. Try again in a bit.';
				return;
			}
			if (!res.ok) throw new Error(`stylist failed (${res.status})`);
			const data = (await res.json()) as { reply?: string };
			const reply = (data.reply ?? '').trim() || '…';
			messages = [...messages, { role: 'assistant', content: reply }];
		} catch {
			error = 'Could not reach the stylist. Try again.';
		} finally {
			sending = false;
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape') toggle();
	}}
/>

{#if auth.session}
	{#if open}
		<div class="stylist-panel" role="dialog" aria-label="AI Stylist chat">
			<div class="stylist-header">
				<span class="stylist-title">✨ AI Stylist</span>
				<button type="button" class="stylist-close" onclick={toggle} aria-label="Close stylist chat">
					✕
				</button>
			</div>
			<div class="stylist-messages" bind:this={panelEl}>
				{#if messages.length === 0}
					<p class="stylist-empty">
						Tanya soal outfit — acara, cuaca, budget, atau gaya.
					</p>
				{/if}
				{#each messages as m}
					<p class="stylist-msg" class:mine={m.role === 'user'}>{m.content}</p>
				{/each}
				{#if sending}
					<p class="stylist-msg">…</p>
				{/if}
				{#if error}
					<p class="stylist-error" role="alert">{error}</p>
				{/if}
			</div>
			<form
				class="stylist-form"
				onsubmit={(e) => {
					e.preventDefault();
					send();
				}}
			>
				<input
					bind:this={inputEl}
					type="text"
					bind:value={input}
					maxlength={2000}
					placeholder="Mau tampil apa hari ini?"
					aria-label="Message the stylist"
					disabled={sending}
				/>
				<button type="submit" disabled={sending || !input.trim()}>Send</button>
			</form>
		</div>
	{:else}
		<button
			type="button"
			class="stylist-fab"
			onclick={toggle}
			aria-label="Open AI Stylist chat"
			title="AI Stylist"
		>
			✨
		</button>
	{/if}
{/if}

<style>
	.stylist-fab {
		position: fixed;
		left: 1rem;
		bottom: 1rem;
		z-index: 900;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		font-size: 1.3rem;
		line-height: 1;
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.12);
	}

	.stylist-panel {
		position: fixed;
		left: 1rem;
		bottom: 1rem;
		z-index: 900;
		width: 22rem;
		max-width: calc(100vw - 2rem);
		height: 28rem;
		max-height: calc(100vh - 8rem);
		display: flex;
		flex-direction: column;
		background: var(--t-surface);
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		box-shadow: 0 8px 32px rgb(0 0 0 / 0.16);
		overflow: hidden;
	}

	.stylist-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 0.9rem;
		border-bottom: 1px solid var(--t-line);
	}

	.stylist-title {
		font-weight: 700;
		font-size: 0.9rem;
	}

	.stylist-close {
		border: 0;
		background: none;
		color: var(--t-muted);
		font-size: 0.9rem;
		padding: 0.25rem 0.5rem;
	}

	.stylist-messages {
		flex: 1;
		overflow-y: auto;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.stylist-empty {
		margin: auto;
		text-align: center;
		color: var(--t-muted);
		font-size: 0.85rem;
		line-height: 1.5;
		max-width: 16rem;
	}

	.stylist-msg {
		margin: 0;
		padding: 0.55rem 0.8rem;
		border-radius: 1rem;
		border: 1px solid var(--t-line);
		background: var(--t-tint);
		font-size: 0.85rem;
		line-height: 1.45;
		white-space: pre-wrap;
		word-break: break-word;
		align-self: flex-start;
		max-width: 90%;
	}

	.stylist-msg.mine {
		align-self: flex-end;
		background: var(--t-fg);
		color: var(--t-bg);
		border-color: var(--t-fg);
	}

	.stylist-error {
		margin: 0;
		color: var(--t-accent);
		font-size: 0.8rem;
	}

	.stylist-form {
		display: flex;
		gap: 0.5rem;
		padding: 0.7rem 0.9rem;
		border-top: 1px solid var(--t-line);
	}

	.stylist-form input {
		flex: 1;
		min-width: 0;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-bg);
		color: var(--t-fg);
		font-size: 0.85rem;
	}

	.stylist-form button {
		border: 0;
		border-radius: 999px;
		background: var(--t-fg);
		color: var(--t-bg);
		font-weight: 700;
		font-size: 0.82rem;
		padding: 0.6rem 1rem;
	}

	.stylist-form button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
