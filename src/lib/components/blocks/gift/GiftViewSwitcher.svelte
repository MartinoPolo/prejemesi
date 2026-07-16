<script lang="ts">
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import TableIcon from '@lucide/svelte/icons/table';
	import { GIFT_VIEW_MODES, type GiftViewMode } from '$lib/modules/gifts/types.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import * as m from '$lib/paraglide/messages.js';

	interface GiftViewSwitcherProps {
		value: GiftViewMode;
		onchange: (mode: GiftViewMode) => void;
	}

	let { value, onchange }: GiftViewSwitcherProps = $props();

	const modes = [
		{ key: GIFT_VIEW_MODES.card, icon: LayoutGridIcon },
		{ key: GIFT_VIEW_MODES.list, icon: ListIcon },
		{ key: GIFT_VIEW_MODES.compact, icon: TableIcon },
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
	{value}
	onValueChange={(newValue) => {
		if (newValue !== '') onchange(newValue as GiftViewMode);
	}}
	intent="default"
	size="icon"
	aria-label={m.gift_view_switcher_aria()}
	data-testid="gift-view-switcher"
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
