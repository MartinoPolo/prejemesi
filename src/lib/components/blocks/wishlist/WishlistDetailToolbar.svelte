<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ListPlusIcon from '@lucide/svelte/icons/list-plus';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import GiftSortSelect from '$lib/components/blocks/gift/GiftSortSelect.svelte';
	import GiftFilterOverflowMenu from '$lib/components/blocks/gift/GiftFilterOverflowMenu.svelte';
	import GiftViewSwitcher from '$lib/components/blocks/gift/GiftViewSwitcher.svelte';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import type { GiftFilters, GiftSortOption, GiftViewMode } from '$lib/modules/gifts/types.js';

	interface WishlistDetailToolbarProps {
		/** Recipient OR správce: gates theme, settings, import, batch-add, and add-gift. */
		canManage: boolean;
		/** Viewer role: the availability chip is hidden for the recipient (reservations are hidden). */
		role: WishlistRole;
		isArchived: boolean;
		isAuthenticated: boolean;
		viewMode: GiftViewMode;
		sortOption: GiftSortOption;
		filters: GiftFilters;
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
		role,
		isArchived,
		isAuthenticated,
		viewMode,
		sortOption,
		filters,
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

	// Role guard (issue #101 REQ-3): the recipient never sees reservation state, so
	// an availability filter would be meaningless noise on their own list.
	const showAvailableChip = $derived(role !== WISHLIST_ROLES.recipient);

	function toggleAvailableOnly() {
		onfilterchange({ ...filters, availableOnly: !filters.availableOnly });
	}
</script>

<!-- Sticker toolbar panel (anime-sky wishlist view) -->
<div
	class="flex flex-wrap items-center gap-2.5 rounded-panel border-[2.5px] border-ink bg-card px-3.5 py-2.5 shadow-sticker"
>
	<GiftViewSwitcher value={viewMode} onchange={onviewmodechange} />

	<GiftSortSelect value={sortOption} onchange={onsortchange} />

	{#if showAvailableChip}
		<!-- „Pouze dostupné" toggle chip (issue #101): filled when active, aria-pressed for AT -->
		<button
			type="button"
			class="rounded-full border-2 border-ink bg-surface px-3.5 py-1.5 text-[13.5px] font-semibold text-ink transition-[background-color,color,transform] hover:-translate-y-px aria-pressed:bg-primary aria-pressed:text-primary-foreground"
			aria-pressed={filters.availableOnly}
			onclick={toggleAvailableOnly}
		>
			{m.gift_filter_available_only()}
		</button>
	{/if}

	<GiftFilterOverflowMenu {filters} {onfilterchange} />

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
