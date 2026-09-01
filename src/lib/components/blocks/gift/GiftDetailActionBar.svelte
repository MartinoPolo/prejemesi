<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import LikeButton from './LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import ReleaseReservationButton from '$lib/components/blocks/reservation/ReleaseReservationButton.svelte';
	import { formatReserverLine } from '$lib/modules/gifts/gift_display.js';
	import { giftDetailActionBarVariants } from './gift_detail_action_bar_variants.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

	interface GiftDetailActionBarProps {
		gift: GiftForVisitor;
		isArchived?: boolean;
		/**
		 * `overlay`: the photo-corner reservation status stack (own + others').
		 * `bar`: the pinned like + primary action row. Two mount points of the
		 * SAME component so all reservation-state presentation (SUMMARY.md)
		 * lives in one place, even though they render in different parents of
		 * the view-mode grid (media column vs. the grid's pinned `auto` row).
		 */
		placement: 'overlay' | 'bar';
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		class?: string;
	}

	let {
		gift,
		isArchived = false,
		placement,
		onreserve,
		onunreserve,
		class: className,
	}: GiftDetailActionBarProps = $props();

	const styles = giftDetailActionBarVariants();

	const isMine = $derived(gift.myReservationId !== null);
	// Reserved by someone else: the bar's disabled "Rezervováno" branch is
	// suppressed here (status already lives on the photo overlay) — the bar
	// keeps only the like button in this state (SUMMARY.md rule 3).
	const isFullyReservedByOthers = $derived(gift.isFullyReserved && !isMine);
	const reserverLine = $derived(formatReserverLine(gift.reserverNames));
</script>

{#if placement === 'overlay'}
	{#if isMine}
		<div class={cn(styles.overlayStack(), className)}>
			<div class={styles.note()}>
				<CheckIcon class={styles.noteIcon()} />
				{m.gift_reserved_by_me_overlay()}
			</div>
			<PurchasedToggle {gift} class={styles.purchasedToggle()} />
		</div>
	{:else if isFullyReservedByOthers}
		<div class={cn(styles.overlayStack(), className)}>
			<div class={styles.note()}>
				<span class="inline-flex items-center gap-1">
					<CheckIcon class={styles.noteIcon()} />
					{m.gift_reserved_overlay()}
				</span>
				{#if reserverLine !== null}
					<span class={styles.noteSub()}>{reserverLine}</span>
				{/if}
			</div>
		</div>
	{/if}
{:else}
	<div class={cn(styles.bar(), className)}>
		<LikeButton
			giftId={gift.id}
			giftName={gift.name}
			likeCount={gift.likeCount}
			size="md"
			appearance="sticker"
			class="mr-auto"
		/>
		{#if !isFullyReservedByOthers}
			<div class={styles.primary()}>
				<ReserveButton {gift} {isArchived} size="md" {onreserve} {onunreserve} />
			</div>
		{/if}
		<!-- Managers use the edit form; this keeps the app-admin override reachable from
		     the read-only gift detail without restoring release controls to browse surfaces. -->
		<ReleaseReservationButton {gift} size="md" />
	</div>
{/if}
