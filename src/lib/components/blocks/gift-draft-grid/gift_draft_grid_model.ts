import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';
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

/** Payload emitted on every change: the committable drafts and their count. */
export interface DraftGridChange {
	drafts: GiftDraft[];
	validCount: number;
}

/** Editor-local state for one draft row. Mirrors {@link GiftDraft} with UI-only fields. */
export interface DraftGridRow {
	/** Stable identity for keyed `{#each}` and selection – never sent to the server. */
	id: string;
	name: string;
	/** Raw textarea value; normalized to `null` when blank on emit. */
	description: string;
	links: GiftLink[];
	/** Raw price text (whole units); parsed to an integer on emit. */
	price: string;
	currency: GiftCurrency;
	/** Binary priority toggled via the heart control; medium until set high. */
	priority: DraftPriority;
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
		priority: init?.priority ?? DEFAULT_DRAFT_PRIORITY,
		selected: opts?.selected ?? true,
		pristine: opts?.pristine ?? false,
		dismissedDuplicate: false,
	};
}

/** Convert an editor row back into a wire {@link GiftDraft} (blank fields → null/empty). */
export function rowToDraft(row: DraftGridRow): GiftDraft {
	const trimmedPrice = row.price.trim();
	const parsed = trimmedPrice === '' ? null : Math.round(Number(trimmedPrice));
	return {
		name: row.name,
		description: row.description.trim() === '' ? null : row.description,
		links: row.links.filter((link) => link.url.trim() !== ''),
		price: parsed !== null && Number.isFinite(parsed) ? parsed : null,
		currency: row.currency,
		priority: row.priority,
	};
}
