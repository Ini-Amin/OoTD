<script lang="ts">
	import type { Category } from '$lib/pieces';

	let { category, size = 22 }: { category: Category; size?: number } = $props();

	const paths: Record<Category, string> = {
		hat: 'M5 15c0-4 3-8 7-8s7 4 7 8M2 17c4 2.5 16 2.5 20 0M5 15h14',
		top: 'M8 4 3 7l2 4 3-1v10h8V10l3 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z',
		bottom: 'M7 3h10l1 18h-4l-2-10-2 10H6L7 3zM7 7h10',
		shoes: 'M3 16c0-2 1-3 3-3l3-4 3 3h3c3 0 6 1 6 4v2H3v-2zM3 18h18',
		bag: 'M5 8h14l1 12H4L5 8zM9 8V6a3 3 0 0 1 6 0v2',
		accessory: 'M7 4h10l4 5-9 11L3 9l4-5zM3 9h18M9 4l3 5 3-5'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d={paths[category]} />
</svg>
