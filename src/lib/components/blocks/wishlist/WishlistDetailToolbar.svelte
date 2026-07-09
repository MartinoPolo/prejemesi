<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ListPlusIcon from '@lucide/svelte/icons/list-plus';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import GiftSortFilter from '$lib/components/blocks/gift/GiftSortFilter.svelte';
	import GiftViewSwitcher from '$lib/components/blocks/gift/GiftViewSwitcher.svelte';
	import type { GiftFilters, GiftSortOption, GiftViewMode } from '$lib/modules/gifts/types.js';

	interface WishlistDetailToolbarProps {
		/** Recipient OR správce: gates theme, settings, import, batch-add, and add-gift. */
		canManage: boolean;
		isArchived: boolean;
		isAuthenticated: boolean;
		viewMode: GiftViewMode;
		sortOption: GiftSortOption;
		filters: GiftFilters;
		hasActiveFilters: boolean;
		onviewmodechange: (mode: GiftViewMode) => void;
		onsortchange: (sort: GiftSortOption) => void;
		onfilterchange: (filters: GiftFilters) => void;
		onthemeopen: () => void;
		onsettings: () => void;
		onunfollow: () => void;
		onaddgift: () => void;
		onbatchadd: () => void;
		onimport: () => void;
	}

	let {
		canManage,
		isArchived,
		isAuthenticated,
		viewMode,
		sortOption,
		filters,
		hasActiveFilters,
		onviewmodechange,
		onsortchange,
		onfilterchange,
		onthemeopen,
		onsettings,
		onunfollow,
		onaddgift,
		onbatchadd,
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
		{#if canManage && !isArchived}
			<SimpleTooltip text={m.wishlist_detail_change_theme()}>
				<Button
					size="icon"
					intent="outline"
					aria-label={m.wishlist_detail_change_theme()}
					onclick={onthemeopen}
				>
					<PaletteIcon />
				</Button>
			</SimpleTooltip>
			<SimpleTooltip text={m.wishlist_settings_title()}>
				<Button
					size="icon"
					intent="outline"
					aria-label={m.wishlist_settings_title()}
					onclick={onsettings}
				>
					<SettingsIcon />
				</Button>
			</SimpleTooltip>
		{/if}
		{#if !canManage && !isArchived && isAuthenticated}
			<Button size="sm" intent="ghost" onclick={onunfollow}
				>{m.wishlist_detail_unfollow()}</Button
			>
		{/if}
		{#if canManage && !isArchived}
			<SimpleTooltip text={m.import_toolbar_label()}>
				<Button
					size="icon"
					intent="outline"
					aria-label={m.import_toolbar_label()}
					onclick={onimport}
				>
					<FileUpIcon />
				</Button>
			</SimpleTooltip>
			<SimpleTooltip text={m.batch_add_toolbar_label()}>
				<Button
					size="icon"
					intent="outline"
					aria-label={m.batch_add_toolbar_label()}
					onclick={onbatchadd}
				>
					<ListPlusIcon />
				</Button>
			</SimpleTooltip>
			<Button size="md" aria-label={m.wishlist_detail_add_gift_label()} onclick={onaddgift}>
				<PlusIcon data-icon="inline-start" />
				{m.wishlist_detail_add_wish()}
			</Button>
		{/if}
	</div>
</div>
