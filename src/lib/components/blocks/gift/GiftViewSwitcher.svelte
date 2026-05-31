<script lang="ts">
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import TableIcon from '@lucide/svelte/icons/table';
	import { GIFT_VIEW_MODES, type GiftViewMode } from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';

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

<div
	class="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5"
	role="group"
	aria-label="Zobrazeni"
>
	{#each modes as mode (mode.key)}
		{@const isActive = value === mode.key}
		<button
			type="button"
			class={cn(
				'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-all',
				isActive && 'bg-background text-foreground shadow-sm',
				!isActive && 'hover:text-foreground',
			)}
			aria-pressed={isActive}
			aria-label={mode.label}
			onclick={() => onchange(mode.key)}
		>
			<mode.icon class="size-4" />
		</button>
	{/each}
</div>
