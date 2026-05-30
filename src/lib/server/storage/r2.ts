import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';

/**
 * R2 types extracted from App.Platform to avoid depending on @cloudflare/workers-types globals.
 * These match the Cloudflare R2 binding API surface we actually use.
 */
type PlatformR2Bucket = NonNullable<App.Platform['env']>['R2'];

interface R2StoredObject {
	readonly key: string;
	readonly size: number;
	readonly etag: string;
	readonly httpEtag: string;
	get body(): ReadableStream;
	writeHttpMetadata(headers: Headers): void;
	arrayBuffer(): Promise<ArrayBuffer>;
	text(): Promise<string>;
}

/**
 * Allowed upload target prefixes. Each maps to a directory in the R2 bucket.
 */
export const UPLOAD_TARGETS = {
	'gift-image': 'gifts',
	'wishlist-banner': 'wishlists/banners',
	'wishlist-thumbnail': 'wishlists/thumbnails',
	avatar: 'avatars',
} as const;

export type UploadTarget = keyof typeof UPLOAD_TARGETS;

/** Maximum file size per target (in bytes). */
export const MAX_FILE_SIZE = {
	'gift-image': 5 * 1024 * 1024, // 5 MB
	'wishlist-banner': 10 * 1024 * 1024, // 10 MB
	'wishlist-thumbnail': 5 * 1024 * 1024, // 5 MB
	avatar: 5 * 1024 * 1024, // 5 MB
} as const satisfies Record<UploadTarget, number>;

/** Allowed image MIME types. */
export const ALLOWED_CONTENT_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export function isAllowedContentType(value: string): value is AllowedContentType {
	return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

/**
 * Returns the R2 bucket binding from the platform environment.
 * Returns `undefined` when running locally without R2 configured.
 */
export function getR2Bucket(): PlatformR2Bucket | undefined {
	const event = getRequestEvent();
	return event?.platform?.env?.R2;
}

/**
 * Checks whether R2 storage is available (production with bindings).
 */
export function isR2Available(): boolean {
	return getR2Bucket() !== undefined;
}

/**
 * Constructs the public URL for a stored object.
 * Uses R2_PUBLIC_URL env var or falls back to the local dev upload path.
 */
export function getPublicUrl(objectKey: string): string {
	const publicUrl = env.R2_PUBLIC_URL;
	if (publicUrl) {
		return `${publicUrl.replace(/\/$/, '')}/${objectKey}`;
	}
	// Local dev fallback — served from the upload API route
	return `/api/upload/${objectKey}`;
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
	if (!bucket) {
		return false;
	}

	await bucket.put(key, body, {
		httpMetadata: { contentType },
	});

	return true;
}

/**
 * Gets an object from R2 storage. Returns `null` if not found or R2 is unavailable.
 */
export async function getObject(key: string): Promise<R2StoredObject | null> {
	const bucket = getR2Bucket();
	if (!bucket) {
		return null;
	}

	return bucket.get(key) as Promise<R2StoredObject | null>;
}

/**
 * Deletes an object from R2 storage.
 */
export async function deleteObject(key: string): Promise<void> {
	const bucket = getR2Bucket();
	if (!bucket) {
		return;
	}

	await bucket.delete(key);
}
