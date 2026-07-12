/**
 * Client-safe resolution of stored object keys to loadable URLs (issue #107).
 *
 * Production sets PUBLIC_R2_URL (the R2 bucket's custom domain), so images are
 * served straight from R2/CDN and never flow through the SvelteKit Worker.
 * Local dev leaves it empty and serves through the same-origin upload API
 * route (R2 binding, in-memory fallback, or seed images).
 */

import { env } from '$env/dynamic/public';
import { UPLOAD_API_BASE } from '$lib/modules/uploads/types.js';

/** Public base URL for stored images, without trailing slash. Null in local dev. */
export function imagePublicBase(): string | null {
	const base = env.PUBLIC_R2_URL;
	if (base == null || base === '') {
		return null;
	}
	return base.replace(/\/$/, '');
}

/** Resolves a stored object key to a browser-loadable URL. */
export function imagePublicUrl(objectKey: string): string {
	const base = imagePublicBase();
	if (base !== null) {
		return `${base}/${objectKey}`;
	}
	return `${UPLOAD_API_BASE}/${objectKey}`;
}

/**
 * Whether a persisted image value is an R2 object key (e.g. `avatars/abc.jpg`)
 * rather than an already-loadable URL. `user.image` mixes both: external URLs
 * (Google profile picture) and object keys (uploaded avatar).
 */
export function isStoredObjectKey(value: string): boolean {
	return !value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('/');
}

/**
 * Resolves a persisted user avatar value to a displayable URL. Object keys
 * must be resolved before rendering; URLs pass through unchanged.
 */
export function resolveUserImageUrl(image: string | null | undefined): string | null {
	if (image == null || image === '') {
		return null;
	}
	return isStoredObjectKey(image) ? imagePublicUrl(image) : image;
}
