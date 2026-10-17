import { error } from '@sveltejs/kit';
import { inArray } from 'drizzle-orm';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { agentImage } from '$lib/server/db/agent_image.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { DEFAULT_IMAGE_METADATA } from '$lib/modules/images/types.js';
import type { LookupDatabase } from './policy_lookups.js';

/** The agent input field naming an image from `POST /api/v1/images`. */
export const IMAGE_REFERENCE_FIELD = 'imageReference';

/** An agent's input split into what the core validates and the image reference it names. */
export type ImageReferenceSplit =
	| { imageReference: null; coreInput: unknown }
	| { imageReference: string; coreInput: Record<string, unknown> };

/** A resolved reference: the user's own stored image for the wishlist the call changes. */
export interface AgentImageBinding {
	referenceId: string;
	objectKey: string;
}

function invalidReference(): never {
	error(400, SERVER_ERROR.AGENT_IMAGE_REFERENCE_INVALID);
}

/** Whether the input names an image reference anywhere, e.g. on an imported draft. */
export function namesImageReference(rawInput: unknown): boolean {
	if (Array.isArray(rawInput)) {
		return rawInput.some(namesImageReference);
	}
	if (typeof rawInput !== 'object' || rawInput === null) {
		return false;
	}
	return (
		Object.hasOwn(rawInput, IMAGE_REFERENCE_FIELD) ||
		Object.values(rawInput).some(namesImageReference)
	);
}

export function splitImageReference(rawInput: unknown): ImageReferenceSplit {
	if (
		typeof rawInput !== 'object' ||
		rawInput === null ||
		Array.isArray(rawInput) ||
		!Object.hasOwn(rawInput, IMAGE_REFERENCE_FIELD)
	) {
		return { imageReference: null, coreInput: rawInput };
	}
	const imageReference: unknown = Reflect.get(rawInput, IMAGE_REFERENCE_FIELD);
	if (typeof imageReference !== 'string' || imageReference === '') {
		invalidReference();
	}
	const coreInput = Object.fromEntries(
		Object.entries(rawInput).filter(([field]) => field !== IMAGE_REFERENCE_FIELD),
	);
	return { imageReference, coreInput };
}

/**
 * The core input setting the referenced image as the gift's stored image: any image URL is
 * cleared, and a new image starts with automatic framing unless the input sets its own.
 */
export function inputWithBoundImage(
	coreInput: Record<string, unknown>,
	binding: AgentImageBinding,
): Record<string, unknown> {
	return {
		imageMeta: DEFAULT_IMAGE_METADATA,
		...coreInput,
		imageKey: binding.objectKey,
		imageUrl: null,
	};
}

type StoredImageReference = Pick<
	typeof agentImage.$inferSelect,
	'id' | 'userId' | 'wishlistId' | 'objectKey' | 'expiresAt' | 'attachedAt'
>;

const STORED_REFERENCE_COLUMNS = {
	id: agentImage.id,
	userId: agentImage.userId,
	wishlistId: agentImage.wishlistId,
	objectKey: agentImage.objectKey,
	expiresAt: agentImage.expiresAt,
	attachedAt: agentImage.attachedAt,
};

/**
 * 400 for an unknown reference, another user's and one for another wishlist alike, so ids
 * cannot be probed; 409 once attached; 410 once expired.
 */
function assertAttachable(
	reference: StoredImageReference | undefined,
	step: { userId: string; targetWishlistIds: readonly string[] },
	now: Date,
): asserts reference is StoredImageReference {
	const [targetWishlistId, ...otherWishlistIds] = step.targetWishlistIds;
	if (
		reference === undefined ||
		reference.userId !== step.userId ||
		otherWishlistIds.length > 0 ||
		reference.wishlistId !== targetWishlistId
	) {
		invalidReference();
	}
	if (reference.attachedAt !== null) {
		error(409, SERVER_ERROR.AGENT_IMAGE_REFERENCE_USED);
	}
	if (reference.expiresAt.getTime() <= now.getTime()) {
		error(410, SERVER_ERROR.AGENT_IMAGE_REFERENCE_EXPIRED);
	}
}

export interface ImageReferenceStep {
	imageReference: string | null;
	/** The wishlists the call changes; a reference binds to exactly one. */
	targetWishlistIds: readonly string[];
}

/**
 * Resolves each step's image reference: it must be the user's own, for the one wishlist the step
 * changes, not yet attached and unexpired. A batch naming one reference twice is rejected, since
 * an image attaches to one gift only.
 */
export async function resolveImageReferences(
	database: LookupDatabase,
	userId: string,
	steps: readonly ImageReferenceStep[],
	now = new Date(),
): Promise<(AgentImageBinding | null)[]> {
	const referenceIds = steps.flatMap((step) =>
		step.imageReference === null ? [] : [step.imageReference],
	);
	if (referenceIds.length === 0) {
		return steps.map(() => null);
	}
	if (new Set(referenceIds).size !== referenceIds.length) {
		invalidReference();
	}
	const references = await database
		.select(STORED_REFERENCE_COLUMNS)
		.from(agentImage)
		.where(inArray(agentImage.id, referenceIds));
	const referencesById = new Map(references.map((reference) => [reference.id, reference]));
	return steps.map((step) => {
		if (step.imageReference === null) {
			return null;
		}
		const reference = referencesById.get(step.imageReference);
		assertAttachable(reference, { userId, targetWishlistIds: step.targetWishlistIds }, now);
		return { referenceId: reference.id, objectKey: reference.objectKey };
	});
}

/**
 * Under the batch's locks, re-checks every bound reference and marks it attached by this
 * transaction, so it attaches once even when two proposals name it. Rows are locked FOR UPDATE
 * after the wishlists. The first failing step is reported to `onStepFailed` like a step that
 * threw. A dry run marks too; its transaction rolls back.
 */
export async function attachImageReferences(
	transaction: DatabaseTransaction,
	userId: string,
	steps: readonly { targetWishlistIds: readonly string[]; binding: AgentImageBinding | null }[],
	onStepFailed?: (stepIndex: number, thrown: unknown) => void,
): Promise<void> {
	const referenceIds = steps.flatMap((step) =>
		step.binding === null ? [] : [step.binding.referenceId],
	);
	if (referenceIds.length === 0) {
		return;
	}
	const now = new Date();
	const references = await transaction
		.select(STORED_REFERENCE_COLUMNS)
		.from(agentImage)
		.where(inArray(agentImage.id, referenceIds))
		.orderBy(agentImage.id)
		.for('update');
	const referencesById = new Map(references.map((reference) => [reference.id, reference]));
	for (const [stepIndex, step] of steps.entries()) {
		if (step.binding === null) {
			continue;
		}
		try {
			assertAttachable(
				referencesById.get(step.binding.referenceId),
				{ userId, targetWishlistIds: step.targetWishlistIds },
				now,
			);
		} catch (thrown) {
			onStepFailed?.(stepIndex, thrown);
			throw thrown;
		}
	}
	await transaction
		.update(agentImage)
		.set({ attachedAt: now })
		.where(inArray(agentImage.id, referenceIds));
}
