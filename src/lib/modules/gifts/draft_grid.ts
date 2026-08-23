/**
 * Pure presentation logic for the editable gift-draft grid (import Review step +
 * batch-add dialog). Keeps status/selection derivation out of the Svelte
 * components so it can be unit-tested in isolation.
 */

/** At-a-glance status that tints a whole draft row/card. */
export const ROW_STATUS = {
	/** Valid, ready to commit (green). */
	ready: 'ready',
	/** Matches an existing gift by name or link – advisory only (orange). */
	duplicate: 'duplicate',
	/** Missing required name on a touched row (red). */
	error: 'error',
	/** Untouched batch starter row – no tint until edited. */
	neutral: 'neutral',
} as const;

export type RowStatus = (typeof ROW_STATUS)[keyof typeof ROW_STATUS];

interface DraftRowStatusInput {
	name: string;
	isDuplicate: boolean;
	/** Any field-level validation problem (for example image URL or quantity). */
	hasValidationError?: boolean;
	/** A pristine row was never touched (untouched batch starter) – stays neutral while blank. */
	pristine: boolean;
}

/**
 * Derive the whole-card status. Precedence: **error > duplicate > ready**. A
 * blank-named pristine row is `neutral` (avoids premature-validation red on an
 * untouched batch starter); a blank-named touched row is `error`.
 */
export function deriveRowStatus({
	name,
	isDuplicate,
	hasValidationError = false,
	pristine,
}: DraftRowStatusInput): RowStatus {
	if (name.trim() === '') {
		return pristine ? ROW_STATUS.neutral : ROW_STATUS.error;
	}
	if (hasValidationError) {
		return ROW_STATUS.error;
	}
	if (isDuplicate) {
		return ROW_STATUS.duplicate;
	}
	return ROW_STATUS.ready;
}

/** Tri-state of the single global select-all header checkbox. */
export type HeaderSelectionState = 'none' | 'some' | 'all';

/** Compute the header select-all tri-state from the current rows' selection. */
export function headerSelectionState(rows: readonly { selected: boolean }[]): HeaderSelectionState {
	if (rows.length === 0) {
		return 'none';
	}
	let selected = 0;
	for (const row of rows) {
		if (row.selected) {
			selected++;
		}
	}
	if (selected === 0) {
		return 'none';
	}
	return selected === rows.length ? 'all' : 'some';
}
