<script lang="ts">
	import { cn } from '$lib/utils.js';
	import LikeButton from './LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import ReleaseReservationButton from '$lib/components/blocks/reservation/ReleaseReservationButton.svelte';
	import { giftDetailActionBarVariants } from './gift_detail_action_bar_variants.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

	interface GiftDetailActionBarProps {
		gift: GiftForVisitor;
		isArchived?: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		class?: string;
	}

	let {
		gift,
		isArchived = false,
		onreserve,
		onunreserve,
		class: className,
	}: GiftDetailActionBarProps = $props();

	const styles = giftDetailActionBarVariants();

	const isMine = $derived(gift.myReservationId !== null);
	// Reserved by someone else: the shared photo state badge already says so, so the bar keeps
	// only Like instead of a disabled reserve button.
	const isFullyReservedByOthers = $derived(gift.isFullyReserved && !isMine);
</script>

<div class={cn(styles.bar(), className)}>
	<LikeButton
		giftId={gift.id}
		giftName={gift.name}
		likeCount={gift.likeCount}
		appearance="sticker"
		class="mr-auto"
	/>
	{#if isMine}
		<PurchasedToggle {gift} />
	{/if}
	{#if !isFullyReservedByOthers}
		<div class={styles.primary()}>
			<ReserveButton {gift} {isArchived} {onreserve} {onunreserve} />
		</div>
	{/if}
	<!-- Managers use the edit form; this keeps the app-admin override reachable from
	     the read-only gift detail without restoring release controls to browse surfaces. -->
	<ReleaseReservationButton {gift} />
</div>
