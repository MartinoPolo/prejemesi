import * as v from 'valibot';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { agentImage } from '$lib/server/db/agent_image.schema.js';
import { generateId } from '$lib/server/db/id.js';
import { UPLOAD_TARGETS, type AgentImageStorage } from '$lib/server/storage/r2.js';
import { requireWishlistManagement } from '$lib/server/operations/wishlist_management.js';
import {
	IMAGE_DOWNLOAD_FAILURE,
	ImageDownloadError,
	fetchPublicImage,
	type DownloadedImage,
	type ImageDownloadFailure,
	type ImageFetch,
} from '$lib/server/images/image_download.js';
import { assertWishlistMutable } from '$lib/modules/wishlists/wishlist_access.js';
import { imagePublicUrl } from '$lib/modules/images/public_url.js';
import { IMAGE_FILE_EXTENSIONS, MAX_GIFT_IMAGE_BYTES } from '$lib/modules/uploads/types.js';
import {
	ImageMetadataError,
	stripImageMetadata,
} from '$lib/modules/uploads/strip_image_metadata.js';
import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import { SERVER_ERROR, type ServerErrorCode } from '$lib/modules/errors/server_error_codes.js';
import { NonEmptyIdSchema } from '$lib/modules/change_proposals/types.js';
import { credentialReference, type AgentCaller } from './agent_caller.js';
import { requireAgentScope } from './agent_grant.js';
import { AgentApiFailure } from './api.js';
import { resolveAddressedWishlist } from './wishlist_address.js';
import { scheduleAgentAccessPurge } from './agent_access_purge.js';
import {
	assertWithinTrailingBudget,
	lockTrailingBudget,
	type TrailingBudget,
} from './trailing_budget.js';
import {
	AGENT_DAILY_IMAGE_BUDGET,
	AGENT_IMAGE_FETCH_TIMEOUT_MS,
	AGENT_IMAGE_MAX_REDIRECTS,
	AGENT_IMAGE_REFERENCE_LIFETIME_MS,
} from './limits.js';

/** Longer URLs are not plausible image addresses. */
const IMAGE_URL_MAX_LENGTH = 2048;

const ImageUploadRequestSchema = v.strictObject({
	wishlistShortId: v.optional(NonEmptyIdSchema),
	wishlistId: v.optional(NonEmptyIdSchema),
	url: v.pipe(v.string(), v.minLength(1), v.maxLength(IMAGE_URL_MAX_LENGTH)),
});

const DOWNLOAD_FAILURE_RESPONSES = {
	[IMAGE_DOWNLOAD_FAILURE.invalidUrl]: {
		status: 400,
		code: SERVER_ERROR.AGENT_IMAGE_URL_INVALID,
	},
	[IMAGE_DOWNLOAD_FAILURE.blockedHost]: {
		status: 400,
		code: SERVER_ERROR.AGENT_IMAGE_HOST_BLOCKED,
	},
	[IMAGE_DOWNLOAD_FAILURE.tooLarge]: { status: 422, code: SERVER_ERROR.AGENT_IMAGE_TOO_LARGE },
	[IMAGE_DOWNLOAD_FAILURE.unsupportedType]: {
		status: 422,
		code: SERVER_ERROR.AGENT_IMAGE_UNSUPPORTED_TYPE,
	},
	[IMAGE_DOWNLOAD_FAILURE.signatureMismatch]: {
		status: 422,
		code: SERVER_ERROR.AGENT_IMAGE_SIGNATURE_MISMATCH,
	},
	[IMAGE_DOWNLOAD_FAILURE.invalidDimensions]: {
		status: 422,
		code: SERVER_ERROR.AGENT_IMAGE_DIMENSIONS_INVALID,
	},
	[IMAGE_DOWNLOAD_FAILURE.fetchFailed]: {
		status: 502,
		code: SERVER_ERROR.AGENT_IMAGE_FETCH_FAILED,
	},
} as const satisfies Record<ImageDownloadFailure, { status: number; code: ServerErrorCode }>;

function downloadFailure(reason: ImageDownloadFailure): AgentApiFailure {
	const { status, code } = DOWNLOAD_FAILURE_RESPONSES[reason];
	const details =
		reason === IMAGE_DOWNLOAD_FAILURE.tooLarge ? { maxBytes: MAX_GIFT_IMAGE_BYTES } : {};
	return new AgentApiFailure(status, code, details);
}

type StorableImage = Pick<
	DownloadedImage,
	'bytes' | 'contentType' | 'byteLength' | 'width' | 'height'
>;

/** Downloads the image and removes its identifying metadata, as browser uploads do. */
async function downloadAgentImage(url: string, fetch: ImageFetch): Promise<StorableImage> {
	let image: DownloadedImage;
	try {
		image = await fetchPublicImage(url, {
			fetch,
			timeoutMs: AGENT_IMAGE_FETCH_TIMEOUT_MS,
			maxBytes: MAX_GIFT_IMAGE_BYTES,
			maxRedirects: AGENT_IMAGE_MAX_REDIRECTS,
		});
	} catch (thrown) {
		if (thrown instanceof ImageDownloadError) {
			throw downloadFailure(thrown.reason);
		}
		throw thrown;
	}
	let bytes: Uint8Array;
	try {
		bytes = stripImageMetadata(image.bytes, image.contentType);
	} catch (thrown) {
		// Unlike the browser, the server has no decoder to re-encode with.
		if (thrown instanceof ImageMetadataError) {
			throw new AgentApiFailure(422, SERVER_ERROR.AGENT_IMAGE_DAMAGED);
		}
		throw thrown;
	}
	const { contentType, width, height } = image;
	return { bytes, contentType, byteLength: bytes.byteLength, width, height };
}

