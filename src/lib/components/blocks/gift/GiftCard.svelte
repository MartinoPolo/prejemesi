<script lang="ts">
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import GiftLinkList from '$lib/components/blocks/gift/GiftLinkList.svelte';
	import GiftStateOverlay from '$lib/components/blocks/gift/GiftStateOverlay.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import { formatPrice } from '$lib/modules/gifts/gift_display.js';
	import {
		deriveGiftBrowseActions,
		deriveGiftDisplayState,
	} from '$lib/modules/gifts/gift_display_state.js';
	import { canLikeGift } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { useGifts } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import { hasExplicitFrameFill } from '$lib/components/derived/image-frame/index.js';
	import { cn } from '$lib/utils.js';
	import { giftCardVariants } from './gift_card_variants.js';
	import { GIFT_CARD_CONTROL_SELECTOR } from './gift_card_controls.js';
	import GiftDescription from './GiftDescription.svelte';
	import GiftCategoryBadge from './GiftCategoryBadge.svelte';
	import GiftPriorityBadge from './GiftPriorityBadge.svelte';
	import GiftBrowseActions from './GiftBrowseActions.svelte';
	import GiftLivePreviewBadge from './GiftLivePreviewBadge.svelte';
	import { GIFT_LIVE_PREVIEW } from '$lib/components/blocks/change-proposals/change_row_model.js';
	import { giftLivePreviewMarks } from '$lib/components/blocks/change-proposals/gift_live_preview.js';
	import { restingShadowNesting } from '$lib/utils/resting_shadow_nesting.js';
	import type { GiftPresentationProps } from './gift_presentation_props.js';

	interface GiftCardProps extends GiftPresentationProps {
		allowArchivedLike?: boolean;
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
		livePreview,
	}: GiftCardProps = $props();

	const previewMarks = $derived(giftLivePreviewMarks(livePreview));
	const showsTopOverlays = $derived(
		!contextualMode || gift.category != null || previewMarks.proposed,
	);

	const giftsContext = useGifts();

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
	const { visitorGift, isFullyReserved } = $derived(displayState);
	const presentation = $derived(displayState.presentation);
	const browseActions = $derived(
		deriveGiftBrowseActions({
			role,
			visitorGift,
			isFullyReserved,
			isArchived,
			isAuthenticated: giftsContext.isAuthenticated.current,
			contextualMode,
			canMarkReceived: onreceived !== undefined,
		}),
	);
	let actionContentWidth = $state(0);
	let pressStartedOnControl = $state(false);

	function recordPressOrigin(event: PointerEvent & { currentTarget: HTMLDivElement }) {
		const control =
			event.target instanceof Element
				? event.target.closest(GIFT_CARD_CONTROL_SELECTOR)
				: null;
		pressStartedOnControl = control !== null && event.currentTarget.contains(control);
	}

	const isDimmed = $derived(presentation.isDimmed || previewMarks.deletion);
	const styles = $derived(giftCardVariants({ dimmed: isDimmed }));

	const imageSrc = $derived(resolveGiftImageUrl(gift.imageUrl, gift.imageKey));
	const explicitImageFrameFill = $derived.by(() => {
		const fillColor = gift.imageMeta?.bgColor;
		return hasExplicitFrameFill(fillColor) ? fillColor : null;
	});
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const hasDescriptionContent = $derived(
		(gift.description ?? '').trim() !== '' || gift.descriptionAppends.length > 0,
	);
</script>

{#snippet topOverlays()}
	<div
		class="gift-card-top-overlays absolute top-2 right-2 z-20 flex items-start gap-2"
		data-gift-card-top-overlays
	>
		{#if gift.category != null}
			<div class="min-w-0 flex-1" data-gift-card-category-zone>
				<GiftCategoryBadge category={gift.category} {isDimmed} />
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
		{#if previewMarks.proposed && livePreview !== undefined}
			<GiftLivePreviewBadge kind={livePreview} class="ml-auto" />
		{/if}
	</div>
{/snippet}

<div
	class={styles.card()}
	data-testid="gift-card-surface"
	data-gift-actions-open={moreOpen ? moreSurface : undefined}
	data-gift-control-press={pressStartedOnControl || undefined}
	data-live-preview={livePreview}
	onpointerdowncapture={recordPressOrigin}
>
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

			<div
				class="absolute inset-x-0 top-0 bottom-(--border-w) flex items-center justify-center"
			>
				<div class={styles.cropComposition()} data-testid="gift-card-crop-composition">
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

			<!-- The photo bleeds beneath this foreground separator; clipping it at the border
			     edge would blend the mat into a pale line at fractional device pixels. -->
			<div
				class={styles.separator()}
				data-testid="gift-card-image-separator"
				aria-hidden="true"
			></div>

			{#if showsTopOverlays}
				{@render topOverlays()}
			{/if}

			{#if previewMarks.deletion}
				<div
					class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
				>
					<GiftLivePreviewBadge kind={GIFT_LIVE_PREVIEW.deletion} />
				</div>
			{:else}
				<GiftStateOverlay entries={presentation.overlay} avoidTopRight />
			{/if}
			<GiftPriorityBadge
				priorityLabel={gift.priorityLabel}
				{showPriority}
				{isDimmed}
				class="absolute bottom-3 left-3 z-20 max-w-[calc(100%-1.5rem)]"
			/>
		</div>

		<!-- Body -->
		<div class={styles.body()} data-testid="gift-card-body">
			<!-- Name + piece count. Edited-after-share info surfaces only as a muted line
		     in the gift detail modal (issue #185), not on the card. -->
			<div class={styles.nameRow()} data-gift-card-track="title">
				<h3
					class={cn(styles.name(), previewMarks.deletion && 'line-through decoration-2')}
					title={gift.name}
				>
					{gift.name}
				</h3>
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

		{#if !contextualMode && !previewMarks.actionless && (browseActions.primaryAction !== undefined || (onmore && persistentMore))}
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
					<GiftBrowseActions
						{gift}
						{visitorGift}
						{role}
						{isArchived}
						actions={browseActions}
						contentWidth={actionContentWidth}
						{onreserve}
						{onunreserve}
						{onreceived}
						{receivedPending}
						{onmore}
						{persistentMore}
						{moreOpen}
						{moreSurface}
					/>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* The chat's live preview: a proposed edit is outlined, a proposed new gift is a ghost card. */
	.gift-card-root[data-live-preview='edit'] {
		outline: 2.5px dashed var(--brand);
		outline-offset: 4px;
	}

	.gift-card-root[data-live-preview='creation'] :global(.gift-card-painted-surface) {
		border-style: dashed;
		border-color: var(--brand);
		background: color-mix(in oklab, var(--brand) 7%, var(--card));
		box-shadow: none;
	}

	.gift-card-root[data-live-preview='creation'] :global(.gift-card-painted-surface::after) {
		display: none;
	}

	.gift-card-root[data-live-preview='creation'] [data-testid='gift-card-image-separator'] {
		background: var(--brand);
	}

	:global([data-gift-card-tracks-aligned='true'] .gift-card-root),
	:global([data-gift-card-tracks-aligned='true'] .gift-card-painted-surface) {
		height: 100%;
	}

	:global([data-gift-card-has-descriptions='true']) [data-gift-card-track='description'] {
		padding-top: 0.125rem;
	}

	.gift-card-top-overlays {
		left: var(--gift-context-leading-clearance, 0.5rem);
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
