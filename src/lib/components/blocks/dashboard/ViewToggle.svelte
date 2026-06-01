<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { viewToggleVariants } from './view_toggle_variants.js';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import type { ViewMode } from '$lib/modules/wishlists/dashboard_types.js';

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
