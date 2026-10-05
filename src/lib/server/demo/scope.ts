import { getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { eq, isNull, type SQL } from 'drizzle-orm';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { preparedDemoImageUrls } from './catalog.js';

export function isPreparedDemoImage(url: string | null | undefined): boolean {
	return url == null || preparedDemoImageUrls.has(url);
}

export function demoSessionId(): string | null {
	try {
		return getRequestEvent().locals.demoSession?.id ?? null;
	} catch {
		return null;
	}
}

export function wishlistScope(): SQL {
	const sessionId = demoSessionId();
	return sessionId === null
		? isNull(wishlist.demoSessionId)
		: eq(wishlist.demoSessionId, sessionId);
}

export function assertWishlistScope(row: { demoSessionId?: string | null }): void {
	if ((row.demoSessionId ?? null) !== demoSessionId()) {
		error(404, 'Wishlist not found');
	}
}

export function rejectDemoOperation(): void {
	if (demoSessionId() !== null) {
		error(403, 'This action is unavailable in the demo');
	}
}

export function rejectDemoImageUpload(imageKey: string | null | undefined): void {
	if (demoSessionId() !== null && (imageKey ?? '') !== '') {
		error(403, 'Image uploads are unavailable in the demo');
	}
}

/** Demo gifts may only show the prepared catalog images, never uploads or arbitrary URLs. */
export function rejectDemoGiftImages(
	images: ReadonlyArray<{ imageKey?: string | null; imageUrl?: string | null }>,
): void {
	if (
		demoSessionId() !== null &&
		images.some(
			(image) => (image.imageKey ?? '') !== '' || !isPreparedDemoImage(image.imageUrl),
		)
	) {
		error(403, 'Image uploads and image URLs are unavailable in the demo');
	}
}
