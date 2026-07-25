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

	// Bits UI's ToggleGroup.Root (type="single") mutates its own bindable `value`
	// on every click, including a re-click of the already-active item (see
	// GiftViewSwitcher.svelte for the full root-cause note). Passing `value` as a
	// plain prop leaves the group uncontrolled, so that transient deselect is
	// never undone. A writable `$derived` local, kept in sync with the `value`
	// prop automatically, makes the rendered state always resolvable; resetting it
	// inside onValueChange undoes the deselect. That reset always overwrites a
	// value the two-way binding just set to "" (Bits UI writes through the bound
	// value before calling onValueChange), so it's a genuine change and always
	// re-renders.
	let selected = $derived(value);
</script>

<ToggleGroup.Root
	type="single"
	bind:value={selected}
	onValueChange={(newValue) => {
		if (newValue === '') {
			selected = value;
			return;
		}
		value = newValue as ViewMode;
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
