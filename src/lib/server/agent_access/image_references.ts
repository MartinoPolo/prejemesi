import { error } from '@sveltejs/kit';
import { inArray } from 'drizzle-orm';
import * as v from 'valibot';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { agentImage } from '$lib/server/db/agent_image.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	DEFAULT_IMAGE_METADATA,
	ImageMetadataSchema,
	type ImageMetadata,
} from '$lib/modules/images/types.js';
import { MAX_GIFT_IMAGES, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import type { LookupDatabase } from './policy_lookups.js';

/** The agent input field naming an image from `POST /api/v1/images`. */
export const IMAGE_REFERENCE_FIELD = 'imageReference';

/** The agent input field naming a gift's whole ordered gallery by image references. */
export const IMAGE_REFERENCES_FIELD = 'imageReferences';

/** One gallery entry an agent names: a stored image and, optionally, its framing. */
export interface RequestedGalleryImage {
	imageReference: string;
	imageMeta: ImageMetadata | null;
}

/** An agent's input split into what the core validates and the image references it names. */
export type ImageReferenceSplit =
	| { kind: 'none'; coreInput: unknown }
	| { kind: 'cover'; imageReference: string; coreInput: Record<string, unknown> }
	| {
			kind: 'gallery';
			gallery: RequestedGalleryImage[];
			coreInput: Record<string, unknown>;
	  };

/** A resolved reference: the user's own stored image for the wishlist the call changes. */
export interface AgentImageBinding {
	referenceId: string;
	objectKey: string;
}

function invalidReference(): never {
	error(400, SERVER_ERROR.AGENT_IMAGE_REFERENCE_INVALID);
}

function invalidGallery(): never {
	error(400, SERVER_ERROR.AGENT_IMAGE_REFERENCES_INVALID);
}

const GALLERY_ENTRY_FIELDS = new Set([IMAGE_REFERENCE_FIELD, 'imageMeta']);

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
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
		Object.hasOwn(rawInput, IMAGE_REFERENCES_FIELD) ||
		Object.values(rawInput).some(namesImageReference)
	);
}

function requestedGalleryImage(entry: unknown): RequestedGalleryImage {
	if (!isJsonObject(entry)) {
		invalidGallery();
	}
	if (Object.keys(entry).some((field) => !GALLERY_ENTRY_FIELDS.has(field))) {
		invalidGallery();
	}
	const imageReference: unknown = Reflect.get(entry, IMAGE_REFERENCE_FIELD);
	if (typeof imageReference !== 'string' || imageReference === '') {
		invalidReference();
	}
	const imageMeta: unknown = Reflect.get(entry, 'imageMeta') ?? null;
	if (imageMeta === null) {
		return { imageReference, imageMeta: null };
	}
	const parsedMeta = v.safeParse(ImageMetadataSchema, imageMeta);
	if (!parsedMeta.success) {
		invalidGallery();
	}
	return { imageReference, imageMeta: parsedMeta.output };
}

/**
 * `imageReferences` names the whole gallery, 1 to {@link MAX_GIFT_IMAGES} entries, each with its
 * own framing; it excludes `imageReference` and a top-level `imageMeta`, which frame the cover.
 */
function requestedGallery(rawInput: Record<string, unknown>): RequestedGalleryImage[] {
	if (Object.hasOwn(rawInput, IMAGE_REFERENCE_FIELD) || Object.hasOwn(rawInput, 'imageMeta')) {
		invalidGallery();
	}
	const entries: unknown = rawInput[IMAGE_REFERENCES_FIELD];
	if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_GIFT_IMAGES) {
		invalidGallery();
	}
	return entries.map(requestedGalleryImage);
}

function withoutImageReferenceFields(rawInput: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(rawInput).filter(
			([field]) => field !== IMAGE_REFERENCE_FIELD && field !== IMAGE_REFERENCES_FIELD,
		),
	);
}

