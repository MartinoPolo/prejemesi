<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import GiftLinkList from '$lib/components/blocks/gift/GiftLinkList.svelte';
	import GiftReservedSticker from '$lib/components/blocks/gift/GiftReservedSticker.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import GiftReceivedToggle from './GiftReceivedToggle.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		formatReserverLine,
		getPriorityDisplay,
	} from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import { hasExplicitFrameFill } from '$lib/components/derived/image-frame/index.js';
	import { cn } from '$lib/utils.js';
	import { giftCardVariants } from './gift_card_variants.js';
	import GiftDescription from './GiftDescription.svelte';

	interface GiftCardProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		hideReservationState?: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		onreceived?: (giftId: string, received: boolean) => void;
	}

	let {
		gift,
		role,
		isArchived = false,
		hideReservationState = false,
		onreserve,
		onunreserve,
		onreceived,
	}: GiftCardProps = $props();

	const { isVisitorOrModerator, visitorGift, isFullyReserved, reservedCount } = $derived(
		deriveGiftDisplayState(gift, role, hideReservationState),
	);
	// Edit-icon hover affordance (issue #125 REQ-3): editing roles see a pencil icon appear
	// on card hover/focus; visitors rely on the shared cursor-pointer + hover lift only.
	const canManage = $derived(canManageWishlist(role));

	// Dimmed = "don't buy this": fully reserved (visitor/moderator only — the
	// recipient never sees reservation state) or already received.
	const isDimmed = $derived((isVisitorOrModerator && isFullyReserved) || gift.received);

	const styles = $derived(giftCardVariants({ dimmed: isDimmed }));

	const imageSrc = $derived(resolveGiftImageUrl(gift.imageUrl, gift.imageKey));
	const explicitImageFrameFill = $derived.by(() => {
		const fillColor = gift.imageMeta?.bgColor;
		return hasExplicitFrameFill(fillColor) ? fillColor : null;
	});
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
</script>

<div class={styles.card()}>
	<!-- Image area: dotted mat behind the photo; letterboxed photos keep the mat visible -->
	<div
		class={cn(styles.imageArea(), explicitImageFrameFill !== null && 'bg-[var(--frame-fill)]')}
		data-testid="gift-card-image-frame"
		style:--frame-fill={explicitImageFrameFill ?? undefined}
	>
		{#if explicitImageFrameFill === null}
			<div
				class={styles.imagePattern()}
				data-testid="gift-card-image-pattern"
				aria-hidden="true"
			></div>
		{/if}

		<GiftImage
			class="size-full rounded-none bg-transparent"
			imageUrl={imageSrc}
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
			<GiftReservedSticker {reserverLine} />
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
			<GiftPieceCount
				quantity={gift.quantity}
				role={hideReservationState ? 'recipient' : role}
				{reservedCount}
				reservationAcknowledgementKey={visitorGift?.myReservationId ?? null}
				hideWhenOne
			/>
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

	{#if (canManage && !isArchived && onreceived !== undefined) || (isVisitorOrModerator && visitorGift)}
		<div class={styles.footer()}>
			{#if isVisitorOrModerator && visitorGift}
				<LikeButton
					giftId={gift.id}
					giftName={gift.name}
					likeCount={visitorGift.likeCount}
				/>
			{/if}
			<div class={styles.reservationActions()}>
				{#if canManage && onreceived !== undefined}
					<GiftReceivedToggle
						giftId={gift.id}
						received={gift.received}
						{role}
						{isArchived}
						{onreceived}
						class="w-full"
					/>
				{/if}
				{#if isVisitorOrModerator && visitorGift}
					<PurchasedToggle gift={visitorGift} class="w-full" />
					<ReserveButton
						gift={visitorGift}
						{isArchived}
						size="md"
						{onreserve}
						{onunreserve}
						class="w-full"
					/>
				{/if}
			</div>
		</div>
	{/if}
</div>
