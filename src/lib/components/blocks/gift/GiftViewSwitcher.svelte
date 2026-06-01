<script lang="ts">
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import TableIcon from '@lucide/svelte/icons/table';
	import { GIFT_VIEW_MODES, type GiftViewMode } from '$lib/modules/gifts/types.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';

	interface GiftViewSwitcherProps {
		value: GiftViewMode;
		onchange: (mode: GiftViewMode) => void;
	}

	let { value, onchange }: GiftViewSwitcherProps = $props();

	const modes = [
		{ key: GIFT_VIEW_MODES.card, icon: LayoutGridIcon, label: 'Karta' },
		{ key: GIFT_VIEW_MODES.list, icon: ListIcon, label: 'Seznam' },
		{ key: GIFT_VIEW_MODES.compact, icon: TableIcon, label: 'Kompakt' },
	] as const;
</script>

<ToggleGroup.Root
	type="single"
	{value}
	onValueChange={(newValue) => {
		if (newValue !== '') onchange(newValue as GiftViewMode);
	}}
	intent="default"
	size="icon"
	aria-label="Zobrazeni"
>
	{#each modes as mode (mode.key)}
		<ToggleGroup.Item value={mode.key} aria-label={mode.label}>
			<mode.icon />
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>
