<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import {
		FilterMenu,
		type FilterDefinition,
	} from '$lib/components/derived/filter-menu/index.js';
	import ViewToggle from './ViewToggle.svelte';
	import SortDropdown from './SortDropdown.svelte';
	import type { SortOption, ViewMode } from '$lib/modules/wishlists/dashboard_types.js';

	interface DashboardToolbarProps {
		sortValue: SortOption;
		sortOptions?: SortOption[];
		viewMode: ViewMode;
		showArchived: boolean;
		showUnfollowed?: boolean;
		unfollowedValue?: boolean;
		class?: string;
	}

	let {
		sortValue = $bindable(),
		sortOptions,
		viewMode = $bindable(),
		showArchived = $bindable(),
		showUnfollowed = false,
		unfollowedValue = $bindable(false),
		class: className,
	}: DashboardToolbarProps = $props();

	const filterDefinitions = $derived<FilterDefinition[]>([
		{
			id: 'archived',
			menuLabel: m.dashboard_show_archived(),
			activeLabel: m.dashboard_include_archived(),
			checked: showArchived,
			onchange: (checked: boolean) => (showArchived = checked),
		},
		...(showUnfollowed
			? [
					{
						id: 'unfollowed',
						menuLabel: m.dashboard_show_unfollowed(),
						activeLabel: m.dashboard_include_unfollowed(),
						checked: unfollowedValue,
						onchange: (checked: boolean) => (unfollowedValue = checked),
					},
				]
			: []),
	]);

	function clearDashboardFilters() {
		showArchived = false;
		unfollowedValue = false;
	}
</script>

<div class={cn('flex w-full flex-wrap items-center gap-2', className)}>
	<FilterMenu
		class="order-first grow"
		definitions={filterDefinitions}
		triggerLabel={m.gift_filter()}
		menuHeading={m.filter_show_more()}
		clearAllLabel={m.wishlist_detail_clear_filters()}
		onclearall={clearDashboardFilters}
		removeFilterLabel={(label) => m.filter_remove({ label })}
		activeCountLabel={(count) => m.filter_active_count({ count })}
		align="end"
	/>
	<SortDropdown bind:value={sortValue} options={sortOptions} />
	<ViewToggle bind:value={viewMode} />
</div>
