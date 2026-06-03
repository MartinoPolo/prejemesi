<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { resolve } from '$app/paths';
	import { wishlistListViewVariants } from './wishlist_list_view_variants.js';
	import { STATUS_DOT_CLASSES } from './wishlist_card_variants.js';
	import {
		getThemePreset,
		type DashboardWishlistTheme,
	} from '$lib/modules/wishlists/wishlist_theme.js';
	import { WISHLIST_STATUS_LABELS } from '$lib/modules/wishlists/dashboard_types.js';
	import type { Wishlist } from '$lib/modules/wishlists/types.js';
	import { wishlistImageUrl, wishlistSlotToFrameProps } from '$lib/modules/images/index.js';
	import WishlistSlotImage from '$lib/components/blocks/wishlist/WishlistSlotImage.svelte';
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
		{@const theme = getThemePreset(item.wishlist.theme as DashboardWishlistTheme)}
		{@const isArchived = item.wishlist.status === 'archived'}
		{@const rowVariants = wishlistListViewVariants({ archived: isArchived })}
		{@const thumbSrc = wishlistImageUrl(item.wishlist.imageKey)}
		{@const thumbFrame = wishlistSlotToFrameProps(item.wishlist.imageSlots, 'thumbnail')}
		<a
			href={resolve('/(app)/w/[id]', { id: item.wishlist.shortId })}
			class={rowVariants.row()}
			aria-label={item.wishlist.title}
		>
			<div class={rowVariants.bannerMini()}>
				<div class="absolute inset-0">
					<WishlistSlotImage
						src={thumbSrc}
						frame={thumbFrame}
						themeEmoji={theme.emoji}
						alt={item.wishlist.title}
					/>
				</div>
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
					{WISHLIST_STATUS_LABELS[item.wishlist.status]()}
				</div>
			</div>
		</a>
	{/each}
</div>
