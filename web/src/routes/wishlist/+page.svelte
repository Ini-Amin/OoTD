<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import CategoryIcon from '$lib/CategoryIcon.svelte';
	import { closet } from '$lib/closet.svelte';
	import { wishlist } from '$lib/wishlist.svelte';
	import { findSku, skuToClosetPiece, storeById, type MallSku, type MallStore } from '$lib/mall';
	import { CATEGORY_LABEL } from '$lib/pieces';

	let notice = $state('');

	onMount(() => {
		wishlist.init();
		closet.init();
	});

	type Resolved = { store: MallStore; sku: MallSku };

	let items = $derived.by(() => {
		const out: (Resolved & { addedAt: number })[] = [];
		for (const e of wishlist.entries) {
			const sku = findSku(e.storeId, e.skuId);
			const store = storeById(e.storeId);
			if (!sku || !store) continue;
			out.push({ store, sku, addedAt: e.addedAt });
		}
		return out;
	});

	function removeSku(sku: MallSku) {
		wishlist.remove(sku.id);
		notice = `Removed ${sku.label} from your wishlist. It stays in your closet.`;
	}

	async function tryOn(resolved: Resolved) {
		const piece = skuToClosetPiece(resolved.store, resolved.sku);
		if (!closet.has(piece.id)) closet.add(piece);
		const replaced = closet.wornPiece(resolved.sku.category);
		closet.wear(piece);
		if (replaced && replaced.id !== piece.id) {
			// Surface the same-category replacement before leaving the page.
			notice = `Trying on ${resolved.sku.label} — replaces your current ${CATEGORY_LABEL[resolved.sku.category].toLowerCase()}.`;
			await new Promise((r) => setTimeout(r, 900));
		}
		await goto('/mannequin');
	}
</script>

<svelte:head>
	<title>Wishlist — OoTD</title>
</svelte:head>

<main class="wish-page">
	<header class="intro">
		<p class="kicker">Mall</p>
		<h1>Wishlist</h1>
		<p class="lede">
			{#if items.length}
				{items.length} saved piece{items.length === 1 ? '' : 's'}. Removing one never
				removes it from your closet or takes it off.
			{:else}
				Pieces you save while trying things on land here.
			{/if}
		</p>
	</header>

	<p class="status" aria-live="polite">{notice}</p>

	{#if items.length === 0}
		<div class="empty">
			<p>Nothing saved yet.</p>
			<a class="cta" href="/map">Browse the mall</a>
			<p class="fine">Your wishlist lives in this browser, like your closet.</p>
		</div>
	{:else}
		<ul class="grid">
			{#each items as item (item.sku.id)}
				<li class="card">
					<img src={item.sku.imageUrl} alt="" width="200" height="260" />
					<div class="meta">
						<span class="cat">
							<CategoryIcon category={item.sku.category} size={13} />
							{CATEGORY_LABEL[item.sku.category]} · {item.store.name}
						</span>
						<strong>{item.sku.label}</strong>
						<span class="price">{item.sku.price}</span>
						<div class="actions">
							<button type="button" class="try" onclick={() => tryOn(item)}>
								Try on
							</button>
							<button
								type="button"
								class="remove"
								aria-label={`Remove ${item.sku.label} from wishlist`}
								onclick={() => removeSku(item.sku)}
							>
								Remove
							</button>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.wish-page {
		width: min(1100px, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 1.25rem 0 4.5rem;
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

	.lede {
		margin: 0.45rem 0 0;
		color: var(--t-muted);
		line-height: 1.45;
		font-size: 0.95rem;
		max-width: 40rem;
	}

	.status {
		margin: 0.65rem 0 0;
		font-size: 0.85rem;
		color: var(--t-muted);
		min-height: 1.2em;
	}

	.empty {
		margin-top: 1.5rem;
		border: 1px dashed var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
		padding: 2.5rem 1.5rem;
		text-align: center;
		color: var(--t-muted);
	}

	.empty p {
		margin: 0 0 1rem;
	}

	.empty .fine {
		margin: 1rem 0 0;
		font-size: 0.78rem;
	}

	.cta {
		display: inline-block;
		border: 1px solid var(--t-accent);
		background: var(--t-accent);
		color: #fff;
		border-radius: 999px;
		padding: 0.55rem 1.2rem;
		font-size: 0.88rem;
		font-weight: 600;
		text-decoration: none;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.75rem;
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
	}

	.card {
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		background: var(--t-surface);
		overflow: hidden;
	}

	.card img {
		width: 100%;
		height: 10rem;
		object-fit: cover;
		display: block;
		background: var(--t-tint);
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.7rem 0.8rem 0.85rem;
	}

	.cat {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--t-muted);
	}

	.price {
		font-size: 0.82rem;
		color: var(--t-muted);
	}

	.actions {
		display: flex;
		gap: 0.45rem;
		margin-top: 0.45rem;
	}

	.try {
		flex: 1;
		border: 1px solid var(--t-accent);
		background: var(--t-accent);
		color: #fff;
		border-radius: 999px;
		padding: 0.45rem 0.8rem;
		font-size: 0.82rem;
		font-weight: 600;
	}

	.remove {
		border: 1px solid var(--t-line);
		background: transparent;
		color: var(--t-muted);
		border-radius: 999px;
		padding: 0.45rem 0.8rem;
		font-size: 0.82rem;
	}

	@media (max-width: 860px) {
		.wish-page {
			width: calc(100% - 1.5rem);
		}
	}
</style>
