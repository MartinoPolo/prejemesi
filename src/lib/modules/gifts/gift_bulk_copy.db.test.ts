import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, isNull, like } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL ?? '';
const storage = vi.hoisted(() => ({
	getObject: vi.fn(),
	putObject: vi.fn(),
	deleteObject: vi.fn(),
}));

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => {
		throw new Error('no request context');
	}),
}));
vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: process.env.DATABASE_URL } }));
vi.mock('$lib/server/storage/r2.js', () => storage);

import { closeDb, getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { gift, giftCategory, giftLike, reservation } from '$lib/server/db/gift.schema.js';
import { giftIngestionOrphan } from '$lib/server/db/ingestion.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { newGiftDigestState, notification } from '$lib/server/db/notification.schema.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { parseNewGiftDigestPayload } from '$lib/modules/notifications/new_gift_digest.js';
import { copyGifts } from './gift_bulk_copy.js';

const PREFIX = `test-bulk-copy-${Date.now()}-`;
const RECIPIENT_ID = `${PREFIX}recipient`;
const MANAGER_ID = `${PREFIX}manager`;
const FOLLOWER_ID = `${PREFIX}follower`;
const SOURCE_ID = `${PREFIX}source`;
const DESTINATION_ID = `${PREFIX}destination`;
const SOURCE_GIFT_ONE = `${PREFIX}gift-one`;
const SOURCE_GIFT_TWO = `${PREFIX}gift-two`;
const MANAGER_ASSIGNMENTS = [`${PREFIX}source-manager`, `${PREFIX}destination-manager`];

function isLocalDatabaseUrl(value: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return false;
	}
}

async function isDatabaseReady() {
	if (!isLocalDatabaseUrl(databaseUrl)) {
		return false;
	}
	try {
		await getDb().select({ id: giftIngestionOrphan.id }).from(giftIngestionOrphan).limit(1);
		return true;
	} catch {
		await closeDb().catch(() => undefined);
		return false;
	}
}

const DATABASE_READY = await isDatabaseReady();

