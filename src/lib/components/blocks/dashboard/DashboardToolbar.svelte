<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import FilterChip from '$lib/components/derived/filter-chip/FilterChip.svelte';
	import ViewToggle from './ViewToggle.svelte';
	import SortDropdown from './SortDropdown.svelte';
	import type { SortOption, ViewMode } from '$lib/modules/wishlists/dashboard_types.js';

	interface DashboardToolbarProps {
		sortValue: SortOption;
		sortOptions?: SortOption[];
		viewMode: ViewMode;
		showArchived: boolean;
		/** Show "Zobrazit opuštěné" toggle (followed page only) */
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
</script>

<div class={cn('flex flex-wrap items-center gap-2', className)}>
	<SortDropdown bind:value={sortValue} options={sortOptions} />
	<ViewToggle bind:value={viewMode} />

	<FilterChip pressed={showArchived} onclick={() => (showArchived = !showArchived)}>
		{m.dashboard_show_archived()}
	</FilterChip>

	{#if showUnfollowed}
		<FilterChip pressed={unfollowedValue} onclick={() => (unfollowedValue = !unfollowedValue)}>
			{m.dashboard_show_unfollowed()}
		</FilterChip>
	{/if}
</div>
