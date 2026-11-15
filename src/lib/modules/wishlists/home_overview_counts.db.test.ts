import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_ID,
	SECOND_RESERVER_ID,
	createGiftFixture,
	createWishlistFixture,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { reservation } from '$lib/server/db/gift.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { getHomeOverview } from './home_overview_service.js';
import { createOwnRolePrimitives } from './wishlist_role_query_primitives.js';

/**
 * Dashboard counts per role, against a real database: totals count live gifts, správci see gifts
 * with at least one active reservation, followers see live gifts nobody actively reserved plus
 * their own reservations. Counts never leak between wishlists.
 */
describe.skipIf(!DB_READY)('dashboard gift counts', () => {
	let countedWishlistId = '';
	let neighbourWishlistId = '';
	let emptyWishlistId = '';

	beforeAll(async () => {
		await seedFixtureUsers();
		countedWishlistId = (await createWishlistFixture({ sharedAt: new Date() })).id;
		neighbourWishlistId = (await createWishlistFixture({ sharedAt: new Date() })).id;
		emptyWishlistId = (await createWishlistFixture({ sharedAt: new Date() })).id;

		await createGiftFixture(countedWishlistId);
		const purchasedGiftId = await createGiftFixture(countedWishlistId);
		const sharedGiftId = await createGiftFixture(countedWishlistId, { quantity: 3 });
		const releasedGiftId = await createGiftFixture(countedWishlistId);
		const otherReserverGiftId = await createGiftFixture(countedWishlistId);
		const deletedGiftId = await createGiftFixture(countedWishlistId, { deletedAt: new Date() });
		const neighbourReservedGiftId = await createGiftFixture(neighbourWishlistId);
		await createGiftFixture(neighbourWishlistId);

		await getDb()
			.insert(reservation)
			.values([
				{ giftId: purchasedGiftId, userId: RESERVER_ID, purchasedAt: new Date() },
				{ giftId: sharedGiftId, userId: RESERVER_ID },
				{ giftId: sharedGiftId, userId: SECOND_RESERVER_ID },
				{ giftId: releasedGiftId, userId: SECOND_RESERVER_ID, deletedAt: new Date() },
				{ giftId: otherReserverGiftId, userId: SECOND_RESERVER_ID },
				{ giftId: deletedGiftId, userId: RESERVER_ID },
				{ giftId: neighbourReservedGiftId, userId: SECOND_RESERVER_ID },
			]);
		await getDb()
			.insert(wishlistFollower)
			.values([
				{ wishlistId: countedWishlistId, userId: RESERVER_ID },
				{ wishlistId: neighbourWishlistId, userId: RESERVER_ID },
				{ wishlistId: emptyWishlistId, userId: RESERVER_ID },
			]);
	});

	afterAll(removeFixtureRows);

	it('counts live gifts on the recipient’s own wishlists', async () => {
		const overview = await getHomeOverview(RECIPIENT_ID);
		const totals = new Map(overview.own.items.map((item) => [item.id, item.totalGifts]));

		expect(totals.get(countedWishlistId)).toBe(5);
		expect(totals.get(neighbourWishlistId)).toBe(2);
		expect(totals.get(emptyWishlistId)).toBe(0);
	});

	it('counts live gifts when the own-role projection is selected from the wishlist table alone', async () => {
		const ownRole = createOwnRolePrimitives(RECIPIENT_ID);
		const rows = await getDb()
			.select(ownRole.projection)
			.from(wishlist)
			.where(and(ownRole.predicate, isNull(wishlist.deletedAt)));
		const totals = new Map(rows.map(ownRole.map).map((item) => [item.id, item.totalGifts]));

		expect(totals.get(countedWishlistId)).toBe(5);
		expect(totals.get(neighbourWishlistId)).toBe(2);
		expect(totals.get(emptyWishlistId)).toBe(0);
	});

	it('counts live gifts and gifts reserved by anyone on managed wishlists', async () => {
		const overview = await getHomeOverview(MANAGER_ID);
		const counts = new Map(
			overview.moderated.items.map((item) => [
				item.id,
				[item.totalGifts, item.reservedGifts],
			]),
		);

		expect(counts.get(countedWishlistId)).toEqual([5, 3]);
		expect(counts.get(neighbourWishlistId)).toEqual([2, 1]);
		expect(counts.get(emptyWishlistId)).toEqual([0, 0]);
	});

	it('counts gifts nobody reserved and the follower’s own reservations on followed wishlists', async () => {
		const overview = await getHomeOverview(RESERVER_ID);
		const followed = new Map(overview.followed.items.map((item) => [item.id, item]));

		expect(followed.get(countedWishlistId)).toMatchObject({
			availableGifts: 2,
			myReservations: 2,
			myPurchased: 1,
		});
		expect(followed.get(neighbourWishlistId)).toMatchObject({
			availableGifts: 1,
			myReservations: 0,
		});
		expect(followed.get(emptyWishlistId)).toMatchObject({ availableGifts: 0 });
	});
});
