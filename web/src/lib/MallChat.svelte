<script lang="ts">
	import { onMount } from 'svelte';
	import { mallChat } from '$lib/mallChat.svelte';
	import { auth } from '$lib/auth.svelte';
	import { presence } from '$lib/presence.svelte';
	import { mallFriends, storeById } from '$lib/mall';
	import { BOT_BADGE, BOT_THREAD_LABEL, botPeerId, isBotPeerId } from '$lib/mallBots';
	import { playClick } from '$lib/mallSound';

	/** Overlay mode floats inside the 3D stage; docked mode fills its parent. */
	let { overlay = false }: { overlay?: boolean } = $props();

	type Tab = 'mall' | 'whisper' | 'makers';
	let tab = $state<Tab>('mall');
	let peerId = $state<string | null>(null);
	let collapsed = $state(false);
	let input = $state('');
	let sending = $state(false);
	let boxEl = $state<HTMLDivElement | null>(null);

	const makers = storeById('makers');
	let visitors = $derived(presence.visitors.filter((v) => v.clientId !== presence.clientId));
	let makersOnline = $derived(visitors.filter((v) => v.role === 'maker'));
	let threadIds = $derived(Object.keys(mallChat.whispers));
	let unreadTotal = $derived(mallChat.unreadTotal());
	let thread = $derived(peerId ? (mallChat.whispers[peerId] ?? []) : []);
	let peerName = $derived(peerId ? mallChat.threadName(peerId) : '');
	let peerOnline = $derived(peerId ? visitors.some((v) => v.clientId === peerId) : false);
	// Demo-bot threads are local-only: always sendable, even offline.
	let botThread = $derived(isBotPeerId(peerId));
	let sendReady = $derived(botThread || mallChat.status === 'live');

	onMount(() => {
		mallChat.connect();
		if (overlay && window.innerWidth < 860) collapsed = true;
		return () => {
			mallChat.disconnect();
		};
	});

	$effect(() => {
		const n = mallChat.messages.length + thread.length;
		if (boxEl && n >= 0) {
			boxEl.scrollTop = boxEl.scrollHeight;
		}
	});

	// Viewing a conversation clears its unread badge.
	$effect(() => {
		const u = mallChat.unread;
		if (overlay && collapsed) return;
		if (tab === 'mall' && u['mall']) mallChat.markRead('mall');
		if (tab === 'whisper' && peerId && u[peerId]) mallChat.markRead(peerId);
	});

	// Keep this tab's roster identity fresh: signing in as a maker after
	// presence connected must update the tracked name/role once.
	$effect(() => {
		const p = auth.profile;
		if (p !== undefined && presence.status === 'live') presence.refreshIdentity();
	});

	function lastPreview(id: string): string {
		const t = mallChat.whispers[id] ?? [];
		const last = t[t.length - 1];
		if (!last) return '';
		return last.mine ? `You: ${last.text}` : last.text;
	}

	function openChat() {
		collapsed = false;
	}

	function pickPeer(id: string) {
		peerId = id;
		input = '';
	}

	function whisperMaker(id: string) {
		pickPeer(id);
		tab = 'whisper';
	}

	async function send() {
		const text = input.trim();
		if (!text || sending) return;
		if (tab === 'whisper' && !peerId) return;
		if (tab === 'whisper' && botThread) {
			sending = true;
			input = '';
			const ok = mallChat.sendBotWhisper(peerId as string, text);
			if (ok) playClick();
			else if (mallChat.lastRejection) input = text;
			sending = false;
			return;
		}
		if (mallChat.status !== 'live') return;
		sending = true;
		input = '';
		let ok: boolean;
		if (tab === 'whisper' && peerId) {
			ok = await mallChat.sendWhisper(peerId, peerName, text);
		} else {
			ok = await mallChat.send(text);
		}
		if (ok) playClick();
		else if (mallChat.lastRejection) input = text;
		sending = false;
	}

	function storeLabel(storeId: string | null): string {
		if (!storeId) return 'in the mall';
		return `in ${storeById(storeId)?.name ?? 'a store'}`;
	}
</script>

