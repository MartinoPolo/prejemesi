import {
	validateDraft,
	type GiftDraft,
	type ValidatedGiftDraft,
} from '$lib/modules/gifts/gift_draft.js';
import {
	DEFAULT_DRAFT_PRIORITY,
	DEFAULT_GIFT_CURRENCY,
	type DraftPriority,
	type GiftCurrency,
	type GiftLink,
} from '$lib/modules/gifts/types.js';

/**
 * Which host embeds the grid. `import` pre-fills rows from a parse and flags
 * possible duplicates; `batch` starts with one blank row and offers add-row.
 */
export const DRAFT_GRID_CONTEXT = {
	import: 'import',
	batch: 'batch',
} as const;

export type DraftGridContext = (typeof DRAFT_GRID_CONTEXT)[keyof typeof DRAFT_GRID_CONTEXT];

/** Minimal existing-gift shape the grid dedups parsed rows against (import context). */
export interface ExistingGiftRef {
	name: string;
	links?: readonly GiftLink[] | null;
}

/** Payload emitted on every change, including selected rows that block submission. */
export interface DraftGridChange {
	drafts: ValidatedGiftDraft[];
	selectedDrafts: GiftDraft[];
	validCount: number;
	selectedCount: number;
	blockingCount: number;
}

/** Editor-local state for one draft row. Mirrors {@link GiftDraft} with UI-only fields. */
export interface DraftGridRow {
	/** Stable identity for keyed `{#each}` and selection – never sent to the server. */
	id: string;
	name: string;
	/** Raw textarea value; normalized to `null` when blank on emit. */
	description: string;
	links: GiftLink[];
	/** Raw price text; parsed to a finite number on emit. */
	price: string;
	currency: GiftCurrency;
	/** Raw URL remains editable; validation permits HTTPS only. */
	imageUrl: string;
	/** Raw quantity remains editable so invalid imports can show row feedback. */
	quantity: string;
	/** Binary priority toggled via the heart control; medium until set high. */
	priority: DraftPriority;
	categoryId: string;
	importedCategoryLabel: string;
	selected: boolean;
	/** Untouched batch starter – suppresses the premature error tint while blank. */
	pristine: boolean;
	/** User dismissed the possible-duplicate flag for this row. */
	dismissedDuplicate: boolean;
}

/** Build a fresh editor row from an optional seed draft. */
export function createDraftGridRow(
	init?: Partial<GiftDraft>,
	opts?: { selected?: boolean; pristine?: boolean },
): DraftGridRow {
	return {
		id: `draft-row-${crypto.randomUUID()}`,
		name: init?.name ?? '',
		description: init?.description ?? '',
		links: (init?.links ?? []).map((link) => ({ ...link })),
		price: init?.price != null ? String(init.price) : '',
		currency: init?.currency ?? DEFAULT_GIFT_CURRENCY,
		imageUrl: init?.imageUrl ?? '',
		quantity: init?.quantity === undefined ? '1' : String(init.quantity),
		priority: init?.priority ?? DEFAULT_DRAFT_PRIORITY,
		categoryId: init?.categoryId ?? '',
		importedCategoryLabel: init?.importedCategoryLabel ?? '',
		selected: opts?.selected ?? true,
		pristine: opts?.pristine ?? false,
		dismissedDuplicate: false,
	};
}

/** Convert an editor row back into a wire {@link GiftDraft} (blank fields → null/empty). */
export function rowToDraft(row: DraftGridRow): GiftDraft {
	const trimmedPrice = row.price.trim();
	const parsed = trimmedPrice === '' ? null : Number(trimmedPrice);
	const trimmedQuantity = row.quantity.trim();
	const parsedQuantity = Number(trimmedQuantity);
	return {
		name: row.name,
		description: row.description.trim() === '' ? null : row.description,
		links: row.links.filter((link) => link.url.trim() !== ''),
		price: parsed,
		currency: row.currency,
		imageUrl: row.imageUrl.trim() || null,
		quantity:
			trimmedQuantity !== '' && Number.isInteger(parsedQuantity)
				? parsedQuantity
				: row.quantity,
		priority: row.priority,
		categoryId: row.categoryId || null,
		importedCategoryLabel: row.importedCategoryLabel.trim() || null,
	};
}

/** Collect only selected, valid rows whose duplicate warning was acknowledged. */
export function collectDraftGridChange(
	rows: readonly DraftGridRow[],
	hasDuplicateWarning: (row: DraftGridRow) => boolean,
	resolvedImportedCategoryLabels: ReadonlySet<string> = new Set(),
): DraftGridChange {
	const drafts: ValidatedGiftDraft[] = [];
	const selectedDrafts: GiftDraft[] = [];
	let selectedCount = 0;
	let blockingCount = 0;

	for (const row of rows) {
		if (!row.selected) {
			continue;
		}
		selectedCount++;
		const draft = rowToDraft(row);
		selectedDrafts.push(draft);
		const validation = validateDraft(draft, { resolvedImportedCategoryLabels });
		const unresolvedDuplicate = !row.dismissedDuplicate && hasDuplicateWarning(row);
		if (!validation.valid || unresolvedDuplicate) {
			blockingCount++;
			continue;
		}
		drafts.push(validation.normalized);
	}

	return { drafts, selectedDrafts, validCount: drafts.length, selectedCount, blockingCount };
}
