<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import GiftCard from './GiftCard.svelte';

	/**
	 * Test/story-only harness: `GiftCard`'s footer (`LikeButton` + `PurchasedToggle`) reads
	 * `useLikes()`/`useGifts()`, which only the real wishlist page (`/w/[id]/+page.svelte`)
	 * provides via `setLikesContext`/`setGiftsContext`. This stands in for that page so
	 * `GiftCard` can be rendered in isolation.
	 */
	let props: ComponentProps<typeof GiftCard> = $props();

	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
	setGiftsContext(
		() => [props.gift],
		() => props.role,
		() => props.isArchived ?? false,
		() => true,
		() => [],
	);
</script>

<GiftCard {...props} />
