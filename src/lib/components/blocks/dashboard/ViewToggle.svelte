<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import type { ViewMode } from '$lib/modules/wishlists/dashboard_types.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';

	interface ViewToggleProps {
		value: ViewMode;
		class?: string;
	}

	let { value = $bindable(), class: className }: ViewToggleProps = $props();
</script>

<SegmentedToggle.Root
	bind:value
	intent="default"
	size="icon"
	class={className}
	aria-label={m.dashboard_view_label()}
>
	<SegmentedToggle.Item value="grid" aria-label={m.dashboard_view_grid()}>
		<LayoutGridIcon />
	</SegmentedToggle.Item>
	<SegmentedToggle.Item value="list" aria-label={m.dashboard_view_list()}>
		<ListIcon />
	</SegmentedToggle.Item>
</SegmentedToggle.Root>
