<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import GiftDetailModal from './GiftDetailModal.svelte';

	/** Test-only harness: the read-only detail's action bar reads the wishlist page contexts. */
	let props: ComponentProps<typeof GiftDetailModal> = $props();

	setGiftsContext(
		() => props.wishlistId,
		() => (props.gift ? [props.gift] : []),
		() => props.role ?? 'visitor',
		() => props.isArchived ?? false,
		() => true,
		() => [],
	);
	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
	setReservationsContext(
		() => RESERVATION_RELEASE_CAPABILITY.none,
		() => [],
		async () => false,
	);
</script>

<GiftDetailModal {...props} />