export function splitImageReference(rawInput: unknown): ImageReferenceSplit {
	if (!isJsonObject(rawInput)) {
		return { kind: 'none', coreInput: rawInput };
	}
	if (Object.hasOwn(rawInput, IMAGE_REFERENCES_FIELD)) {
		const gallery = requestedGallery(rawInput);
		return { kind: 'gallery', gallery, coreInput: withoutImageReferenceFields(rawInput) };
	}
	if (!Object.hasOwn(rawInput, IMAGE_REFERENCE_FIELD)) {
		return { kind: 'none', coreInput: rawInput };
	}
	const imageReference = rawInput[IMAGE_REFERENCE_FIELD];
	if (typeof imageReference !== 'string' || imageReference === '') {
		invalidReference();
	}
	return { kind: 'cover', imageReference, coreInput: withoutImageReferenceFields(rawInput) };
}

/** The reference ids a split names, in gallery order. */
export function splitReferenceIds(split: ImageReferenceSplit): string[] {
	switch (split.kind) {
		case 'none':
			return [];
		case 'cover':
			return [split.imageReference];
		case 'gallery':
			return split.gallery.map((entry) => entry.imageReference);
	}
}

/**
 * The core input setting the referenced images: a single reference replaces only the cover (any
 * image URL cleared, automatic framing unless the input sets its own); a gallery replaces every
 * image, each with automatic framing unless its entry sets its own.
 */
export function inputWithBoundImages(
	split: Exclude<ImageReferenceSplit, { kind: 'none' }>,
	bindings: readonly AgentImageBinding[],
): Record<string, unknown> {
	const objectKeys = bindings.map((binding) => binding.objectKey);
	if (split.kind === 'cover') {
		return {
			imageMeta: DEFAULT_IMAGE_METADATA,
			...split.coreInput,
			imageKey: objectKeys[0],
			imageUrl: null,
		};
	}
	const images: GiftImage[] = split.gallery.map((entry, index) => ({
		imageUrl: null,
		imageKey: objectKeys[index] ?? null,
		imageMeta: entry.imageMeta ?? DEFAULT_IMAGE_METADATA,
	}));
	return { ...split.coreInput, images };
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
	/** The references the step names, in gallery order; empty when it names none. */
	imageReferences: readonly string[];
	/** The wishlists the call changes; a reference binds to exactly one. */
	targetWishlistIds: readonly string[];
}

/**
 * Resolves each step's image references: each must be the user's own, for the one wishlist the
 * step changes, not yet attached and unexpired. A batch naming one reference twice, in one step
 * or across steps, is rejected, since an image attaches to one gift only.
 */
export async function resolveImageReferences(
	database: LookupDatabase,
	userId: string,
	steps: readonly ImageReferenceStep[],
	now = new Date(),
): Promise<AgentImageBinding[][]> {
	const referenceIds = steps.flatMap((step) => step.imageReferences);
	if (referenceIds.length === 0) {
		return steps.map(() => []);
	}
	if (new Set(referenceIds).size !== referenceIds.length) {
		invalidReference();
	}
	const references = await database
		.select(STORED_REFERENCE_COLUMNS)
		.from(agentImage)
		.where(inArray(agentImage.id, referenceIds));
	const referencesById = new Map(references.map((reference) => [reference.id, reference]));
	return steps.map((step) =>
		step.imageReferences.map((referenceId) => {
			const reference = referencesById.get(referenceId);
			assertAttachable(reference, { userId, targetWishlistIds: step.targetWishlistIds }, now);
			return { referenceId: reference.id, objectKey: reference.objectKey };
		}),
	);
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
	steps: readonly {
		targetWishlistIds: readonly string[];
		bindings: readonly AgentImageBinding[];
	}[],
	onStepFailed?: (stepIndex: number, thrown: unknown) => void,
): Promise<void> {
	const referenceIds = steps.flatMap((step) =>
		step.bindings.map((binding) => binding.referenceId),
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
		try {
			for (const binding of step.bindings) {
				assertAttachable(
					referencesById.get(binding.referenceId),
					{ userId, targetWishlistIds: step.targetWishlistIds },
					now,
				);
			}
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
