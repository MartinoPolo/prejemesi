<script lang="ts">
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import GiftLinkList from '$lib/components/blocks/gift/GiftLinkList.svelte';
	import GiftStateOverlay from '$lib/components/blocks/gift/GiftStateOverlay.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import GiftReceivedToggle from './GiftReceivedToggle.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { formatPrice, formatReserverLine } from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import {
		canLikeGift,
		canManageWishlist,
		canSeeReserverNames,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import { hasExplicitFrameFill } from '$lib/components/derived/image-frame/index.js';
	import { cn } from '$lib/utils.js';
	import { giftCardVariants } from './gift_card_variants.js';
	import GiftDescription from './GiftDescription.svelte';
	import GiftCategoryBadge from './GiftCategoryBadge.svelte';
	import GiftPriorityBadge from './GiftPriorityBadge.svelte';
	import GiftActionRow from './GiftActionRow.svelte';
	import { restingShadowNesting } from '$lib/utils/resting_shadow_nesting.js';
	import type { GiftActionPlacementSnapshot } from '$lib/components/blocks/wishlist/gift_context_invocation.js';

	interface GiftCardProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		hideReservationState?: boolean;
		contextualMode?: boolean;
		allowArchivedLike?: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		onreceived?: (giftId: string, received: boolean) => void;
		receivedPending?: boolean;
		onmore?: (
			anchor: HTMLButtonElement,
			placementSnapshot: GiftActionPlacementSnapshot,
		) => void;
		persistentMore?: boolean;
		moreOpen?: boolean;
		moreSurface?: 'menu' | 'dialog';
		showPriority?: boolean;
	}

	let {
		gift,
		role,
		isArchived = false,
		hideReservationState = role === 'recipient',
		contextualMode = false,
		allowArchivedLike = false,
		onreserve,
		onunreserve,
		onreceived,
		receivedPending = false,
		onmore,
		persistentMore = onmore !== undefined,
		moreOpen = false,
		moreSurface = 'menu',
		showPriority = true,
	}: GiftCardProps = $props();

	const displayState = $derived(
		deriveGiftDisplayState(
			gift,
			role,
			hideReservationState,
			{
				canLike:
					canLikeGift(role) &&
					!hideReservationState &&
					!contextualMode &&
					(!isArchived || allowArchivedLike),
				isArchived: isArchived && !allowArchivedLike,
			},
			contextualMode,
		),
	);
	const { isVisitorOrModerator, visitorGift, isFullyReserved } = $derived(displayState);
	const presentation = $derived(displayState.presentation);
	const hasReservationAction = $derived(
		visitorGift !== null &&
			(visitorGift.myReservationId !== null || (!isArchived && !isFullyReserved)),
	);
	const canManage = $derived(canManageWishlist(role) && !contextualMode);
	const hasReceivedPrimary = $derived(canManage && !isArchived && onreceived !== undefined);
	const hasMultipleActions = $derived(
		hasReceivedPrimary && isVisitorOrModerator && hasReservationAction,
	);
	let actionContentWidth = $state(0);

	const isDimmed = $derived(presentation.isDimmed);
	const styles = $derived(giftCardVariants({ dimmed: isDimmed }));

	const imageSrc = $derived(resolveGiftImageUrl(gift.imageUrl, gift.imageKey));
	const explicitImageFrameFill = $derived.by(() => {
		const fillColor = gift.imageMeta?.bgColor;
		return hasExplicitFrameFill(fillColor) ? fillColor : null;
	});
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
	const visibleReserverLine = $derived(
		canSeeReserverNames(role) && reserverLine !== null && reserverLine.trim() !== ''
			? reserverLine
			: null,
	);
	const hasDescriptionContent = $derived(
		(gift.description ?? '').trim() !== '' || gift.descriptionAppends.length > 0,
	);
</script>

