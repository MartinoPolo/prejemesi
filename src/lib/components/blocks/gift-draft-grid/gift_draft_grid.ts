import { validateDraft, type GiftDraft } from '$lib/modules/gifts/gift_draft.js';
import { DEFAULT_GIFT_CURRENCY, type GiftDraftInput } from '$lib/modules/gifts/types.js';

// ── Types ───────────────────────────────────────────────────────────────────

/** Status of a single row in the draft grid. */
export type DraftRowStatus = 'ready' | 'error' | 'excluded' | 'pristine';

/** A single row in the batch-add draft grid. */
export interface GridDraftRow {
	/** Unique client-side identifier for keyed rendering. */
	id: string;
	/** The editable draft data. */
	draft: GiftDraft;
	/** Whether this row is selected for commit. */
	selected: boolean;
	/** Whether the user has interacted with this row (typed, pasted, etc.). */
	touched: boolean;
}

// ── Pure functions ──────────────────────────────────────────────────────────

let rowCounter = 0;

/** Create a blank draft with default values. */
export function createBlankDraft(): GiftDraft {
	return {
		name: '',
		description: null,
		links: [],
		price: null,
		currency: DEFAULT_GIFT_CURRENCY,
	};
}

/** Create a new blank row ready for the grid. */
export function createBlankRow(): GridDraftRow {
	return {
		id: `draft-${++rowCounter}`,
		draft: createBlankDraft(),
		selected: true,
		touched: false,
	};
}

/** Count rows that are both selected and have a non-empty (trimmed) name. */
export function getValidSelectedCount(rows: readonly GridDraftRow[]): number {
	let count = 0;
	for (const row of rows) {
		if (row.selected && row.draft.name.trim() !== '') {
			count++;
		}
	}
	return count;
}

/** Determine the visual status of a draft row. */
export function getDraftStatus(row: Readonly<GridDraftRow>): DraftRowStatus {
	if (!row.selected) {
		return 'excluded';
	}
	const hasName = row.draft.name.trim() !== '';
	if (hasName) {
		return 'ready';
	}
	if (row.touched) {
		return 'error';
	}
	return 'pristine';
}

/**
 * Whether the grid has unsaved changes worth guarding with a discard confirm.
 * A single blank untouched row is the initial state and not dirty.
 */
export function isDirty(rows: readonly GridDraftRow[]): boolean {
	if (rows.length !== 1) {
		return true;
	}
	const only = rows[0]!;
	return only.touched || only.draft.name.trim() !== '' || only.draft.links.length > 0;
}

/**
 * Convert valid+selected grid rows to the wire format expected by `importGifts`.
 * Invalid rows (blank trimmed name) and deselected rows are excluded.
 */
export function toGiftDraftInputs(rows: readonly GridDraftRow[]): GiftDraftInput[] {
	const results: GiftDraftInput[] = [];
	for (const row of rows) {
		if (!row.selected) {
			continue;
		}
		const { valid, normalized } = validateDraft(row.draft);
		if (!valid) {
			continue;
		}
		results.push({
			name: normalized.name,
			description: normalized.description,
			links: normalized.links,
			price: normalized.price,
			currency: normalized.currency,
		});
	}
	return results;
}
