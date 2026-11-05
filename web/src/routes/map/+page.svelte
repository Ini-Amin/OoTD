<script lang="ts">
	import { onMount } from 'svelte';
	import Mannequin3D from '$lib/Mannequin3D.svelte';
	import Mall3D from '$lib/Mall3D.svelte';
	import CategoryIcon from '$lib/CategoryIcon.svelte';
	import MallChat from '$lib/MallChat.svelte';
	import { closet } from '$lib/closet.svelte';
	import { presence } from '$lib/presence.svelte';
	import { CATEGORIES, CATEGORY_LABEL, type Category, type ClosetPiece } from '$lib/pieces';
	import {
		mallFriends,
		mallStores,
		skuToClosetPiece,
		storeById,
		type MallFriend,
		type MallSku,
		type MallStore
	} from '$lib/mall';
	import type { Vec2 } from '$lib/mall3d';

	let insideId = $state<string | null>(null);
	let notice = $state('');
	let friends = $state<MallFriend[]>(mallFriends.map((f) => ({ ...f })));
	let wanderTimer: ReturnType<typeof setInterval> | undefined;
	/** Last 3D position, so leaving a store resumes where you stood. */
	let lastPos = $state<Vec2 | null>(null);

	function friendsHere(storeId: string): MallFriend[] {
		return friends.filter((f) => f.storeId === storeId);
	}

	onMount(() => {
		closet.init();
		presence.connect();
		presence.update(null);
		// Friends wander the mall so the map feels alive.
		wanderTimer = setInterval(() => {
			friends = friends.map((f) =>
				Math.random() < 0.45
					? { ...f, storeId: mallStores[Math.floor(Math.random() * mallStores.length)].id }
					: f
			);
		}, 7000);
		return () => {
			clearInterval(wanderTimer);
			presence.disconnect();
		};
	});

	// Re-track the roster entry on enter/leave. Live 3D positions flow over
	// broadcast through handlePlayerMove (the server closes channels that
	// track repeatedly).
	$effect(() => {
		presence.update(insideId);
	});

	let inside = $derived(storeById(insideId));
	let guests = $derived(insideId ? friendsHere(insideId) : []);
	// Real visitors from Supabase Presence, excluding this tab.
	let liveVisitors = $derived(presence.visitors.filter((v) => v.clientId !== presence.clientId));
	let liveHere = $derived(insideId ? liveVisitors.filter((v) => v.storeId === insideId) : []);

	let worn = $derived.by(() => {
		const map: Partial<Record<Category, ClosetPiece | undefined>> = {};
		for (const cat of CATEGORIES) {
			map[cat] = closet.wornPiece(cat);
		}
		return map;
	});

	function enterStore(storeId: string) {
		if (!storeById(storeId)) return;
		insideId = storeId;
		notice = '';
	}

	function handlePlayerMove(pos: Vec2) {
		lastPos = pos;
		presence.sendPos(pos.x, pos.z);
	}

	function leaveStore() {
		insideId = null;
	}

	function tryOn(store: MallStore, item: MallSku) {
		const piece = skuToClosetPiece(store, item);
		if (!closet.has(piece.id)) closet.add(piece);
		closet.wear(piece);
		notice = `Trying on ${item.label}`;
	}

	function takeOff(cat: Category) {
		closet.unwear(cat);
		notice = `Removed ${CATEGORY_LABEL[cat].toLowerCase()}`;
	}

	function isWornSku(item: MallSku) {
		return closet.worn[item.category] === `mall-${item.id}`;
	}
</script>

<svelte:head>
	<title>Mall map — OoTD</title>
</svelte:head>

