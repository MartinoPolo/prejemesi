<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import GiftLinkList from '$lib/components/blocks/gift/GiftLinkList.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		formatReserverLine,
		getPriorityDisplay,
	} from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { giftCardVariants } from './gift_card_variants.js';
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
	// Edit-icon hover affordance (issue #125 REQ-3): editing roles see a pencil icon appear
	// on card hover/focus; visitors rely on the shared cursor-pointer + hover lift only.
	const canManage = $derived(canManageWishlist(role));

	// Dimmed = "don't buy this": fully reserved (visitor/moderator only — the
	// recipient never sees reservation state) or already received.
	const isDimmed = $derived((isVisitorOrModerator && isFullyReserved) || gift.received);

	const styles = $derived(giftCardVariants({ dimmed: isDimmed }));

	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
</script>

<div class={styles.card()}>
	<!-- Image area: dotted mat behind the photo; letterboxed photos keep the mat visible -->
	<div class={styles.imageArea()}>
		<div class={styles.imagePattern()} aria-hidden="true"></div>

		<GiftImage
			class="size-full rounded-none bg-transparent"
			imageUrl={gift.imageUrl}
			imageMeta={gift.imageMeta}
			target="square"
			alt={gift.name}
			variant="card"
		/>

		{#if isDimmed}
			<div class={styles.imageVeil()} aria-hidden="true"></div>
		{/if}

		{#if canManage}
			<!-- Edit affordance (issue #125 REQ-3): hidden until the card is hovered/focused;
			     purely decorative, the whole card is already the click target via
			     WishlistGiftDraggableWrapper. -->
			<span class={styles.editIcon()} aria-hidden="true">
				<PencilIcon class="size-3.5" />
			</span>
		{/if}

		{#if isVisitorOrModerator && isFullyReserved}
			<span class={styles.reservedSticker()}>
				<span class={styles.reservedStickerLabel()}>
					<CheckIcon class="size-3.5" />
					{m.gift_reserved_overlay()}
				</span>
				{#if reserverLine !== null}
					<small class={styles.reservedStickerNames()}>{reserverLine}</small>
				{/if}
			</span>
		{/if}

		{#if gift.received}
			<span class={styles.receivedSticker()}>
				<CheckIcon class="size-3" />
				{m.gift_received_badge()}
			</span>
		{/if}
	</div>

	<!-- Body -->
	<div class={styles.body()}>
		<!-- Name + piece count. Edited-after-share info surfaces only as a muted line
		     in the gift detail modal (issue #185), not on the card. -->
		<div class={styles.nameRow()}>
			<h3 class={styles.name()}>{gift.name}</h3>
			<GiftPieceCount quantity={gift.quantity} {role} {reservedCount} hideWhenOne />
		</div>

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
			maxVisibleAppends={1}
			class="row-start-5 mt-3"
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
