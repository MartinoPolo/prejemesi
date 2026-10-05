import { error } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { demoSession } from '$lib/server/db/auth.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { DEMO_GIFT_LIMIT, DEMO_WISHLIST_LIMIT } from './constants.js';

/** Locks the session row so concurrent creations in one demo serialize their limit checks. */
async function lockActiveDemoSession(tx: DatabaseTransaction, sessionId: string): Promise<void> {
	const [active] = await tx
		.select()
		.from(demoSession)
		.where(eq(demoSession.id, sessionId))
		.for('update');
	if (active === undefined || active.expiresAt <= new Date()) {
		error(410, 'Demo has expired');
	}
}

export async function enforceDemoWishlistLimit(
	tx: DatabaseTransaction,
	sessionId: string,
): Promise<void> {
	await lockActiveDemoSession(tx, sessionId);
	const [{ count }] = await tx
		.select({ count: sql<number>`count(*)` })
		.from(wishlist)
		.where(eq(wishlist.demoSessionId, sessionId));
	if (Number(count) >= DEMO_WISHLIST_LIMIT) {
		error(429, 'Demo wishlist limit reached');
	}
}

export async function enforceDemoGiftLimit(
	tx: DatabaseTransaction,
	sessionId: string,
	addedGiftCount: number,
): Promise<void> {
	await lockActiveDemoSession(tx, sessionId);
	const [{ count }] = await tx
		.select({ count: sql<number>`count(*)` })
		.from(gift)
		.innerJoin(wishlist, eq(gift.wishlistId, wishlist.id))
		.where(eq(wishlist.demoSessionId, sessionId));
	if (Number(count) + addedGiftCount > DEMO_GIFT_LIMIT) {
		error(429, 'Demo gift limit reached');
	}
}