<main class="mall-page">
	{#if inside == null}
		<header class="intro">
			<p class="kicker">Prototype</p>
			<h1>Fashion mall</h1>
			<p class="lede">
				Walk the mall in 3D — step onto a glowing door pad and enter the store
				to try pieces on. Friends wander the floor; say hi in the mall chat
				and style together.
			</p>
			<p class="disclaimer">
				Sample store names for the prototype only. Not affiliated with these brands.
			</p>
		</header>

		<div class="map-shell">
			<div class="map-grid">
				<div class="map-col">
				<div class="stage3d" role="application" aria-label="Walkable 3D mall">
					<Mall3D
						{friends}
						visitors={liveVisitors}
						startPos={lastPos}
						onEnter={enterStore}
						onMove={handlePlayerMove}
					/>
				</div>

				<ul class="legend">
					<li><span class="dot you-dot"></span> You</li>
					<li><span class="dot friend-dot"></span> Friends (demo)</li>
					{#if presence.status === 'live'}
						<li><span class="dot visitor-dot"></span> Here now: {liveVisitors.length}</li>
					{/if}
					<li>Walk to a glowing door pad to enter a store</li>
				</ul>
			</div>
				<MallChat />
			</div>
		</div>
	{:else}
		<header class="store-bar">
			<button type="button" class="back" onclick={leaveStore}>← Mall map</button>
			<div class="store-title">
				<p class="kicker">{inside.kind}</p>
				<h1>{inside.name}</h1>
				<p class="lede">{inside.blurb}</p>
			</div>
			{#if guests.length}
				<p class="guests">
					{guests.map((g) => g.name).join(', ')}
					{guests.length === 1 ? 'is' : 'are'} here too
				</p>
			{/if}
			{#if presence.status === 'live' && liveHere.length}
				<p class="guests live">
					{liveHere.map((g) => g.name).join(', ')}
					{liveHere.length === 1 ? 'is' : 'are'} shopping here now
				</p>
			{/if}
		</header>

		<div class="store-layout">
			<section class="try-col" aria-label="Try on">
				<div class="viewport">
					<Mannequin3D {worn} height="58vh" />
				</div>
				<p class="status" aria-live="polite">{notice || 'Pick a piece to try it on.'}</p>
				<div class="worn-row">
					{#each CATEGORIES as cat (cat)}
						{@const piece = worn[cat]}
						<button
							type="button"
							class="worn-chip"
							class:empty={!piece}
							disabled={!piece}
							onclick={() => takeOff(cat)}
							title={piece ? `Take off ${piece.label}` : CATEGORY_LABEL[cat]}
						>
							<CategoryIcon category={cat} size={14} />
							<span>{piece ? piece.label.replace(/^.*· /, '') : CATEGORY_LABEL[cat]}</span>
						</button>
					{/each}
				</div>
			</section>

			<section class="rack-col" aria-label={`${inside.name} pieces`}>
				<h2>Try the rack</h2>
				<div class="rack">
					{#each inside.skus as item (item.id)}
						{@const on = isWornSku(item)}
						<button
							type="button"
							class="sku"
							class:on
							aria-pressed={on}
							onclick={() => {
								if (inside) tryOn(inside, item);
							}}
						>
							<img src={item.imageUrl} alt="" width="200" height="260" />
							<div class="sku-meta">
								<span class="sku-cat">{CATEGORY_LABEL[item.category]}</span>
								<strong>{item.label}</strong>
								<span class="sku-price">{item.price}</span>
								<span class="sku-cta">{on ? 'On you' : 'Try on'}</span>
							</div>
						</button>
					{/each}
				</div>
				<p class="hint">Tried pieces stay in your closet on the Mannequin page.</p>
			</section>
		</div>
		<div class="store-chat">
			<MallChat />
		</div>
	{/if}
</main>

<style>
	.mall-page {
		width: min(1200px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 1.25rem 0 4.5rem;
	}

	.intro,
	.store-title {
		max-width: 40rem;
	}

	.kicker {
		margin: 0 0 0.35rem;
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--t-muted);
	}

	h1 {
		margin: 0;
		font-size: 1.85rem;
		font-weight: 700;
		letter-spacing: -0.04em;
	}

	h2 {
		margin: 0 0 0.85rem;
		font-size: 1.05rem;
	}

	.lede {
		margin: 0.45rem 0 0;
		color: var(--t-muted);
		line-height: 1.45;
		font-size: 0.95rem;
	}

	.disclaimer {
		margin: 0.55rem 0 0;
		font-size: 0.78rem;
		color: var(--t-muted);
	}

	.map-shell {
		margin-top: 1.25rem;
	}

	.map-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.65fr) minmax(17rem, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.map-col {
		min-width: 0;
	}

	.store-chat {
		margin-top: 1rem;
	}

	.stage3d {
		position: relative;
		width: 100%;
		height: clamp(30rem, 68vh, 46rem);
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: #e9e4d8;
		overflow: hidden;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem 1.25rem;
		list-style: none;
		margin: 0.85rem 0 0;
		padding: 0;
		color: var(--t-muted);
		font-size: 0.8rem;
	}

	.legend .dot {
		display: inline-block;
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 50%;
		margin-right: 0.3rem;
		vertical-align: middle;
	}

	.you-dot {
		background: var(--t-fg);
	}

	.friend-dot {
		background: hsl(330 70% 46%);
	}

	.visitor-dot {
		background: var(--t-surface);
		border: 2px solid var(--t-accent);
		box-sizing: border-box;
	}

	.store-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem 1.5rem;
		margin-bottom: 1.15rem;
	}

	.back {
		background: transparent;
		border: 1px solid var(--t-line);
		color: var(--t-fg);
		border-radius: 999px;
		padding: 0.4rem 0.85rem;
		font-size: 0.85rem;
	}

	.guests {
		margin: 0 0 0.2rem auto;
		font-size: 0.82rem;
		color: var(--t-muted);
	}

	.store-layout {
		display: grid;
		grid-template-columns: minmax(280px, 0.9fr) minmax(320px, 1.1fr);
		gap: 1.5rem;
		align-items: start;
	}

	.viewport {
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-tint);
		overflow: hidden;
	}

	.status {
		margin: 0.65rem 0 0.5rem;
		font-size: 0.85rem;
		color: var(--t-muted);
		min-height: 1.2em;
	}

	.worn-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.worn-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		max-width: 100%;
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		border-radius: 999px;
		padding: 0.28rem 0.55rem;
		font-size: 0.72rem;
	}

	.worn-chip.empty {
		color: var(--t-muted);
		opacity: 0.7;
	}

	.worn-chip span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 10rem;
	}

	.rack {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.sku {
		display: flex;
		flex-direction: column;
		padding: 0;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
		color: inherit;
		overflow: hidden;
		text-align: left;
	}

	.sku.on {
		box-shadow: 0 0 0 2px var(--t-accent);
		border-color: var(--t-accent);
	}

	.sku img {
		width: 100%;
		height: 8.5rem;
		object-fit: cover;
		display: block;
		background: var(--t-tint);
	}

	.sku-meta {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.6rem 0.7rem 0.75rem;
	}

	.sku-cat {
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--t-muted);
	}

	.sku-price {
		font-size: 0.8rem;
		color: var(--t-muted);
	}

	.sku-cta {
		margin-top: 0.25rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--t-accent);
	}

	.hint {
		margin: 0.85rem 0 0;
		font-size: 0.78rem;
		color: var(--t-muted);
	}

	@media (max-width: 860px) {
		.mall-page {
			width: calc(100% - 1.5rem);
		}

		.stage3d {
			height: clamp(26rem, 62vh, 38rem);
		}

		.store-layout {
			grid-template-columns: 1fr;
		}

		.map-grid {
			grid-template-columns: 1fr;
		}

		.guests {
			margin-left: 0;
		}
	}
</style>
