<script lang="ts">
	import type { Snippet } from 'svelte';
	import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';

	/** Stands in for the wishlist page contexts that a story's real gift card or row reads. */
	let { children }: { children: Snippet } = $props();

	const getWishlistId = () => 'gift-story-wishlist';
	const getGifts = () => [];
	const getRole = () => WISHLIST_ROLES.visitor;
	const getIsArchived = () => false;
	const getIsAuthenticated = () => true;
	const getLikedIds = () => [];
	const requireAuth = () => {};
	const getReleaseCapability = () => RESERVATION_RELEASE_CAPABILITY.none;
	const getReservationsForGift = () => [];
	const releaseReservation = async () => false;

	setLikesContext(getLikedIds, getIsAuthenticated, requireAuth);
	setGiftsContext(
		getWishlistId,
		getGifts,
		getRole,
		getIsArchived,
		getIsAuthenticated,
		getLikedIds,
	);
	setReservationsContext(getReleaseCapability, getReservationsForGift, releaseReservation);
</script>

{@render children()}
