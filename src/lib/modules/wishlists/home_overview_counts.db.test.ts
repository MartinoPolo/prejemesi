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
import { getDb } from '$lib/server/db/index.js';
import { reservation } from '$lib/server/db/gift.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { getHomeOverview } from './home_overview_service.js';

/**
 * Dashboard counts per role, against a real database: totals count live gifts, správci see gifts
 * with at least one active reservation, followers see live gifts nobody actively reserved plus
 * their own reservations. Counts never leak between wishlists.
 */
describe.skipIf(!DB_READY)('dashboard gift counts', () => {
	let countedWishlistId = '';
	let neighbourWishlistId = '';

	beforeAll(async () => {
		await seedFixtureUsers();
		countedWishlistId = (await createWishlistFixture({ sharedAt: new Date() })).id;
		neighbourWishlistId = (await createWishlistFixture({ sharedAt: new Date() })).id;

		await createGiftFixture(countedWishlistId);
		const purchasedGiftId = await createGiftFixture(countedWishlistId);
		const sharedGiftId = await createGiftFixture(countedWishlistId, { quantity: 3 });
		const releasedGiftId = await createGiftFixture(countedWishlistId);
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
				{ giftId: deletedGiftId, userId: RESERVER_ID },
				{ giftId: neighbourReservedGiftId, userId: SECOND_RESERVER_ID },
			]);
		await getDb()
			.insert(wishlistFollower)
			.values({ wishlistId: countedWishlistId, userId: RESERVER_ID });
	});

	afterAll(removeFixtureRows);

	it('counts live gifts on the recipient’s own wishlists', async () => {
		const overview = await getHomeOverview(RECIPIENT_ID);
		const totals = new Map(overview.own.items.map((item) => [item.id, item.totalGifts]));

		expect(totals.get(countedWishlistId)).toBe(4);
		expect(totals.get(neighbourWishlistId)).toBe(2);
	});

	it('counts live and reserved gifts on managed wishlists', async () => {
		const overview = await getHomeOverview(MANAGER_ID);
		const counts = new Map(
			overview.moderated.items.map((item) => [
				item.id,
				[item.totalGifts, item.reservedGifts],
			]),
		);

		expect(counts.get(countedWishlistId)).toEqual([4, 2]);
		expect(counts.get(neighbourWishlistId)).toEqual([2, 1]);
	});

	it('counts available gifts and the follower’s own reservations on followed wishlists', async () => {
		const overview = await getHomeOverview(RESERVER_ID);
		const followed = overview.followed.items.find((item) => item.id === countedWishlistId);

		expect(followed).toMatchObject({ availableGifts: 2, myReservations: 2, myPurchased: 1 });
		expect(overview.followed.items.map((item) => item.id)).not.toContain(neighbourWishlistId);
	});
});
