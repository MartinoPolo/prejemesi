<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		/** Inline rendering (no card chrome) for placement beside other controls. */
		compact?: boolean;
		class?: string;
	}

	let { compact = false, class: className }: Props = $props();
</script>

<div
	class={cn(
		'flex flex-wrap text-xs text-muted-foreground',
		compact
			? 'items-center gap-x-3 gap-y-1'
			: 'gap-4 rounded-lg border border-border bg-surface px-4 py-3',
		className,
	)}
	aria-hidden="true"
>
	<span class="inline-flex items-center gap-1.5 font-semibold">
		<span
			class="size-3.5 rounded-xs border-[1.5px] border-[color-mix(in_oklab,var(--status-success)_55%,var(--border))] bg-[color-mix(in_oklab,var(--status-success)_16%,var(--surface))]"
		></span>
		{m.draft_grid_legend_ready()}
	</span>
	<span class="inline-flex items-center gap-1.5 font-semibold">
		<span
			class="size-3.5 rounded-xs border-[1.5px] border-[color-mix(in_oklab,var(--status-dup)_62%,var(--border))] bg-[color-mix(in_oklab,var(--status-dup)_20%,var(--surface))]"
		></span>
		{m.draft_grid_legend_duplicate()}
	</span>
	<span class="inline-flex items-center gap-1.5 font-semibold">
		<span
			class="size-3.5 rounded-xs border-[1.5px] border-[color-mix(in_oklab,var(--status-danger)_60%,var(--border))] bg-[color-mix(in_oklab,var(--status-danger)_15%,var(--surface))]"
		></span>
		{m.draft_grid_legend_error()}
	</span>
</div>
