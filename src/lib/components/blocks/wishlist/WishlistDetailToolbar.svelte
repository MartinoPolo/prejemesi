<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import GiftSortFilter from '$lib/components/blocks/gift/GiftSortFilter.svelte';
	import GiftViewSwitcher from '$lib/components/blocks/gift/GiftViewSwitcher.svelte';
	import type { GiftFilters, GiftSortOption, GiftViewMode } from '$lib/modules/gifts/types.js';

	interface WishlistDetailToolbarProps {
		isOwner: boolean;
		isArchived: boolean;
		isOwnerOrModerator: boolean;
		viewMode: GiftViewMode;
		sortOption: GiftSortOption;
		filters: GiftFilters;
		hasActiveFilters: boolean;
		onviewmodechange: (mode: GiftViewMode) => void;
		onsortchange: (sort: GiftSortOption) => void;
		onfilterchange: (filters: GiftFilters) => void;
		onthemeopen: () => void;
		onunfollow: () => void;
		onaddgift: () => void;
	}

	let {
		isOwner,
		isArchived,
		isOwnerOrModerator,
		viewMode,
		sortOption,
		filters,
		hasActiveFilters,
		onviewmodechange,
		onsortchange,
		onfilterchange,
		onthemeopen,
		onunfollow,
		onaddgift,
	}: WishlistDetailToolbarProps = $props();
</script>

<div class="flex flex-wrap items-center gap-3">
	<GiftViewSwitcher value={viewMode} onchange={onviewmodechange} />

	<GiftSortFilter
		sortValue={sortOption}
		{filters}
		{hasActiveFilters}
		{onsortchange}
		{onfilterchange}
	/>

	<div class="ml-auto flex items-center gap-2">
		{#if isOwner && !isArchived}
			<SimpleTooltip text={m.wishlist_detail_change_theme()}>
				<Button
					size="icon-sm"
					intent="outline"
					aria-label={m.wishlist_detail_change_theme()}
					onclick={onthemeopen}
				>
					<PaletteIcon />
				</Button>
			</SimpleTooltip>
		{/if}
		{#if !isOwner && !isArchived}
			<Button size="sm" intent="ghost" onclick={onunfollow}
				>{m.wishlist_detail_unfollow()}</Button
			>
		{/if}
		{#if isOwnerOrModerator && !isArchived}
			<Button size="sm" aria-label={m.wishlist_detail_add_gift_label()} onclick={onaddgift}>
				<PlusIcon data-icon="inline-start" />
				{m.wishlist_detail_add_wish()}
			</Button>
		{/if}
	</div>
</div>
