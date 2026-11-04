<script lang="ts">
	import { onMount } from 'svelte';
	import Mannequin3D from '$lib/Mannequin3D.svelte';
	import CategoryIcon from '$lib/CategoryIcon.svelte';
	import MallChat from '$lib/MallChat.svelte';
	import { closet } from '$lib/closet.svelte';
	import { CATEGORIES, CATEGORY_LABEL, type Category, type ClosetPiece } from '$lib/pieces';
	import {
		mallFriends,
		mallStores,
		mallYouStart,
		skuToClosetPiece,
		storeById,
		type MallFriend,
		type MallSku,
		type MallStore
	} from '$lib/mall';

	let you = $state({ x: mallYouStart.x, y: mallYouStart.y });
	let insideId = $state<string | null>(null);
	let notice = $state('');
	let friends = $state<MallFriend[]>(mallFriends.map((f) => ({ ...f })));
	let walkingTo = $state<string | null>(null);
	let walkTimer: ReturnType<typeof setTimeout> | undefined;
	let wanderTimer: ReturnType<typeof setInterval> | undefined;

	function friendsHere(storeId: string): MallFriend[] {
		return friends.filter((f) => f.storeId === storeId);
	}

	onMount(() => {
		closet.init();
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
			clearTimeout(walkTimer);
		};
	});

	let inside = $derived(storeById(insideId));
	let guests = $derived(insideId ? friendsHere(insideId) : []);

	let worn = $derived.by(() => {
		const map: Partial<Record<Category, ClosetPiece | undefined>> = {};
		for (const cat of CATEGORIES) {
			map[cat] = closet.wornPiece(cat);
		}
		return map;
	});

	function storeCenter(store: MallStore) {
		return { x: store.x + store.w / 2, y: store.y + store.h / 2 };
	}

	function friendSpot(storeId: string, index: number) {
		const store = storeById(storeId);
		if (!store) return { x: 50, y: 50 };
		return {
			x: store.x + store.w - 6 - index * 1.2,
			y: store.y + 5
		};
	}

	function walkToStore(store: MallStore) {
		clearTimeout(walkTimer);
		you = storeCenter(store);
		const reduced =
			typeof window !== 'undefined' &&
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced) {
			enterNow(store);
			return;
		}
		walkingTo = store.name;
		walkTimer = setTimeout(() => enterNow(store), 650);
	}

	function enterNow(store: MallStore) {
		walkingTo = null;
		insideId = store.id;
		notice = '';
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
				Tap a store to walk over and try pieces on your mannequin. Friends wander
				the mall as dots — say hi in the mall chat and style together.
			</p>
			<p class="disclaimer">
				Sample store names for the prototype only. Not affiliated with these brands.
			</p>
		</header>

		<div class="map-shell">
			<div class="map-grid">
				<div class="map-col">
			<div class="map-stage" role="application" aria-label="Mall floor plan">
				<svg class="floor" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
					<rect class="atrium" x="32" y="27" width="36" height="8" rx="4" />
					<text class="atrium-label" x="50" y="32.4" text-anchor="middle">Atrium</text>
					<rect class="path" x="48.5" y="35" width="3" height="27" rx="1.5" />
					<rect class="path" x="4" y="62" width="92" height="5" rx="2.5" />
					<line class="path-line" x1="50" y1="36.5" x2="50" y2="60.5" />
					<line class="path-line" x1="6" y1="64.5" x2="94" y2="64.5" />
				</svg>

				{#each mallStores as store (store.id)}
					<button
						type="button"
						class="store-pad"
						style={`left:${store.x}%;top:${store.y}%;width:${store.w}%;height:${store.h}%;--store:${store.color}`}
						onclick={() => walkToStore(store)}
					>
						<span class="store-kind">{store.kind}</span>
						<span class="store-name">{store.name}</span>
						{#if friendsHere(store.id).length}
							<span class="store-friends"
								>{friendsHere(store.id).length} friend{friendsHere(store.id).length > 1
									? 's'
									: ''} here</span
							>
						{/if}
					</button>
				{/each}

				{#each friends as friend (friend.id)}
					{@const spot = friendSpot(friend.storeId, friendsHere(friend.storeId).indexOf(friend))}
					<div
						class="pin friend"
						style={`left:${spot.x}%;top:${spot.y}%;--hue:${friend.hue}`}
						title={`${friend.name} — ${friend.note}`}
					>
						<span>{friend.name.charAt(0)}</span>
					</div>
				{/each}

				<div class="pin you" style={`left:${you.x}%;top:${you.y}%`} title="You">
					<span>You</span>
				</div>
				{#if walkingTo}
					<p class="walking">Walking to {walkingTo}…</p>
				{/if}
			</div>

			<ul class="legend">
				<li><span class="dot you-dot"></span> You</li>
				<li><span class="dot friend-dot"></span> Friends exploring</li>
				<li>Tap a store to walk in and try on</li>
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

	.walking {
		position: absolute;
		left: 0.9rem;
		bottom: 0.9rem;
		z-index: 6;
		margin: 0;
		padding: 0.45rem 0.8rem;
		border-radius: 999px;
		background: var(--t-fg);
		color: var(--t-bg);
		font-size: 0.78rem;
		font-weight: 600;
	}

	.store-chat {
		margin-top: 1rem;
	}

	.map-stage {
		position: relative;
		width: 100%;
		aspect-ratio: 1.35 / 1;
		min-height: 28rem;
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background:
			radial-gradient(circle at 50% 33%, color-mix(in srgb, var(--t-accent) 12%, var(--t-tint)), transparent 42%),
			var(--t-tint);
		overflow: hidden;
	}

	.floor {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.atrium {
		fill: color-mix(in srgb, var(--t-surface) 80%, var(--t-accent));
		stroke: var(--t-line);
		stroke-width: 0.25;
	}

	.atrium-label {
		fill: var(--t-muted);
		font-size: 3.2px;
		letter-spacing: 0.2px;
	}

	.path {
		fill: color-mix(in srgb, var(--t-surface) 70%, var(--t-bg));
	}

	.path-line {
		fill: none;
		stroke: var(--t-line);
		stroke-width: 0.4;
		stroke-dasharray: 1.5 1.2;
		opacity: 0.8;
	}

	.store-pad {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-end;
		gap: 0.15rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid color-mix(in srgb, var(--store) 35%, var(--t-line));
		border-top: 3px solid var(--store);
		border-radius: calc(var(--t-radius) * 0.55);
		background: color-mix(in srgb, var(--store) 14%, var(--t-surface));
		color: var(--t-fg);
		text-align: left;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.store-pad:hover,
	.store-pad:focus-visible {
		transform: translateY(-2px);
		box-shadow: 0 8px 20px color-mix(in srgb, var(--store) 22%, transparent);
		outline: 2px solid var(--store);
		outline-offset: 1px;
		z-index: 2;
	}

	.store-kind {
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--t-muted);
	}

	.store-name {
		font-weight: 700;
		font-size: 0.92rem;
		letter-spacing: -0.03em;
	}

	.store-friends {
		font-size: 0.68rem;
		color: var(--t-accent);
	}

	.pin {
		position: absolute;
		transform: translate(-50%, -50%);
		z-index: 4;
		pointer-events: none;
		transition: left 0.6s ease, top 0.6s ease;
	}

	.pin span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.7rem;
		height: 1.7rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		font-size: 0.65rem;
		font-weight: 700;
		border: 2px solid var(--t-surface);
	}

	.pin.you span {
		background: var(--t-fg);
		color: var(--t-bg);
	}

	.pin.friend span {
		background: hsl(var(--hue) 70% 46%);
		color: white;
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

		.map-stage {
			aspect-ratio: 0.85 / 1;
			min-height: 34rem;
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

		.store-name {
			font-size: 0.78rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.store-pad,
		.pin {
			transition: none;
		}
	}
</style>
