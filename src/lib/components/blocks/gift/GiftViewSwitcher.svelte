<script lang="ts">
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import { GIFT_VIEW_MODES, type GiftViewMode } from '$lib/modules/gifts/types.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import * as m from '$lib/paraglide/messages.js';

	interface GiftViewSwitcherProps {
		value: GiftViewMode;
		onchange: (mode: GiftViewMode) => void;
		disabled?: boolean;
	}

	let { value, onchange, disabled = false }: GiftViewSwitcherProps = $props();

	// Bits UI's ToggleGroup.Root (type="single") mutates its own bindable `value`
	// on every click, including a re-click of the already-active item (which it
	// briefly sets to "" before the empty-value guard below runs). Passing `value`
	// as a plain prop leaves the group uncontrolled, so that transient deselect is
	// never undone and the radiogroup renders with nothing checked. Binding to a
	// writable `$derived` local -- kept in sync with the `value` prop automatically
	// -- makes the rendered state always resolvable from `value`, and resetting it
	// inside onValueChange undoes the deselect. That reset always overwrites a
	// value the two-way binding just set to "" (Bits UI writes through the bound
	// value before calling onValueChange), so it's a genuine change and always
	// re-renders.
	let selected = $derived(value);

	// #163 REQ-6: the switcher offers only card and list. The compact renderer is
	// retained as a safe fallback for an already-selected compact view state, so its
	// label mapping below stays exhaustive even though it is no longer togglable here.
	const modes = [
		{ key: GIFT_VIEW_MODES.card, icon: LayoutGridIcon },
		{ key: GIFT_VIEW_MODES.list, icon: ListIcon },
	] as const;

	function modeLabel(key: GiftViewMode): string {
		switch (key) {
			case GIFT_VIEW_MODES.card:
				return m.gift_view_card();
			case GIFT_VIEW_MODES.list:
				return m.gift_view_list();
			case GIFT_VIEW_MODES.compact:
				return m.gift_view_compact();
		}
	}
</script>

<ToggleGroup.Root
	type="single"
	bind:value={selected}
	onValueChange={(newValue) => {
		if (newValue === '') {
			selected = value;
			return;
		}
		onchange(newValue as GiftViewMode);
	}}
	intent="default"
	size="icon"
	aria-label={m.gift_view_switcher_aria()}
	data-testid="gift-view-switcher"
	{disabled}
>
	{#each modes as mode (mode.key)}
		<ToggleGroup.Item
			value={mode.key}
			aria-label={modeLabel(mode.key)}
			data-testid="gift-view-{mode.key}"
		>
			<mode.icon />
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>
