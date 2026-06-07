import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { normalizeGiftLinks } from './gift_url.js';
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
	// Rejection checks first — they short-circuit before any updateData is built.
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

	const updateData: Record<string, unknown> = {};
	let changed = false;

	// quantity (already known >= current when provided)
	if (input.quantity !== undefined && input.quantity !== null) {
		if (input.quantity !== (current.quantity ?? 1)) {
			updateData.quantity = input.quantity;
			changed = true;
		}
	}

	// description append engine
	if (typeof input.description === 'string' && input.description.trim() !== '') {
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
