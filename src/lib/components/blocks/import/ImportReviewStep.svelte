<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { detectColumns, type DetectedColumn } from '$lib/modules/import/detect_columns.js';
	import { findDuplicates, type GiftDraft } from '$lib/modules/gifts/gift_draft.js';
	import type { GiftLink } from '$lib/modules/gifts/types.js';
	import ImportColumnMapping from './ImportColumnMapping.svelte';
	import ImportExistingItemsPanel from './ImportExistingItemsPanel.svelte';
	import { buildDraftRows } from './import_draft_builder.js';
	import { deriveWishlistTitle } from './import_title_derivation.js';
	import { WIZARD_MODE, type WizardMode } from './import_wizard_types.js';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

	interface ImportReviewStepProps {
		parsedRows: string[][];
		filename?: string;
		mode: WizardMode;
		existingGifts?: Array<{ name: string; links: GiftLink[] }>;
		onready: (data: { drafts: GiftDraft[]; title?: string }) => void;
	}

	let {
		parsedRows,
		filename,
		mode,
		existingGifts = [],
		onready,
	}: ImportReviewStepProps = $props();

	// Column detection — derived from props so it stays reactive
	const detectionResult = $derived(detectColumns(parsedRows));

	// Mutable column overrides (user can remap roles)
	let columnOverrides = $state<DetectedColumn[] | null>(null);
	const columns = $derived(columnOverrides ?? detectionResult.columns);

	// Title for new-list mode
	let title = $state('');

	// Initialize title once on mount
	$effect(() => {
		// Only set once — when title is still empty and we have a filename
		if (title === '' && mode === WIZARD_MODE.newList) {
			title = deriveWishlistTitle(filename ?? '');
		}
	});

	// Data rows (respecting detection boundaries)
	const dataRows = $derived(
		parsedRows.slice(detectionResult.dataStartIndex, detectionResult.dataEndIndex),
	);

	// Build drafts from data rows + column mapping
	const drafts = $derived(buildDraftRows(dataRows, columns));

	// Row selection (all selected by default) — reset when row count changes
	let lastRowCount = $state(-1);
	const selectedRows = new SvelteSet<number>();

	$effect(() => {
		const length = dataRows.length;
		if (length !== lastRowCount) {
			lastRowCount = length;
			selectedRows.clear();
			for (let i = 0; i < length; i++) {
				selectedRows.add(i);
			}
		}
	});

	// Check if name column is mapped
	const hasNameColumn = $derived(columns.some((col) => col.role === 'name'));

	// Selected drafts
	const selectedDrafts = $derived(drafts.filter((_, index) => selectedRows.has(index)));

	// Duplicate detection for append mode
	const duplicateNames = $derived.by(() => {
		if (mode !== WIZARD_MODE.append || existingGifts.length === 0) {
			return new SvelteSet<string>();
		}
		const matched = new SvelteSet<string>();
		for (const draft of selectedDrafts) {
			const dupes = findDuplicates(draft, existingGifts);
			if (dupes.length > 0) {
				matched.add(draft.name);
			}
		}
		return matched;
	});

	const matchedExistingNames = $derived.by(() => {
		if (mode !== WIZARD_MODE.append || existingGifts.length === 0) {
			return new SvelteSet<string>();
		}
		const matched = new SvelteSet<string>();
		for (const draft of selectedDrafts) {
			const dupes = findDuplicates(draft, existingGifts);
			for (const dupe of dupes) {
				matched.add(dupe.name);
			}
		}
		return matched;
	});

	// Skipped rows info
	const skippedCount = $derived(
		detectionResult.skippedPreambleRows + detectionResult.skippedFooterRows,
	);

	// Valid selected count (name not empty)
	const validSelectedCount = $derived(
		selectedDrafts.filter((draft) => draft.name.trim() !== '').length,
	);

	// Forward gate: name column mapped AND >= 1 valid row selected
	const canProceed = $derived(hasNameColumn && validSelectedCount > 0);

	// Emit ready state whenever selection or title changes
	$effect(() => {
		if (canProceed) {
			const validDrafts = selectedDrafts.filter((draft) => draft.name.trim() !== '');
			onready({
				drafts: validDrafts,
				title: mode === WIZARD_MODE.newList ? title : undefined,
			});
		}
	});

	function handleColumnChange(updatedColumns: DetectedColumn[]) {
		columnOverrides = updatedColumns;
	}

	function toggleRow(index: number) {
		if (selectedRows.has(index)) {
			selectedRows.delete(index);
		} else {
			selectedRows.add(index);
		}
	}

	function toggleAll() {
		if (selectedRows.size === dataRows.length) {
			selectedRows.clear();
		} else {
			for (let i = 0; i < dataRows.length; i++) {
				selectedRows.add(i);
			}
		}
	}
