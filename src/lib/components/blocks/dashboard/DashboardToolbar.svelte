<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { Switch } from '$lib/components/base/switch/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import ViewToggle from './ViewToggle.svelte';
	import SortDropdown from './SortDropdown.svelte';
	import { Separator } from '$lib/components/base/separator/index.js';
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

	<Separator orientation="vertical" class="mx-0.5 h-5" />

	<div class="flex items-center gap-1.5">
		<Switch bind:checked={showArchived} size="sm" id="show-archived" />
		<Label for="show-archived" class="cursor-pointer text-sm text-muted-foreground">
			{m.dashboard_show_archived()}
		</Label>
	</div>

	{#if showUnfollowed}
		<div class="flex items-center gap-1.5">
			<Switch bind:checked={unfollowedValue} size="sm" id="show-unfollowed" />
			<Label for="show-unfollowed" class="cursor-pointer text-sm text-muted-foreground">
				{m.dashboard_show_unfollowed()}
			</Label>
		</div>
	{/if}
</div>
