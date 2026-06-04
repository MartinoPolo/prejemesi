<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { detectColumns, type DetectedColumn } from '$lib/modules/import/detect_columns.js';
	import { findDuplicates, type GiftDraft } from '$lib/modules/gifts/gift_draft.js';
	import type { GiftLink } from '$lib/modules/gifts/types.js';
	import ImportColumnMapping from './ImportColumnMapping.svelte';
	import ImportExistingItemsPanel from './ImportExistingItemsPanel.svelte';
	import GiftDraftGrid from '$lib/components/blocks/gift-draft-grid/GiftDraftGrid.svelte';
	import GiftDraftStatusLegend from '$lib/components/blocks/gift-draft-grid/GiftDraftStatusLegend.svelte';
	import {
		DRAFT_GRID_CONTEXT,
		type DraftGridChange,
	} from '$lib/components/blocks/gift-draft-grid/gift_draft_grid_model.js';
	import { buildDraftRows } from '$lib/modules/import/import_draft_builder.js';
	import { deriveWishlistTitle } from '$lib/modules/import/import_title_derivation.js';
	import { WIZARD_MODE, normalizeColumnRoles, type WizardMode } from './import_wizard_types.js';
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

	// Mutable column overrides (user can remap roles). Normalized so a single-use
	// role never appears on two columns (the field-oriented mapping shows one).
	let columnOverrides = $state<DetectedColumn[] | null>(null);
	const columns = $derived(normalizeColumnRoles(columnOverrides ?? detectionResult.columns));

	// Title for new-list mode — initialized once from props (component remounts on each dialog open).
	// untrack prevents Svelte from treating props as reactive dependencies of the $state initializer.
	let title = $state(
		untrack(() => (mode === WIZARD_MODE.newList ? deriveWishlistTitle(filename ?? '') : '')),
	);

	// Data rows (respecting detection boundaries)
	const dataRows = $derived(
		parsedRows.slice(detectionResult.dataStartIndex, detectionResult.dataEndIndex),
	);

	// Build drafts from data rows + column mapping
	const drafts = $derived(buildDraftRows(dataRows, columns));

	// GiftDraftGrid seeds its internal rows from initialRows once at mount. Remapping
	// columns re-derives `drafts`, so this signature changes and remounts the grid,
	// rebuilding it from the new mapping (in-grid edits are intentionally reset).
	const mappingKey = $derived(columns.map((col) => `${col.index}:${col.role}`).join('|'));

	// Check if name column is mapped
	const hasNameColumn = $derived(columns.some((col) => col.role === 'name'));

	// Grid change tracking
	let gridDrafts = $state<GiftDraft[]>([]);
	let gridValidCount = $state(0);

	function handleGridChange(change: DraftGridChange) {
		gridDrafts = change.drafts;
		gridValidCount = change.validCount;
	}

	// Forward gate: name column mapped AND >= 1 valid row from the grid
	const canProceed = $derived(hasNameColumn && gridValidCount > 0);

	// Skipped rows info
	const skippedCount = $derived(
		detectionResult.skippedPreambleRows + detectionResult.skippedFooterRows,
	);

	// Matched existing names for the side panel (append mode)
	const matchedExistingNames = $derived.by(() => {
		if (mode !== WIZARD_MODE.append || existingGifts.length === 0) {
			return new SvelteSet<string>();
		}
		const matched = new SvelteSet<string>();
		for (const draft of gridDrafts) {
			const dupes = findDuplicates(draft, existingGifts);
			for (const dupe of dupes) {
				matched.add(dupe.name);
			}
		}
		return matched;
	});

	// Emit ready state whenever grid drafts or title changes
	$effect(() => {
		if (canProceed) {
			onready({
				drafts: gridDrafts,
				title: mode === WIZARD_MODE.newList ? title : undefined,
			});
		}
	});

	function handleColumnChange(updatedColumns: DetectedColumn[]) {
		columnOverrides = updatedColumns;
	}
</script>

<div class="flex gap-4">
	<!-- Main content -->
	<div class="flex min-w-0 flex-1 flex-col gap-3">
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

		<!-- Column mapping bar: title + status legend share one compact header,
		     keeping the legend off its own vertical band (saves height). -->
		<div class="border-border bg-surface-2 flex flex-col gap-3 rounded-lg border p-4">
			<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div class="flex flex-col gap-0.5">
					<span class="text-foreground text-sm font-semibold">
						{m.import_wizard_mapping_title()}
					</span>
					<span class="text-muted-foreground text-xs">
						{m.import_wizard_mapping_help()}
					</span>
				</div>
				<GiftDraftStatusLegend compact />
			</div>
			<ImportColumnMapping {columns} onchange={handleColumnChange} />
		</div>

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
					selected: gridValidCount,
					total: drafts.length,
				})}
			</HelpText>
			{#if skippedCount > 0}
				<HelpText>
					{m.import_wizard_skipped_rows({ count: skippedCount })}
				</HelpText>
			{/if}
		</div>

		<!-- Editable draft grid — renders full height; the whole dialog body scrolls.
		     Keyed on the mapping so a remap rebuilds the grid from the new columns. -->
		{#key mappingKey}
			<GiftDraftGrid
				context={DRAFT_GRID_CONTEXT.import}
				initialRows={drafts}
				{existingGifts}
				allowAddRow={false}
				showLegend={false}
				onchange={handleGridChange}
			/>
		{/key}
	</div>

	<!-- Existing items panel (append mode) — large screens inline -->
	{#if mode === WIZARD_MODE.append && existingGifts.length > 0}
		<div class="hidden shrink-0 lg:block">
			{@render existingPanel()}
		</div>
	{/if}
</div>

<!-- Existing items below on small screens (append mode) -->
{#if mode === WIZARD_MODE.append && existingGifts.length > 0}
	<div class="mt-4 lg:hidden">
		{@render existingPanel()}
	</div>
{/if}

{#snippet existingPanel()}
	<ImportExistingItemsPanel {existingGifts} matchedNames={matchedExistingNames} />
{/snippet}
