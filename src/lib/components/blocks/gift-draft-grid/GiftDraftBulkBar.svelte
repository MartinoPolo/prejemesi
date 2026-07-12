<script lang="ts">
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import type { HeaderSelectionState } from '$lib/modules/gifts/draft_grid.js';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		/** Number of currently selected rows. */
		selectedCount: number;
		/** Tri-state of the global select-all (drives the mobile-only checkbox). */
		selectAllState: HeaderSelectionState;
		/** Toggle every row's selection (mobile select-all lives here – no header on mobile). */
		onselectall: (checked: boolean) => void;
		/** Delete every selected row. */
		ondelete: () => void;
		/**
		 * Pin the bar to the top while scrolling. Disable when the surrounding
		 * surface already has a sticky grid header in the same scroll container
		 * (two stickies at the top would overlap).
		 */
		sticky?: boolean;
	}

	let { selectedCount, selectAllState, onselectall, ondelete, sticky = true }: Props = $props();
</script>

<!-- Detached, card-like bulk bar. On desktop the single global select-all
     lives in the grid header; on mobile (no header) it lives here. -->
<div
	role="region"
	aria-label={m.draft_grid_bulk_region()}
	class={cn(
		'mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[color-mix(in_oklch,var(--primary)_30%,transparent)] bg-primary-soft px-3 py-2.5 shadow-sm',
		sticky && 'sticky top-2 z-(--z-sticky)',
	)}
>
	<span class="md:hidden">
		<Checkbox
			checked={selectAllState === 'all'}
			indeterminate={selectAllState === 'some'}
			onCheckedChange={onselectall}
			aria-label={m.draft_grid_select_all()}
		/>
	</span>
	<span class="inline-flex items-center gap-2 text-sm font-bold text-primary">
		<span class="size-2 rounded-full bg-primary" aria-hidden="true"></span>
		{m.draft_grid_selected_count({ count: selectedCount })}
	</span>
	<div class="flex-1"></div>
	<Button intent="danger" size="sm" onclick={ondelete}>
		<Trash2Icon data-icon="inline-start" />
		{m.draft_grid_bulk_delete()}
	</Button>
	<SimpleTooltip text={m.draft_grid_bulk_enrich_phase2()} side="top">
		<Button intent="ghost" size="sm" disabled>
			<SparklesIcon data-icon="inline-start" />
			{m.draft_grid_bulk_enrich()}
		</Button>
	</SimpleTooltip>
</div>
