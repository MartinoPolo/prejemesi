<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import GiftListItem from './GiftListItem.svelte';

	/** Test/story-only harness — see GiftCardTestHost.svelte for why this is needed. */
	let props: ComponentProps<typeof GiftListItem> = $props();

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
	// No release reach in isolation: these harnesses exercise the card/row itself, not the
	// administrator override (see ReleaseReservationTestHost.svelte for that flow).
	setReservationsContext(
		() => RESERVATION_RELEASE_CAPABILITY.none,
		() => [],
		async () => false,
	);
</script>

<GiftListItem {...props} />
