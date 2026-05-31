<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { formatPrice, extractDomain } from '$lib/modules/gifts/gift_display.js';
	import { cn } from '$lib/utils.js';

	interface GiftCompactRowProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
		onclick?: () => void;
		onreserve?: (gift: GiftForVisitor) => void;
	}

	let { gift, role, isArchived = false, onclick, onreserve }: GiftCompactRowProps = $props();

	const isVisitorOrModerator = $derived(role === 'visitor' || role === 'moderator');
	const visitorGift = $derived(isVisitorOrModerator ? (gift as GiftForVisitor) : null);
	const isFullyReserved = $derived(visitorGift?.isFullyReserved ?? false);

	const domain = $derived(extractDomain(gift.url));
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency));
	const showQuantity = $derived((gift.quantity ?? 1) > 1);
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
			{#if showQuantity}
				<span class="text-muted-foreground">x{gift.quantity}</span>
			{/if}
		</span>
	</td>

	<td class="px-3 py-1.5">
		{#if domain}
			<a
				href={gift.url ?? '#'}
				target="_blank"
				rel="external noopener noreferrer"
				class="inline-flex items-center gap-1 text-xs text-primary"
			>
				<ExternalLinkIcon class="size-3" />
				{domain}
			</a>
		{:else}
			<span class="text-xs text-muted-foreground">Bez odkazu</span>
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
			{#if isFullyReserved}
				<span class="text-xs font-medium text-reserved">Rezervovano</span>
			{:else if visitorGift}
				<ReserveButton gift={visitorGift} {isArchived} size="xs" {onreserve} />
			{/if}
		</td>
	{/if}
</tr>
