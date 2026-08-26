<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import ReleaseReservationButton from '$lib/components/blocks/reservation/ReleaseReservationButton.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		formatReserverLine,
		extractGiftDomain,
	} from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import { normalizeGiftUrl, getPrimaryGiftLink } from '$lib/modules/gifts/gift_url.js';
	import { cn } from '$lib/utils.js';

	interface GiftCompactRowProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		hideReservationState?: boolean;
		onclick?: () => void;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
	}

	let {
		gift,
		role,
		isArchived = false,
		hideReservationState = false,
		onclick,
		onreserve,
		onunreserve,
	}: GiftCompactRowProps = $props();

	const { isVisitorOrModerator, visitorGift, isFullyReserved, reservedCount } = $derived(
		deriveGiftDisplayState(gift, role, hideReservationState),
	);

	const primaryLink = $derived(getPrimaryGiftLink(gift.links));
	const domain = $derived(extractGiftDomain(gift.links));
	const safeGiftUrl = $derived(normalizeGiftUrl(primaryLink?.url ?? null));
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency, gift.priceMax));
	const reserverLine = $derived(formatReserverLine(visitorGift?.reserverNames ?? []));
</script>

<tr
	class={cn(
		'h-10 border-b border-border transition-colors hover:bg-muted/50',
		(isFullyReserved || gift.received) && 'opacity-55 grayscale-50',
		onclick && 'cursor-pointer',
	)}
	onclick={() => onclick?.()}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick?.();
		}
	}}
	role={onclick ? 'button' : undefined}
	tabindex={onclick ? 0 : undefined}
	aria-label={onclick ? m.gift_open_detail_aria({ name: gift.name }) : undefined}
>
	<td class="px-3 py-1.5">
		<span class="text-sm font-medium text-foreground">
			{gift.name}
			<GiftPieceCount
				quantity={gift.quantity}
				role={hideReservationState ? 'recipient' : role}
				{reservedCount}
				hideWhenOne
			/>
		</span>
	</td>

	<td class="px-3 py-1.5">
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
	</td>

	<td class="px-3 py-1.5 text-right">
		{#if gift.price !== null}
			<span class="text-sm font-semibold text-primary">{priceDisplay}</span>
		{:else}
			<span class="text-xs text-muted-foreground">{priceDisplay}</span>
		{/if}
	</td>

	{#if isVisitorOrModerator && visitorGift}
		<td class="px-3 py-1.5 text-center">
			<LikeButton
				giftId={gift.id}
				giftName={gift.name}
				likeCount={visitorGift.likeCount}
				size="sm"
			/>
		</td>

		<td class="px-3 py-1.5 text-right">
			<div class="flex items-center justify-end gap-1.5">
				<PurchasedToggle gift={visitorGift} size="sm" />
				{#if isFullyReserved && visitorGift.myReservationId === null}
					<span class="flex flex-col items-end leading-tight">
						<span class="text-xs font-medium text-reserved"
							>{m.gift_reserved_overlay()}</span
						>
						{#if reserverLine !== null}
							<span class="text-[10px] font-medium text-muted-foreground"
								>{reserverLine}</span
							>
						{/if}
					</span>
				{:else}
					<ReserveButton
						gift={visitorGift}
						{isArchived}
						size="sm"
						{onreserve}
						{onunreserve}
					/>
				{/if}
				<!-- Outside the branch above: the reserve control is replaced by a plain status
				     label once someone else holds the gift, which is exactly when a release is
				     wanted (issue #213 REQ-3). -->
				<ReleaseReservationButton gift={visitorGift} size="sm" />
			</div>
		</td>
	{/if}
</tr>