<div class={styles.card()} data-testid="gift-card-surface">
	<div class={styles.surface()} use:restingShadowNesting data-slot="elevation-surface">
		<!-- Image area: dotted mat behind the photo; letterboxed photos keep the mat visible -->
		<div
			class={cn(
				styles.imageArea(),
				'[container-type:inline-size]',
				explicitImageFrameFill !== null && 'bg-[var(--frame-fill)]',
			)}
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

			<div class="absolute inset-x-0 top-0 bottom-[2.5px] flex items-center justify-center">
				<div
					class="aspect-[4/3] w-[calc(100%+3px)] shrink-0"
					data-testid="gift-card-crop-composition"
				>
					<GiftImage
						class="size-full rounded-none bg-transparent max-sm:[&_img]:p-0"
						imageUrl={imageSrc}
						imageMeta={gift.imageMeta}
						target="square"
						alt={gift.name}
						variant="card"
					/>
				</div>
			</div>

			{#if isDimmed}
				<div class={styles.imageVeil()} aria-hidden="true"></div>
			{/if}

			<!-- The photo bleeds beneath this foreground separator; clipping it at the border
			     edge would blend the mat into a pale line at fractional device pixels. -->
			<div
				class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[3.5px] bg-ink"
				data-testid="gift-card-image-separator"
				aria-hidden="true"
			></div>

			{#if !contextualMode}
				<div
					class="gift-card-top-overlays absolute top-2 right-2 left-2 z-20 flex items-start gap-2"
					data-gift-card-top-overlays
				>
					{#if gift.category != null}
						<div class="min-w-0 flex-1" data-gift-card-category-zone>
							<GiftCategoryBadge category={gift.category} />
						</div>
					{/if}
					{#if presentation.showLike && visitorGift}
						<LikeButton
							giftId={gift.id}
							giftName={gift.name}
							likeCount={visitorGift.likeCount}
							class="ml-auto"
						/>
					{/if}
				</div>
			{/if}

			<GiftStateOverlay
				model={presentation.overlay}
				identity={visibleReserverLine}
				avoidTopRight
			/>
			<GiftPriorityBadge
				priorityLabel={gift.priorityLabel}
				{showPriority}
				class="absolute bottom-3 left-3 z-20 max-w-[calc(100%-1.5rem)]"
			/>
		</div>

		<!-- Body -->
		<div class={styles.body()}>
			<!-- Name + piece count. Edited-after-share info surfaces only as a muted line
		     in the gift detail modal (issue #185), not on the card. -->
			<div class={styles.nameRow()} data-gift-card-track="title">
				<h3 class={styles.name()} title={gift.name}>{gift.name}</h3>
				<span class="flex h-[1.3rem] shrink-0 items-center sm:h-[1.95rem]">
					<GiftPieceCount quantity={gift.quantity} role="recipient" hideWhenOne />
				</span>
			</div>

			<div
				class="[min-height:var(--gift-card-description-track-height,auto)] data-[has-content=true]:pt-0.5"
				data-gift-card-track="description"
				data-has-content={hasDescriptionContent ? 'true' : 'false'}
				data-testid={hasDescriptionContent ? 'gift-card-description-stack' : undefined}
			>
				{#if hasDescriptionContent}
					<GiftDescription
						description={gift.description}
						descriptionAppends={gift.descriptionAppends}
						preview
						descriptionClass="line-clamp-2 sm:line-clamp-1"
					/>
				{/if}
			</div>

			<div
				class="mt-2 min-w-0 [min-height:var(--gift-card-links-track-height,auto)]"
				data-gift-card-track="links"
				data-testid="gift-card-links"
			>
				<div class={styles.linkList()}>
					<GiftLinkList links={gift.links} maxVisible={3} />
				</div>
			</div>
			<div
				class="mt-1 min-w-0 [min-height:var(--gift-card-price-track-height,auto)]"
				data-gift-card-track="price"
				data-testid="gift-card-price"
			>
				{#if gift.price !== null}
					<span class={styles.price()}>{priceDisplay}</span>
				{:else}
					<span class={styles.priceEmpty()}>{priceDisplay}</span>
				{/if}
			</div>
		</div>

		{#if !contextualMode && (hasReceivedPrimary || (isVisitorOrModerator && hasReservationAction) || (onmore && persistentMore))}
			<div
				class={styles.footer()}
				data-gift-card-track="actions"
				data-testid="gift-card-footer"
			>
				<div
					bind:clientWidth={actionContentWidth}
					data-testid="gift-card-reservation-actions"
					class={styles.reservationActions()}
				>
					{#snippet secondaryReceivedAction()}
						<GiftReceivedToggle
							giftId={gift.id}
							received={gift.received}
							{role}
							{isArchived}
							{onreceived}
							pending={receivedPending}
							compactLabel
						/>
					{/snippet}
					<GiftActionRow
						{onmore}
						{moreOpen}
						{moreSurface}
						{persistentMore}
						contentWidth={actionContentWidth}
						secondary={hasMultipleActions ? secondaryReceivedAction : undefined}
						secondaryAction={hasMultipleActions ? 'received' : undefined}
						primaryAction={hasReservationAction && visitorGift
							? visitorGift.myReservationId === null
								? 'reserve'
								: 'cancel-reservation'
							: hasReceivedPrimary
								? 'received'
								: undefined}
						controlSizing="intrinsic"
					>
						{#if !canManage && isVisitorOrModerator && visitorGift && onmore === undefined}
							<PurchasedToggle gift={visitorGift} class="w-full max-sm:hidden" />
						{/if}
						{#if hasMultipleActions && visitorGift}
							<ReserveButton
								gift={visitorGift}
								{isArchived}
								{onreserve}
								{onunreserve}
							/>
						{:else if hasReceivedPrimary}
							<GiftReceivedToggle
								giftId={gift.id}
								received={gift.received}
								{role}
								{isArchived}
								{onreceived}
								pending={receivedPending}
								compactLabel
							/>
						{:else if isVisitorOrModerator && visitorGift}
							<ReserveButton
								gift={visitorGift}
								{isArchived}
								{onreserve}
								{onunreserve}
							/>
						{/if}
					</GiftActionRow>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	:global([data-gift-card-tracks-aligned='true'] .gift-card-root),
	:global([data-gift-card-tracks-aligned='true'] .gift-card-painted-surface) {
		height: 100%;
	}

	:global([data-gift-card-has-descriptions='true']) [data-gift-card-track='description'] {
		padding-top: 0.125rem;
	}

	@container (width <= 10rem) {
		.gift-card-top-overlays {
			top: 0;
		}
	}

	:global([data-gift-card-image-crowded='true']) .gift-card-top-overlays {
		flex-wrap: wrap;
	}

	:global([data-gift-card-image-crowded='true']) [data-gift-card-category-zone] {
		flex-basis: 100%;
	}
</style>
