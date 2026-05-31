<script lang="ts">
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import CheckIcon from '@lucide/svelte/icons/check';
	import type { GiftForVisitor, GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		formatPrice,
		extractDomain,
		getPriorityDisplay,
	} from '$lib/modules/gifts/gift-display.js';
	import { cn } from '$lib/utils.js';

	interface GiftListItemProps {
		gift: GiftByRole;
		role: WishlistRole;
		isArchived?: boolean;
	}

	let { gift, role, isArchived = false }: GiftListItemProps = $props();

	const isVisitorOrModerator = $derived(role === 'visitor' || role === 'moderator');
	const visitorGift = $derived(isVisitorOrModerator ? (gift as GiftForVisitor) : null);
	const isFullyReserved = $derived(visitorGift?.isFullyReserved ?? false);

	const domain = $derived(extractDomain(gift.url));
	const priceDisplay = $derived(formatPrice(gift.price, gift.currency));
	const priorityInfo = $derived(getPriorityDisplay(gift.priorityLabel));
	const showQuantity = $derived((gift.quantity ?? 1) > 1);
</script>

<div
	class={cn(
		'flex items-center gap-4 border-b border-border px-2 py-3 transition-colors hover:bg-muted/50',
		isFullyReserved && 'opacity-[0.78]',
	)}
>
	<!-- Thumbnail -->
	<div class="size-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
		{#if gift.imageUrl}
			<img src={gift.imageUrl} alt={gift.name} class="size-full object-cover" />
		{:else}
			<div class="flex size-full items-center justify-center">
				<GiftIcon class="size-6 text-muted-foreground/40" />
			</div>
		{/if}
	</div>

	<!-- Info -->
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		<div class="flex items-center gap-2">
			<h3 class="truncate font-heading text-base font-semibold text-foreground">
				{gift.name}
				{#if showQuantity}
					<span class="text-sm font-normal text-muted-foreground">x{gift.quantity}</span>
				{/if}
			</h3>
			{#if gift.received}
				<Badge variant="default" class="gap-1 text-[11px]">
					<CheckIcon class="size-2.5" />
					Prijato
				</Badge>
			{/if}
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

			{#if priorityInfo}
				<Badge variant="secondary" class={cn('text-[11px]', priorityInfo.colorClass)}>
					{priorityInfo.label}
				</Badge>
			{/if}

			{#if isVisitorOrModerator && visitorGift && isFullyReserved}
				<Badge
					variant="secondary"
					class="bg-reserved/15 text-reserved border-reserved/25 text-[11px]"
				>
					Rezervovano
				</Badge>
			{:else if isVisitorOrModerator && visitorGift && visitorGift.reservedCount > 0 && (gift.quantity ?? 1) > 1}
				<Badge
					variant="secondary"
					class="bg-reserved/15 text-reserved border-reserved/25 text-[11px]"
				>
					Rezervovano ({visitorGift.reservedCount}/{gift.quantity})
				</Badge>
			{/if}
		</div>
	</div>

	<!-- Actions -->
	{#if isVisitorOrModerator && visitorGift}
		<div class="flex flex-shrink-0 items-center gap-2">
			<button
				type="button"
				class="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-liked"
				aria-label="Oblibit {gift.name}"
			>
				<HeartIcon class="size-4" />
				{#if visitorGift.likeCount > 0}
					<span class="text-xs">{visitorGift.likeCount}</span>
				{/if}
			</button>

			{#if !isArchived}
				<Button
					size="sm"
					variant={isFullyReserved ? 'outline' : 'default'}
					disabled={isFullyReserved}
					aria-label="Rezervovat {gift.name}"
				>
					{#if isFullyReserved}
						Rezervovano
					{:else}
						Rezervovat
					{/if}
				</Button>
			{/if}
		</div>
	{/if}
</div>
