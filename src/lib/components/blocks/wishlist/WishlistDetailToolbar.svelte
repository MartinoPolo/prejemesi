<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import ImageIcon from '@lucide/svelte/icons/image';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
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
		onappearance: () => void;
		onunfollow: () => void;
		onaddgift: () => void;
		onimport?: () => void;
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
		onappearance,
		onunfollow,
		onaddgift,
		onimport,
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
			<SimpleTooltip text={m.wishlist_detail_edit_appearance()}>
				<Button
					size="icon-sm"
					intent="outline"
					aria-label={m.wishlist_detail_edit_appearance()}
					onclick={onappearance}
				>
					<ImageIcon />
				</Button>
			</SimpleTooltip>
		{/if}
		{#if !isOwner && !isArchived}
			<Button size="sm" intent="ghost" onclick={onunfollow}
				>{m.wishlist_detail_unfollow()}</Button
			>
		{/if}
		{#if isOwnerOrModerator && !isArchived}
			{#if onimport}
				<SimpleTooltip text={m.import_wizard_title()}>
					<Button
						size="icon-sm"
						intent="outline"
						aria-label={m.import_wizard_title()}
						onclick={onimport}
					>
						<FileUpIcon />
					</Button>
				</SimpleTooltip>
			{/if}
			<Button size="sm" aria-label={m.wishlist_detail_add_gift_label()} onclick={onaddgift}>
				<PlusIcon data-icon="inline-start" />
				{m.wishlist_detail_add_wish()}
			</Button>
		{/if}
	</div>
</div>
