<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		extractGiftDomain,
		getPriorityDisplay,
	} from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import { normalizeGiftUrl, getPrimaryGiftLink } from '$lib/modules/gifts/gift_url.js';
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

	const primaryLink = $derived(getPrimaryGiftLink(gift.links));
	const domain = $derived(extractGiftDomain(gift.links));
	const safeGiftUrl = $derived(normalizeGiftUrl(primaryLink?.url ?? null));
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
</script>

<div
	class={cn(
		'flex items-center gap-4 border-b border-border px-2 py-3 transition-colors hover:bg-muted/50',
		(isFullyReserved || gift.received) && 'opacity-55 grayscale-50',
	)}
>
	<!-- Thumbnail -->
	<GiftImage
		class="size-16 flex-shrink-0 rounded-lg"
		imageUrl={gift.imageUrl}
		imageMeta={gift.imageMeta}
		alt={gift.name}
	/>

	<!-- Info -->
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		<div class="flex items-baseline gap-2">
			<h3 class="truncate font-heading text-base font-semibold text-foreground">
				{gift.name}
			</h3>
			<GiftPieceCount quantity={gift.quantity} {role} {reservedCount} hideWhenOne />
			{#if gift.received}
				<Badge tone="neutral" class="gap-1 text-[11px]">
					<CheckIcon class="size-2.5" />
					{m.gift_received_badge()}
				</Badge>
			{/if}
			<GiftEditedBadge editedAfterShareAt={gift.editedAfterShareAt} />
		</div>

		<div class="flex flex-wrap items-center gap-2 text-sm">
			{#if gift.price !== null}
				<span class="font-bold text-primary">{priceDisplay}</span>
			{:else}
				<span class="text-muted-foreground">{priceDisplay}</span>
			{/if}

			<span class="text-border">|</span>

			{#if domain}
				<a
					href={safeGiftUrl ?? '#'}
					target="_blank"
					rel="external noopener noreferrer"
					class="inline-flex items-center gap-1 text-xs text-primary"
					onclick={(e: MouseEvent) => e.stopPropagation()}
				>
					<ExternalLinkIcon class="size-3" />
					{domain}
				</a>
				{#if gift.links.length > 1}
					<span class="text-xs text-muted-foreground"
						>{m.gift_link_overflow({ count: gift.links.length - 1 })}</span
					>
				{/if}
			{:else}
				<span class="text-xs text-muted-foreground">{m.gift_link_none()}</span>
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
		</div>
		<GiftDescription
			description={gift.description}
			descriptionAppends={gift.descriptionAppends}
			maxVisibleAppends={1}
		/>
	</div>

	<!-- Actions -->
	{#if isVisitorOrModerator && visitorGift}
		<div class="flex flex-shrink-0 items-center gap-2">
			<LikeButton giftId={gift.id} giftName={gift.name} likeCount={visitorGift.likeCount} />

			<PurchasedToggle gift={visitorGift} />

			<ReserveButton gift={visitorGift} {isArchived} {onreserve} {onunreserve} />
		</div>
	{/if}
</div>
