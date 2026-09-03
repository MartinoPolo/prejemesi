<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/base/button/index.js';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftReservedSticker from '$lib/components/blocks/gift/GiftReservedSticker.svelte';
	import GiftStateOverlay from '$lib/components/blocks/gift/GiftStateOverlay.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import GiftReceivedToggle from './GiftReceivedToggle.svelte';
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
	import {
		canLikeGift,
		canManageWishlist,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import { cn } from '$lib/utils.js';
	import GiftDescription from './GiftDescription.svelte';
	import { useNarrowViewportState } from '$lib/components/derived/narrow_viewport_state.svelte.js';

	interface GiftListItemProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		hideReservationState?: boolean;
		contextualMode?: boolean;
		showLikeCount?: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		onreceived?: (giftId: string, received: boolean) => void;
		onmore?: () => void;
	}

	let {
		gift,
		role,
		isArchived = false,
		hideReservationState = false,
		contextualMode = false,
		showLikeCount = false,
		onreserve,
		onunreserve,
		onreceived,
		onmore,
	}: GiftListItemProps = $props();

	const narrowViewportState = useNarrowViewportState();
	const displayState = $derived(
		deriveGiftDisplayState(
			gift,
			role,
			hideReservationState || contextualMode,
			{
				canLike: canLikeGift(role) && !hideReservationState && !contextualMode,
				isArchived,
			},
			contextualMode,
		),
	);
	const { isVisitorOrModerator, visitorGift, isFullyReserved, reservedCount } =
		$derived(displayState);
	const presentation = $derived(displayState.presentation);
	// Edit-icon hover affordance (issue #125 REQ-3): mirrors GiftCard's manager-only pencil icon.
	const canManage = $derived(canManageWishlist(role) && !contextualMode);
	const isDimmed = $derived(presentation.isDimmed);
	const hasDesktopAction = $derived(
		presentation.showLike ||
			(canManage && !isArchived && onreceived !== undefined) ||
			(isVisitorOrModerator &&
				visitorGift != null &&
				(visitorGift.myReservationId != null || (!isArchived && !isFullyReserved))),
	);

	const primaryLink = $derived(getPrimaryGiftLink(gift.links));
	const domain = $derived(extractGiftDomain(gift.links));
	const safeGiftUrl = $derived(normalizeGiftUrl(primaryLink?.url ?? null));
	const imageSrc = $derived(resolveGiftImageUrl(gift.imageUrl, gift.imageKey));
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
</script>

<div
	data-testid="gift-list-item"
	class="group grid h-32 grid-cols-[128px_minmax(0,1fr)] items-start gap-0 overflow-hidden rounded-panel border-2 border-ink bg-card shadow-sticker transition-colors sm:h-auto sm:grid-cols-[clamp(8rem,39vw,9.5rem)_minmax(0,1fr)] sm:items-center sm:gap-4 sm:overflow-visible sm:rounded-none sm:border-x-0 sm:border-t-0 sm:border-b sm:border-border sm:bg-transparent sm:py-3 sm:shadow-none sm:hover:bg-muted/50"
