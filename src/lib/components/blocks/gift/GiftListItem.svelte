<script lang="ts">
	import GiftListImage from '$lib/components/blocks/gift/GiftListImage.svelte';
	import GiftStateOverlay from '$lib/components/blocks/gift/GiftStateOverlay.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
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
	import { cn } from '$lib/utils.js';
	import GiftDescription from './GiftDescription.svelte';
	import GiftActionRow from './GiftActionRow.svelte';
	import GiftPriorityBadge from './GiftPriorityBadge.svelte';
	import GiftCategoryBadge from './GiftCategoryBadge.svelte';
	import GiftLinkList from './GiftLinkList.svelte';
	import { restingShadowNesting } from '$lib/utils/resting_shadow_nesting.js';
	import type { GiftActionPlacementSnapshot } from '$lib/components/blocks/wishlist/gift_context_invocation.js';

	interface GiftListItemProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		hideReservationState?: boolean;
		contextualMode?: boolean;
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
		onreserve,
		onunreserve,
		onreceived,
		receivedPending = false,
		onmore,
		persistentMore = onmore !== undefined,
		moreOpen = false,
		moreSurface = 'menu',
		showPriority = true,
	}: GiftListItemProps = $props();

	const displayState = $derived(
		deriveGiftDisplayState(
			gift,
			role,
			hideReservationState,
			{
				canLike: canLikeGift(role) && !hideReservationState && !contextualMode,
				isArchived,
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
	const imageSrc = $derived(resolveGiftImageUrl(gift.imageUrl, gift.imageKey));
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
	const visibleReserverLine = $derived(
		canSeeReserverNames(role) && reserverLine !== null && reserverLine.trim() !== ''
			? reserverLine
			: null,
	);

	function synchronizeListOverlayClearance(image: HTMLElement) {
		const item = image.parentElement;
		if (!(item instanceof HTMLElement)) {
			return;
		}
		const itemStyle = item.style;
		const wrapper = item.closest<HTMLElement>('[data-gift-item]');
		function contextualControls() {
			return (
				wrapper?.querySelectorAll<HTMLElement>(
					':scope > [data-testid="gift-selection-control"], :scope > button > .elevation-surface',
				) ?? []
			);
		}

		let animationFrame = 0;
		const resizeObserver = new ResizeObserver(schedule);
		const mutationObserver = new MutationObserver(refreshObservedElements);

		function schedule() {
			cancelAnimationFrame(animationFrame);
			animationFrame = requestAnimationFrame(measure);
		}

		function refreshObservedElements() {
			resizeObserver.disconnect();
			resizeObserver.observe(image);
			for (const control of contextualControls()) {
				resizeObserver.observe(control);
			}
			for (const element of image.querySelectorAll<HTMLElement>(
				'[data-testid="gift-category-badge"], [data-testid="gift-priority-badge"], [data-testid="gift-state-overlay"] > span',
			)) {
				resizeObserver.observe(element);
			}
			schedule();
		}

		function measure() {
			const imageRect = image.getBoundingClientRect();
			const category = image.querySelector<HTMLElement>(
				'[data-testid="gift-category-badge"]',
			);
			const priority = image.querySelector<HTMLElement>(
				'[data-testid="gift-priority-badge"]',
			);
			const overlay = image.querySelector<HTMLElement>('[data-testid="gift-state-overlay"]');
			const overlayItems = overlay?.querySelectorAll<HTMLElement>(':scope > span') ?? [];
			const rootFontSize = Number.parseFloat(
				getComputedStyle(document.documentElement).fontSize,
			);
			const separation = rootFontSize * 0.5;
			const categoryRect = category?.getBoundingClientRect();
			const priorityRect = priority?.getBoundingClientRect();
			const overlayGap = overlay
				? Number.parseFloat(getComputedStyle(overlay).rowGap) || 0
				: 0;
			const overlayHeight =
				Array.from(overlayItems).reduce(
					(total, element) => total + element.getBoundingClientRect().height,
					0,
				) +
				Math.max(0, overlayItems.length - 1) * overlayGap;
			const contextualClearance = Math.max(
				0,
				...Array.from(contextualControls(), (control) => {
					const rect = control.getBoundingClientRect();
					return rect.right > imageRect.left && rect.left < imageRect.right
						? rect.bottom - imageRect.top + separation
						: 0;
				}),
			);
			const startClearance = Math.max(
				contextualClearance,
				categoryRect
					? categoryRect.top - imageRect.top + categoryRect.height + separation
					: 0,
			);
			const endClearance = priorityRect
				? imageRect.bottom - priorityRect.bottom + priorityRect.height + separation
				: 0;
			const minimumHeight = Math.ceil(startClearance + overlayHeight + endClearance);
			const values = {
				'--gift-list-overlay-start-clearance': `${Math.ceil(startClearance)}px`,
				'--gift-list-overlay-end-clearance': `${Math.ceil(endClearance)}px`,
				'--gift-list-overlay-min-height': `${minimumHeight}px`,
			};
			for (const [property, value] of Object.entries(values)) {
				if (itemStyle.getPropertyValue(property) !== value) {
					itemStyle.setProperty(property, value);
				}
			}
		}

		mutationObserver.observe(wrapper ?? image, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		refreshObservedElements();
		measure();

		return {
			destroy() {
				cancelAnimationFrame(animationFrame);
				resizeObserver.disconnect();
				mutationObserver.disconnect();
				itemStyle.removeProperty('--gift-list-overlay-start-clearance');
				itemStyle.removeProperty('--gift-list-overlay-end-clearance');
				itemStyle.removeProperty('--gift-list-overlay-min-height');
			},
		};
	}
</script>

<div class="gift-list-query-container w-full">
	<div
		data-testid="gift-list-item"
		use:restingShadowNesting
		class={cn(
			'gift-list-item resting-shadow-nesting relative grid items-start gap-0 rounded-panel border-2 border-ink bg-card shadow-sticker',
			hasReceivedPrimary &&
				reserverLine !== null &&
				reserverLine !== '' &&
				'gift-list-item-manager-dense',
			hasMultipleActions && 'gift-list-item-multiple-actions',
			gift.category != null &&
				presentation.overlay !== null &&
				'gift-list-item-crowded-overlay',
		)}
	>
		<div
			data-testid="gift-list-image"
			use:synchronizeListOverlayClearance
			class="gift-list-image relative self-stretch overflow-hidden border-r-2 border-ink"
		>
			<GiftListImage imageUrl={imageSrc} imageMeta={gift.imageMeta} alt={gift.name} />
			{#if isDimmed}
				<div
					data-testid="gift-reserved-veil"
					class="absolute inset-0 bg-reserved-veil"
					aria-hidden="true"
				></div>
			{/if}
			{#if gift.category != null && !contextualMode}
				<div class="gift-list-category absolute top-2 right-2 left-2 z-20 min-w-0">
					<GiftCategoryBadge category={gift.category} {isDimmed} />
				</div>
			{/if}
			<GiftStateOverlay
				model={presentation.overlay}
				identity={visibleReserverLine}
				class={cn('gift-list-state-overlay', contextualMode && 'pt-[3.25rem]')}
			/>
			<GiftPriorityBadge
				priorityLabel={gift.priorityLabel}
				{showPriority}
				{isDimmed}
				class="absolute bottom-2 left-2 z-20 max-w-[calc(100%-1rem)]"
			/>
		</div>

		<div
			data-testid="gift-list-content"
			class="gift-list-content flex min-w-0 flex-col gap-0.5 self-stretch sm:gap-1"
		>
			<div
				class="flex min-w-0 items-start gap-1.5 font-heading text-[1rem] leading-[1.3] sm:text-[1.5rem]"
			>
				<h3
					class="gift-list-title line-clamp-2 min-w-0 flex-1 font-semibold text-foreground [overflow-wrap:anywhere] sm:line-clamp-1"
					title={gift.name}
				>
					{gift.name}
				</h3>
				<span class="flex h-[1lh] shrink-0 items-center">
					<GiftPieceCount quantity={gift.quantity} role="recipient" hideWhenOne />
				</span>
				{#if !contextualMode && presentation.showLike && isVisitorOrModerator && visitorGift}
					<span
						class="flex h-[1lh] min-w-(--size-control-lg) shrink-0 items-center justify-center"
					>
						<LikeButton
							giftId={gift.id}
							giftName={gift.name}
							likeCount={visitorGift.likeCount}
						/>
					</span>
				{/if}
			</div>

			<GiftDescription
				description={gift.description}
				descriptionAppends={gift.descriptionAppends}
				preview
				class="gift-list-description"
				descriptionClass="line-clamp-2 sm:line-clamp-1"
			/>

			<div class="mt-1.5 min-w-0" data-testid="gift-link-list">
				<GiftLinkList links={gift.links} maxVisible={3} />
			</div>
			{#if gift.price !== null}
				<span
					class="text-sm font-bold text-secondary-foreground"
					data-testid="gift-list-price">{priceDisplay}</span
				>
			{:else}
				<span class="text-sm text-muted-foreground italic" data-testid="gift-list-price"
					>{priceDisplay}</span
				>
			{/if}

			{#if !contextualMode && (hasReceivedPrimary || (isVisitorOrModerator && hasReservationAction) || (onmore && persistentMore))}
				<div
					bind:clientWidth={actionContentWidth}
					class="mt-auto flex min-w-0 flex-col gap-1.5 pt-1.5"
					data-testid="gift-list-actions"
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
						class="gift-list-action-row"
						{onmore}
						{persistentMore}
						{moreOpen}
						{moreSurface}
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
			{/if}
		</div>
	</div>
</div>

<style>
	.gift-list-query-container {
		container: gift-list / inline-size;
	}

	.gift-list-item {
		box-sizing: border-box;
		grid-template-columns: auto minmax(0, 1fr);
		min-height: max(9rem, var(--gift-list-overlay-min-height, 9rem));
	}

	.gift-list-content {
		padding-block: var(--gift-content-inset, 0.5rem)
			var(--gift-content-inset-bottom, var(--gift-content-inset, 0.5rem));
		padding-inline: var(--gift-content-inset, 0.5rem)
			var(--gift-content-inset-end, var(--gift-content-inset, 0.5rem));
	}

	.gift-list-image {
		aspect-ratio: 1;
		height: 100%;
		min-width: 9rem;
		border-top-left-radius: max(
				0px,
				calc(var(--radius-panel) - var(--nested-border-inline, 2px))
			)
			max(0px, calc(var(--radius-panel) - var(--nested-border-block, 2px)));
		border-bottom-left-radius: max(
				0px,
				calc(var(--radius-panel) - var(--nested-border-inline, 2px))
			)
			max(0px, calc(var(--radius-panel) - var(--nested-border-block, 2px)));
	}

	:global(.gift-list-state-overlay) {
		box-sizing: border-box;
		padding-block: var(--gift-list-overlay-start-clearance, 0)
			var(--gift-list-overlay-end-clearance, 0);
	}

	:global(.gift-list-action-row) {
		flex-wrap: nowrap;
		gap: var(--gift-action-gap, 0.5rem);
	}

	:global(.gift-list-action-row > div),
	:global(.gift-list-action-row .gift-action-slot) {
		flex-flow: row nowrap;
		justify-content: flex-end;
	}

	@container gift-list (width < 40rem) {
		.gift-list-item {
			grid-template-columns: min(35%, 9.5rem) minmax(0, 1fr);
			min-height: max(
				9rem,
				var(--gift-list-overlay-min-height, 9rem),
				calc(min(35cqw, 9.5rem) + 2 * var(--nested-border-block, 2px) + 1px)
			);
		}

		.gift-list-image {
			aspect-ratio: auto;
			width: 100%;
			height: 100%;
			min-width: 0;
			max-width: none;
		}
	}
</style>
