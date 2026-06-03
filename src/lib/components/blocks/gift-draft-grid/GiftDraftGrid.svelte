<script lang="ts">
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import GiftDraftRow from './GiftDraftRow.svelte';
	import GiftDraftBulkBar from './GiftDraftBulkBar.svelte';
	import { createBlankRow, type GridDraftRow } from './gift_draft_grid.js';
	import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';

	interface GiftDraftGridProps {
		rows: GridDraftRow[];
		onrowschange: (rows: GridDraftRow[]) => void;
	}

	let { rows, onrowschange }: GiftDraftGridProps = $props();

	// ── Derived ─────────────────────────────────────────────────────────────

	const selectedCount = $derived(rows.filter((r) => r.selected).length);
	const allSelected = $derived(rows.length > 0 && rows.every((r) => r.selected));
	const someSelected = $derived(rows.some((r) => r.selected) && !allSelected);

	// ── Helpers ─────────────────────────────────────────────────────────────

	function updateRow(id: string, updater: (row: GridDraftRow) => GridDraftRow) {
		onrowschange(rows.map((r) => (r.id === id ? updater(r) : r)));
	}

	function updateDraft<K extends keyof GiftDraft>(id: string, field: K, value: GiftDraft[K]) {
		updateRow(id, (r) => ({
			...r,
			draft: { ...r.draft, [field]: value },
		}));
	}

	// ── Actions ─────────────────────────────────────────────────────────────

	function toggleSelectAll() {
		const nextSelected = !allSelected;
		onrowschange(rows.map((r) => ({ ...r, selected: nextSelected })));
	}

	function addRow() {
		onrowschange([...rows, createBlankRow()]);
	}

	function removeRow(id: string) {
		const filtered = rows.filter((r) => r.id !== id);
		if (filtered.length === 0) {
			onrowschange([createBlankRow()]);
		} else {
			onrowschange(filtered);
		}
	}

	function deleteSelected() {
		const remaining = rows.filter((r) => !r.selected);
		if (remaining.length === 0) {
			onrowschange([createBlankRow()]);
		} else {
			onrowschange(remaining);
		}
	}
</script>

<div class="flex flex-col gap-3">
	<!-- Grid table -->
	<div class="overflow-x-auto">
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr class="bg-muted/50 border-border sticky top-0 z-[5] border-b text-xs">
					<th class="w-10 px-2 py-2 text-center">
						<Checkbox
							checked={allSelected}
							indeterminate={someSelected}
							onCheckedChange={toggleSelectAll}
							aria-label={m.col_select_all()}
						/>
					</th>
					<th class="px-1.5 py-2 text-left font-medium">{m.col_name()}</th>
					<th class="px-1.5 py-2 text-left font-medium">{m.col_note()}</th>
					<th class="px-1.5 py-2 text-left font-medium">{m.col_links()}</th>
					<th class="px-1.5 py-2 text-left font-medium">{m.col_price()}</th>
					<th class="w-10 px-1.5 py-2 text-center font-medium">{m.col_enrich()}</th>
					<th class="w-10 px-1.5 py-2 text-center font-medium">{m.col_remove()}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<GiftDraftRow
						{row}
						onselectedchange={(selected) =>
							updateRow(row.id, (r) => ({ ...r, selected }))}
						ontouched={() => updateRow(row.id, (r) => ({ ...r, touched: true }))}
						onnamechange={(name) => updateDraft(row.id, 'name', name)}
						ondescriptionchange={(description) =>
							updateDraft(row.id, 'description', description)}
						onlinkschange={(links) => updateDraft(row.id, 'links', links)}
						onpricechange={(price) => updateDraft(row.id, 'price', price)}
						oncurrencychange={(currency) => updateDraft(row.id, 'currency', currency)}
						onremove={() => removeRow(row.id)}
					/>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Add row button -->
	<button
		type="button"
		class="border-border text-muted-foreground hover:border-primary/30 hover:text-foreground flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm transition-colors"
		onclick={addRow}
	>
		<PlusIcon class="size-4" />
		{m.batch_add_row()}
	</button>

	<!-- Bulk bar -->
	<GiftDraftBulkBar {selectedCount} ondeleteselected={deleteSelected} />
</div>
