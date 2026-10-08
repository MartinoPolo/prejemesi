<script lang="ts">
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import PurchasedToggle from './PurchasedToggle.svelte';

	interface Props {
		gift: GiftForVisitor;
		isAuthenticated?: boolean;
		isArchived?: boolean;
	}

	let { gift, isAuthenticated = true, isArchived = false }: Props = $props();

	setGiftsContext(
		() => gift.wishlistId,
		() => [gift],
		() => 'visitor',
		() => isArchived,
		() => isAuthenticated,
		() => [],
	);
</script>

<PurchasedToggle {gift} />
