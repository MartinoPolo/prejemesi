<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import { OUTLINE_CONTROL_SURFACE_CLASSES } from '$lib/components/base/button/button_variants.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import * as Select from '$lib/components/base/select/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
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
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import ListFilterPlusIcon from '@lucide/svelte/icons/list-filter-plus';
	import BellOffIcon from '@lucide/svelte/icons/bell-off';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import GiftSortSelect from '$lib/components/blocks/gift/GiftSortSelect.svelte';
	import {
		GIFT_SORT_KEYS,
		GIFT_SORT_LABELS,
	} from '$lib/components/blocks/gift/gift_sort_options.js';
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
	import { flushSync, onMount, tick, type Snippet } from 'svelte';
	import { emptyGiftFilters } from '$lib/modules/gifts/gifts.context.svelte.js';
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
		onselectionstart: () => void;
		selectionContent?: Snippet;
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
		onselectionstart,
		selectionContent,
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
	const showPersistentMobileActions = $derived(showSettingsAction);

	const GROUPING_LABELS = {
		none: () => m.gift_grouping_none(),
		priority: () => m.gift_grouping_priority(),
		category: () => m.gift_grouping_category(),
	} satisfies Record<GiftGroupingOption, () => string>;
	const groupingCombinedLabel = $derived(
		`${m.gift_grouping_label()}: ${GROUPING_LABELS[grouping]()}`,
	);

	function clearGiftFilters() {
		onfilterchange(emptyGiftFilters());
	}

	function resetDisplayControls() {
		onfilterchange(emptyGiftFilters());
		onsortchange(GIFT_SORT_OPTIONS.ownerOrder);
		ongroupingchange(GIFT_GROUPING_OPTIONS.none);
	}

	function updateCategoryFilter(value: GiftCategoryFilterValue, checked: boolean) {
		const values = checked
			? [...filters.categoryValues, value]
			: filters.categoryValues.filter((selected) => selected !== value);
		onfilterchange({ ...filters, categoryValues: [...new Set(values)] });
	}

	function isGroupingOptionAvailable(option: GiftGroupingOption) {
		return option === GIFT_GROUPING_OPTIONS.none || groupingAvailability[option];
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
	let mobileReorderEntryButton = $state<HTMLButtonElement | null>(null);
	let mobileReorderDoneButton = $state<HTMLButtonElement | null>(null);
	let mobileSortTrigger = $state<HTMLButtonElement | null>(null);
	let mobileGroupingTrigger = $state<HTMLButtonElement | null>(null);
	let mobileFilterTrigger = $state<HTMLButtonElement | null>(null);
	let openDisplayControl = $state<OpenDisplayControl | null>(null);
	let mobileOpenDisplayControl = $state<OpenDisplayControl | null>(null);
	let mobileViewportMode = $state<boolean | null>(null);
	let mobileSheetScrollPosition = $state({ x: 0, y: 0 });
	let mobileSheetRestoreTrigger = $state<HTMLButtonElement | null>(null);
	let mobileSheetFocusRestorationScheduled = false;
	let mobileSheetScrollCapturedFromPointer = false;
	let mobileSheetFocusFrame: number | null = null;
	let mobileSheetScrollFrame: number | null = null;

	function resetMobileSheetState() {
		if (mobileSheetFocusFrame !== null) {
			cancelAnimationFrame(mobileSheetFocusFrame);
			mobileSheetFocusFrame = null;
		}
		if (mobileSheetScrollFrame !== null) {
			cancelAnimationFrame(mobileSheetScrollFrame);
			mobileSheetScrollFrame = null;
		}
		mobileOpenDisplayControl = null;
		mobileSheetRestoreTrigger = null;
		mobileSheetScrollCapturedFromPointer = false;
		mobileSheetFocusRestorationScheduled = false;
	}

	onMount(() => {
		const mobileViewportQuery = window.matchMedia('(max-width: 639px)');
		const updateMobileViewportMode = (event: MediaQueryListEvent) => {
			openDisplayControl = null;
			resetMobileSheetState();
			mobileViewportMode = event.matches;
		};

		flushSync(() => {
			mobileViewportMode = mobileViewportQuery.matches;
		});
		mobileViewportQuery.addEventListener('change', updateMobileViewportMode);

		return () => {
			mobileViewportQuery.removeEventListener('change', updateMobileViewportMode);
			resetMobileSheetState();
		};
	});

	function getMobileDisplayTrigger(control: OpenDisplayControl) {
		switch (control) {
			case 'sort':
				return mobileSortTrigger;
			case 'grouping':
				return mobileGroupingTrigger;
			case 'filter':
				return mobileFilterTrigger;
		}
	}

	$effect(() => {
		if (reorderMode) {
			openDisplayControl = null;
			resetMobileSheetState();
		}
	});

	function updateOpenDisplayControl(control: OpenDisplayControl, open: boolean) {
		if (open) {
			openDisplayControl = control;
		} else if (openDisplayControl === control) {
			openDisplayControl = null;
		}
	}

	function captureMobileSheetScrollPosition() {
		if (mobileOpenDisplayControl === null) {
			mobileSheetScrollPosition = { x: window.scrollX, y: window.scrollY };
			mobileSheetScrollCapturedFromPointer = true;
		}
	}

	function cancelMobileSheetPointerCapture() {
		mobileSheetScrollCapturedFromPointer = false;
	}

	function openMobileDisplaySheet(control: OpenDisplayControl) {
		if (mobileOpenDisplayControl === null) {
			mobileSheetRestoreTrigger = getMobileDisplayTrigger(control);
			if (!mobileSheetScrollCapturedFromPointer) {
				mobileSheetScrollPosition = { x: window.scrollX, y: window.scrollY };
			}
		}
		mobileSheetScrollCapturedFromPointer = false;
		mobileOpenDisplayControl = control;
	}

	function closeMobileDisplaySheet() {
		const trigger = mobileSheetRestoreTrigger;
		const scrollPosition = mobileSheetScrollPosition;
		if (mobileOpenDisplayControl === null || mobileSheetFocusRestorationScheduled) {
			return;
		}
		mobileSheetFocusRestorationScheduled = true;
		mobileOpenDisplayControl = null;
		mobileSheetFocusFrame = requestAnimationFrame(() => {
			mobileSheetFocusFrame = null;
			trigger?.focus({ preventScroll: true });
			window.scrollTo(scrollPosition.x, scrollPosition.y);
			mobileSheetScrollFrame = requestAnimationFrame(() => {
				mobileSheetScrollFrame = null;
				window.scrollTo(scrollPosition.x, scrollPosition.y);
				mobileSheetRestoreTrigger = null;
				mobileSheetFocusRestorationScheduled = false;
			});
		});
	}

	function handleFilterRowClick(
		event: MouseEvent,
		checked: boolean,
		onchange: (checked: boolean) => void,
	) {
		if ((event.target as Element).closest("[data-slot='checkbox']")) {
			return;
		}
		onchange(!checked);
	}

	function filterRowActivation(
		node: HTMLElement,
		state: { checked: boolean; onchange: (checked: boolean) => void },
	) {
		let currentState = state;
		const handleClick = (event: MouseEvent) =>
			handleFilterRowClick(event, currentState.checked, currentState.onchange);
		node.addEventListener('click', handleClick);
		return {
			update(nextState: typeof state) {
				currentState = nextState;
			},
			destroy() {
				node.removeEventListener('click', handleClick);
			},
		};
	}

	function handleMobileSheetOpenChange(open: boolean) {
		if (!open) {
			closeMobileDisplaySheet();
		}
	}

	async function changeMobileReorderMode(active: boolean) {
		const scrollPosition = { x: window.scrollX, y: window.scrollY };
		onreordermodechange(active);
		await tick();
		const focusTarget = active ? mobileReorderDoneButton : mobileReorderEntryButton;
		focusTarget?.focus({ preventScroll: true });
		window.scrollTo(scrollPosition.x, scrollPosition.y);
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
	const sortCombinedLabel = $derived(`${m.gift_sort_by()}: ${GIFT_SORT_LABELS[sortOption]()}`);

	let previousReorderMode = $state<boolean | null>(null);
	let reorderAnnouncement = $state('');
	$effect(() => {
		if (previousReorderMode === null) {
			previousReorderMode = reorderMode;
		} else if (reorderMode !== previousReorderMode) {
			reorderAnnouncement = reorderMode
				? m.gift_reorder_mode_entered()
				: m.gift_reorder_mode_exited();
			previousReorderMode = reorderMode;
		}
	});
</script>

{#snippet viewControls()}
	<div class="toolbar-view-controls" data-testid="wishlist-toolbar-view-controls">
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
					disabled={reorderMode}
					aria-describedby="recipient-view-preview-description recipient-view-preview-status"
					onclick={() => onrecipientviewpreviewchange(!recipientViewPreview)}
				>
					{#if recipientViewPreview}<EyeOffIcon />{:else}<EyeIcon />{/if}
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
{/snippet}

{#snippet groupingControl()}
	<Select.Root
		type="single"
		value={grouping}
		disabled={reorderMode}
		open={openDisplayControl === 'grouping'}
		onOpenChange={(open) => updateOpenDisplayControl('grouping', open)}
		onValueChange={(newValue) => {
			if (Object.values(GIFT_GROUPING_OPTIONS).includes(newValue as GiftGroupingOption)) {
				ongroupingchange(newValue as GiftGroupingOption);
			}
		}}
	>
		<Select.Trigger
			size="md"
			class={cn('toolbar-grouping-control min-w-0 px-3', OUTLINE_CONTROL_SURFACE_CLASSES)}
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
				<Select.Item value={GIFT_GROUPING_OPTIONS.none} label={m.gift_grouping_none()} />
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
{/snippet}

{#snippet filterControls()}
	<div class="toolbar-filter-controls">
		<FilterMenu
			class="toolbar-filter-control"
			triggerClass="w-full justify-between"
			bind:triggerElement={filterTriggerElement}
			definitions={filterDefinitions}
			disabled={reorderMode}
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
						disabled={reorderMode}
						onclick={resetDisplayControls}
					>
						<RotateCcwIcon data-toolbar-icon="reset" />
					</Button>
				</SimpleTooltip>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet displayControls(includeSort = true)}
	<div class="toolbar-display-controls" data-testid="wishlist-toolbar-display-controls">
		{#if includeSort}
			<GiftSortSelect
				class="toolbar-sort-control"
				value={sortOption}
				disabled={reorderMode}
				onchange={onsortchange}
				open={openDisplayControl === 'sort'}
				onopenchange={(open) => updateOpenDisplayControl('sort', open)}
			/>
		{/if}
		{@render groupingControl()}
		{@render filterControls()}
	</div>
{/snippet}

{#snippet mobileVisitorControls()}
	{#if showUnfollowAction}
		<SimpleTooltip text={m.wishlist_detail_unfollow()}>
			<Button
				size="icon"
				intent="ghost"
				aria-label={m.wishlist_detail_unfollow()}
				onclick={onunfollow}
			>
				<BellOffIcon />
			</Button>
		</SimpleTooltip>
	{/if}
	{#if canPreviewRecipientView && !canManage}
		<Button
			size="icon"
			intent="ghost"
			aria-label={recipientViewPreview
				? m.recipient_view_preview_turn_off()
				: m.recipient_view_preview_turn_on()}
			aria-pressed={recipientViewPreview}
			disabled={reorderMode}
			onclick={() => onrecipientviewpreviewchange(!recipientViewPreview)}
		>
			{#if recipientViewPreview}<EyeOffIcon />{:else}<EyeIcon />{/if}
		</Button>
	{/if}
{/snippet}

{#snippet mobileDisplayControls()}
	<div class="mobile-browse-row" data-mobile-toolbar-row>
		<div class="mobile-browse-spacer"></div>
		<SimpleTooltip text={sortCombinedLabel}>
			<Button
				bind:ref={mobileSortTrigger}
				size="icon"
				intent="outline"
				data-testid="mobile-sort-trigger"
				aria-label={sortCombinedLabel}
				aria-haspopup="dialog"
				aria-expanded={mobileOpenDisplayControl === 'sort'}
				disabled={reorderMode}
				onpointerdown={captureMobileSheetScrollPosition}
				onpointercancel={cancelMobileSheetPointerCapture}
				onclick={() => openMobileDisplaySheet('sort')}
			>
				<ArrowUpDownIcon data-toolbar-icon="sort" />
			</Button>
		</SimpleTooltip>
		<SimpleTooltip text={groupingCombinedLabel}>
			<Button
				bind:ref={mobileGroupingTrigger}
				size="icon"
				intent="outline"
				data-testid="mobile-grouping-trigger"
				aria-label={groupingCombinedLabel}
				aria-haspopup="dialog"
				aria-expanded={mobileOpenDisplayControl === 'grouping'}
				disabled={reorderMode}
				onpointerdown={captureMobileSheetScrollPosition}
				onpointercancel={cancelMobileSheetPointerCapture}
				onclick={() => openMobileDisplaySheet('grouping')}
			>
				<LayersIcon data-toolbar-icon="grouping" />
			</Button>
		</SimpleTooltip>
		<SimpleTooltip text={m.gift_filter()}>
			<Button
				bind:ref={mobileFilterTrigger}
				size="icon"
				intent="outline"
				class="mobile-filter-trigger"
				data-testid="mobile-filter-trigger"
				aria-label={activeFilters.length > 0
					? `${m.gift_filter()}: ${m.filter_active_count({ count: activeFilters.length })}`
					: m.gift_filter()}
				aria-haspopup="dialog"
				aria-expanded={mobileOpenDisplayControl === 'filter'}
				disabled={reorderMode}
				onpointerdown={captureMobileSheetScrollPosition}
				onpointercancel={cancelMobileSheetPointerCapture}
				onclick={() => openMobileDisplaySheet('filter')}
			>
				<ListFilterPlusIcon data-toolbar-icon="filter" />
				{#if activeFilters.length > 0}
					<span class="mobile-filter-count" data-filter-count aria-hidden="true"
						>{activeFilters.length}</span
					>
				{/if}
			</Button>
		</SimpleTooltip>
		{#if showReset}
			<SimpleTooltip text={m.gift_display_reset_tooltip()}>
				<Button
					size="icon"
					intent="ghost"
					data-testid="mobile-reset-trigger"
					aria-label={m.gift_display_reset_aria()}
					disabled={reorderMode}
					onclick={resetDisplayControls}
				>
					<RotateCcwIcon data-toolbar-icon="reset" />
				</Button>
			</SimpleTooltip>
		{/if}
		<div
			class="mobile-visitor-inline"
			class:mobile-visitor-inline-with-reset={showReset}
			class:mobile-visitor-inline-unfollow={showUnfollowAction}
			class:mobile-visitor-inline-persistent={showPersistentMobileActions}
		>
			{@render mobileVisitorControls()}
		</div>
	</div>
{/snippet}

{#snippet mobileReorderControls()}
	<div class="mobile-reorder-row" data-mobile-toolbar-row>
		<Button
			bind:ref={mobileReorderDoneButton}
			size="md"
			intent="primary"
			class="mobile-reorder-done"
			aria-label={m.gift_reorder_done()}
			onclick={() => changeMobileReorderMode(false)}
		>
			<CheckIcon
				data-icon="inline-start"
				data-toolbar-icon="reorder-done"
				data-lucide="check"
			/>
			<span>{m.gift_reorder_done()}</span>
		</Button>
	</div>
{/snippet}

{#snippet mobileManagementControls()}
	{#if showPersistentMobileActions || showUnfollowAction}
		<div
			class="mobile-management-row"
			class:mobile-visitor-fallback-only={!showPersistentMobileActions}
			data-mobile-toolbar-row
		>
			{#if showManagementActions}
				<SimpleTooltip text={m.gift_selection_toolbar()}>
					<Button
						size="icon"
						intent="outline"
						aria-label={m.gift_selection_toolbar()}
						disabled={reorderMode}
						onclick={onselectionstart}
					>
						<ListChecksIcon data-toolbar-icon="selection" data-lucide="list-checks" />
					</Button>
				</SimpleTooltip>
			{/if}
			{#if canPreviewRecipientView && canManage}
				<Button
					size="icon"
					intent="ghost"
					aria-label={recipientViewPreview
						? m.recipient_view_preview_turn_off()
						: m.recipient_view_preview_turn_on()}
					aria-pressed={recipientViewPreview}
					disabled={reorderMode}
					onclick={() => onrecipientviewpreviewchange(!recipientViewPreview)}
				>
					{#if recipientViewPreview}<EyeOffIcon />{:else}<EyeIcon />{/if}
				</Button>
			{/if}
			{#if canReorder}
				<Button
					bind:ref={mobileReorderEntryButton}
					size="icon"
					intent="outline"
					aria-label={m.gift_reorder_action()}
					onclick={() => changeMobileReorderMode(true)}
				>
					<HandIcon data-toolbar-icon="reorder" data-lucide="hand" />
				</Button>
			{/if}
			<div class="mobile-management-spacer"></div>
			<div class="mobile-visitor-fallback">
				{@render mobileVisitorControls()}
			</div>
			<div class="mobile-management-cluster">
				{#if showSettingsAction}
					<Button
						size="icon"
						intent="outline"
						aria-label={m.wishlist_settings_title()}
						disabled={reorderMode}
						onclick={onsettings}
					>
						<SettingsIcon />
					</Button>
				{/if}
				{#if showManagementActions}
					<Button
						size="icon"
						intent="outline"
						aria-label={m.batch_add_toolbar_label()}
						disabled={reorderMode}
						onclick={onbatchadd}
					>
						<ListPlusIcon />
					</Button>
					<Button
						size="icon"
						aria-label={m.wishlist_detail_add_gift_label()}
						disabled={reorderMode}
						onclick={onaddgift}
					>
						<PlusIcon />
					</Button>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet mobileDisplaySheet()}
	<Sheet.Root open={mobileOpenDisplayControl !== null} onOpenChange={handleMobileSheetOpenChange}>
		{#if mobileOpenDisplayControl !== null}
			<Sheet.Content
				side="bottom"
				portalProps={{ disabled: true }}
				class="mobile-display-sheet max-h-[80dvh] gap-0 overflow-hidden rounded-t-panel pb-[max(0.75rem,env(safe-area-inset-bottom))]"
				preventScroll={true}
				onCloseAutoFocus={(event) => event.preventDefault()}
			>
				<Sheet.Header class="border-border border-b px-4 py-3">
					<Sheet.Title>
						{mobileOpenDisplayControl === 'sort'
							? m.gift_sort_by()
							: mobileOpenDisplayControl === 'grouping'
								? m.gift_grouping_label()
								: m.gift_filter()}
					</Sheet.Title>
					<Sheet.Description>
						{mobileOpenDisplayControl === 'sort'
							? GIFT_SORT_LABELS[sortOption]()
							: mobileOpenDisplayControl === 'grouping'
								? GROUPING_LABELS[grouping]()
								: activeFilters.length > 0
									? m.filter_active_count({ count: activeFilters.length })
									: m.gift_filter()}
					</Sheet.Description>
				</Sheet.Header>
				<div class="mobile-sheet-switcher" aria-label={m.gift_view_switcher_aria()}>
					<Button
						size="icon"
						intent="ghost"
						aria-label={m.gift_sort_by()}
						aria-pressed={mobileOpenDisplayControl === 'sort'}
						data-testid="mobile-sheet-sort-switch"
						onclick={() => openMobileDisplaySheet('sort')}><ArrowUpDownIcon /></Button
					>
					<Button
						size="icon"
						intent="ghost"
						aria-label={m.gift_grouping_label()}
						aria-pressed={mobileOpenDisplayControl === 'grouping'}
						data-testid="mobile-sheet-grouping-switch"
						onclick={() => openMobileDisplaySheet('grouping')}><LayersIcon /></Button
					>
					<Button
						size="icon"
						intent="ghost"
						aria-label={m.gift_filter()}
						aria-pressed={mobileOpenDisplayControl === 'filter'}
						data-testid="mobile-sheet-filter-switch"
						onclick={() => openMobileDisplaySheet('filter')}
						><ListFilterPlusIcon /></Button
					>
				</div>
				<div class="mobile-sheet-scroll" data-testid="mobile-sheet-scroll">
					{#if mobileOpenDisplayControl === 'sort'}
						{#each GIFT_SORT_KEYS as option (option)}
							<label class="mobile-sheet-choice">
								<input
									type="radio"
									name="mobile-gift-sort"
									value={option}
									checked={sortOption === option}
									onchange={() => {
										onsortchange(option);
										closeMobileDisplaySheet();
									}}
								/>
								<span>{GIFT_SORT_LABELS[option]()}</span>
							</label>
						{/each}
					{:else if mobileOpenDisplayControl === 'grouping'}
						{#each Object.values(GIFT_GROUPING_OPTIONS) as option (option)}
							<label
								class="mobile-sheet-choice"
								class:mobile-sheet-choice-disabled={!isGroupingOptionAvailable(
									option,
								)}
							>
								<input
									type="radio"
									name="mobile-gift-grouping"
									value={option}
									checked={grouping === option}
									disabled={!isGroupingOptionAvailable(option)}
									onchange={() => {
										ongroupingchange(option);
										closeMobileDisplaySheet();
									}}
								/>
								<span>{GROUPING_LABELS[option]()}</span>
							</label>
						{/each}
					{:else}
						{#each filterDefinitions as definition (definition.id)}
							<div
								class="mobile-sheet-choice"
								use:filterRowActivation={{
									checked: definition.checked,
									onchange: definition.onchange,
								}}
							>
								<Checkbox
									checked={definition.checked}
									onCheckedChange={definition.onchange}
									aria-label={definition.menuLabel}
								/>
								<span>{definition.menuLabel}</span>
							</div>
						{/each}
						{#each filterFacets as facet (facet.id)}
							<section class="mobile-filter-section">
								<h3>{facet.label}</h3>
								{#each facet.options as option (option.value)}
									<div
										class="mobile-sheet-choice"
										use:filterRowActivation={{
											checked: option.checked,
											onchange: option.onchange,
										}}
									>
										<Checkbox
											checked={option.checked}
											onCheckedChange={option.onchange}
											aria-label={option.label}
										/>
										<span>{option.label}</span>
									</div>
								{/each}
							</section>
						{/each}
						{#if activeFilters.length > 0}
							<Button class="m-3" intent="ghost" size="lg" onclick={clearGiftFilters}
								>{m.wishlist_detail_clear_filters()}</Button
							>
						{/if}
					{/if}
				</div>
			</Sheet.Content>
		{/if}
	</Sheet.Root>
{/snippet}

{#snippet activeFilterRegion()}
	{#if activeFilters.length > 0}
		<div class="toolbar-active-filters min-w-0" data-testid="wishlist-toolbar-active-filters">
			<ActiveFilterPills
				class="min-w-0"
				items={activeFilters}
				disabled={reorderMode}
				clearAllLabel={m.wishlist_detail_clear_filters()}
				onclearall={clearGiftFilters}
				removeFilterLabel={(label) => m.filter_remove({ label })}
				triggerElement={filterTriggerElement}
			/>
		</div>
	{/if}
{/snippet}

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
	{reorderAnnouncement}
</div>

<div
	class="wishlist-toolbar sticky top-3 z-(--z-sticky) min-w-0 rounded-panel border-[2.5px] border-ink bg-card shadow-sticker"
	data-testid="wishlist-toolbar"
>
	{#if selectionContent}
		<div class="toolbar-layout min-w-0 toolbar-layout-selection">
			<div class="toolbar-selection-content min-w-0">{@render selectionContent()}</div>
		</div>
	{:else}
		{#if !reorderMode || mobileViewportMode === false}
			<div class="toolbar-responsive-view-switcher">
				<GiftViewSwitcher
					value={viewMode}
					onchange={onviewmodechange}
					disabled={reorderMode}
				/>
			</div>
		{/if}
		{#if mobileViewportMode === null || mobileViewportMode}
			<div class="toolbar-mobile" data-testid="wishlist-toolbar-mobile">
				{#if reorderMode}
					{@render mobileReorderControls()}
				{:else}
					{@render mobileDisplayControls()}
					{@render mobileManagementControls()}
				{/if}
			</div>
			{@render mobileDisplaySheet()}
		{/if}
		{#if mobileViewportMode === null || !mobileViewportMode}
			<div class="toolbar-desktop">
				<div class="toolbar-layout min-w-0">
					<div class="toolbar-controls min-w-0" data-testid="wishlist-toolbar-controls">
						{@render viewControls()}

						{@render displayControls()}

						{#if canReorder}
							<div
								class="toolbar-edit-controls"
								data-testid="wishlist-toolbar-edit-controls"
							>
								<Button
									size="md"
									intent={reorderMode ? 'primary' : 'outline'}
									class="reorder-mode-action min-w-0 max-w-full"
									title={reorderMode
										? m.gift_reorder_done()
										: m.gift_reorder_action()}
									aria-label={reorderMode
										? m.gift_reorder_done()
										: m.gift_reorder_action()}
									onclick={() => onreordermodechange(!reorderMode)}
								>
									<span class="reorder-mode-icon-stack" aria-hidden="true">
										<HandIcon
											class={`reorder-mode-content${!reorderMode ? ' reorder-mode-content-active' : ''}`}
											data-icon="inline-start"
											data-toolbar-icon="reorder"
										/>
										<CheckIcon
											class={`reorder-mode-content${reorderMode ? ' reorder-mode-content-active' : ''}`}
											data-icon="inline-start"
											data-toolbar-icon="reorder-done"
										/>
									</span>
									<span
										class="reorder-mode-label-stack min-w-0"
										aria-hidden="true"
									>
										<span
											class="reorder-mode-content min-w-0 truncate"
											class:reorder-mode-content-active={!reorderMode}
										>
											{m.gift_reorder_action()}
										</span>
										<span
											class="reorder-mode-content min-w-0 truncate"
											class:reorder-mode-content-active={reorderMode}
											data-reorder-mode-label
										>
											{m.gift_reorder_done()}
										</span>
									</span>
								</Button>
							</div>
						{/if}
					</div>

					{@render activeFilterRegion()}

					{#if showActions}
						<div class="toolbar-actions min-w-0" data-testid="wishlist-toolbar-actions">
							{#if showSettingsAction}
								<SimpleTooltip text={m.wishlist_settings_title()}>
									<Button
										size="icon"
										intent="outline"
										aria-label={m.wishlist_settings_title()}
										disabled={reorderMode}
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
									disabled={reorderMode}
									onclick={onunfollow}
								>
									<span class="min-w-0 truncate"
										>{m.wishlist_detail_unfollow()}</span
									>
								</Button>
							{/if}
							{#if showManagementActions}
								<SimpleTooltip text={m.batch_add_toolbar_label()}>
									<Button
										size="icon"
										intent="outline"
										aria-label={m.batch_add_toolbar_label()}
										disabled={reorderMode}
										onclick={onbatchadd}
									>
										<ListPlusIcon />
									</Button>
								</SimpleTooltip>
								<Button
									size="md"
									class="min-w-0 max-w-44 shrink"
									aria-label={m.wishlist_detail_add_gift_label()}
									disabled={reorderMode}
									title={m.wishlist_detail_add_wish()}
									onclick={onaddgift}
								>
									<PlusIcon data-icon="inline-start" />
									<span class="min-w-0 truncate"
										>{m.wishlist_detail_add_wish()}</span
									>
								</Button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.wishlist-toolbar {
		container-name: wishlist-toolbar;
		container-type: inline-size;
		max-width: 100%;
		overflow: visible;
		padding: 4px 8px;
	}

	.toolbar-responsive-view-switcher {
		position: absolute;
		z-index: 1;
		inset-block-start: 4px;
		inset-inline-start: 8px;
	}

	.toolbar-mobile {
		display: grid;
		min-width: 0;
		grid-auto-rows: 46px;
		gap: 8px;
	}

	.toolbar-desktop {
		display: none;
	}

	.mobile-browse-row,
	.mobile-management-row,
	.mobile-reorder-row {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}

	.mobile-browse-row {
		padding-inline-start: 88px;
	}

	.mobile-reorder-row {
		justify-content: flex-end;
	}

	.toolbar-mobile :global(.mobile-reorder-done) {
		width: auto;
		min-width: 40px;
		height: 40px;
		min-height: 40px;
		padding-inline: 1rem;
	}

	.mobile-browse-spacer,
	.mobile-management-spacer {
		min-width: 0;
		flex: 1 1 auto;
	}

	.mobile-browse-spacer {
		margin-inline-end: -6px;
	}

	.mobile-management-spacer {
		margin-inline-start: -6px;
	}

	.mobile-visitor-inline,
	.mobile-visitor-fallback {
		display: flex;
		gap: 4px;
	}

	.mobile-visitor-inline {
		display: none;
	}

	.mobile-visitor-inline:not(.mobile-visitor-inline-unfollow) {
		display: flex;
	}

	.mobile-management-row:not(.mobile-visitor-fallback-only) .mobile-visitor-inline,
	.mobile-management-row:not(.mobile-visitor-fallback-only) .mobile-visitor-fallback {
		display: flex;
	}

	@media (width >= 360px) and (width <= 639px) {
		.mobile-visitor-inline:not(
			.mobile-visitor-inline-with-reset,
			.mobile-visitor-inline-persistent
		) {
			display: flex;
		}

		.toolbar-mobile:has(
				.mobile-visitor-inline:not(
					.mobile-visitor-inline-with-reset,
					.mobile-visitor-inline-persistent
				)
			)
			.mobile-visitor-fallback-only {
			display: none;
		}
	}

	@media (width >= 400px) and (width <= 639px) {
		.mobile-visitor-inline.mobile-visitor-inline-with-reset:not(
				.mobile-visitor-inline-persistent
			) {
			display: flex;
		}

		.toolbar-mobile:has(
				.mobile-visitor-inline.mobile-visitor-inline-with-reset:not(
						.mobile-visitor-inline-persistent
					)
			)
			.mobile-visitor-fallback-only {
			display: none;
		}
	}

	.mobile-management-cluster {
		display: flex;
		flex: 0 0 auto;
		gap: 6px;
	}

	.toolbar-mobile :global(button),
	.toolbar-responsive-view-switcher :global([data-slot='toggle-group-item']) {
		width: 40px;
		min-width: 40px;
		height: 40px;
		min-height: 40px;
		padding: 0;
	}

	:global(.mobile-filter-trigger) {
		position: relative;
	}

	.mobile-filter-count {
		position: absolute;
		top: -5px;
		right: -5px;
		display: grid;
		min-width: 18px;
		height: 18px;
		place-items: center;
		border: 2px solid var(--ink);
		border-radius: 999px;
		background: var(--warning);
		color: var(--warning-foreground);
		font-size: 0.625rem;
		font-weight: 800;
		line-height: 1;
	}

	:global(.mobile-display-sheet [data-slot='sheet-close']) {
		width: 40px;
		min-width: 40px;
		height: 40px;
		min-height: 40px;
	}

	.mobile-sheet-switcher {
		display: flex;
		min-width: 0;
		justify-content: center;
		gap: 0.5rem;
		border-bottom: 1px solid var(--border);
		padding: 0.25rem;
		overflow: hidden;
	}

	.mobile-sheet-switcher :global(button) {
		width: 40px;
		min-width: 40px;
		height: 40px;
		min-height: 40px;
	}

	.mobile-sheet-scroll {
		min-height: 0;
		flex: 1 1 auto;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.5rem;
	}

	.mobile-sheet-choice {
		display: flex;
		min-height: 48px;
		align-items: center;
		gap: 0.75rem;
		border-radius: var(--radius-btn);
		padding: 0.5rem 0.75rem;
		font-weight: 650;
	}

	.mobile-sheet-choice:hover {
		background: var(--accent);
	}

	.mobile-sheet-choice input[type='radio'] {
		width: 20px;
		height: 20px;
		accent-color: var(--primary);
	}

	.mobile-sheet-choice-disabled {
		opacity: 0.5;
	}

	.mobile-filter-section {
		border-top: 1px solid var(--border);
		padding-top: 0.5rem;
	}

	@media (width <= 639px) {
		.toolbar-selection-content :global(.selection-toolbar) {
			gap: 4px;
		}

		.toolbar-selection-content :global(button),
		.toolbar-selection-content :global([data-slot='checkbox']) {
			min-width: 40px;
			min-height: 40px;
		}
	}

	.mobile-filter-section h3 {
		padding: 0.25rem 0.75rem;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
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
	.toolbar-selection-content {
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
	.toolbar-edit-controls {
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
		order: 1;
		align-items: center;
		align-self: flex-end;
		margin-inline-start: auto;
		gap: 0.5rem;
	}

	.toolbar-active-filters {
		display: flex;
		width: 100%;
		max-width: 100%;
		flex: 0 0 100%;
		order: 2;
	}

	.toolbar-layout-selection {
		align-items: stretch;
		gap: 0.75rem;
	}

	.toolbar-selection-content {
		display: flex;
		min-width: 0;
		width: 100%;
		flex: 1 1 100%;
	}

	:global(.reorder-mode-action) {
		width: 8.5rem;
		transition-duration: 200ms;
	}

	.reorder-mode-icon-stack,
	.reorder-mode-label-stack {
		display: inline-grid;
		min-width: 0;
	}

	.reorder-mode-icon-stack {
		width: 1rem;
		flex: 0 0 1rem;
	}

	:global(.reorder-mode-content) {
		grid-area: 1 / 1;
		opacity: 0;
		transition: opacity 200ms ease;
	}

	:global(.reorder-mode-content-active) {
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.reorder-mode-action),
		:global(.reorder-mode-content) {
			transition-duration: 0ms;
		}
	}

	@media (width >= 640px) {
		.wishlist-toolbar {
			display: flex;
			align-items: flex-start;
			gap: 0.625rem;
			padding: 0.375rem 0.875rem;
		}

		.toolbar-responsive-view-switcher {
			position: static;
			flex: 0 0 auto;
		}

		.toolbar-mobile {
			display: none;
		}

		.toolbar-desktop {
			display: block;
			min-width: 0;
			flex: 1 1 auto;
		}

		.toolbar-responsive-view-switcher :global([data-slot='toggle-group-item']) {
			width: auto;
			min-width: 32px;
			height: 32px;
			min-height: 32px;
			padding-inline: 0.5rem;
		}

		.toolbar-layout-selection {
			align-items: center;
		}

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

		.toolbar-layout-selection .toolbar-selection-content {
			flex: 1 1 auto;
		}
	}
</style>
