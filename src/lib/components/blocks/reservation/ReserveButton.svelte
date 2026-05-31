<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

	interface ReserveButtonProps {
		gift: GiftForVisitor;
		isArchived?: boolean;
		size?: 'md' | 'sm';
		onreserve?: (gift: GiftForVisitor) => void;
	}

	let { gift, isArchived = false, size = 'sm', onreserve }: ReserveButtonProps = $props();

	const isFullyReserved = $derived(gift.isFullyReserved);

	function handleClick(event: MouseEvent) {
		event.stopPropagation();
		if (!isFullyReserved && !isArchived) {
			onreserve?.(gift);
		}
	}
</script>

{#if !isArchived}
	<Button
		{size}
		intent={isFullyReserved ? 'outline' : 'primary'}
		disabled={isFullyReserved}
		aria-label="Rezervovat {gift.name}"
		onclick={handleClick}
	>
		{#if isFullyReserved}
			Rezervovano
		{:else}
			Rezervovat
		{/if}
	</Button>
{/if}
