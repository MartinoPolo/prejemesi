<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import { OUTLINE_CONTROL_SURFACE_CLASSES } from '$lib/components/base/button/button_variants.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import * as Select from '$lib/components/base/select/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ListPlusIcon from '@lucide/svelte/icons/list-plus';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import CheckIcon from '@lucide/svelte/icons/check';
	import HandIcon from '@lucide/svelte/icons/hand';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import GiftSortSelect from '$lib/components/blocks/gift/GiftSortSelect.svelte';
	import GiftViewSwitcher from '$lib/components/blocks/gift/GiftViewSwitcher.svelte';
	import {
		ActiveFilterPills,
		FilterMenu,
		normalizeActiveFilters,
		type FilterDefinition,
		type FilterFacetGroup,
	} from '$lib/components/derived/filter-menu/index.js';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import { cn } from '$lib/utils.js';
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
	const showManagementActions = $derived(canManage && !isArchived);
	const showSettingsAction = $derived(showManagementActions || adminSettingsAvailable);
	const showUnfollowAction = $derived(!canManage && !isArchived && isAuthenticated);
	const showActions = $derived(showManagementActions || showSettingsAction || showUnfollowAction);

	const GROUPING_LABELS = {
		none: () => m.gift_grouping_none(),
		priority: () => m.gift_grouping_priority(),
		category: () => m.gift_grouping_category(),
	} satisfies Record<GiftGroupingOption, () => string>;
	const groupingCombinedLabel = $derived(
		`${m.gift_grouping_label()}: ${GROUPING_LABELS[grouping]()}`,
	);

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

	type OpenDisplayControl = 'sort' | 'grouping' | 'filter';

	let filterTriggerElement = $state<HTMLButtonElement | null>(null);
	let openDisplayControl = $state<OpenDisplayControl | null>(null);

	function updateOpenDisplayControl(control: OpenDisplayControl, open: boolean) {
		if (open) {
			openDisplayControl = control;
		} else if (openDisplayControl === control) {
			openDisplayControl = null;
		}
	}

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
	const activeFilters = $derived(normalizeActiveFilters(filterDefinitions, filterFacets));
</script>

<div
	class="wishlist-toolbar min-w-0 rounded-panel border-[2.5px] border-ink bg-card px-3.5 py-2.5 shadow-sticker"
	data-testid="wishlist-toolbar"
