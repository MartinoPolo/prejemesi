<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
	import {
		RESERVATION_RELEASE_CAPABILITY,
		type ReservationReleaseCapability,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { provideGiftGalleryPositions } from '$lib/modules/gifts/gift_gallery_positions.js';
	import GiftDetailModal from './GiftDetailModal.svelte';

	/** Test-only harness: the Gift viewer's actions read the wishlist page contexts. */
	type GiftDetailModalTestHostProps = ComponentProps<typeof GiftDetailModal> & {
		releaseCapability?: ReservationReleaseCapability;
		releaseLedger?: ReservationForModerator[];
		isAuthenticated?: boolean;
		/** The image the gift's card showed, as the wishlist page shares it with the viewer. */
		cardGalleryIndex?: number;
	};

	let {
		releaseCapability = RESERVATION_RELEASE_CAPABILITY.none,
		releaseLedger = [],
		isAuthenticated = true,
		cardGalleryIndex,
		...props
	}: GiftDetailModalTestHostProps = $props();

	const galleryPositions = provideGiftGalleryPositions();
	// svelte-ignore state_referenced_locally
	if (cardGalleryIndex !== undefined && props.gift != null) {
		galleryPositions.remember(props.gift.id, cardGalleryIndex);
	}

	setGiftsContext(
		() => props.wishlistId,
		() => (props.gift != null ? [props.gift] : []),
		() => props.role ?? 'visitor',
		() => props.isArchived ?? false,
		() => isAuthenticated,
		() => [],
	);
	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
	setReservationsContext(
		() => releaseCapability,
		() => releaseLedger,
		async () => false,
	);
</script>

<GiftDetailModal {...props} />
