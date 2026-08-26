<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import { onMount, untrack } from 'svelte';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import { cn } from '$lib/utils.js';
	import {
		findDuplicates,
		validateDraft,
		type GiftDraft,
	} from '$lib/modules/gifts/gift_draft.js';
	import {
		deriveRowStatus,
		headerSelectionState,
		type RowStatus,
	} from '$lib/modules/gifts/draft_grid.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftDraftRow from './GiftDraftRow.svelte';
	import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';
	import GiftDraftBulkBar from './GiftDraftBulkBar.svelte';
	import GiftDraftStatusLegend from './GiftDraftStatusLegend.svelte';
	import {
		DRAFT_GRID_COLUMNS,
		DRAFT_GRID_COLUMNS_NO_PRIORITY,
		DRAFT_COL_LABEL_CLASS,
	} from './gift_draft_grid_variants.js';
	import {
		DRAFT_GRID_CONTEXT,
		collectDraftGridChange,
		createDraftGridRow,
		rowToDraft,
		type DraftGridChange,
		type DraftGridContext,
		type DraftGridRow,
		type ExistingGiftRef,
	} from './gift_draft_grid_model.js';

	interface Props {
		context?: DraftGridContext;
		/** Seed rows (import host pre-fills from a parse). */
		initialRows?: GiftDraft[];
		/** Existing gifts to flag possible duplicates against (import context only). */
		existingGifts?: ExistingGiftRef[];
		/** Show the trailing "+ Přidat řádek" affordance. Defaults to batch context. */
		allowAddRow?: boolean;
		/** Show the status legend above the grid. Defaults to import context. */
		showLegend?: boolean;
		/**
		 * Show the priority (heart) column. Hidden when the target wishlist lacks the
		 * two ranks the toggle maps to. Defaults to true (every wishlist has them).
		 */
		priorityAvailable?: boolean;
		categoryOptions?: ManagedGiftCategory[];
		resolvedImportedCategoryLabels?: ReadonlySet<string>;
		/** Emitted on every edit/selection change with the committable draft set. */
		onchange?: (change: DraftGridChange) => void;
		class?: string;
	}

	let {
		context = DRAFT_GRID_CONTEXT.batch,
		initialRows,
		existingGifts = [],
		allowAddRow,
		showLegend,
		priorityAvailable = true,
		categoryOptions = [],
		resolvedImportedCategoryLabels = new Set(),
		onchange,
		class: className,
	}: Props = $props();

	const showAddRow = $derived(allowAddRow ?? context === DRAFT_GRID_CONTEXT.batch);
	const showStatusLegend = $derived(showLegend ?? context === DRAFT_GRID_CONTEXT.import);
	const isImport = $derived(context === DRAFT_GRID_CONTEXT.import);
	const gridColumns = $derived(
		priorityAvailable ? DRAFT_GRID_COLUMNS : DRAFT_GRID_COLUMNS_NO_PRIORITY,
	);

	let rows = $state<DraftGridRow[]>(seedRows());

	const selectedCount = $derived(rows.filter((row) => row.selected).length);
	const headerState = $derived(headerSelectionState(rows));

	function seedRows(): DraftGridRow[] {
		if (initialRows && initialRows.length > 0) {
			// Pre-filled rows carry data → validate immediately (not pristine).
			return initialRows.map((draft) => createDraftGridRow(draft, { pristine: false }));
		}
		if (context === DRAFT_GRID_CONTEXT.batch) {
			return [createDraftGridRow(undefined, { pristine: true })];
		}
		return [];
	}

	/** A row has a possible duplicate only in import context. */
	function rowHasDuplicateWarning(row: DraftGridRow): boolean {
		if (context !== DRAFT_GRID_CONTEXT.import || existingGifts.length === 0) {
			return false;
		}
		return findDuplicates(rowToDraft(row), existingGifts).length > 0;
	}

	function rowStatus(row: DraftGridRow): RowStatus {
		const validation = validateDraft(rowToDraft(row), { resolvedImportedCategoryLabels });
		return deriveRowStatus({
			name: row.name,
			isDuplicate: !row.dismissedDuplicate && rowHasDuplicateWarning(row),
			pristine: row.pristine,
			hasValidationError: !validation.valid,
		});
	}

	const resolvedImportedCategorySignature = $derived(
		[...resolvedImportedCategoryLabels].sort().join('|'),
	);

	function emit() {
		onchange?.(
			collectDraftGridChange(rows, rowHasDuplicateWarning, resolvedImportedCategoryLabels),
		);
	}

	function selectAll(checked: boolean) {
		for (const row of rows) {
			row.selected = checked;
		}
		emit();
	}

	function addRow() {
		rows.push(createDraftGridRow(undefined, { pristine: true }));
		emit();
	}

	function removeRow(id: string) {
		rows = rows.filter((row) => row.id !== id);
		emit();
	}

	function bulkDelete() {
		rows = rows.filter((row) => !row.selected);
		emit();
	}

	function dismissDuplicate(row: DraftGridRow) {
		row.dismissedDuplicate = true;
		emit();
	}

	// Emit once after mount so hosts (e.g. the batch dialog footer) get the initial
	// draft set + validity without waiting for the first user interaction.
	onMount(emit);

	$effect(() => {
		resolvedImportedCategorySignature;
		untrack(emit);
	});