>
	<div class="toolbar-layout min-w-0">
		<div class="toolbar-controls min-w-0" data-testid="wishlist-toolbar-controls">
			{#if reorderMode && canReorder}
				<div class="toolbar-reorder-state">
					<Button
						size="md"
						class="min-w-0 max-w-full"
						title={m.gift_reorder_done()}
						onclick={() => onreordermodechange(false)}
					>
						<CheckIcon data-icon="inline-start" />
						<span class="min-w-0 truncate">{m.gift_reorder_done()}</span>
					</Button>
				</div>
			{:else}
				<div class="toolbar-view-controls" data-testid="wishlist-toolbar-view-controls">
					<GiftViewSwitcher value={viewMode} onchange={onviewmodechange} />
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
				</div>

				<div
					class="toolbar-display-controls"
					data-testid="wishlist-toolbar-display-controls"
				>
					<GiftSortSelect
						class="toolbar-sort-control"
						value={sortOption}
						onchange={onsortchange}
						open={openDisplayControl === 'sort'}
						onopenchange={(open) => updateOpenDisplayControl('sort', open)}
					/>
					<Select.Root
						type="single"
						value={grouping}
						open={openDisplayControl === 'grouping'}
						onOpenChange={(open) => updateOpenDisplayControl('grouping', open)}
						onValueChange={(newValue) => {
							if (
								Object.values(GIFT_GROUPING_OPTIONS).includes(
									newValue as GiftGroupingOption,
								)
							) {
								ongroupingchange(newValue as GiftGroupingOption);
							}
						}}
					>
						<Select.Trigger
							size="md"
							class={cn(
								'toolbar-grouping-control min-w-0 px-3',
								OUTLINE_CONTROL_SURFACE_CLASSES,
							)}
							aria-label={groupingCombinedLabel}
							title={groupingCombinedLabel}
						>
							<LayersIcon
								class="size-4 shrink-0 text-muted-foreground"
								data-toolbar-icon="grouping"
							/>
							<span class="min-w-0 truncate">{GROUPING_LABELS[grouping]()}</span>
						</Select.Trigger>
						<Select.Content preventScroll={false}>
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
					<div class="toolbar-filter-controls">
						<FilterMenu
							class="toolbar-filter-control"
							triggerClass="w-full justify-between"
							bind:triggerElement={filterTriggerElement}
							definitions={filterDefinitions}
							facets={filterFacets}
							{activeFilters}
							showActivePills={false}
							alwaysShowClearAllInMenu
							triggerLabel={m.gift_filter()}
							menuHeading={m.gift_filter()}
							clearAllLabel={m.wishlist_detail_clear_filters()}
							onclearall={clearGiftFilters}
							removeFilterLabel={(label) => m.filter_remove({ label })}
							activeCountLabel={(count) => m.filter_active_count({ count })}
							align="end"
							open={openDisplayControl === 'filter'}
							onopenchange={(open) => updateOpenDisplayControl('filter', open)}
						/>
						{#if showReset}
							<div class="toolbar-reset-control">
								<SimpleTooltip text={m.gift_display_reset_tooltip()}>
									<Button
										size="icon"
										intent="ghost"
										aria-label={m.gift_display_reset_aria()}
										onclick={resetDisplayControls}
									>
										<RotateCcwIcon data-toolbar-icon="reset" />
									</Button>
								</SimpleTooltip>
							</div>
						{/if}
					</div>
				</div>

				{#if canReorder}
					<div class="toolbar-edit-controls" data-testid="wishlist-toolbar-edit-controls">
						<Button
							size="md"
							intent="outline"
							class="min-w-0 max-w-full"
							title={m.gift_reorder_action()}
							onclick={() => onreordermodechange(true)}
						>
							<HandIcon data-icon="inline-start" data-toolbar-icon="reorder" />
							<span class="min-w-0 truncate">{m.gift_reorder_action()}</span>
						</Button>
					</div>
				{/if}
			{/if}
		</div>

		{#if !(reorderMode && canReorder)}
			{#if activeFilters.length > 0}
				<div
					class="toolbar-active-filters min-w-0"
					data-testid="wishlist-toolbar-active-filters"
				>
					<ActiveFilterPills
						class="min-w-0"
						items={activeFilters}
						clearAllLabel={m.wishlist_detail_clear_filters()}
						onclearall={clearGiftFilters}
						removeFilterLabel={(label) => m.filter_remove({ label })}
						triggerElement={filterTriggerElement}
					/>
				</div>
			{/if}

			{#if showActions}
				<div class="toolbar-actions min-w-0" data-testid="wishlist-toolbar-actions">
					{#if showSettingsAction}
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
					{#if showUnfollowAction}
						<Button
							size="md"
							intent="ghost"
							class="min-w-0 max-w-48 shrink"
							title={m.wishlist_detail_unfollow()}
							onclick={onunfollow}
						>
							<span class="min-w-0 truncate">{m.wishlist_detail_unfollow()}</span>
						</Button>
					{/if}
					{#if showManagementActions}
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
							class="min-w-0 max-w-44 shrink"
							aria-label={m.wishlist_detail_add_gift_label()}
							title={m.wishlist_detail_add_wish()}
							onclick={onaddgift}
						>
							<PlusIcon data-icon="inline-start" />
							<span class="min-w-0 truncate">{m.wishlist_detail_add_wish()}</span>
						</Button>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.wishlist-toolbar {
		container-name: wishlist-toolbar;
		container-type: inline-size;
		max-width: 100%;
		overflow: visible;
	}

	.toolbar-layout {
		display: flex;
		min-width: 0;
		max-width: 100%;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.625rem;
	}

	.toolbar-controls,
	.toolbar-actions,
	.toolbar-active-filters,
	.toolbar-view-controls,
	.toolbar-display-controls,
	.toolbar-edit-controls,
	.toolbar-reorder-state {
		min-width: 0;
	}

	.toolbar-controls {
		display: grid;
		width: max-content;
		max-width: 100%;
		flex: 0 0 auto;
		grid-template-columns: minmax(0, 1fr);
		align-items: center;
		gap: 0.625rem;
	}

	.toolbar-view-controls,
	.toolbar-edit-controls,
	.toolbar-reorder-state {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.toolbar-display-controls {
		display: flex;
		min-width: 0;
		max-width: 100%;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.625rem;
	}

	:global(.toolbar-sort-control),
	:global(.toolbar-grouping-control) {
		width: fit-content;
		max-width: 100%;
	}

	.toolbar-filter-controls {
		display: flex;
		min-width: 0;
		max-width: 100%;
		align-items: center;
		gap: 0.625rem;
	}

	:global(.toolbar-filter-control) {
		width: min(9.5rem, 100%);
	}

	.toolbar-actions {
		display: flex;
		width: max-content;
		max-width: 100%;
		flex: 0 0 auto;
		flex-wrap: nowrap;
		align-items: center;
		align-self: flex-end;
		margin-inline-start: auto;
		gap: 0.5rem;
	}

	.toolbar-active-filters {
		display: flex;
		max-width: 100%;
		flex: 1 1 12rem;
	}

	@container wishlist-toolbar (min-width: 40rem) {
		.toolbar-controls {
			display: flex;
			flex-wrap: wrap;
			gap: 0.625rem 0.875rem;
		}

		.toolbar-display-controls {
			width: max-content;
			flex: 0 0 auto;
			flex-wrap: nowrap;
		}

		:global(.toolbar-sort-control),
		:global(.toolbar-grouping-control) {
			width: 11rem;
		}

		:global(.toolbar-filter-control) {
			width: 9.5rem;
		}

		.toolbar-edit-controls {
			margin-inline-start: 0.25rem;
			border-inline-start: 2px solid color-mix(in oklab, var(--ink) 25%, transparent);
			padding-inline-start: 0.75rem;
		}
	}
</style>
