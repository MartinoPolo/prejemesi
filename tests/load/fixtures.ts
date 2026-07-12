/**
 * Load-test fixtures (REQ-6, AC-7): dedicated accounts, wishlists, and gifts,
 * every row identifiable via the `loadtest-` prefix (directly or through its
 * FK to a loadtest row). Setup is idempotent (cleanup-then-insert, like seed).
 */

import { sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { user, account } from '../../src/lib/server/db/auth.schema.js';
import { wishlist } from '../../src/lib/server/db/wishlist.schema.js';
import { gift } from '../../src/lib/server/db/gift.schema.js';
import {
	ARENA_VIEW_GIFT_COUNT,
	LOADTEST_EMAIL_DOMAIN,
	LOADTEST_ID_PREFIX,
	LOADTEST_PASSWORD,
	MAX_VIRTUAL_USERS,
} from './config.js';
import type { LoadTestDb } from './db.js';

function padIndex(index: number): string {
	return String(index).padStart(3, '0');
}

export const ARENA_WISHLIST_ID = `${LOADTEST_ID_PREFIX}wl-arena`;
export const ARENA_SHORT_ID = `${LOADTEST_ID_PREFIX}arena`;
export const CONTENTION_GIFT_ID = `${LOADTEST_ID_PREFIX}gift-contention`;
export const OWNER_USER_ID = `${LOADTEST_ID_PREFIX}user-owner`;

export function virtualUserId(index: number): string {
	return `${LOADTEST_ID_PREFIX}user-vu-${padIndex(index)}`;
}

export function virtualUserEmail(index: number): string {
	return `${LOADTEST_ID_PREFIX}vu-${padIndex(index)}@${LOADTEST_EMAIL_DOMAIN}`;
}

export function virtualUserWishlistId(index: number): string {
	return `${LOADTEST_ID_PREFIX}wl-vu-${padIndex(index)}`;
}

export function distinctGiftId(index: number): string {
	return `${LOADTEST_ID_PREFIX}gift-distinct-${padIndex(index)}`;
}

/**
 * Removes every loadtest row. Rows created at runtime through the app
 * (reservations, likes, follows, notifications, sessions, scenario-created
 * gifts) have app-generated ids, so they are matched via their FK columns —
 * never by anything that could touch real user rows.
 */
export async function cleanupLoadTestData(db: LoadTestDb): Promise<void> {
	const prefix = `${LOADTEST_ID_PREFIX}%`;
	await db.execute(sql`
		DELETE FROM notification
		WHERE user_id LIKE ${prefix}
			OR actor_id LIKE ${prefix}
			OR wishlist_id LIKE ${prefix}
	`);
	await db.execute(sql`
		DELETE FROM gift_like
		WHERE user_id LIKE ${prefix}
			OR gift_id IN (
				SELECT id FROM gift WHERE id LIKE ${prefix} OR wishlist_id LIKE ${prefix}
			)
	`);
	await db.execute(sql`
		DELETE FROM reservation
		WHERE user_id LIKE ${prefix}
			OR gift_id IN (
				SELECT id FROM gift WHERE id LIKE ${prefix} OR wishlist_id LIKE ${prefix}
			)
	`);
	await db.execute(sql`DELETE FROM gift WHERE id LIKE ${prefix} OR wishlist_id LIKE ${prefix}`);
	await db.execute(sql`DELETE FROM priority_level WHERE wishlist_id LIKE ${prefix}`);
	await db.execute(sql`
		DELETE FROM moderator_invite
		WHERE wishlist_id LIKE ${prefix}
			OR created_by_user_id LIKE ${prefix}
			OR used_by_user_id LIKE ${prefix}
	`);
	await db.execute(sql`
		DELETE FROM moderator_assignment
		WHERE wishlist_id LIKE ${prefix} OR user_id LIKE ${prefix}
	`);
	await db.execute(sql`
		DELETE FROM wishlist_follower
		WHERE wishlist_id LIKE ${prefix} OR user_id LIKE ${prefix}
	`);
	await db.execute(sql`DELETE FROM wishlist WHERE id LIKE ${prefix}`);
	await db.execute(sql`DELETE FROM session WHERE user_id LIKE ${prefix}`);
	await db.execute(sql`DELETE FROM account WHERE id LIKE ${prefix} OR user_id LIKE ${prefix}`);
	await db.execute(sql`DELETE FROM "user" WHERE id LIKE ${prefix}`);
}

export async function setupLoadTestData(db: LoadTestDb): Promise<void> {
	await cleanupLoadTestData(db);

	const passwordHash = await hashPassword(LOADTEST_PASSWORD);
	const vuIndexes = Array.from({ length: MAX_VIRTUAL_USERS }, (_, i) => i);

	// Users: one arena owner (recipient of the shared wishlist — recipients
	// cannot reserve, so the owner never participates as a VU) + the VU pool.
	await db.insert(user).values([
		{
			id: OWNER_USER_ID,
			name: 'Loadtest Owner',
			email: `${LOADTEST_ID_PREFIX}owner@${LOADTEST_EMAIL_DOMAIN}`,
			emailVerified: true,
		},
		...vuIndexes.map((i) => ({
			id: virtualUserId(i),
			name: `Loadtest VU ${padIndex(i)}`,
			email: virtualUserEmail(i),
			emailVerified: true,
		})),
	]);

	await db.insert(account).values(
		[OWNER_USER_ID, ...vuIndexes.map(virtualUserId)].map((userId) => ({
			id: userId.replace(`${LOADTEST_ID_PREFIX}user-`, `${LOADTEST_ID_PREFIX}acc-`),
			accountId: userId,
			providerId: 'credential',
			userId,
			password: passwordHash,
		})),
	);

	// Arena wishlist: shared, active — the target of viewing + reservation
	// scenarios. Each VU also gets a private draft wishlist for gift creation.
	await db.insert(wishlist).values([
		{
			id: ARENA_WISHLIST_ID,
			shortId: ARENA_SHORT_ID,
			recipientUserId: OWNER_USER_ID,
			title: 'Loadtest arena',
			description: 'Dedicated load-test wishlist — safe to delete.',
			status: 'active',
			sharedAt: new Date(),
		},
		...vuIndexes.map((i) => ({
			id: virtualUserWishlistId(i),
			shortId: `${LOADTEST_ID_PREFIX}vu-${padIndex(i)}`,
			recipientUserId: virtualUserId(i),
			title: `Loadtest VU ${padIndex(i)} list`,
			status: 'draft' as const,
		})),
	]);

	// Arena gifts: browse set + one single-unit gift per VU (distinct
	// reservations without contention) + one single-unit contention gift.
	await db.insert(gift).values([
		...Array.from({ length: ARENA_VIEW_GIFT_COUNT }, (_, i) => ({
			id: `${LOADTEST_ID_PREFIX}gift-view-${padIndex(i)}`,
			wishlistId: ARENA_WISHLIST_ID,
			name: `Loadtest view gift ${padIndex(i)}`,
			description: 'Browse-only gift for viewing scenarios.',
			price: 100 + i,
			quantity: 1,
			sortOrder: i,
		})),
		...vuIndexes.map((i) => ({
			id: distinctGiftId(i),
			wishlistId: ARENA_WISHLIST_ID,
			name: `Loadtest distinct gift ${padIndex(i)}`,
			description: 'Per-VU reservation target.',
			quantity: 1,
			sortOrder: ARENA_VIEW_GIFT_COUNT + i,
		})),
		{
			id: CONTENTION_GIFT_ID,
			wishlistId: ARENA_WISHLIST_ID,
			name: 'Loadtest contention gift',
			description: 'Single unit fought over by all VUs.',
			quantity: 1,
			sortOrder: ARENA_VIEW_GIFT_COUNT + MAX_VIRTUAL_USERS,
		},
	]);
}
