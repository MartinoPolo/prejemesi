<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { tv } from 'tailwind-variants';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import type { ViewMode } from '$lib/modules/wishlists/dashboard_types.js';

	const viewToggleVariants = tv({
		slots: {
			root: 'flex items-center overflow-hidden rounded-md border border-border bg-card',
			button: 'flex size-9 items-center justify-center border-none bg-transparent text-muted-foreground transition-colors duration-normal',
		},
		variants: {
			active: {
				true: {
					button: 'bg-primary/10 text-primary',
				},
				false: {
					button: 'hover:bg-accent hover:text-foreground',
				},
			},
		},
	});

	interface ViewToggleProps {
		value: ViewMode;
		class?: string;
	}

	let { value = $bindable(), class: className }: ViewToggleProps = $props();

	const variants = viewToggleVariants();
</script>

<div class={cn(variants.root(), className)} role="group" aria-label={m.dashboard_view_label()}>
	<button
		type="button"
		class={viewToggleVariants({ active: value === 'grid' }).button()}
		aria-label={m.dashboard_view_grid()}
		aria-pressed={value === 'grid'}
		onclick={() => (value = 'grid')}
	>
		<LayoutGridIcon class="size-3.5" />
	</button>
	<button
		type="button"
		class={cn(
			viewToggleVariants({ active: value === 'list' }).button(),
			'border-l border-border',
		)}
		aria-label={m.dashboard_view_list()}
		aria-pressed={value === 'list'}
		onclick={() => (value = 'list')}
	>
		<ListIcon class="size-3.5" />
	</button>
</div>
