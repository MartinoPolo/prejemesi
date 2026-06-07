<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import GiftPieceCount from '$lib/components/blocks/gift/GiftPieceCount.svelte';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { formatPrice, extractGiftDomain } from '$lib/modules/gifts/gift_display.js';
	import { deriveGiftDisplayState } from '$lib/modules/gifts/gift_display_state.js';
	import { normalizeGiftUrl, getPrimaryGiftLink } from '$lib/modules/gifts/gift_url.js';
	import { cn } from '$lib/utils.js';
	import GiftEditedBadge from './GiftEditedBadge.svelte';

	interface GiftCompactRowProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		onclick?: () => void;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
	}

	let {
		gift,
		role,
		isArchived = false,
		onclick,
		onreserve,
		onunreserve,
	}: GiftCompactRowProps = $props();

	const { isVisitorOrModerator, visitorGift, isFullyReserved, reservedCount } = $derived(
		deriveGiftDisplayState(gift, role),
	);

	const primaryLink = $derived(getPrimaryGiftLink(gift.links));
	const domain = $derived(extractGiftDomain(gift.links));
	const safeGiftUrl = $derived(normalizeGiftUrl(primaryLink?.url ?? null));
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency));
</script>

<tr
	class={cn(
		'h-10 border-b border-border transition-colors hover:bg-muted/50',
		isFullyReserved && 'opacity-65',
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
>
	<td class="px-3 py-1.5">
		<span class="text-sm font-medium text-foreground">
			{gift.name}
			<GiftPieceCount quantity={gift.quantity} {role} {reservedCount} hideWhenOne />
			<GiftEditedBadge editedAfterShareAt={gift.editedAfterShareAt} />
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
			{#if isFullyReserved && visitorGift.myReservationId === null}
				<span class="text-xs font-medium text-reserved">{m.gift_reserved_overlay()}</span>
			{:else}
				<ReserveButton
					gift={visitorGift}
					{isArchived}
					size="sm"
					{onreserve}
					{onunreserve}
				/>
			{/if}
		</td>
	{/if}
</tr>
