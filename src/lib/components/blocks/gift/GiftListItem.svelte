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
	import GiftEditedBadge from './GiftEditedBadge.svelte';
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
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
</script>

<div
	data-testid="gift-list-item"
	class={cn(
		'group grid grid-cols-[clamp(8rem,39vw,9.5rem)_minmax(0,1fr)] items-start gap-3 border-b border-border px-2 py-3 transition-colors hover:bg-muted/50 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center sm:gap-4',
		(isFullyReserved || gift.received) && 'opacity-55 grayscale-50',
	)}
>
	<!-- Shared square crop: large on mobile, 96px minimum from tablet upward. -->
	<div
		data-testid="gift-list-image"
		class="relative aspect-square w-[clamp(8rem,39vw,9.5rem)] self-start sm:w-24 sm:self-center"
	>
		<GiftImage
			class="size-full rounded-lg"
			imageUrl={gift.imageUrl}
			imageMeta={gift.imageMeta}
			target="square"
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
				size="sm"
				showCount={false}
				class="absolute right-2 bottom-2 z-10 size-9 justify-center rounded-full border-2 border-ink bg-card p-0 shadow-sticker"
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
			<GiftEditedBadge
				editedAfterShareAt={gift.editedAfterShareAt}
				compact
				updateText={gift.descriptionAppends.at(-1)?.text ?? null}
			/>
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
				<span class="text-xs font-semibold text-ink-soft">{reserverLine}</span>
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
			<div class="mt-auto flex items-center justify-end gap-2 pt-2">
				<PurchasedToggle gift={visitorGift} />
				<ReserveButton gift={visitorGift} {isArchived} {onreserve} {onunreserve} />
			</div>
		{/if}
	</div>
</div>
