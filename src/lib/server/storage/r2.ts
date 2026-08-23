import { getRequestEvent } from '$app/server';
import { imagePublicUrl } from '$lib/modules/images/public_url.js';
import { MAX_GIFT_IMAGE_BYTES } from '$lib/modules/uploads/types.js';

export { isAllowedContentType } from '$lib/modules/uploads/types.js';

/**
 * R2 types extracted from App.Platform to avoid depending on @cloudflare/workers-types globals.
 * These match the Cloudflare R2 binding API surface we actually use.
 */
type PlatformR2Bucket = NonNullable<App.Platform['env']>['R2'];

interface R2StoredObject {
	readonly key: string;
	readonly size: number;
	readonly httpEtag: string;
	readonly httpMetadata?: { contentType?: string };
	arrayBuffer(): Promise<ArrayBuffer>;
}

/** A fully-buffered object ready to be served over HTTP. */
export interface ServableObject {
	body: ArrayBuffer;
	contentType: string;
	etag: string;
}

/**
 * Allowed upload target prefixes. Each maps to a directory in the R2 bucket.
 */
export const UPLOAD_TARGETS = {
	'gift-image': 'gifts',
	'wishlist-banner': 'wishlists/banners',
	'wishlist-thumbnail': 'wishlists/thumbnails',
	// Forward-ported from profile/settings – not in issue #5 scope but already wired up
	avatar: 'avatars',
} as const;

export type UploadTarget = keyof typeof UPLOAD_TARGETS;

/** Maximum file size per target (in bytes). */
export const MAX_FILE_SIZE = {
	'gift-image': MAX_GIFT_IMAGE_BYTES,
	'wishlist-banner': 10 * 1024 * 1024, // 10 MB
	'wishlist-thumbnail': 5 * 1024 * 1024, // 5 MB
	avatar: 5 * 1024 * 1024, // 5 MB
} as const satisfies Record<UploadTarget, number>;

function getR2Bucket(): PlatformR2Bucket | undefined {
	try {
		const event = getRequestEvent();
		return event?.platform?.env?.R2;
	} catch {
		return undefined;
	}
}

/**
 * Checks whether R2 storage is available (production with bindings).
 */
export function isR2Available(): boolean {
	return getR2Bucket() !== undefined;
}

/**
 * Constructs the public URL for a stored object.
 * Uses the PUBLIC_R2_URL env var or falls back to the local dev upload path.
 */
export function getPublicUrl(objectKey: string): string {
	return imagePublicUrl(objectKey);
}

/**
 * Puts a file into R2 storage. Falls back to no-op in dev when R2 is unavailable.
 * Returns `true` if the file was stored, `false` if R2 is not available.
 */
export async function putObject(
	key: string,
	body: ReadableStream | ArrayBuffer | string,
	contentType: string,
): Promise<boolean> {
	const bucket = getR2Bucket();
	if (bucket == null) {
		return false;
	}

	await bucket.put(key, body, {
		httpMetadata: { contentType },
	});

	return true;
}

/**
 * Gets an object from R2 storage as a fully-buffered, HTTP-servable value.
 * Returns `null` if not found or R2 is unavailable.
 *
 * The body is read into an ArrayBuffer rather than streamed: in local dev,
 * `getPlatformProxy` cannot stream R2 bodies or serialize `writeHttpMetadata`
 * across the worker proxy boundary. Buffering is acceptable for images
 * (≤10 MB) and behaves identically in production.
 */
export async function getObject(key: string): Promise<ServableObject | null> {
	const bucket = getR2Bucket();
	if (bucket == null) {
		return null;
	}

	const object = (await bucket.get(key)) as R2StoredObject | null;
	if (object == null) {
		return null;
	}

	return {
		body: await object.arrayBuffer(),
		contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
		etag: object.httpEtag,
	};
}

/**
 * Deletes an object from R2 storage.
 */
export async function deleteObject(key: string): Promise<void> {
	const bucket = getR2Bucket();
	if (bucket == null) {
		return;
	}

	await bucket.delete(key);
}

/**
 * Deletes stored objects referenced by rows that were just deleted (REQ-6).
 * Best-effort by design: the DB mutation must never fail because storage
 * cleanup did – an unreferenced object is a cost issue, not a data issue.
 * The R2 binding accepts up to 1000 keys per call.
 */
export async function deleteObjectsBestEffort(
	keys: readonly (string | null | undefined)[],
): Promise<void> {
	const bucket = getR2Bucket();
	const validKeys = keys.filter((key): key is string => key != null && key !== '');
	if (bucket == null || validKeys.length === 0) {
		return;
	}

	try {
		await bucket.delete(validKeys);
	} catch (thrown) {
		console.error('R2 cleanup failed for keys', validKeys, thrown);
	}
}
