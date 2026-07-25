<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		formatReserverLine,
		extractGiftDomain,
		getPriorityDisplay,
	} from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import { normalizeGiftUrl, getPrimaryGiftLink } from '$lib/modules/gifts/gift_url.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { cn } from '$lib/utils.js';
	import GiftDescription from './GiftDescription.svelte';

	interface GiftListItemProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
	}

	let { gift, role, isArchived = false, onreserve, onunreserve }: GiftListItemProps = $props();

	const { isVisitorOrModerator, visitorGift, isFullyReserved, reservedCount } = $derived(
		deriveGiftDisplayState(gift, role),
	);
	// Edit-icon hover affordance (issue #125 REQ-3): mirrors GiftCard's manager-only pencil icon.
	const canManage = $derived(canManageWishlist(role));

	const primaryLink = $derived(getPrimaryGiftLink(gift.links));
	const domain = $derived(extractGiftDomain(gift.links));
	const safeGiftUrl = $derived(normalizeGiftUrl(primaryLink?.url ?? null));
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
</script>

<div
	data-testid="gift-list-item"
	class={cn(
		'group grid grid-cols-[clamp(8rem,39vw,9.5rem)_minmax(0,1fr)] items-start gap-3 border-b border-border py-3 transition-colors hover:bg-muted/50 sm:items-center sm:gap-4',
		(isFullyReserved || gift.received) && 'opacity-55 grayscale-50',
	)}
>
	<!-- 1:1 crop (#189, reverts the interim 4:3 list thumb from #183): large thumb
	     at every width (clamp maxes at 9.5rem for all viewports ≥ sm). -->
	<div
		data-testid="gift-list-image"
		class="relative aspect-square w-[clamp(8rem,39vw,9.5rem)] self-start sm:self-center"
	>
		<GiftImage
			class="size-full rounded-lg"
			imageUrl={gift.imageUrl}
			imageMeta={gift.imageMeta}
			target="thumb"
			alt={gift.name}
			variant="listThumb"
		/>
		{#if canManage}
			<!-- Edit affordance (issue #125 REQ-3): decorative, the whole row is the click target. -->
			<span
				class="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full border-2 border-ink bg-card p-1 opacity-0 shadow-sticker transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
				aria-hidden="true"
			>
				<PencilIcon class="size-3" />
			</span>
		{/if}
		{#if isVisitorOrModerator && visitorGift}
			<LikeButton
				giftId={gift.id}
				giftName={gift.name}
				likeCount={visitorGift.likeCount}
				size="md"
				showCount={false}
				class="absolute right-2 bottom-2 z-10 size-(--size-control-md) justify-center rounded-full border-2 border-ink bg-card p-0 shadow-sticker"
			/>
		{/if}
	</div>

	<!-- Content and primary reservation action stay beside the image at every width. -->
	<div class="flex min-w-0 flex-col gap-1 self-stretch">
		<div class="flex items-start gap-1.5">
			<h3
				class="line-clamp-2 min-w-0 flex-1 font-heading text-base font-semibold leading-snug text-foreground"
			>
				{gift.name}
			</h3>
			<GiftPieceCount quantity={gift.quantity} {role} {reservedCount} hideWhenOne />
			{#if gift.received}
				<Badge tone="neutral" class="gap-1 text-[11px]">
					<CheckIcon class="size-2.5" />
					{m.gift_received_badge()}
				</Badge>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-1.5 text-sm">
			{#if gift.price !== null}
				<span class="font-bold text-primary">{priceDisplay}</span>
			{:else}
				<span class="text-muted-foreground">{priceDisplay}</span>
			{/if}

			{#if priorityInfo}
				<Badge
					tone="neutral"
					badgeStyle="subtle"
					class={cn('text-[11px]', priorityInfo.colorClass)}
				>
					{priorityInfo.label()}
				</Badge>
			{/if}

			{#if isFullyReserved && reserverLine !== null}
				<span class="text-xs font-semibold text-muted-foreground">{reserverLine}</span>
			{/if}
		</div>

		{#if domain}
			<a
				href={safeGiftUrl ?? '#'}
				target="_blank"
				rel="external noopener noreferrer"
				class="inline-flex min-w-0 items-center gap-1 truncate text-xs text-primary"
				onclick={(e: MouseEvent) => e.stopPropagation()}
			>
				<ExternalLinkIcon class="size-3 shrink-0" />
				<span class="truncate">{domain}</span>
				{#if gift.links.length > 1}
					<span class="shrink-0 text-muted-foreground"
						>{m.gift_link_overflow({ count: gift.links.length - 1 })}</span
					>
				{/if}
			</a>
		{:else}
			<span class="text-xs text-muted-foreground">{m.gift_link_none()}</span>
		{/if}

		<GiftDescription
			description={gift.description}
			descriptionAppends={gift.descriptionAppends}
			showAppends={false}
			descriptionClass="line-clamp-1"
		/>

		{#if isVisitorOrModerator && visitorGift}
			<!-- `self-end` (issue #211): this row's parent is a `flex-col` with the
			     default `align-items: stretch`, which would otherwise force this
			     wrapper to the full content width. Opting out lets it shrink-wrap to
			     its widest child (mirrors GiftCard's `reservationActions` slot) while
			     staying right-aligned like the previous single-row layout. -->
			<div class="mt-auto flex flex-col gap-1.5 self-end pt-2">
				<PurchasedToggle gift={visitorGift} class="w-full" />
				<ReserveButton
					gift={visitorGift}
					{isArchived}
					size="md"
					{onreserve}
					{onunreserve}
					class="w-full"
				/>
			</div>
		{/if}
	</div>
</div>