{#if overlay && collapsed}
	<button type="button" class="chat-fab" onclick={openChat} aria-label="Open mall chat">
		Chat
		{#if unreadTotal > 0}
			<span class="fab-badge" aria-label="{unreadTotal} unread">{unreadTotal}</span>
		{/if}
	</button>
{:else}
	<section class="chat-card" class:overlay aria-label="Mall chat">
		<header class="chat-head">
			<div class="tabs" role="tablist" aria-label="Chat channels">
				<button
					type="button"
					role="tab"
					aria-selected={tab === 'mall'}
					class:on={tab === 'mall'}
					onclick={() => (tab = 'mall')}
				>
					Mall
					{#if (mallChat.unread['mall'] ?? 0) > 0}
						<span class="tab-badge">{mallChat.unread['mall']}</span>
					{/if}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === 'whisper'}
					class:on={tab === 'whisper'}
					onclick={() => (tab = 'whisper')}
				>
					Whisper
					{#if threadIds.some((id) => (mallChat.unread[id] ?? 0) > 0)}
						<span class="tab-badge">•</span>
					{/if}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === 'makers'}
					class:on={tab === 'makers'}
					onclick={() => (tab = 'makers')}
				>
					Makers
				</button>
			</div>
			<div class="head-right">
				<span class="status" aria-live="polite">
					{#if mallChat.status === 'live'}
						<span class="live-dot" aria-hidden="true"></span> Live
					{:else if mallChat.status === 'connecting'}
						Connecting…
					{:else}
						Offline
					{/if}
				</span>
				{#if overlay}
					<button type="button" class="icon-btn" onclick={() => (collapsed = true)} aria-label="Minimize chat">
						—
					</button>
				{/if}
			</div>
		</header>

		{#if tab === 'mall'}
			<div class="chat-box" bind:this={boxEl} role="log" aria-live="polite" aria-label="Mall messages">
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
			{#if mallChat.lastRejection}
				<p class="chat-reject" role="alert">{mallChat.lastRejection}</p>
			{/if}
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
		{:else if tab === 'whisper'}
			{#if !peerId}
				<div class="chat-box" aria-label="Visitors">
					{#if visitors.length === 0 && threadIds.length === 0}
						<p class="chat-empty">
							Nobody else is here yet. Say hi to a demo bot below, or open a second
							tab to whisper a human.
						</p>
					{/if}
					{#each threadIds as id (id)}
						<button type="button" class="peer-row" onclick={() => pickPeer(id)}>
							<span class="peer-name">{mallChat.threadName(id)}</span>
							{#if isBotPeerId(id)}
								<span class="bot-badge" data-testid="bot-badge">{BOT_BADGE}</span>
							{/if}
							<span class="peer-sub">{lastPreview(id)}</span>
							{#if (mallChat.unread[id] ?? 0) > 0}
								<span class="tab-badge">{mallChat.unread[id]}</span>
							{/if}
						</button>
					{/each}
					{#each visitors.filter((v) => !threadIds.includes(v.clientId)) as v (v.clientId)}
						<button type="button" class="peer-row" onclick={() => pickPeer(v.clientId)}>
							<span class="peer-name">{v.name}</span>
							<span class="peer-sub">{storeLabel(v.storeId)}</span>
						</button>
					{/each}
					<p class="bot-dir-label">Demo bots — bukan manusia</p>
					{#each mallFriends.filter((f) => !threadIds.includes(botPeerId(f.id))) as f (f.id)}
						<button
							type="button"
							class="peer-row"
							data-testid="bot-row-{f.id}"
							onclick={() => pickPeer(botPeerId(f.id))}
						>
							<span class="peer-name">{mallChat.threadName(botPeerId(f.id))}</span>
							<span class="bot-badge" data-testid="bot-badge">{BOT_BADGE}</span>
							<span class="peer-sub">{f.note}</span>
						</button>
					{/each}
				</div>
			{:else}
				<div class="thread-bar">
					<button type="button" class="icon-btn" onclick={() => (peerId = null)} aria-label="Back to visitors">
						←
					</button>
					<strong>{peerName}</strong>
					{#if botThread}
						<span class="bot-label" data-testid="bot-label">{BOT_THREAD_LABEL}</span>
					{/if}
					<span
						class="peer-status"
						class:on={peerOnline}
						class:bot={botThread}
						data-testid="whisper-status"
						aria-label={botThread ? 'Bot demo, balasan otomatis' : peerOnline ? 'Online' : 'Offline'}
					>
						{botThread ? 'Bot' : peerOnline ? 'Online' : 'Offline'}
					</span>
				</div>
				<div class="chat-box" bind:this={boxEl} role="log" aria-live="polite" aria-label="Whisper thread">
					{#if thread.length === 0}
						{#if botThread}
							<p class="chat-empty">Say hi to {peerName}. Balasannya otomatis.</p>
							<p class="chat-empty-sub">Bot demo — bukan manusia.</p>
						{:else}
							<p class="chat-empty">Say hi to {peerName}. Only the two of you see this.</p>
							<p class="chat-empty-sub">Pesan terkirim hanya jika mereka online.</p>
						{/if}
					{/if}
					{#each thread as m (m.id)}
						<p class="chat-msg" class:mine={m.mine}>
							<span>{m.text}</span>
						</p>
					{/each}
				</div>
				{#if mallChat.lastRejection}
					<p class="chat-reject" role="alert">{mallChat.lastRejection}</p>
				{/if}
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
						placeholder={sendReady ? `Whisper to ${peerName}…` : 'Waiting for connection…'}
						aria-label="Whisper message"
						disabled={sending || !sendReady}
					/>
					<button type="submit" disabled={sending || !input.trim() || !sendReady}>
						Send
					</button>
				</form>
			{/if}
		{:else}
			<div class="chat-box" aria-label="Makers">
				{#if makers}
					<p class="maker-name">{makers.name}</p>
					<p class="maker-blurb">{makers.blurb}</p>
					{#if makersOnline.length > 0}
						<p class="maker-note" data-testid="makers-online">
							{makersOnline.length}
							{makersOnline.length === 1 ? 'maker is' : 'makers are'} online now. Say hi —
							only the two of you see the whisper.
						</p>
						{#each makersOnline as m (m.clientId)}
							<button type="button" class="peer-row" onclick={() => whisperMaker(m.clientId)}>
								<span class="peer-name">{m.name}</span>
								<span class="peer-sub">{storeLabel(m.storeId)} · whisper</span>
							</button>
						{/each}
					{:else}
						<p class="maker-note" data-testid="makers-offline">
							No makers online right now. Send a craft request and they will see it in
							their dashboard.
						</p>
					{/if}
					<a class="maker-cta" href="/mannequin?craft=1">Request a craft</a>
				{:else}
					<p class="chat-empty">No makers listed yet.</p>
				{/if}
			</div>
		{/if}
	</section>
{/if}

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

	.chat-card.overlay {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		z-index: 7;
		width: min(21rem, calc(100% - 1.5rem));
		max-height: calc(100% - 1.5rem);
		box-shadow: 0 0.75rem 2rem rgba(20, 16, 10, 0.28);
	}

	.chat-fab {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		z-index: 7;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 44px;
		border: 1px solid var(--t-line);
		border-radius: 999px;
		background: var(--t-surface);
		color: var(--t-fg);
		font-weight: 700;
		font-size: 0.85rem;
		padding: 0.55rem 1rem;
		box-shadow: 0 0.5rem 1.25rem rgba(20, 16, 10, 0.25);
	}

	.fab-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.4rem;
		height: 1.4rem;
		border-radius: 999px;
		background: var(--t-accent);
		color: #fff;
		font-size: 0.72rem;
		padding: 0 0.3rem;
	}

	.chat-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid var(--t-line);
	}

	.tabs {
		display: flex;
		gap: 0.25rem;
		min-width: 0;
	}

	.tabs button {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		min-height: 44px;
		border: 0;
		border-radius: 0.6rem;
		background: transparent;
		color: var(--t-muted);
		font-size: 0.82rem;
		font-weight: 700;
		padding: 0.4rem 0.6rem;
	}

	.tabs button.on {
		background: var(--t-tint);
		color: var(--t-fg);
	}

	.tab-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		border-radius: 999px;
		background: var(--t-accent);
		color: #fff;
		font-size: 0.68rem;
		padding: 0 0.25rem;
	}

	.head-right {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-shrink: 0;
	}

	.status {
		font-size: 0.72rem;
		color: var(--t-muted);
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		white-space: nowrap;
	}

	.live-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #1a9e54;
		display: inline-block;
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		border: 1px solid var(--t-line);
		background: transparent;
		color: var(--t-fg);
		border-radius: 0.6rem;
		font-size: 0.9rem;
	}

	.thread-bar {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid var(--t-line);
		font-size: 0.85rem;
	}

	.chat-box {
		flex: 1;
		min-height: 10rem;
		max-height: 24rem;
		overflow-y: auto;
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.chat-card.overlay .chat-box {
		min-height: 8rem;
		max-height: 40vh;
	}

	.chat-empty {
		margin: auto auto 0;
		color: var(--t-muted);
		font-size: 0.83rem;
		text-align: center;
	}

	.chat-empty-sub {
		margin: 0 auto auto;
		color: var(--t-muted);
		font-size: 0.78rem;
		text-align: center;
	}

	.peer-status {
		margin-left: auto;
		font-size: 0.72rem;
		font-weight: 700;
		color: #8a8f98;
	}

	.peer-status.on {
		color: #1a9e54;
	}

	.peer-status.bot {
		color: #7c5c00;
	}

	.bot-badge {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		border-radius: 999px;
		background: #fff3c4;
		color: #7c5c00;
		border: 1px solid #e3c66a;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		padding: 0.1rem 0.45rem;
		white-space: nowrap;
	}

	.bot-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: #7c5c00;
		white-space: nowrap;
	}

	.bot-dir-label {
		margin: 0.35rem 0 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--t-muted);
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

	.peer-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		width: 100%;
		text-align: left;
		border: 1px solid var(--t-line);
		border-radius: 0.75rem;
		background: var(--t-bg);
		color: var(--t-fg);
		padding: 0.55rem 0.7rem;
	}

	.peer-name {
		font-weight: 700;
		font-size: 0.85rem;
	}

	.peer-sub {
		margin-left: auto;
		font-size: 0.72rem;
		color: var(--t-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.maker-name {
		margin: 0;
		font-weight: 700;
		font-size: 0.95rem;
	}

	.maker-blurb {
		margin: 0;
		font-size: 0.83rem;
		color: var(--t-muted);
		line-height: 1.45;
	}

	.maker-note {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.maker-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		border-radius: 999px;
		background: var(--t-fg);
		color: var(--t-bg);
		font-weight: 700;
		font-size: 0.83rem;
		text-decoration: none;
		padding: 0.55rem 1rem;
		align-self: flex-start;
	}

	.chat-reject {
		margin: 0;
		padding: 0.45rem 0.9rem;
		border-top: 1px solid var(--t-line);
		color: #b3261e;
		font-size: 0.78rem;
		font-weight: 600;
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
		min-height: 44px;
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
		min-height: 44px;
	}

	.chat-form button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
