<script lang="ts">
	import { page } from '$app/state';
	import OutfitViewer from '$lib/OutfitViewer.svelte';
</script>

<svelte:head>
	<title>Look — OoTD</title>
</svelte:head>

<main class="page-container">
	<OutfitViewer id={page.params.id ?? ''} />
</main>

<style>
	.page-container {
		min-height: calc(100vh - 4.5rem);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2.5rem 1.5rem;
		box-sizing: border-box;
	}

	@media (max-width: 860px) {
		.page-container {
			padding: 1.25rem 0.75rem;
			min-height: auto;
		}
	}
</style>
