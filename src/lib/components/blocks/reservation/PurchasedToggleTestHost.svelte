<script lang="ts">
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import PurchasedToggle from './PurchasedToggle.svelte';

	interface Props {
		gift: GiftForVisitor;
		isAuthenticated?: boolean;
	}

	let { gift, isAuthenticated = true }: Props = $props();

	setGiftsContext(
		() => gift.wishlistId,
		() => [gift],
		() => 'visitor',
		() => false,
		() => isAuthenticated,
		() => [],
	);
</script>

<PurchasedToggle {gift} />
