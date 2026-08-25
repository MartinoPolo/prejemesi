<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import { Switch } from '$lib/components/base/switch/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ListPlusIcon from '@lucide/svelte/icons/list-plus';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GiftSortSelect from '$lib/components/blocks/gift/GiftSortSelect.svelte';
	import GiftViewSwitcher from '$lib/components/blocks/gift/GiftViewSwitcher.svelte';
	import {
		FilterMenu,
		type FilterDefinition,
		type FilterToggle,
	} from '$lib/components/derived/filter-menu/index.js';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import type { GiftFilters, GiftSortOption, GiftViewMode } from '$lib/modules/gifts/types.js';

	interface WishlistDetailToolbarProps {
		canManage: boolean;
		adminSettingsAvailable?: boolean;
		role: WishlistRole;
		isArchived: boolean;
		isAuthenticated: boolean;
		viewMode: GiftViewMode;
		sortOption: GiftSortOption;
		filters: GiftFilters;
		/** „Seskupit podle priority" state; only offered when the list has any prioritized gift. */
		priorityGrouping: boolean;
		showPriorityGrouping: boolean;
		reorderMode: boolean;
		recipientViewPreview: boolean;
		onrecipientviewpreviewchange: (active: boolean) => void;
		onreordermodechange: (active: boolean) => void;
		onviewmodechange: (mode: GiftViewMode) => void;
		onsortchange: (sort: GiftSortOption) => void;
		onfilterchange: (filters: GiftFilters) => void;
		onprioritygroupingchange: (grouping: boolean) => void;
		onthemeopen: () => void;
		onsettings: () => void;
		onunfollow: () => void;
		onaddgift: () => void;
		onbatchadd: () => void;
		onimport: () => void;
		onexport: () => void;
	}

	let {
		canManage,
		adminSettingsAvailable = false,
		role,
		isArchived,
		isAuthenticated,
		viewMode,
		sortOption,
		filters,
		priorityGrouping,
		showPriorityGrouping,
		reorderMode,
		recipientViewPreview,
		onrecipientviewpreviewchange,
		onreordermodechange,
		onviewmodechange,
		onsortchange,
		onfilterchange,
		onprioritygroupingchange,
		onthemeopen,
		onsettings,
		onunfollow,
		onaddgift,
		onbatchadd,
		onimport,
		onexport,
	}: WishlistDetailToolbarProps = $props();

	const canPreviewRecipientView = $derived(
		role === WISHLIST_ROLES.visitor || role === WISHLIST_ROLES.moderator,
	);
	const showAvailableFilter = $derived(
		role !== WISHLIST_ROLES.recipient && !recipientViewPreview,
	);
	const canReorder = $derived(
		canManage &&
			(role === WISHLIST_ROLES.recipient || role === WISHLIST_ROLES.moderator) &&
			!isArchived &&
			(viewMode === 'card' || viewMode === 'list'),
	);
	const showLikedFilter = $derived(
		isAuthenticated && role !== WISHLIST_ROLES.recipient && !recipientViewPreview,
	);

	function clearGiftFilters() {
		onfilterchange({
			availableOnly: false,
			withLinkOnly: false,
			likedOnly: false,
			showReceived: false,
		});
	}

	const filterDefinitions = $derived<FilterDefinition[]>([
		...(showAvailableFilter
			? [
					{
						id: 'available-only',
						menuLabel: m.gift_filter_available_only(),
						checked: filters.availableOnly,
						onchange: (availableOnly: boolean) =>
							onfilterchange({ ...filters, availableOnly }),
					},
				]
			: []),
		{
			id: 'with-link-only',
			menuLabel: m.gift_filter_with_link(),
			checked: filters.withLinkOnly,
			onchange: (withLinkOnly: boolean) => onfilterchange({ ...filters, withLinkOnly }),
		},
		...(showLikedFilter
			? [
					{
						id: 'liked-only',
						menuLabel: m.gift_filter_liked(),
						checked: filters.likedOnly,
						onchange: (likedOnly: boolean) => onfilterchange({ ...filters, likedOnly }),
					},
				]
			: []),
		{
			id: 'show-received',
			menuLabel: m.gift_filter_show_received(),
			checked: filters.showReceived,
			onchange: (showReceived: boolean) => onfilterchange({ ...filters, showReceived }),
		},
	]);

	const filterToggles = $derived<FilterToggle[]>(
		showPriorityGrouping
			? [
					{
						id: 'priority-grouping',
						label: m.gift_group_by_priority(),
						checked: priorityGrouping,
						onchange: onprioritygroupingchange,
					},
				]
			: [],
	);
</script>

<div
	class="flex flex-wrap items-center gap-2.5 rounded-panel border-[2.5px] border-ink bg-card px-3.5 py-2.5 shadow-sticker"
>
	{#if canPreviewRecipientView}
		<div class="flex items-center gap-2">
			<Switch
				id="recipient-view-preview"
				checked={recipientViewPreview}
				aria-label={m.recipient_view_preview_label()}
				aria-describedby="recipient-view-preview-description recipient-view-preview-status"
				onCheckedChange={onrecipientviewpreviewchange}
			/>
			<label for="recipient-view-preview" class="cursor-pointer text-sm font-medium">
				{m.recipient_view_preview_label()}
			</label>
			<span id="recipient-view-preview-description" class="sr-only">
				{m.recipient_view_preview_description()}
			</span>
			<span id="recipient-view-preview-status" class="sr-only" aria-live="polite">
				{recipientViewPreview
					? m.recipient_view_preview_status_on()
					: m.recipient_view_preview_status_off()}
			</span>
		</div>
	{/if}

	{#if reorderMode && canReorder}
		<Button size="md" onclick={() => onreordermodechange(false)}>
			<CheckIcon data-icon="inline-start" />
			{m.gift_reorder_done()}
		</Button>
	{:else}
		<GiftViewSwitcher value={viewMode} onchange={onviewmodechange} />
		<GiftSortSelect value={sortOption} onchange={onsortchange} />
		<FilterMenu
			definitions={filterDefinitions}
			toggles={filterToggles}
			triggerLabel={m.gift_filter()}
			menuHeading={m.gift_filter()}
			clearAllLabel={m.wishlist_detail_clear_filters()}
			onclearall={clearGiftFilters}
			removeFilterLabel={(label) => m.filter_remove({ label })}
			activeCountLabel={(count) => m.filter_active_count({ count })}
			align="end"
		/>
		{#if canReorder}
			<Button size="md" intent="outline" onclick={() => onreordermodechange(true)}>
				<ArrowUpDownIcon data-icon="inline-start" />
				{m.gift_reorder_action()}
			</Button>
		{/if}

		<div class="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
			{#if canManage && !isArchived}
				<SimpleTooltip text={m.wishlist_palette_dialog_title()}>
					<Button
						size="icon"
						intent="outline"
						aria-label={m.wishlist_palette_dialog_title()}
						onclick={onthemeopen}
					>
						<PaletteIcon />
					</Button>
				</SimpleTooltip>
			{/if}
			{#if (canManage && !isArchived) || adminSettingsAvailable}
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
				<SimpleTooltip text={m.export_toolbar_label()}>
					<Button
						size="icon"
						intent="outline"
						aria-label={m.export_toolbar_label()}
						onclick={onexport}
					>
						<FileDownIcon />
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
				<Button
					size="md"
					aria-label={m.wishlist_detail_add_gift_label()}
					onclick={onaddgift}
				>
					<PlusIcon data-icon="inline-start" />
					{m.wishlist_detail_add_wish()}
				</Button>
			{/if}
		</div>
	{/if}
</div>
