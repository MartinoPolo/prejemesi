import { createContext } from 'svelte';
import { findDuplicates, validateDraft, type GiftDraft } from '$lib/modules/gifts/gift_draft.js';
import { DEFAULT_GIFT_CURRENCY, type GiftLink } from '$lib/modules/gifts/types.js';
import type { GiftDraftRowStatus } from './gift_draft_grid_variants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GiftDraftRow {
	draft: GiftDraft;
	selected: boolean;
	pristine: boolean;
	duplicateMatch: boolean;
}

export interface ExistingGift {
	name: string;
	links?: readonly GiftLink[] | null;
}

export type SelectAllState = 'all' | 'none' | 'indeterminate';

type GiftDraftGridContext = ReturnType<typeof createGiftDraftGridContext>;

// ---------------------------------------------------------------------------
// Context plumbing
// ---------------------------------------------------------------------------

const [useGiftDraftGrid, setGiftDraftGridInternal] = createContext<GiftDraftGridContext>();
export { useGiftDraftGrid };

export function setGiftDraftGridContext(options: {
	initialDrafts: GiftDraft[];
	existingGifts: ExistingGift[];
	mode: 'import' | 'batch';
}) {
	const context = createGiftDraftGridContext(options);
	setGiftDraftGridInternal(context);
	return context;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyDraft(): GiftDraft {
	return {
		name: '',
		description: null,
		links: [],
		price: null,
		currency: DEFAULT_GIFT_CURRENCY,
	};
}

export function deriveRowStatus(row: GiftDraftRow, mode: 'import' | 'batch'): GiftDraftRowStatus {
	if (row.pristine && mode === 'batch') {
		return 'neutral';
	}
	if (row.draft.name.trim() === '') {
		return 'error';
	}
	if (row.duplicateMatch) {
		return 'duplicate';
	}
	return 'ready';
}

// ---------------------------------------------------------------------------
// Factory (last per convention)
// ---------------------------------------------------------------------------

function createGiftDraftGridContext(options: {
	initialDrafts: GiftDraft[];
	existingGifts: ExistingGift[];
	mode: 'import' | 'batch';
}) {
	// -- mutable state -------------------------------------------------------
	let rows = $state<GiftDraftRow[]>(
		options.initialDrafts.map((draft) => ({
			draft: { ...draft },
			selected: true,
			pristine: false,
			duplicateMatch: findDuplicates(draft, options.existingGifts).length > 0,
		})),
	);

	const mode = options.mode;
	const existingGifts = options.existingGifts;

	// -- derived state -------------------------------------------------------
	const selectAllState = $derived.by<SelectAllState>(() => {
		if (rows.length === 0) {
			return 'none';
		}
		const selectedCount = rows.filter((r) => r.selected).length;
		if (selectedCount === 0) {
			return 'none';
		}
		if (selectedCount === rows.length) {
			return 'all';
		}
		return 'indeterminate';
	});

	const selectedCount = $derived(rows.filter((r) => r.selected).length);

	const validSelectedCount = $derived(
		rows.filter((r) => r.selected && validateDraft(r.draft).valid).length,
	);

	const committableRows = $derived(
		rows
			.filter((r) => r.selected && validateDraft(r.draft).valid)
			.map((r) => {
				const { normalized } = validateDraft(r.draft);
				return {
					name: normalized.name,
					description: normalized.description,
					links: normalized.links.length > 0 ? normalized.links : null,
					price: normalized.price,
					currency: normalized.currency,
				};
			}),
	);

	// -- methods -------------------------------------------------------------

	function updateDraft(index: number, partial: Partial<GiftDraft>) {
		const row = rows[index];
		if (row == null) {
			return;
		}
		const updatedDraft = { ...row.draft, ...partial };
		const duplicateMatch = findDuplicates(updatedDraft, existingGifts).length > 0;
		rows[index] = {
			...row,
			draft: updatedDraft,
			pristine: false,
			duplicateMatch,
		};
		// Trigger reactivity
		rows = [...rows];
	}

	function toggleSelection(index: number) {
		const row = rows[index];
		if (row == null) {
			return;
		}
		rows[index] = { ...row, selected: !row.selected };
		rows = [...rows];
	}

	function toggleSelectAll() {
		const allSelected = selectAllState === 'all';
		rows = rows.map((r) => ({ ...r, selected: !allSelected }));
	}

	function removeRows(indices: number[]) {
		const indexSet = new Set(indices);
		rows = rows.filter((_, i) => !indexSet.has(i));
	}

	function addRow() {
		rows = [
			...rows,
			{
				draft: createEmptyDraft(),
				selected: true,
				pristine: true,
				duplicateMatch: false,
			},
		];
	}

	function addLink(rowIndex: number, url: string) {
		const row = rows[rowIndex];
		if (row == null) {
			return;
		}
		const newLinks = [...row.draft.links, { url }];
		updateDraft(rowIndex, { links: newLinks });
	}

	function removeLink(rowIndex: number, linkIndex: number) {
		const row = rows[rowIndex];
		if (row == null) {
			return;
		}
		const newLinks = row.draft.links.filter((_, i) => i !== linkIndex);
		updateDraft(rowIndex, { links: newLinks });
	}

	function dismissDuplicate(index: number) {
		const row = rows[index];
		if (row == null) {
			return;
		}
		rows[index] = { ...row, duplicateMatch: false };
		rows = [...rows];
	}

	return {
		get rows() {
			return rows;
		},
		mode,
		get selectAllState() {
			return selectAllState;
		},
		get selectedCount() {
			return selectedCount;
		},
		get validSelectedCount() {
			return validSelectedCount;
		},
		get committableRows() {
			return committableRows;
		},
		updateDraft,
		toggleSelection,
		toggleSelectAll,
		removeRows,
		addRow,
		addLink,
		removeLink,
		dismissDuplicate,
	};
}
