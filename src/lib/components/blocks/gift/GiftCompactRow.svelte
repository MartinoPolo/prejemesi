<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { formatPrice, extractDomain } from '$lib/modules/gifts/gift-display.js';
	import { cn } from '$lib/utils.js';

	interface GiftCompactRowProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
	}

	let { gift, role, isArchived = false }: GiftCompactRowProps = $props();

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
	)}
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
				rel="noopener noreferrer"
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
			<button
				type="button"
				class="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-liked"
				aria-label="Oblibit {gift.name}"
			>
				<HeartIcon class="size-3.5" />
				{#if visitorGift.likeCount > 0}
					<span class="text-[11px]">{visitorGift.likeCount}</span>
				{/if}
			</button>
		</td>

		<td class="px-3 py-1.5 text-right">
			{#if isFullyReserved}
				<span class="text-xs font-medium text-reserved">Rezervovano</span>
			{:else if !isArchived}
				<Button size="xs" variant="default" aria-label="Rezervovat {gift.name}">
					Rezervovat
				</Button>
			{/if}
		</td>
	{/if}
</tr>
