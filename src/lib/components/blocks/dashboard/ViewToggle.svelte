<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import type { ViewMode } from '$lib/modules/wishlists/dashboard_types.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';

	interface ViewToggleProps {
		value: ViewMode;
		class?: string;
	}

	let { value = $bindable(), class: className }: ViewToggleProps = $props();
</script>

<ToggleGroup.Root
	type="single"
	{value}
	onValueChange={(newValue) => {
		if (newValue !== '') value = newValue as ViewMode;
	}}
	intent="default"
	size="icon"
	class={cn(className)}
	aria-label={m.dashboard_view_label()}
>
	<ToggleGroup.Item value="grid" aria-label={m.dashboard_view_grid()}>
		<LayoutGridIcon />
	</ToggleGroup.Item>
	<ToggleGroup.Item value="list" aria-label={m.dashboard_view_list()}>
		<ListIcon />
	</ToggleGroup.Item>
</ToggleGroup.Root>
