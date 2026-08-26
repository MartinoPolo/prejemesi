<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/base/input/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import { detectColumns, type DetectedColumn } from '$lib/modules/import/detect_columns.js';
	import {
		findDuplicates,
		type GiftDraft,
		type ValidatedGiftDraft,
	} from '$lib/modules/gifts/gift_draft.js';
	import type { GiftLink } from '$lib/modules/gifts/types.js';
	import { GIFT_CATEGORY_PRESET_BY_KEY } from '$lib/modules/gift-categories/presets.js';
	import {
		labelForGiftCategory,
		normalizeGiftCategoryLabel,
		presetLabelsByNormalizedValue,
		type ManagedGiftCategory,
		type GiftCategoryPresetKey,
	} from '$lib/modules/gift-categories/types.js';
	import type { ImportCategoryResolution } from '$lib/modules/import/import_types.js';
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
	import { WISHLIST_TITLE_MAX_LENGTH } from '$lib/modules/wishlists/types.js';
	import { WIZARD_MODE, normalizeColumnRoles, type WizardMode } from './import_wizard_types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';

	interface ImportReviewStepProps {
		parsedRows: string[][];
		filename?: string;
		mode: WizardMode;
		existingGifts?: Array<{ name: string; links: GiftLink[] }>;
		/** Show the priority heart column (hidden when the target lacks ≥2 levels). */
		priorityAvailable?: boolean;
		categoryOptions?: ManagedGiftCategory[];
		/**
		 * Whether the parent attempted to advance past this step with an invalid title.
		 * Bindable so `ImportWizard` can force the inline error to surface on a blocked
		 * "Next" click, matching the touched-on-submit-attempt pattern used elsewhere.
		 */
		titleTouched?: boolean;
		onready: (data: {
			drafts: ValidatedGiftDraft[];
			title?: string;
			categoryResolutions: ImportCategoryResolution[];
		}) => void;
	}

	let {
		parsedRows,
		filename,
		mode,
		existingGifts = [],
		priorityAvailable = true,
		categoryOptions = [],
		titleTouched = $bindable(false),
		onready,
	}: ImportReviewStepProps = $props();

	// Column detection – derived from props so it stays reactive
	const detectionResult = $derived(detectColumns(parsedRows));

	// Mutable column overrides (user can remap roles). Normalized so a single-use
	// role never appears on two columns (the field-oriented mapping shows one).
	let columnOverrides = $state<DetectedColumn[] | null>(null);
	const columns = $derived(normalizeColumnRoles(columnOverrides ?? detectionResult.columns));

	// Title for new-list mode – initialized once from props (component remounts on each dialog open).
	// untrack prevents Svelte from treating props as reactive dependencies of the $state initializer.
	let title = $state(
		untrack(() => (mode === WIZARD_MODE.newList ? deriveWishlistTitle(filename ?? '') : '')),
	);
	const trimmedTitle = $derived(title.trim());
	const titleError = $derived(
		mode === WIZARD_MODE.newList && titleTouched && trimmedTitle === ''
			? m.wishlist_name_required()
			: '',
	);

	// Data rows (respecting detection boundaries)
	const dataRows = $derived(
		parsedRows.slice(detectionResult.dataStartIndex, detectionResult.dataEndIndex),
	);

	// Build drafts from data rows + column mapping
	const drafts = $derived(buildDraftRows(dataRows, columns, categoryOptions));

	// Grid change tracking
	let gridDrafts = $state<ValidatedGiftDraft[]>([]);
	let gridSelectedDrafts = $state<GiftDraft[]>([]);
	let gridHasEmitted = $state(false);
	let gridValidCount = $state(0);
	let gridSelectedCount = $state(0);
	let gridBlockingCount = $state(0);

	type CategoryResolutionDraft =
		| { action: ''; categoryId: ''; label: ''; presetKey: null }
		| { action: 'map-existing'; categoryId: string; label: ''; presetKey: null }
		| { action: 'enable-preset'; categoryId: ''; label: ''; presetKey: GiftCategoryPresetKey }
		| { action: 'create-custom'; categoryId: ''; label: string; presetKey: null };

	let categoryResolutionDrafts = $state<Record<string, CategoryResolutionDraft>>({});
	const presetMatches = $derived(presetLabelsByNormalizedValue());
	const importedUnresolvedCategoryLabels = $derived.by(() => {
		const labels = new Map<string, string>();
		for (const draft of gridHasEmitted ? gridSelectedDrafts : drafts) {
			const label = draft.importedCategoryLabel?.trim() ?? '';
			if (label === '' || draft.categoryId != null) {
				continue;
			}
			labels.set(normalizeGiftCategoryLabel(label), label);
		}
		return [...labels.entries()].map(([normalized, label]) => ({ normalized, label }));
	});

	function categoryLabel(category: ManagedGiftCategory): string {
		return labelForGiftCategory(category, getLocale().startsWith('en') ? 'en' : 'cs');
	}

	function presetLabel(presetKey: GiftCategoryPresetKey): string {
		return (
			GIFT_CATEGORY_PRESET_BY_KEY.get(presetKey)?.labels[
				getLocale().startsWith('en') ? 'en' : 'cs'
			] ?? presetKey
		);
	}

	function emptyCategoryResolution(): CategoryResolutionDraft {
		return { action: '', categoryId: '', label: '', presetKey: null };
	}

	function categoryResolutionFor(normalized: string): CategoryResolutionDraft {
		return categoryResolutionDrafts[normalized] ?? emptyCategoryResolution();
	}

	function updateCategoryResolution(normalized: string, draft: CategoryResolutionDraft) {
		categoryResolutionDrafts = { ...categoryResolutionDrafts, [normalized]: draft };
	}

	function updateCategoryResolutionAction(
		label: string,
		action: CategoryResolutionDraft['action'],
	) {
		const normalized = normalizeGiftCategoryLabel(label);
		const presetKey = presetMatches.get(normalized) ?? null;
		if (action === 'map-existing') {
			updateCategoryResolution(normalized, {
				action,
				categoryId: categoryOptions[0]?.id ?? '',
				label: '',
				presetKey: null,
			});
		} else if (action === 'enable-preset' && presetKey !== null) {
			updateCategoryResolution(normalized, {
				action,
				categoryId: '',
				label: '',
				presetKey,
			});
		} else if (action === 'create-custom' && presetKey === null) {
			updateCategoryResolution(normalized, {
				action,
				categoryId: '',
				label,
				presetKey: null,
			});
		} else {
			updateCategoryResolution(normalized, emptyCategoryResolution());
		}
	}

	function completeCategoryResolution(
		label: string,
		resolution: CategoryResolutionDraft,
	): ImportCategoryResolution | null {
		if (resolution.action === 'map-existing' && resolution.categoryId !== '') {
			return {
				action: 'map-existing',
				sourceLabel: label,
				categoryId: resolution.categoryId,
			};
		}
		if (resolution.action === 'enable-preset' && resolution.presetKey !== null) {
			return { action: 'enable-preset', sourceLabel: label, presetKey: resolution.presetKey };
		}
		if (resolution.action === 'create-custom' && resolution.label.trim() !== '') {
			return { action: 'create-custom', sourceLabel: label, label: resolution.label.trim() };
		}
		return null;
	}

	const categoryResolutions = $derived(
		importedUnresolvedCategoryLabels
			.map(({ label, normalized }) =>
				completeCategoryResolution(label, categoryResolutionFor(normalized)),
			)
			.filter((resolution): resolution is ImportCategoryResolution => resolution !== null),
	);
	const resolvedImportedCategoryLabels = $derived(
		new Set(
			categoryResolutions.map((resolution) =>
				normalizeGiftCategoryLabel(resolution.sourceLabel),
			),
		),
	);
	const hasIncompleteCategoryResolution = $derived(
		importedUnresolvedCategoryLabels.length !== categoryResolutions.length,
	);

	// GiftDraftGrid seeds its internal rows from initialRows once at mount. Remapping
	// columns re-derives `drafts`, so this signature changes and remounts the grid,
	// rebuilding it from the new mapping (in-grid edits are intentionally reset).
	const mappingKey = $derived(columns.map((col) => `${col.index}:${col.role}`).join('|'));

	// Check if name column is mapped
	const hasNameColumn = $derived(columns.some((col) => col.role === 'name'));

	function handleGridChange(change: DraftGridChange) {
		gridHasEmitted = true;
		gridDrafts = change.drafts;
		gridSelectedDrafts = change.selectedDrafts;
		gridValidCount = change.validCount;
		gridSelectedCount = change.selectedCount;
		gridBlockingCount = change.blockingCount;
	}

	// Forward gate: name column mapped, at least one valid row, and no selected blockers.
	const canProceed = $derived(
		hasNameColumn &&
			gridValidCount > 0 &&
			gridBlockingCount === 0 &&
			!hasIncompleteCategoryResolution,
	);

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

	// Always notify the parent so a later blocking edit clears stale ready drafts.
	$effect(() => {
		onready({
			drafts: canProceed ? gridDrafts : [],
			title: mode === WIZARD_MODE.newList ? title : undefined,
			categoryResolutions: canProceed ? categoryResolutions : [],
		});
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
			<Field
				fieldId="import-wizard-title"
				label={m.import_wizard_review_title_label()}
				errorMessage={titleError}
			>
				{#snippet children({ hasError, errorId }: FieldControlContext)}
					<Input
						id="import-wizard-title"
						bind:value={title}
						placeholder={m.import_wizard_review_title_placeholder()}
						required
						maxlength={WISHLIST_TITLE_MAX_LENGTH}
						state={hasError ? 'error' : 'default'}
						aria-invalid={hasError ? true : undefined}
						aria-describedby={errorId}
						oninput={() => (titleTouched = true)}
						onblur={() => (titleTouched = true)}
					/>
				{/snippet}
			</Field>
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

		{#if importedUnresolvedCategoryLabels.length > 0}
			<Alert.Root tone={hasIncompleteCategoryResolution ? 'warning' : 'default'}>
				<AlertCircleIcon class="size-4" />
				<div class="flex flex-col gap-3">
					<div>
						<p class="text-sm font-semibold">{m.import_category_resolution_title()}</p>
						<Alert.Description>{m.import_category_resolution_help()}</Alert.Description>
					</div>
					<div class="flex flex-col gap-3">
						{#each importedUnresolvedCategoryLabels as { normalized, label } (normalized)}
							{@const resolution = categoryResolutionFor(normalized)}
							{@const presetKey = presetMatches.get(normalized) ?? null}
							<div
								class="grid gap-2 rounded-md border border-border bg-surface p-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)_minmax(12rem,18rem)]"
							>
								<div class="min-w-0">
									<p class="truncate text-sm font-semibold">{label}</p>
									{#if completeCategoryResolution(label, resolution) === null}
										<HelpText state="error">
											{resolution.action === 'create-custom'
												? m.import_category_resolution_bad_custom()
												: m.import_category_resolution_missing({ label })}
										</HelpText>
									{/if}
								</div>
								<Select.Root
									type="single"
									value={resolution.action}
									onValueChange={(value) =>
										updateCategoryResolutionAction(
											label,
											value as CategoryResolutionDraft['action'],
										)}
								>
									<Select.Trigger size="md">
										{#if resolution.action === 'map-existing'}
											{m.import_category_resolution_map_existing()}
										{:else if resolution.action === 'enable-preset' && presetKey !== null}
											{m.import_category_resolution_enable_preset({
												label: presetLabel(presetKey),
											})}
										{:else if resolution.action === 'create-custom'}
											{m.import_category_resolution_create_custom()}
										{:else}
											{m.import_category_resolution_select()}
										{/if}
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											<Select.Item
												value=""
												label={m.import_category_resolution_select()}
											>
												{m.import_category_resolution_select()}
											</Select.Item>
											{#if categoryOptions.length > 0}
												<Select.Item
													value="map-existing"
													label={m.import_category_resolution_map_existing()}
												>
													{m.import_category_resolution_map_existing()}
												</Select.Item>
											{/if}
											{#if presetKey !== null}
												<Select.Item
													value="enable-preset"
													label={m.import_category_resolution_enable_preset(
														{
															label: presetLabel(presetKey),
														},
													)}
												>
													{m.import_category_resolution_enable_preset({
														label: presetLabel(presetKey),
													})}
												</Select.Item>
											{/if}
											{#if presetKey === null}
												<Select.Item
													value="create-custom"
													label={m.import_category_resolution_create_custom()}
												>
													{m.import_category_resolution_create_custom()}
												</Select.Item>
											{/if}
										</Select.Group>
									</Select.Content>
								</Select.Root>
								{#if resolution.action === 'map-existing'}
									<Select.Root
										type="single"
										value={resolution.categoryId}
										onValueChange={(categoryId) =>
											updateCategoryResolution(normalized, {
												action: 'map-existing',
												categoryId,
												label: '',
												presetKey: null,
											})}
									>
										<Select.Trigger size="md">
											{categoryOptions.find(
												(category) => category.id === resolution.categoryId,
											)
												? categoryLabel(
														categoryOptions.find(
															(category) =>
																category.id ===
																resolution.categoryId,
														)!,
													)
												: m.import_category_resolution_existing_label()}
										</Select.Trigger>
										<Select.Content>
											<Select.Group>
												{#each categoryOptions as category (category.id)}
													{@const targetLabel = categoryLabel(category)}
													<Select.Item
														value={category.id}
														label={targetLabel}
														>{targetLabel}</Select.Item
													>
												{/each}
											</Select.Group>
										</Select.Content>
									</Select.Root>
								{:else if resolution.action === 'create-custom'}
									<Input
										value={resolution.label}
										maxlength={80}
										aria-label={m.import_category_resolution_custom_label()}
										oninput={(event) =>
											updateCategoryResolution(normalized, {
												action: 'create-custom',
												categoryId: '',
												label: event.currentTarget.value,
												presetKey: null,
											})}
									/>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</Alert.Root>
		{/if}

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
					selected: gridSelectedCount,
					total: drafts.length,
				})}
			</HelpText>
			{#if skippedCount > 0}
				<HelpText>
					{m.import_wizard_skipped_rows({ count: skippedCount })}
				</HelpText>
			{/if}
		</div>

		<!-- Editable draft grid – renders full height; the whole dialog body scrolls.
		     Keyed on the mapping so a remap rebuilds the grid from the new columns. -->
		{#key mappingKey}
			<GiftDraftGrid
				context={DRAFT_GRID_CONTEXT.import}
				initialRows={drafts}
				{existingGifts}
				allowAddRow={false}
				showLegend={false}
				{priorityAvailable}
				{categoryOptions}
				{resolvedImportedCategoryLabels}
				onchange={handleGridChange}
			/>
		{/key}
	</div>

	<!-- Existing items panel (append mode) – large screens inline -->
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
