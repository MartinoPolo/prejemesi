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
