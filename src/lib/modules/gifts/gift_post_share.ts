import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { normalizeGiftLinks } from './gift_url.js';
import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
import type { DescriptionAppend, GiftLink, UpdateGiftInput } from './types.js';
import type { ImageMetadata } from '$lib/modules/images/types.js';

/** The subset of a gift row the per-field pre-share edit engine compares against. */
export interface PreShareGiftSnapshot {
	name: string;
	description: string | null;
	descriptionAppends: DescriptionAppend[];
	quantity: number | null;
	price: number | null;
	currency: string | null;
	imageUrl: string | null;
	imageKey: string | null;
	imageMeta: ImageMetadata | null;
	links: GiftLink[];
	priorityLevelId: string | null;
}

export interface PostShareEditOutcome {
	/** Non-null => reject the edit with this status + leak-safe code. */
	rejection: { status: number; code: string } | null;
	/** Allowed column writes (excludes updatedAt/editedAfterShareAt). */
	updateData: Record<string, unknown>;
	/** Whether any allowed field actually changed. */
	changed: boolean;
}

function isBlank(value: string | null | undefined): boolean {
	return value === null || value === undefined || value.trim() === '';
}

/** Structural inequality for jsonb-shaped fields (links, imageMeta), normalizing null/undefined. */
export function jsonChanged(a: unknown, b: unknown): boolean {
	return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
}

/**
 * Per-field outcome for an OWNER editing a PRE-SHARE gift on a shared wishlist (REQ-4/6).
 *
 * Surprise-protection invariant: reservation data is never read here. Quantity may only be
 * raised; lowering rejects with a leak-safe code that never references reserved counts.
 */
export function computePreShareOwnerEdit(
	current: PreShareGiftSnapshot,
	input: UpdateGiftInput,
	now: Date,
): PostShareEditOutcome {
	// Rejection checks first – they short-circuit before any updateData is built.
	if (input.name !== undefined && input.name !== current.name) {
		return {
			rejection: { status: 403, code: SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING },
			updateData: {},
			changed: false,
		};
	}

	if (input.quantity !== undefined && input.quantity !== null) {
		if (input.quantity < (current.quantity ?? 1)) {
			return {
				rejection: { status: 400, code: SERVER_ERROR.QUANTITY_CANNOT_BE_LOWERED },
				updateData: {},
				changed: false,
			};
		}
	}

	// A per-segment description edit/delete is only valid within that segment's own grace window
	// (REQ-3). Validate before building any updateData so the rejection short-circuits.
	if (input.descriptionAppendEdit !== undefined) {
		const target = current.descriptionAppends[input.descriptionAppendEdit.index];
		if (target === undefined) {
			return {
				rejection: { status: 404, code: SERVER_ERROR.DESCRIPTION_APPEND_NOT_FOUND },
				updateData: {},
				changed: false,
			};
		}
		if (!isWithinGraceWindow(target.addedAt, now)) {
			return {
				rejection: { status: 403, code: SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING },
				updateData: {},
				changed: false,
			};
		}
	}

	const updateData: Record<string, unknown> = {};
	let changed = false;

	// Per-segment edit/delete (within its window, already validated above). Editing resets the
	// segment's addedAt – re-opening its window (debounce). A blank/null text deletes the segment.
	// Takes precedence over a new-segment append: the two are mutually exclusive.
	if (input.descriptionAppendEdit !== undefined) {
		const { index, text } = input.descriptionAppendEdit;
		const trimmed = text?.trim() ?? '';
		updateData.descriptionAppends =
			trimmed === ''
				? current.descriptionAppends.filter((_, i) => i !== index)
				: current.descriptionAppends.map((append, i) =>
						i === index ? { text: trimmed, addedAt: now.toISOString() } : append,
					);
		changed = true;
	}

	// quantity (already known >= current when provided)
	if (input.quantity !== undefined && input.quantity !== null) {
		if (input.quantity !== (current.quantity ?? 1)) {
			updateData.quantity = input.quantity;
			changed = true;
		}
	}

	// description append engine (skipped when a per-segment edit is supplied – mutually exclusive)
	if (
		input.descriptionAppendEdit === undefined &&
		typeof input.description === 'string' &&
		input.description.trim() !== ''
	) {
		if (isBlank(current.description)) {
			// Empty-at-share edge: the frozen base is empty, so fill it directly (no append).
			updateData.description = input.description;
			changed = true;
		} else {
			updateData.descriptionAppends = [
				...current.descriptionAppends,
				{ text: input.description, addedAt: now.toISOString() },
			];
			changed = true;
		}
	}

	// price
	if (input.price !== undefined && input.price !== current.price) {
		updateData.price = input.price;
		changed = true;
	}

	// currency
	if (input.currency !== undefined && input.currency !== current.currency) {
		updateData.currency = input.currency;
		changed = true;
	}

	// priorityLevelId
	if (input.priorityLevelId !== undefined && input.priorityLevelId !== current.priorityLevelId) {
		updateData.priorityLevelId = input.priorityLevelId;
		changed = true;
	}

	// imageUrl
	if (input.imageUrl !== undefined && input.imageUrl !== current.imageUrl) {
		updateData.imageUrl = input.imageUrl;
		changed = true;
	}

	// imageKey
	if (input.imageKey !== undefined && input.imageKey !== current.imageKey) {
		updateData.imageKey = input.imageKey;
		changed = true;
	}

	// imageMeta (compare by JSON)
	if (input.imageMeta !== undefined && jsonChanged(input.imageMeta, current.imageMeta)) {
		updateData.imageMeta = input.imageMeta;
		changed = true;
	}

	// links (normalize before compare/write)
	if (input.links !== undefined) {
		const normalized = normalizeGiftLinks(input.links);
		if (jsonChanged(normalized, current.links)) {
			updateData.links = normalized;
			changed = true;
		}
	}

	return { rejection: null, updateData, changed };
}