>
	<!-- 1:1 crop (#189, reverts the interim 4:3 list thumb from #183): large thumb
	     at every width (clamp maxes at 9.5rem for all viewports ≥ sm). -->
	<div
		data-testid="gift-list-image"
		class="relative aspect-square size-32 self-start border-r-2 border-ink sm:size-[clamp(8rem,39vw,9.5rem)] sm:border-0 sm:self-center"
	>
		<GiftImage
			class="size-full rounded-none sm:rounded-lg"
			imageUrl={imageSrc}
			imageMeta={gift.imageMeta}
			target="thumb"
			alt={gift.name}
			variant="listThumb"
		/>
		{#if isDimmed}
			<div
				data-testid="gift-reserved-veil"
				class="absolute inset-0 rounded-none bg-reserved-veil sm:rounded-lg"
				aria-hidden="true"
			></div>
		{/if}
		{#if canManage}
			<!-- Edit affordance (issue #125 REQ-3): decorative, the whole row is the click target. -->
			<span
				class="absolute -top-1.5 -right-1.5 hidden items-center justify-center rounded-full border-2 border-ink bg-card p-1 opacity-0 shadow-sticker transition-opacity duration-150 sm:flex group-hover:opacity-100 group-focus-within:opacity-100"
				aria-hidden="true"
			>
				<PencilIcon class="size-3" />
			</span>
		{/if}
		{#if !contextualMode && presentation.showLike && isVisitorOrModerator && visitorGift}
			<LikeButton
				giftId={gift.id}
				giftName={gift.name}
				likeCount={visitorGift.likeCount}
				size="md"
				showCount={showLikeCount}
				class={cn(
					'absolute right-1 top-1 z-20 size-10 min-h-10 justify-center rounded-full border-2 border-ink bg-card p-0 shadow-sticker sm:right-2 sm:top-auto sm:bottom-2',
					showLikeCount
						? 'h-(--size-control-md) min-w-(--size-control-md) gap-1 px-1.5'
						: 'size-(--size-control-md) p-0',
				)}
			/>
		{/if}
		{#if !contextualMode}
			{#if narrowViewportState.current}
				<GiftStateOverlay model={presentation.overlay} />
			{:else if isVisitorOrModerator && isFullyReserved}
				<GiftReservedSticker reserverLine={canManage ? reserverLine : null} />
			{/if}
		{/if}
	</div>

	<!-- Content and primary reservation action stay beside the image at every width. The dim
	     lives here (not on the row) so the reserved sticker on the thumb stays crisp. -->
	<div
		data-testid="gift-list-content"
		class={cn(
			'flex min-w-0 flex-col gap-0.5 self-stretch p-1.5 sm:gap-1 sm:p-0',
			isDimmed && 'opacity-55 grayscale-50',
		)}
	>
		<div class="flex items-start gap-1.5">
			<h3
				class="line-clamp-2 min-w-0 flex-1 font-heading text-base font-semibold leading-snug text-foreground"
			>
				{gift.name}
			</h3>
			<span class="max-sm:hidden">
				<GiftPieceCount
					quantity={gift.quantity}
					role={hideReservationState || contextualMode ? 'recipient' : role}
					{reservedCount}
					reservationAcknowledgementKey={visitorGift?.myReservationId ?? null}
					hideWhenOne
				/>
			</span>
			{#if !contextualMode && !narrowViewportState.current && gift.received}
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
					class={cn('text-[11px] max-sm:hidden', priorityInfo.colorClass)}
				>
					{priorityInfo.label()}
				</Badge>
			{/if}
		</div>

		<div class="max-sm:hidden">
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
		</div>

		{#if !contextualMode && narrowViewportState.current && role === 'moderator' && reserverLine !== null && reserverLine !== ''}
			<p class="truncate text-[11px] font-semibold text-muted-foreground">
				{reserverLine}
			</p>
		{/if}

		<GiftDescription
			description={gift.description}
			descriptionAppends={gift.descriptionAppends}
			showAppends={false}
			descriptionClass="line-clamp-1 max-sm:hidden"
		/>

		{#if !contextualMode && ((canManage && !isArchived && onreceived !== undefined) || (isVisitorOrModerator && visitorGift) || onmore)}
			<div
				class={cn(
					'mt-auto flex min-w-0 flex-row gap-1 self-end pt-0 sm:flex-col sm:gap-1.5 sm:pt-2',
					!hasDesktopAction && 'sm:hidden',
				)}
			>
				{#if onmore}
					<Button
						intent="outline"
						class="size-10 min-h-10 shrink-0 p-0 sm:hidden"
						aria-label={m.gift_more_actions()}
						onclick={(event) => {
							event.stopPropagation();
							onmore();
						}}><EllipsisIcon /></Button
					>
				{/if}
				{#if canManage && onreceived !== undefined}
					<GiftReceivedToggle
						giftId={gift.id}
						received={gift.received}
						{role}
						{isArchived}
						{onreceived}
						class="min-h-10 w-full"
					/>
				{/if}
				{#if isVisitorOrModerator && visitorGift}
					<PurchasedToggle gift={visitorGift} class="w-full max-sm:hidden" />
					<ReserveButton
						gift={visitorGift}
						{isArchived}
						size="md"
						{onreserve}
						{onunreserve}
						class={cn('min-h-10 w-full', canManage && 'max-sm:hidden')}
					/>
				{/if}
			</div>
		{/if}
	</div>
</div>
