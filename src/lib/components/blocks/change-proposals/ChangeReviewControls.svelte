<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import { pluralCopy } from '$lib/modules/change_proposals/change_review_copy.js';
	import {
		CHANGE_REVIEW_FILTER,
		isChangeReviewFilter,
		type ChangeReviewFilter,
	} from './change_review_rows.js';

	const SELECTED_COUNTS = {
		one: m.change_review_selected_count_one,
		few: m.change_review_selected_count_few,
		other: m.change_review_selected_count_other,
	};

	/** "Vybrat vše" over ordinary rows, the selected count and the row filter. */
	let {
		filter = $bindable(),
		allSelected,
		someSelected,
		selectedCount,
		selectableCount,
		filterCounts,
		ontoggleall,
	}: {
		filter: ChangeReviewFilter;
		allSelected: boolean;
		someSelected: boolean;
		selectedCount: number;
		selectableCount: number;
		filterCounts: Record<ChangeReviewFilter, number>;
		ontoggleall: () => void;
	} = $props();

	const filters = $derived([
		{ value: CHANGE_REVIEW_FILTER.all, label: m.change_review_filter_all() },
		{ value: CHANGE_REVIEW_FILTER.confirm, label: m.change_review_filter_confirm() },
		{ value: CHANGE_REVIEW_FILTER.conflicts, label: m.change_review_filter_conflicts() },
	]);
	const selectedCountText = $derived(
		pluralCopy<{ count: number; selected: number; total: number }>(SELECTED_COUNTS, {
			count: selectableCount,
			selected: selectedCount,
			total: selectableCount,
		}),
	);
</script>

<div class="list-controls">
	<div class="master">
		<Checkbox
			id="change-review-select-all"
			size="md"
			checked={allSelected}
			indeterminate={someSelected}
			aria-describedby="change-review-select-all-note"
			onCheckedChange={ontoggleall}
			data-testid="change-review-select-all"
		/>
		<label class="master-label" for="change-review-select-all">
			{m.change_review_select_all()}
		</label>
		<span class="master-note" id="change-review-select-all-note">
			{m.change_review_select_all_note()}
		</span>
		<span class="master-count" aria-live="polite">{selectedCountText}</span>
	</div>
	<div class="filters">
		<SegmentedToggle.Root
			value={filter}
			onValueChange={(value) => {
				if (isChangeReviewFilter(value)) {
					filter = value;
				}
			}}
			aria-label={m.change_review_filter_label()}
		>
			{#each filters as option (option.value)}
				<SegmentedToggle.Item
					value={option.value}
					data-testid="change-review-filter-{option.value}"
				>
					{option.label}<span class="filter-count">{filterCounts[option.value]}</span>
				</SegmentedToggle.Item>
			{/each}
		</SegmentedToggle.Root>
	</div>
</div>

<style>
	.list-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px var(--space-4);
		margin-top: var(--space-6);
	}

	.master {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}

	.master-label {
		font-weight: 700;
		cursor: pointer;
	}

	.master-note {
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	.master-count {
		padding-left: var(--space-3);
		border-left: 2px solid var(--border-strong);
		font-size: var(--text-md);
		font-weight: 600;
	}

	.filter-count {
		min-width: 18px;
		height: 18px;
		margin-left: 6px;
		padding: 0 5px;
		border-radius: 999px;
		background: color-mix(in oklab, var(--ink) 10%, transparent);
		font-size: var(--text-xs);
		font-weight: 800;
		line-height: 18px;
		text-align: center;
	}

	@media (width < 640px) {
		/* A wrapping column sizes its line to the widest item, so the filters would not shrink to the phone. */
		.list-controls {
			flex-flow: column nowrap;
			align-items: stretch;
		}

		.master {
			flex-wrap: wrap;
		}

		.master-count {
			flex-basis: 100%;
			padding-left: 0;
			border-left: 0;
		}

		/* The filters outgrow a phone, so they scroll sideways edge to edge like tabs. */
		.filters {
			margin: calc(-1 * var(--space-1)) calc(-1 * var(--page-gutter));
			padding: var(--space-1) var(--page-gutter);
			overflow-x: auto;
			scrollbar-width: none;
		}
	}
</style>
