<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import WishlistGiftDisplay from './WishlistGiftDisplay.svelte';

	let props: ComponentProps<typeof WishlistGiftDisplay> = $props();

	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
	setGiftsContext(
		() => 'test-wishlist',
		() => props.sections.flatMap((section) => section.gifts),
		() => props.role,
		() => props.isArchived,
		() => true,
		() => [],
	);
	setReservationsContext(
		() => RESERVATION_RELEASE_CAPABILITY.none,
		() => [],
		async () => false,
	);
</script>

<WishlistGiftDisplay {...props} />