describe.skipIf(!DATABASE_READY)('bulk gift copy [real DB]', () => {
	beforeAll(async () => {
		const database = getDb();
		await database.insert(user).values([
			{ id: RECIPIENT_ID, name: 'Recipient', email: `${PREFIX}recipient@example.com` },
			{ id: MANAGER_ID, name: 'Manager', email: `${PREFIX}manager@example.com` },
			{ id: FOLLOWER_ID, name: 'Follower', email: `${PREFIX}follower@example.com` },
		]);
		await database.insert(wishlist).values([
			{
				id: SOURCE_ID,
				shortId: `${PREFIX}source-short`,
				recipientUserId: RECIPIENT_ID,
				title: 'Source',
				status: 'active',
			},
			{
				id: DESTINATION_ID,
				shortId: `${PREFIX}destination-short`,
				recipientUserId: RECIPIENT_ID,
				title: 'Destination',
				status: 'active',
			},
		]);
		await database.insert(moderatorAssignment).values([
			{ id: MANAGER_ASSIGNMENTS[0], wishlistId: SOURCE_ID, userId: MANAGER_ID },
			{ id: MANAGER_ASSIGNMENTS[1], wishlistId: DESTINATION_ID, userId: MANAGER_ID },
		]);
		await database.insert(priorityLevel).values([
			{
				id: `${PREFIX}source-priority-0`,
				wishlistId: SOURCE_ID,
				label: 'High',
				sortOrder: 0,
			},
			{ id: `${PREFIX}source-priority-1`, wishlistId: SOURCE_ID, label: 'Low', sortOrder: 1 },
			{
				id: `${PREFIX}destination-priority-0`,
				wishlistId: DESTINATION_ID,
				label: 'Important',
				sortOrder: 0,
			},
		]);
		await database.insert(giftCategory).values([
			{
				id: `${PREFIX}source-category`,
				wishlistId: SOURCE_ID,
				customLabel: 'Výlety',
				color: '#112233',
			},
			{
				id: `${PREFIX}destination-category`,
				wishlistId: DESTINATION_ID,
				customLabel: ' výlety ',
				color: '#445566',
			},
		]);
		await database.insert(gift).values([
			{
				id: SOURCE_GIFT_ONE,
				wishlistId: SOURCE_ID,
				name: 'Reserved source gift',
				description: 'Base',
				descriptionAppends: [{ text: 'Append', addedAt: '2026-01-01T00:00:00.000Z' }],
				links: [{ url: 'https://example.com/one' }],
				price: 10,
				priceMax: 20,
				quantity: 2,
				priorityLevelId: `${PREFIX}source-priority-0`,
				categoryId: `${PREFIX}source-category`,
				received: true,
				sortOrder: 0,
			},
			{
				id: SOURCE_GIFT_TWO,
				wishlistId: SOURCE_ID,
				name: 'Unmatched priority gift',
				priorityLevelId: `${PREFIX}source-priority-1`,
				sortOrder: 1,
			},
		]);
		await database.insert(reservation).values({
			giftId: SOURCE_GIFT_ONE,
			userId: FOLLOWER_ID,
			quantity: 1,
			purchasedAt: new Date(),
		});
		await database.insert(giftLike).values({ giftId: SOURCE_GIFT_ONE, userId: FOLLOWER_ID });
		await database.insert(wishlistFollower).values({
			wishlistId: DESTINATION_ID,
			userId: FOLLOWER_ID,
		});
	});

	beforeEach(async () => {
		storage.getObject.mockReset();
		storage.putObject.mockReset();
		storage.deleteObject.mockReset();
		storage.deleteObject.mockResolvedValue(undefined);
		await getDb().delete(gift).where(eq(gift.wishlistId, DESTINATION_ID));
		await getDb().delete(notification).where(eq(notification.userId, FOLLOWER_ID));
		await getDb().delete(newGiftDigestState).where(eq(newGiftDigestState.userId, FOLLOWER_ID));
		await getDb()
			.delete(giftIngestionOrphan)
			.where(like(giftIngestionOrphan.itemId, `${PREFIX}%`));
		await getDb()
			.update(wishlist)
			.set({ status: 'active', archivedAt: null })
			.where(eq(wishlist.id, DESTINATION_ID));
	});

	afterAll(async () => {
		if (!DATABASE_READY) {
			return;
		}
		await getDb()
			.delete(wishlist)
			.where(inArray(wishlist.id, [SOURCE_ID, DESTINATION_ID]));
		await getDb()
			.delete(user)
			.where(inArray(user.id, [RECIPIENT_ID, MANAGER_ID, FOLLOWER_ID]));
		await getDb()
			.delete(giftIngestionOrphan)
			.where(like(giftIngestionOrphan.itemId, `${PREFIX}%`));
		await closeDb();
	});

	it.each([RECIPIENT_ID, MANAGER_ID])(
		'copies for both recipient and správce roles without transferring private state (%s)',
		async (actorId) => {
			await copyGifts(actorId, {
				sourceWishlistId: SOURCE_ID,
				destinationWishlistId: DESTINATION_ID,
				giftIds: [SOURCE_GIFT_ONE, SOURCE_GIFT_TWO],
			});
			const copies = await getDb()
				.select()
				.from(gift)
				.where(and(eq(gift.wishlistId, DESTINATION_ID), isNull(gift.deletedAt)))
				.orderBy(gift.sortOrder);
			expect(copies.map((row) => row.name)).toEqual([
				'Reserved source gift',
				'Unmatched priority gift',
			]);
			expect(copies[0]).toMatchObject({
				description: 'Base\n\nAppend',
				descriptionAppends: [],
				received: false,
				priorityLevelId: `${PREFIX}destination-priority-0`,
				categoryId: `${PREFIX}destination-category`,
				editedAfterShareAt: null,
				preEditShareSnapshot: null,
			});
			expect(copies[1]?.priorityLevelId).toBeNull();
			expect(
				copies.every((row) => ![SOURCE_GIFT_ONE, SOURCE_GIFT_TWO].includes(row.id)),
			).toBe(true);
			const destinationReservations = await getDb()
				.select()
				.from(reservation)
				.where(
					inArray(
						reservation.giftId,
						copies.map((row) => row.id),
					),
				);
			const destinationLikes = await getDb()
				.select()
				.from(giftLike)
				.where(
					inArray(
						giftLike.giftId,
						copies.map((row) => row.id),
					),
				);
			expect(destinationReservations).toHaveLength(0);
			expect(destinationLikes).toHaveLength(0);
			expect(
				await getDb()
					.select()
					.from(reservation)
					.where(eq(reservation.giftId, SOURCE_GIFT_ONE)),
			).toHaveLength(1);
			expect(
				await getDb().select().from(giftLike).where(eq(giftLike.giftId, SOURCE_GIFT_ONE)),
			).toHaveLength(1);
			const digestRows = await getDb()
				.select()
				.from(notification)
				.where(eq(notification.userId, FOLLOWER_ID));
			expect(digestRows).toHaveLength(1);
			expect(parseNewGiftDigestPayload(digestRows[0]!.payload)?.totalCount).toBe(2);
		},
	);

	it('rejects mixed, duplicate, and same-source selections atomically', async () => {
		for (const input of [
			{
				giftIds: [SOURCE_GIFT_ONE, `${PREFIX}missing`],
				destinationWishlistId: DESTINATION_ID,
			},
			{ giftIds: [SOURCE_GIFT_ONE, SOURCE_GIFT_ONE], destinationWishlistId: DESTINATION_ID },
			{ giftIds: [SOURCE_GIFT_ONE], destinationWishlistId: SOURCE_ID },
		]) {
			await expect(
				copyGifts(RECIPIENT_ID, { sourceWishlistId: SOURCE_ID, ...input }),
			).rejects.toBeDefined();
		}
		expect(
			await getDb().select().from(gift).where(eq(gift.wishlistId, DESTINATION_ID)),
		).toHaveLength(0);
	});

	it('does not notify for a draft destination', async () => {
		await getDb()
			.update(wishlist)
			.set({ status: 'draft' })
			.where(eq(wishlist.id, DESTINATION_ID));
		await copyGifts(RECIPIENT_ID, {
			sourceWishlistId: SOURCE_ID,
			destinationWishlistId: DESTINATION_ID,
			giftIds: [SOURCE_GIFT_ONE],
		});
		expect(
			await getDb().select().from(notification).where(eq(notification.userId, FOLLOWER_ID)),
		).toHaveLength(0);
	});

	it('revalidates stale manager access after image staging and compensates the object', async () => {
		await getDb()
			.update(gift)
			.set({ imageKey: `${PREFIX}source.webp` })
			.where(eq(gift.id, SOURCE_GIFT_ONE));
		storage.getObject.mockResolvedValue({
			body: new ArrayBuffer(1),
			contentType: 'image/webp',
			etag: 'etag',
		});
		storage.putObject.mockImplementation(async () => {
			await getDb()
				.update(moderatorAssignment)
				.set({ deletedAt: new Date() })
				.where(eq(moderatorAssignment.id, MANAGER_ASSIGNMENTS[1]));
			return true;
		});
		await expect(
			copyGifts(MANAGER_ID, {
				sourceWishlistId: SOURCE_ID,
				destinationWishlistId: DESTINATION_ID,
				giftIds: [SOURCE_GIFT_ONE],
			}),
		).rejects.toBeDefined();
		expect(storage.deleteObject).toHaveBeenCalledOnce();
		expect(
			await getDb().select().from(gift).where(eq(gift.wishlistId, DESTINATION_ID)),
		).toHaveLength(0);
		await getDb()
			.update(moderatorAssignment)
			.set({ deletedAt: null })
			.where(eq(moderatorAssignment.id, MANAGER_ASSIGNMENTS[1]));
		await getDb().update(gift).set({ imageKey: null }).where(eq(gift.id, SOURCE_GIFT_ONE));
	});

	it('leaves a durable unresolved record when staged-object compensation fails', async () => {
		await getDb()
			.update(gift)
			.set({ imageKey: `${PREFIX}source.webp` })
			.where(eq(gift.id, SOURCE_GIFT_ONE));
		storage.getObject.mockResolvedValue({
			body: new ArrayBuffer(1),
			contentType: 'image/webp',
			etag: 'etag',
		});
		storage.putObject.mockImplementation(async () => {
			await getDb()
				.update(wishlist)
				.set({ status: 'archived' })
				.where(eq(wishlist.id, DESTINATION_ID));
			return true;
		});
		storage.deleteObject.mockRejectedValue(new Error('cleanup unavailable'));
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		await expect(
			copyGifts(RECIPIENT_ID, {
				sourceWishlistId: SOURCE_ID,
				destinationWishlistId: DESTINATION_ID,
				giftIds: [SOURCE_GIFT_ONE],
			}),
		).rejects.toBeDefined();
		consoleError.mockRestore();
		const unresolved = await getDb()
			.select()
			.from(giftIngestionOrphan)
			.where(
				and(
					like(giftIngestionOrphan.itemId, `${PREFIX}%`),
					isNull(giftIngestionOrphan.resolvedAt),
				),
			);
		expect(unresolved.some((row) => row.objectKey.includes('gifts/'))).toBe(true);
		await getDb()
			.update(wishlist)
			.set({ status: 'active', archivedAt: null })
			.where(eq(wishlist.id, DESTINATION_ID));
		await getDb().update(gift).set({ imageKey: null }).where(eq(gift.id, SOURCE_GIFT_ONE));
	});

	it('serializes concurrent appends while preserving each selected order', async () => {
		await Promise.all([
			copyGifts(RECIPIENT_ID, {
				sourceWishlistId: SOURCE_ID,
				destinationWishlistId: DESTINATION_ID,
				giftIds: [SOURCE_GIFT_ONE, SOURCE_GIFT_TWO],
			}),
			copyGifts(MANAGER_ID, {
				sourceWishlistId: SOURCE_ID,
				destinationWishlistId: DESTINATION_ID,
				giftIds: [SOURCE_GIFT_TWO, SOURCE_GIFT_ONE],
			}),
		]);
		const rows = await getDb()
			.select({ name: gift.name, sortOrder: gift.sortOrder })
			.from(gift)
			.where(eq(gift.wishlistId, DESTINATION_ID))
			.orderBy(gift.sortOrder);
		expect(new Set(rows.map((row) => row.sortOrder)).size).toBe(4);
		expect([
			[
				'Reserved source gift',
				'Unmatched priority gift',
				'Unmatched priority gift',
				'Reserved source gift',
			],
			[
				'Unmatched priority gift',
				'Reserved source gift',
				'Reserved source gift',
				'Unmatched priority gift',
			],
		]).toContainEqual(rows.map((row) => row.name));
	});
});