/** Images count from every token, attached or not. */
const IMAGE_BUDGET: TrailingBudget = {
	lockName: 'agent-image-budget',
	limit: AGENT_DAILY_IMAGE_BUDGET.images,
	windowMs: AGENT_DAILY_IMAGE_BUDGET.windowMs,
	exceededCode: SERVER_ERROR.AGENT_DAILY_IMAGE_BUDGET_EXCEEDED,
	limitDetail: 'budgetImages',
	recentSpends: (database, userId, windowStart) =>
		database
			.select({ createdAt: agentImage.createdAt, amount: sql<number>`1` })
			.from(agentImage)
			.where(and(eq(agentImage.userId, userId), gt(agentImage.createdAt, windowStart)))
			.orderBy(asc(agentImage.createdAt)),
};

/** The wishlist the upload is for: the token may reach it and its user manages it. */
async function requireUploadWishlist(
	caller: AgentCaller,
	request: v.InferOutput<typeof ImageUploadRequestSchema>,
): Promise<string> {
	const namesOneWishlist =
		(request.wishlistShortId === undefined) !== (request.wishlistId === undefined);
	if (!namesOneWishlist) {
		throw new AgentApiFailure(400, SERVER_ERROR.AGENT_IMAGE_REQUEST_INVALID);
	}
	const addressed = await resolveAddressedWishlist(caller.grant, request);
	if (addressed === null) {
		throw new AgentApiFailure(400, SERVER_ERROR.AGENT_IMAGE_REQUEST_INVALID);
	}
	const { wishlistRow } = await requireWishlistManagement(
		getDb(),
		caller.grant.userId,
		addressed.id,
		{ lock: false },
	);
	assertWishlistMutable(wishlistRow);
	return wishlistRow.id;
}

export interface AgentImageUploadDependencies {
	fetch: ImageFetch;
	/** Absent where the platform has no R2 binding. */
	storage: AgentImageStorage | undefined;
	now?: Date;
}

/**
 * Downloads an image from a public HTTPS URL into R2 for a gift on a wishlist the token's user
 * manages, and answers a reference a later gift change attaches. The URL itself is never stored:
 * gifts only ever point at the stored copy.
 */
export async function uploadAgentImage(
	caller: AgentCaller,
	body: unknown,
	{ fetch, storage, now = new Date() }: AgentImageUploadDependencies,
) {
	const { grant } = caller;
	requireAgentScope(grant, AGENT_SCOPE.giftsWrite);
	const parsed = v.safeParse(ImageUploadRequestSchema, body);
	if (!parsed.success) {
		throw new AgentApiFailure(400, SERVER_ERROR.AGENT_IMAGE_REQUEST_INVALID);
	}
	const wishlistId = await requireUploadWishlist(caller, parsed.output);
	if (storage === undefined) {
		throw new AgentApiFailure(503, SERVER_ERROR.AGENT_IMAGE_STORAGE_UNAVAILABLE);
	}
	const database = getDb();
	await assertWithinTrailingBudget(database, IMAGE_BUDGET, grant.userId, 1, now);

	const image = await downloadAgentImage(parsed.output.url, fetch);
	const objectKey = `${UPLOAD_TARGETS['gift-image']}/agent/${wishlistId}/${generateId(16)}.${IMAGE_FILE_EXTENSIONS[image.contentType]}`;
	try {
		await storage.put(objectKey, image.bytes, image.contentType);
	} catch (thrown) {
		console.error('[agent-api] storing an agent image failed', thrown);
		throw new AgentApiFailure(503, SERVER_ERROR.AGENT_IMAGE_STORAGE_UNAVAILABLE);
	}
	const expiresAt = new Date(now.getTime() + AGENT_IMAGE_REFERENCE_LIFETIME_MS);
	// A crash after the put, or a commit of unknown outcome, orphans the object: a storage cost,
	// never a gift pointing at a missing image.
	let insertReachedCommit = false;
	let referenceId: string;
	try {
		referenceId = await database.transaction(async (transaction) => {
			await lockTrailingBudget(transaction, IMAGE_BUDGET, grant.userId);
			await assertWithinTrailingBudget(transaction, IMAGE_BUDGET, grant.userId, 1, now);
			const [inserted] = await transaction
				.insert(agentImage)
				.values({
					userId: grant.userId,
					wishlistId,
					...credentialReference(caller.credential),
					objectKey,
					contentType: image.contentType,
					byteLength: image.byteLength,
					width: image.width,
					height: image.height,
					createdAt: now,
					expiresAt,
				})
				.returning({ id: agentImage.id });
			if (inserted === undefined) {
				throw new Error('Inserting the agent image returned no row');
			}
			insertReachedCommit = true;
			return inserted.id;
		});
	} catch (thrown) {
		if (!insertReachedCommit) {
			await storage.deleteBestEffort([objectKey]);
		}
		throw thrown;
	}
	scheduleAgentAccessPurge();
	return {
		reference: referenceId,
		url: imagePublicUrl(objectKey),
		contentType: image.contentType,
		byteLength: image.byteLength,
		width: image.width,
		height: image.height,
		expiresAt: expiresAt.toISOString(),
	};
}
