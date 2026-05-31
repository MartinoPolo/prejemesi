<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { resolve } from '$app/paths';
	import { wishlistListViewVariants } from './wishlist-list-view-variants.js';
	import { STATUS_DOT_CLASSES } from './wishlist-card-variants.js';
	import { getThemePreset, type WishlistTheme } from '$lib/modules/wishlists/wishlist-theme.js';
	import { WISHLIST_STATUS_LABELS } from '$lib/modules/wishlists/dashboard-types.js';
	import type { Wishlist } from '$lib/modules/wishlists/types.js';
	import GiftIcon from '@lucide/svelte/icons/gift';

	interface WishlistListItem {
		wishlist: Wishlist;
		ownerName?: string;
		giftCount?: number;
		reservedCount?: number;
	}

	interface WishlistListViewProps {
		items: WishlistListItem[];
		class?: string;
	}

	let { items, class: className }: WishlistListViewProps = $props();

	const variants = wishlistListViewVariants();
</script>

<div class={cn(variants.root(), className)}>
	{#each items as item (item.wishlist.id)}
		{@const theme = getThemePreset(item.wishlist.theme as WishlistTheme)}
		{@const isArchived = item.wishlist.status === 'archived'}
		{@const rowVariants = wishlistListViewVariants({ archived: isArchived })}
		<a
			href={resolve('/(app)/w/[id]', { id: item.wishlist.shortId })}
			class={rowVariants.row()}
			aria-label={item.wishlist.title}
		>
			<div class={rowVariants.bannerMini()} style:background={theme.gradient}>
				<span class={rowVariants.bannerMiniEmoji()}>{theme.emoji}</span>
				<div class={rowVariants.bannerMiniOverlay()}></div>
			</div>

			<div class={rowVariants.info()}>
				<span class={rowVariants.title()}>{item.wishlist.title}</span>
				<span class={rowVariants.subtitle()}>
					{#if item.ownerName}
						{item.ownerName}
						{#if item.reservedCount !== undefined && item.giftCount !== undefined}
							· {item.reservedCount}/{item.giftCount} rezervováno
						{/if}
					{:else}
						{theme.emoji} {theme.label}
					{/if}
				</span>
			</div>

			<div class={rowVariants.trailing()}>
				{#if item.giftCount !== undefined}
					<span class={rowVariants.giftCount()}>
						<GiftIcon class="mr-1 inline size-3 align-middle" />
						{item.giftCount}
					</span>
				{/if}
				<div class={rowVariants.statusBadge()}>
					<span
						class={cn(
							rowVariants.statusDot(),
							STATUS_DOT_CLASSES[item.wishlist.status],
						)}
					></span>
					{WISHLIST_STATUS_LABELS[item.wishlist.status]}
				</div>
			</div>
		</a>
	{/each}
</div>
