<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import GiftLinkList from '$lib/components/blocks/gift/GiftLinkList.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { formatPrice, getPriorityDisplay } from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import { giftCardVariants } from './gift_card_variants.js';
	import GiftEditedBadge from './GiftEditedBadge.svelte';
	import GiftDescription from './GiftDescription.svelte';

	interface GiftCardProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
	}

	let { gift, role, isArchived = false, onreserve, onunreserve }: GiftCardProps = $props();

	const { isVisitorOrModerator, visitorGift, isFullyReserved, reservedCount } = $derived(
		deriveGiftDisplayState(gift, role),
	);

	const styles = $derived(giftCardVariants({ reserved: isFullyReserved }));

	const priceDisplay = $derived(formatPrice(gift.price, gift.currency));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
</script>

<div class={styles.card()}>
	<!-- Image area -->
	<div class={styles.imageArea()}>
		<GiftImage
			class="size-full"
			imageUrl={gift.imageUrl}
			imageMeta={gift.imageMeta}
			alt={gift.name}
		/>

		{#if isVisitorOrModerator && isFullyReserved}
			<div class={styles.reservedOverlay()}>
				<Badge
					tone="neutral"
					badgeStyle="subtle"
					class="bg-reserved/15 text-reserved gap-1 border-reserved/25"
				>
					<CheckIcon class="size-3" />
					{m.gift_reserved_overlay()}
				</Badge>
			</div>
		{/if}

		{#if gift.received}
			<div class="absolute top-2 right-2">
				<Badge tone="neutral" class="gap-1">
					<CheckIcon class="size-3" />
					{m.gift_received_badge()}
				</Badge>
			</div>
		{/if}
	</div>

	<!-- Body -->
	<div class={styles.body()}>
		<!-- Name + piece count -->
		<div class={styles.nameRow()}>
			<h3 class={styles.name()}>{gift.name}</h3>
			<GiftPieceCount quantity={gift.quantity} {role} {reservedCount} hideWhenOne />
		</div>

		<GiftEditedBadge editedAfterShareAt={gift.editedAfterShareAt} />

		{#if gift.price !== null}
			<span class={styles.price()}>{priceDisplay}</span>
		{:else}
			<span class={styles.priceEmpty()}>{priceDisplay}</span>
		{/if}

		<!-- Priority eyebrow -->
		{#if priorityInfo}
			<div class={styles.priorityEyebrow()}>
				<Badge tone="neutral" badgeStyle="subtle" class={priorityInfo.colorClass}>
					<span class="inline-flex items-baseline gap-1">
						<span class="text-[10px] uppercase opacity-60"
							>{m.gift_priority_eyebrow()}</span
						>
						<span class="opacity-40">&middot;</span>
						{priorityInfo.label()}
					</span>
				</Badge>
			</div>
		{/if}

		<!-- Links -->
		<div class={styles.linkList()}>
			<GiftLinkList links={gift.links} maxVisible={3} />
		</div>

		<GiftDescription
			description={gift.description}
			descriptionAppends={gift.descriptionAppends}
			class="mt-1"
		/>
	</div>

	<!-- Footer: like + reserve (visitor/moderator only) -->
	{#if isVisitorOrModerator && visitorGift}
		<div class={styles.footer()}>
			<LikeButton giftId={gift.id} giftName={gift.name} likeCount={visitorGift.likeCount} />
			<PurchasedToggle gift={visitorGift} />
			<ReserveButton gift={visitorGift} {isArchived} {onreserve} {onunreserve} />
		</div>
	{/if}
</div>
