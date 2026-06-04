<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
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
	import {
		DRAFT_GRID_CONTEXT,
		type DraftGridChange,
	} from '$lib/components/blocks/gift-draft-grid/gift_draft_grid_model.js';
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

		<!-- Editable draft grid -->
		<GiftDraftGrid
			context={DRAFT_GRID_CONTEXT.import}
			initialRows={drafts}
			{existingGifts}
			allowAddRow={false}
			onchange={handleGridChange}
		/>
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
