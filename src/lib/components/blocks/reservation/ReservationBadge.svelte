<script lang="ts">
	import { Badge } from '$lib/components/base/badge/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

	interface ReservationBadgeProps {
		gift: GiftForVisitor;
	}

	let { gift }: ReservationBadgeProps = $props();

	const maxQuantity = $derived(gift.quantity ?? 1);
	const showPartial = $derived(
		gift.reservedCount > 0 && !gift.isFullyReserved && maxQuantity > 1,
	);

	const label = $derived.by(() => {
		if (gift.isFullyReserved) {
			return 'Rezervovano';
		}
		if (showPartial) {
			return `${gift.reservedCount}/${maxQuantity}`;
		}
		return '';
	});
</script>

{#if gift.isFullyReserved}
	<Badge
		tone="neutral"
		badgeStyle="subtle"
		class="bg-reserved/15 text-reserved gap-1 border-reserved/25"
	>
		<CheckIcon class="size-3" />
		{label}
	</Badge>
{:else if showPartial}
	<Badge
		tone="neutral"
		badgeStyle="subtle"
		class="bg-reserved/15 text-reserved border-reserved/25"
	>
		{label}
	</Badge>
{/if}
