<script lang="ts">
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import { GIFT_VIEW_MODES, type GiftViewMode } from '$lib/modules/gifts/types.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import * as m from '$lib/paraglide/messages.js';

	interface GiftViewSwitcherProps {
		value: GiftViewMode;
		onchange: (mode: GiftViewMode) => void;
		disabled?: boolean;
	}

	let { value, onchange, disabled = false }: GiftViewSwitcherProps = $props();

	// Bits UI's single ToggleGroup writes an empty bound value when its active item is re-clicked;
	// SegmentedToggle's writable derived state restores this value instead of deselecting it.
	let selected = $derived(value);

	const modes = [
		{ key: GIFT_VIEW_MODES.card, icon: LayoutGridIcon },
		{ key: GIFT_VIEW_MODES.list, icon: ListIcon },
	] as const;

	function handleArrowKey(event: KeyboardEvent) {
		if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
			return;
		}
		const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
		const currentIndex = modes.findIndex((mode) => mode.key === selected);
		const next = modes[(currentIndex + direction + modes.length) % modes.length];
		if (next.key !== selected) {
			event.preventDefault();
			onchange(next.key);
		}
	}

	function modeLabel(key: GiftViewMode): string {
		switch (key) {
			case GIFT_VIEW_MODES.card:
				return m.gift_view_card();
			case GIFT_VIEW_MODES.list:
				return m.gift_view_list();
		}
	}
</script>

<SegmentedToggle.Root
	bind:value={selected}
	onValueChange={(newValue) => onchange(newValue as GiftViewMode)}
	intent="default"
	format="icon"
	presentation="connected"
	aria-label={m.gift_view_switcher_aria()}
	onkeydown={handleArrowKey}
	data-testid="gift-view-switcher"
	{disabled}
>
	{#each modes as mode (mode.key)}
		<SegmentedToggle.Item
			value={mode.key}
			aria-label={modeLabel(mode.key)}
			data-testid="gift-view-{mode.key}"
		>
			<mode.icon />
		</SegmentedToggle.Item>
	{/each}
</SegmentedToggle.Root>