</script>

<div class={cn('flex min-h-0 flex-col', className)}>
	{#if showStatusLegend}
		<GiftDraftStatusLegend class="mb-4" />
	{/if}

	{#if selectedCount > 0}
		<GiftDraftBulkBar
			{selectedCount}
			selectAllState={headerState}
			onselectall={selectAll}
			ondelete={bulkDelete}
			sticky={!isImport}
		/>
	{/if}

	<!-- Import: the table renders full height and the whole dialog scrolls (the grid
	     header stays sticky against the dialog's scroll container). Batch keeps its
	     own bounded scroll so the surrounding dialog stays compact. -->
	<div
		class={cn(
			'rounded-lg border border-border bg-background',
			isImport ? 'overflow-clip' : 'max-h-[560px] overflow-auto',
		)}
	>
		<!-- Sticky header (desktop only) – hosts the single global select-all -->
		<div
			class={cn(
				'sticky top-0 z-20 hidden border-b border-border-strong bg-surface-3 px-[29px] py-3',
				gridColumns,
			)}
		>
			<span class="flex items-center justify-center">
				<Checkbox
					checked={headerState === 'all'}
					indeterminate={headerState === 'some'}
					onCheckedChange={selectAll}
					aria-label={m.draft_grid_select_all()}
				/>
			</span>
			<span class={DRAFT_COL_LABEL_CLASS}>{m.draft_grid_col_name()}</span>
			<span class={DRAFT_COL_LABEL_CLASS}>{m.draft_grid_col_note()}</span>
			<span class={DRAFT_COL_LABEL_CLASS}>{m.draft_grid_col_links()}</span>
			<span class={DRAFT_COL_LABEL_CLASS}>{m.draft_grid_col_price()}</span>
			<span class={DRAFT_COL_LABEL_CLASS}>{m.draft_grid_col_image()}</span>
			<span class={DRAFT_COL_LABEL_CLASS}>{m.draft_grid_col_category()}</span>
			<span class={DRAFT_COL_LABEL_CLASS}>{m.draft_grid_col_quantity()}</span>
			{#if priorityAvailable}
				<SimpleTooltip text={m.draft_grid_col_priority()} side="top">
					{#snippet asChild(triggerProps)}
						<span
							{...triggerProps}
							class="text-muted-foreground flex items-center justify-center"
						>
							<HeartIcon class="size-3.5" aria-hidden="true" />
							<span class="sr-only">{m.draft_grid_col_priority()}</span>
						</span>
					{/snippet}
				</SimpleTooltip>
			{/if}
			<SimpleTooltip text={m.draft_grid_col_enrich()} side="top">
				{#snippet asChild(triggerProps)}
					<span {...triggerProps} class={cn(DRAFT_COL_LABEL_CLASS, 'text-center')}>
						<SparklesIcon class="size-3.5" aria-hidden="true" />
						<span class="sr-only">{m.draft_grid_col_enrich()}</span>
					</span>
				{/snippet}
			</SimpleTooltip>
		</div>

		<div class="flex flex-col gap-2 p-2">
			{#each rows as row, index (row.id)}
				<GiftDraftRow
					bind:row={rows[index]}
					status={rowStatus(row)}
					showPriority={priorityAvailable}
					{categoryOptions}
					{resolvedImportedCategoryLabels}
					onchange={emit}
					ondelete={() => removeRow(row.id)}
					ondismissduplicate={() => dismissDuplicate(row)}
				/>
			{/each}

			{#if showAddRow}
				<button
					type="button"
					onclick={addRow}
					class="flex w-full items-center justify-center gap-2.5 rounded-lg border-[1.5px] border-dashed border-border-strong px-4 py-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					<PlusIcon class="size-4" aria-hidden="true" />
					{m.draft_grid_add_row()}
				</button>
			{/if}
		</div>
	</div>
</div>