</script>

<div class="flex gap-4">
	<!-- Main content -->
	<div class="flex min-w-0 flex-1 flex-col gap-4">
		<!-- Title field (new-list mode only) -->
		{#if mode === WIZARD_MODE.newList}
			<div class="flex flex-col gap-1.5">
				<Label>{m.import_wizard_review_title_label()}</Label>
				<Input
					bind:value={title}
					placeholder={m.import_wizard_review_title_placeholder()}
				/>
			</div>
		{/if}

		<!-- Column mapping bar -->
		<ImportColumnMapping {columns} onchange={handleColumnChange} />

		<!-- Name column required warning -->
		{#if !hasNameColumn}
			<Alert.Root tone="warning">
				<AlertCircleIcon class="size-4" />
				<Alert.Description>{m.import_wizard_name_required()}</Alert.Description>
			</Alert.Root>
		{/if}

		<!-- Selection summary + skipped rows info -->
		<div class="flex items-center justify-between">
			<HelpText>
				{m.import_wizard_selected_count({
					selected: selectedRows.size,
					total: dataRows.length,
				})}
			</HelpText>
			{#if skippedCount > 0}
				<HelpText>
					{m.import_wizard_skipped_rows({ count: skippedCount })}
				</HelpText>
			{/if}
		</div>

		<!-- Data grid -->
		<div class="border-border max-h-[384px] overflow-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="bg-surface-2 sticky top-0 z-10">
					<tr>
						<th class="w-10 px-2 py-2">
							<Checkbox
								checked={selectedRows.size === dataRows.length}
								indeterminate={selectedRows.size > 0 &&
									selectedRows.size < dataRows.length}
								onCheckedChange={toggleAll}
							/>
						</th>
						{#each columns as column (column.index)}
							<th
								class="text-muted-foreground px-3 py-2 text-left text-xs font-medium"
							>
								{column.headerLabel ?? `Col ${column.index + 1}`}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each dataRows as row, rowIndex (rowIndex)}
						{@const draft = drafts[rowIndex]}
						{@const isSelected = selectedRows.has(rowIndex)}
						{@const isDuplicate =
							mode === WIZARD_MODE.append &&
							draft !== undefined &&
							duplicateNames.has(draft.name)}
						<tr
							class="border-border border-t transition-colors {isSelected
								? 'bg-background'
								: 'bg-surface-2/50 opacity-60'}"
						>
							<td class="px-2 py-1.5">
								<Checkbox
									checked={isSelected}
									onCheckedChange={() => toggleRow(rowIndex)}
								/>
							</td>
							{#each columns as column (column.index)}
								<td class="max-w-[200px] truncate px-3 py-1.5">
									{row[column.index] ?? ''}
								</td>
							{/each}
							{#if isDuplicate}
								<td class="px-2 py-1.5">
									<Badge tone="warning" size="compact">
										{m.import_wizard_possible_duplicate()}
									</Badge>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Existing items panel (append mode) -->
	{#if mode === WIZARD_MODE.append && existingGifts.length > 0}
		<div class="hidden shrink-0 lg:block">
			<ImportExistingItemsPanel {existingGifts} matchedNames={matchedExistingNames} />
		</div>
	{/if}
</div>

<!-- Existing items below on small screens (append mode) -->
{#if mode === WIZARD_MODE.append && existingGifts.length > 0}
	<div class="mt-4 lg:hidden">
		<ImportExistingItemsPanel {existingGifts} matchedNames={matchedExistingNames} />
	</div>
{/if}
