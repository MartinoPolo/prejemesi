<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import { useGiftDraftGrid } from './gift_draft_grid.context.svelte.js';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import * as m from '$lib/paraglide/messages.js';

	const context = useGiftDraftGrid();

	const selectedIndices = $derived(
		context.rows.map((row, index) => (row.selected ? index : -1)).filter((i) => i >= 0),
	);

	function handleDeleteSelected() {
		context.removeRows(selectedIndices);
	}
</script>

{#if context.selectedCount > 0}
	<div
		class="sticky top-2 z-30 flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2 shadow-sm"
		data-testid="bulk-bar"
	>
		<span class="text-sm font-medium">
			{m.draft_grid_selected_count({ count: context.selectedCount })}
		</span>
		<div class="flex items-center gap-2">
			<Button intent="danger" size="sm" onclick={handleDeleteSelected}>
				<Trash2Icon data-icon="inline-start" />
				{m.draft_grid_delete_selected()}
			</Button>
			<Button intent="ghost" size="sm" disabled title={m.draft_grid_phase2_disabled()}>
				<SparklesIcon data-icon="inline-start" />
				{m.draft_grid_enrich_selected()}
			</Button>
		</div>
	</div>
{/if}
