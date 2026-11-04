<script lang="ts">
	import { onMount } from 'svelte';
	import { mallChat } from '$lib/mallChat.svelte';

	let input = $state('');
	let sending = $state(false);
	let boxEl = $state<HTMLDivElement | null>(null);

	onMount(() => {
		mallChat.connect();
		return () => {
			mallChat.disconnect();
		};
	});

	$effect(() => {
		const n = mallChat.messages.length;
		if (boxEl && n >= 0) {
			boxEl.scrollTop = boxEl.scrollHeight;
		}
	});

	async function send() {
		const text = input.trim();
		if (!text || sending || mallChat.status !== 'live') return;
		sending = true;
		input = '';
		await mallChat.send(text);
		sending = false;
	}
</script>

<section class="chat-card" aria-label="Mall chat">
	<header class="chat-head">
		<div>
			<h2>Mall chat</h2>
			<p class="chat-sub">
				{#if mallChat.status === 'live'}
					<span class="live-dot" aria-hidden="true"></span> Live — say hi to friends in the mall
				{:else if mallChat.status === 'connecting'}
					Connecting…
				{:else}
					Chat unavailable right now
				{/if}
			</p>
		</div>
		{#if mallChat.status === 'offline'}
			<button type="button" class="retry-btn" onclick={() => mallChat.connect()}>Retry</button>
		{/if}
	</header>

	<div class="chat-box" bind:this={boxEl} role="log" aria-live="polite" aria-label="Messages">
		{#if mallChat.messages.length === 0}
			<p class="chat-empty">No messages yet. Be the first to say hi.</p>
		{/if}
		{#each mallChat.messages as m (m.id)}
			<p class="chat-msg" class:mine={m.mine}>
				{#if !m.mine}<strong>{m.name}</strong>{/if}
				<span>{m.text}</span>
			</p>
		{/each}
	</div>

	<form
		class="chat-form"
		onsubmit={(e) => {
			e.preventDefault();
			send();
		}}
	>
		<input
			type="text"
			bind:value={input}
			maxlength={500}
			placeholder={mallChat.status === 'live' ? 'Message the mall…' : 'Waiting for connection…'}
			aria-label="Message the mall"
			disabled={sending || mallChat.status !== 'live'}
		/>
		<button type="submit" disabled={sending || !input.trim() || mallChat.status !== 'live'}>
			Send
		</button>
	</form>
</section>

<style>
	.chat-card {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--t-surface);
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		overflow: hidden;
	}

	.chat-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--t-line);
	}

	.chat-head h2 {
		margin: 0;
		font-size: 1rem;
	}

	.chat-sub {
		margin: 0.15rem 0 0;
		font-size: 0.78rem;
		color: var(--t-muted);
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.live-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #1a9e54;
		display: inline-block;
	}

	.retry-btn {
		border: 1px solid var(--t-line);
		background: transparent;
		color: var(--t-fg);
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
		font-size: 0.78rem;
		flex-shrink: 0;
	}

	.chat-box {
		flex: 1;
		min-height: 12rem;
		max-height: 26rem;
		overflow-y: auto;
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.chat-empty {
		margin: auto;
		color: var(--t-muted);
		font-size: 0.83rem;
		text-align: center;
	}

	.chat-msg {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.45;
		word-break: break-word;
		align-self: flex-start;
		max-width: 92%;
		padding: 0.45rem 0.7rem;
		border-radius: 0.9rem;
		border: 1px solid var(--t-line);
		background: var(--t-tint);
	}

	.chat-msg strong {
		display: block;
		font-size: 0.7rem;
		color: var(--t-muted);
		font-weight: 700;
		margin-bottom: 0.1rem;
	}

	.chat-msg.mine {
		align-self: flex-end;
		background: var(--t-fg);
		color: var(--t-bg);
		border-color: var(--t-fg);
	}

	.chat-form {
		display: flex;
		gap: 0.5rem;
		padding: 0.7rem 0.9rem;
		border-top: 1px solid var(--t-line);
	}

	.chat-form input {
		flex: 1;
		min-width: 0;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-bg);
		color: var(--t-fg);
		font-size: 0.85rem;
	}

	.chat-form button {
		border: 0;
		border-radius: 999px;
		background: var(--t-fg);
		color: var(--t-bg);
		font-weight: 700;
		font-size: 0.82rem;
		padding: 0.6rem 1rem;
	}

	.chat-form button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
