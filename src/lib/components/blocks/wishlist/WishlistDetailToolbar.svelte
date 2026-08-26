<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import * as Select from '$lib/components/base/select/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ListPlusIcon from '@lucide/svelte/icons/list-plus';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import CheckIcon from '@lucide/svelte/icons/check';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import ListFilterIcon from '@lucide/svelte/icons/list-filter';
	import GiftSortSelect from '$lib/components/blocks/gift/GiftSortSelect.svelte';
	import GiftViewSwitcher from '$lib/components/blocks/gift/GiftViewSwitcher.svelte';
	import {
		FilterMenu,
		type FilterDefinition,
		type FilterFacetGroup,
	} from '$lib/components/derived/filter-menu/index.js';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		GIFT_GROUPING_OPTIONS,
		GIFT_SORT_OPTIONS,
		type GiftCategoryFilterValue,
		type GiftFilterOption,
		type GiftFilters,
		type GiftGroupingOption,
		type GiftPriorityFilterValue,
		type GiftSortOption,
		type GiftViewMode,
	} from '$lib/modules/gifts/types.js';

	interface WishlistDetailToolbarProps {
		canManage: boolean;
		adminSettingsAvailable?: boolean;
		role: WishlistRole;
		isArchived: boolean;
		isAuthenticated: boolean;
		viewMode: GiftViewMode;
		sortOption: GiftSortOption;
		filters: GiftFilters;
		grouping: GiftGroupingOption;
		groupingAvailability: { priority: boolean; category: boolean };
		categoryFilterOptions: GiftFilterOption<GiftCategoryFilterValue>[];
		priorityFilterOptions: GiftFilterOption<GiftPriorityFilterValue>[];
		reorderMode: boolean;
		recipientViewPreview: boolean;
		onrecipientviewpreviewchange: (active: boolean) => void;
		onreordermodechange: (active: boolean) => void;
		onviewmodechange: (mode: GiftViewMode) => void;
		onsortchange: (sort: GiftSortOption) => void;
		onfilterchange: (filters: GiftFilters) => void;
		ongroupingchange: (grouping: GiftGroupingOption) => void;
		onsettings: () => void;
		onunfollow: () => void;
		onaddgift: () => void;
		onbatchadd: () => void;
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
		grouping,
		groupingAvailability,
		categoryFilterOptions,
		priorityFilterOptions,
		reorderMode,
		recipientViewPreview,
		onrecipientviewpreviewchange,
		onreordermodechange,
		onviewmodechange,
		onsortchange,
		onfilterchange,
		ongroupingchange,
		onsettings,
		onunfollow,
		onaddgift,
		onbatchadd,
	}: WishlistDetailToolbarProps = $props();

	const canPreviewRecipientView = $derived(
		role === WISHLIST_ROLES.visitor || role === WISHLIST_ROLES.moderator,
	);
	const showAvailableFilter = $derived(
		role !== WISHLIST_ROLES.recipient && !recipientViewPreview,
	);
	const noActiveFilters = $derived(
		!filters.availableOnly &&
			!filters.withLinkOnly &&
			!filters.likedOnly &&
			!filters.showReceived &&
			filters.categoryValues.length === 0 &&
			filters.priorityValues.length === 0,
	);
	const canReorder = $derived(
		canManage &&
			(role === WISHLIST_ROLES.recipient || role === WISHLIST_ROLES.moderator) &&
			!isArchived &&
			(viewMode === 'card' || viewMode === 'list') &&
			grouping === GIFT_GROUPING_OPTIONS.none,
	);
	const showLikedFilter = $derived(
		isAuthenticated && role !== WISHLIST_ROLES.recipient && !recipientViewPreview,
	);
	const showReset = $derived(
		!noActiveFilters ||
			sortOption !== GIFT_SORT_OPTIONS.ownerOrder ||
			grouping !== GIFT_GROUPING_OPTIONS.none,
	);

	const GROUPING_LABELS = {
		none: () => m.gift_grouping_none(),
		priority: () => m.gift_grouping_priority(),
		category: () => m.gift_grouping_category(),
	} satisfies Record<GiftGroupingOption, () => string>;

	function emptyFilters(): GiftFilters {
		return {
			availableOnly: false,
			withLinkOnly: false,
			likedOnly: false,
			showReceived: false,
			categoryValues: [],
			priorityValues: [],
		};
	}

	function clearGiftFilters() {
		onfilterchange(emptyFilters());
	}

	function resetDisplayControls() {
		onfilterchange(emptyFilters());
		onsortchange(GIFT_SORT_OPTIONS.ownerOrder);
		ongroupingchange(GIFT_GROUPING_OPTIONS.none);
	}

	function updateCategoryFilter(value: GiftCategoryFilterValue, checked: boolean) {
		const values = checked
			? [...filters.categoryValues, value]
			: filters.categoryValues.filter((selected) => selected !== value);
		onfilterchange({ ...filters, categoryValues: [...new Set(values)] });
	}

	function updatePriorityFilter(value: GiftPriorityFilterValue, checked: boolean) {
		const values = checked
			? [...filters.priorityValues, value]
			: filters.priorityValues.filter((selected) => selected !== value);
		onfilterchange({ ...filters, priorityValues: [...new Set(values)] });
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

	const filterFacets = $derived<FilterFacetGroup[]>([
		{
			id: 'category',
			label: m.gift_filter_category_heading(),
			options: categoryFilterOptions.map((option) => ({
				value: option.value,
				label: option.label,
				checked: filters.categoryValues.includes(option.value),
				onchange: (checked: boolean) => updateCategoryFilter(option.value, checked),
			})),
		},
		{
			id: 'priority',
			label: m.gift_filter_priority_heading(),
			options: priorityFilterOptions.map((option) => ({
				value: option.value,
				label: option.label,
				checked: filters.priorityValues.includes(option.value),
				onchange: (checked: boolean) => updatePriorityFilter(option.value, checked),
			})),
		},
	]);
</script>

<div
	class="flex flex-wrap items-center gap-2.5 rounded-panel border-[2.5px] border-ink bg-card px-3.5 py-2.5 shadow-sticker lg:flex-nowrap"
>
	{#if canPreviewRecipientView}
		<SimpleTooltip
			text={recipientViewPreview
				? m.recipient_view_preview_turn_off()
				: m.recipient_view_preview_turn_on()}
		>
			<Button
				size="icon"
				intent="ghost"
				aria-label={recipientViewPreview
					? m.recipient_view_preview_turn_off()
					: m.recipient_view_preview_turn_on()}
				aria-pressed={recipientViewPreview}
				aria-describedby="recipient-view-preview-description recipient-view-preview-status"
				onclick={() => onrecipientviewpreviewchange(!recipientViewPreview)}
			>
				{#if recipientViewPreview}
					<EyeOffIcon />
				{:else}
					<EyeIcon />
				{/if}
			</Button>
		</SimpleTooltip>
		<span id="recipient-view-preview-description" class="sr-only">
			{m.recipient_view_preview_description()}
		</span>
		<span id="recipient-view-preview-status" class="sr-only" aria-live="polite">
			{recipientViewPreview
				? m.recipient_view_preview_status_on()
				: m.recipient_view_preview_status_off()}
		</span>
	{/if}

	{#if reorderMode && canReorder}
		<Button size="md" onclick={() => onreordermodechange(false)}>
			<CheckIcon data-icon="inline-start" />
			{m.gift_reorder_done()}
		</Button>
	{:else}
		<GiftViewSwitcher value={viewMode} onchange={onviewmodechange} />
		<GiftSortSelect value={sortOption} onchange={onsortchange} />
		<Select.Root
			type="single"
			value={grouping}
			onValueChange={(newValue) => {
				if (Object.values(GIFT_GROUPING_OPTIONS).includes(newValue as GiftGroupingOption)) {
					ongroupingchange(newValue as GiftGroupingOption);
				}
			}}
		>
			<Select.Trigger
				size="md"
				class="min-w-0 max-w-full"
				aria-label={m.gift_grouping_label()}
			>
				<ListFilterIcon class="size-3.5 shrink-0 text-muted-foreground" />
				<span class="min-w-0 truncate">{GROUPING_LABELS[grouping]()}</span>
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					<Select.GroupHeading>{m.gift_grouping_label()}</Select.GroupHeading>
					<Select.Item
						value={GIFT_GROUPING_OPTIONS.none}
						label={m.gift_grouping_none()}
					/>
					<Select.Item
						value={GIFT_GROUPING_OPTIONS.priority}
						label={m.gift_grouping_priority()}
						disabled={!groupingAvailability.priority}
					/>
					<Select.Item
						value={GIFT_GROUPING_OPTIONS.category}
						label={m.gift_grouping_category()}
						disabled={!groupingAvailability.category}
					/>
				</Select.Group>
			</Select.Content>
		</Select.Root>
		<FilterMenu
			definitions={filterDefinitions}
			facets={filterFacets}
			triggerLabel={m.gift_filter()}
			menuHeading={m.gift_filter()}
			clearAllLabel={m.wishlist_detail_clear_filters()}
			onclearall={clearGiftFilters}
			removeFilterLabel={(label) => m.filter_remove({ label })}
			activeCountLabel={(count) => m.filter_active_count({ count })}
			align="end"
		/>
		{#if showReset}
			<SimpleTooltip text={m.gift_display_reset_tooltip()}>
				<Button
					size="icon"
					intent="ghost"
					aria-label={m.gift_display_reset_aria()}
					onclick={resetDisplayControls}
				>
					<RotateCcwIcon />
				</Button>
			</SimpleTooltip>
		{/if}
		{#if canReorder}
			<Button size="md" intent="outline" onclick={() => onreordermodechange(true)}>
				<ArrowUpDownIcon data-icon="inline-start" />
				{m.gift_reorder_action()}
			</Button>
		{/if}

		<div class="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
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
					class="whitespace-nowrap"
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
