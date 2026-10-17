import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, isNull, like } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL ?? '';
const storage = vi.hoisted(() => ({
	getObject: vi.fn(),
	putObject: vi.fn(),
	deleteObject: vi.fn(),
	deleteObjectsBestEffort: vi.fn(),
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
import { giftRevision } from '$lib/server/db/gift_revision.schema.js';
import { parseNewGiftDigestPayload } from '$lib/modules/notifications/new_gift_digest.js';
import type { BulkCopyGiftsInput } from './gift_bulk_copy.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_KIND } from '$lib/modules/wishlists/types.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { bulkCopyGiftsOperation } from '$lib/server/operations/gift_bulk_operations.js';
import {
	revertWishlistToDraftOperation,
	shareWishlistOperation,
} from '$lib/server/operations/wishlist_lifecycle_operations.js';

const copyActor = (actorId: string) => userInterfaceActor({ id: actorId, name: 'Copy actor' });

const copyGifts = (actorId: string, input: BulkCopyGiftsInput) =>
	executeOperation(copyActor(actorId), bulkCopyGiftsOperation, input);

const PREFIX = `test-bulk-copy-${Date.now()}-`;
const RECIPIENT_ID = `${PREFIX}recipient`;
const MANAGER_ID = `${PREFIX}manager`;
const FOLLOWER_ID = `${PREFIX}follower`;
const SOURCE_ID = `${PREFIX}source`;
const DESTINATION_ID = `${PREFIX}destination`;
const PERMANENT_SOURCE_ID = `${PREFIX}permanent-source`;
const PERMANENT_SOURCE_SHARED_AT = new Date(Date.now() - 60 * 60 * 1000);
const NEVER_SHARED_PERMANENT_SOURCE_ID = `${PREFIX}never-shared-permanent-source`;
const REVERTED_PERMANENT_SOURCE_ID = `${PREFIX}reverted-permanent-source`;
const SOURCE_GIFT_ONE = `${PREFIX}gift-one`;
const SOURCE_GIFT_TWO = `${PREFIX}gift-two`;
const MANAGER_ASSIGNMENTS = [
	`${PREFIX}source-manager`,
	`${PREFIX}destination-manager`,
	`${PREFIX}permanent-source-manager`,
	`${PREFIX}reverted-permanent-source-manager`,
];

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
			{
				id: PERMANENT_SOURCE_ID,
				shortId: `${PREFIX}permanent-source-short`,
				recipientUserId: RECIPIENT_ID,
				title: 'Permanent source',
				kind: WISHLIST_KIND.permanent,
				status: 'active',
				sharedAt: PERMANENT_SOURCE_SHARED_AT,
				firstSharedAt: PERMANENT_SOURCE_SHARED_AT,
			},
			{
				id: NEVER_SHARED_PERMANENT_SOURCE_ID,
				shortId: `${PREFIX}never-shared-permanent-source-short`,
				recipientUserId: RECIPIENT_ID,
				title: 'Never shared permanent source',
				kind: WISHLIST_KIND.permanent,
				status: 'draft',
			},
			{
				id: REVERTED_PERMANENT_SOURCE_ID,
				shortId: `${PREFIX}reverted-permanent-source-short`,
				recipientUserId: RECIPIENT_ID,
				title: 'Shared then reverted permanent source',
				kind: WISHLIST_KIND.permanent,
				status: 'draft',
			},
		]);
		await database.insert(moderatorAssignment).values([
			{ id: MANAGER_ASSIGNMENTS[0], wishlistId: SOURCE_ID, userId: MANAGER_ID },
			{ id: MANAGER_ASSIGNMENTS[1], wishlistId: DESTINATION_ID, userId: MANAGER_ID },
			{ id: MANAGER_ASSIGNMENTS[2], wishlistId: PERMANENT_SOURCE_ID, userId: MANAGER_ID },
			{
				id: MANAGER_ASSIGNMENTS[3],
				wishlistId: REVERTED_PERMANENT_SOURCE_ID,
				userId: MANAGER_ID,
			},
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
		storage.deleteObjectsBestEffort.mockReset();
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
			.where(
				inArray(wishlist.id, [
					SOURCE_ID,
					DESTINATION_ID,
					PERMANENT_SOURCE_ID,
					NEVER_SHARED_PERMANENT_SOURCE_ID,
					REVERTED_PERMANENT_SOURCE_ID,
				]),
			);
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
			const copyRevisions = await getDb()
				.select()
				.from(giftRevision)
				.where(
					inArray(
						giftRevision.giftId,
						copies.map((row) => row.id),
					),
				);
			expect(copyRevisions.map((revision) => revision.giftId).sort()).toEqual(
				copies.map((row) => row.id).sort(),
			);
			for (const revision of copyRevisions) {
				expect(revision).toMatchObject({
					before: null,
					actorUserId: actorId,
					channel: 'ui',
				});
			}
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

	it('dry-runs a copy without staging images or writing gifts', async () => {
		await getDb()
			.update(gift)
			.set({ imageKey: `${PREFIX}source.webp` })
			.where(eq(gift.id, SOURCE_GIFT_ONE));

		const dryRun = await executeOperation(
			copyActor(MANAGER_ID),
			bulkCopyGiftsOperation,
			{
				sourceWishlistId: SOURCE_ID,
				destinationWishlistId: DESTINATION_ID,
				giftIds: [SOURCE_GIFT_ONE],
			},
			{ dryRun: true },
		);

		expect(dryRun.revisions).toHaveLength(1);
		expect(storage.getObject).not.toHaveBeenCalled();
		expect(storage.putObject).not.toHaveBeenCalled();
		expect(storage.deleteObject).not.toHaveBeenCalled();
		expect(
			await getDb().select().from(gift).where(eq(gift.wishlistId, DESTINATION_ID)),
		).toHaveLength(0);
		expect(
			await getDb()
				.select()
				.from(giftIngestionOrphan)
				.where(like(giftIngestionOrphan.itemId, `${PREFIX}%`)),
		).toHaveLength(0);
		await getDb().update(gift).set({ imageKey: null }).where(eq(gift.id, SOURCE_GIFT_ONE));
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

	it('lets a správce move unreserved gifts out of a permanent wishlist and keeps reserved ones in place', async () => {
		const reservedSourceId = `${PREFIX}permanent-reserved`;
		const unreservedSourceId = `${PREFIX}permanent-unreserved`;
		const unreservedSourceImageKey = `${PREFIX}permanent-unreserved.webp`;
		const longAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
		await getDb()
			.insert(gift)
			.values([
				{
					id: reservedSourceId,
					wishlistId: PERMANENT_SOURCE_ID,
					name: 'Reserved permanent gift',
					createdAt: longAgo,
				},
				{
					id: unreservedSourceId,
					wishlistId: PERMANENT_SOURCE_ID,
					name: 'Unreserved permanent gift',
					imageKey: unreservedSourceImageKey,
					createdAt: longAgo,
				},
			]);
		await getDb()
			.insert(reservation)
			.values({ giftId: reservedSourceId, userId: FOLLOWER_ID, quantity: 1 });
		await getDb().insert(giftLike).values({ giftId: reservedSourceId, userId: FOLLOWER_ID });
		storage.getObject.mockResolvedValue({
			body: new ArrayBuffer(1),
			contentType: 'image/webp',
			etag: 'etag',
		});
		storage.putObject.mockResolvedValue(true);

		const result = await copyGifts(MANAGER_ID, {
			sourceWishlistId: PERMANENT_SOURCE_ID,
			destinationWishlistId: DESTINATION_ID,
			giftIds: [reservedSourceId, unreservedSourceId],
			removeUnreservedSources: true,
		});

		expect(result.removedSourceIds).toEqual([unreservedSourceId]);
		const sources = await getDb()
			.select({ id: gift.id, deletedAt: gift.deletedAt })
			.from(gift)
			.where(eq(gift.wishlistId, PERMANENT_SOURCE_ID));
		expect(sources.find((row) => row.id === unreservedSourceId)?.deletedAt).not.toBeNull();
		expect(sources.find((row) => row.id === reservedSourceId)?.deletedAt).toBeNull();
		const sourceRevisions = await getDb()
			.select()
			.from(giftRevision)
			.where(inArray(giftRevision.giftId, [reservedSourceId, unreservedSourceId]));
		expect(sourceRevisions).toHaveLength(1);
		expect(sourceRevisions[0]).toMatchObject({
			giftId: unreservedSourceId,
			wishlistId: PERMANENT_SOURCE_ID,
			before: { deletedAt: null },
			after: { deletedAt: expect.any(String) },
		});
		expect(
			await getDb()
				.select()
				.from(reservation)
				.where(
					and(eq(reservation.giftId, reservedSourceId), isNull(reservation.deletedAt)),
				),
		).toHaveLength(1);
		expect(
			await getDb().select().from(giftLike).where(eq(giftLike.giftId, reservedSourceId)),
		).toHaveLength(1);

		const copies = await getDb()
			.select()
			.from(gift)
			.where(and(eq(gift.wishlistId, DESTINATION_ID), isNull(gift.deletedAt)));
		expect(copies.map((row) => row.name).sort()).toEqual([
			'Reserved permanent gift',
			'Unreserved permanent gift',
		]);
		const copiedImageKey = copies.find(
			(row) => row.name === 'Unreserved permanent gift',
		)?.imageKey;
		expect(copiedImageKey).toEqual(expect.any(String));
		expect(copiedImageKey).not.toBe(unreservedSourceImageKey);
		expect(storage.deleteObject).not.toHaveBeenCalled();
		const deletedImageKeys = storage.deleteObjectsBestEffort.mock.calls.flatMap(
			([keys]) => keys as string[],
		);
		expect(deletedImageKeys).toEqual([unreservedSourceImageKey]);
	});

	it('lets the recipient move gifts out of a never-shared permanent wishlist', async () => {
		const unreservedSourceId = `${PREFIX}never-shared-unreserved`;
		await getDb().insert(gift).values({
			id: unreservedSourceId,
			wishlistId: NEVER_SHARED_PERMANENT_SOURCE_ID,
			name: 'Never shared permanent gift',
		});

		const result = await copyGifts(RECIPIENT_ID, {
			sourceWishlistId: NEVER_SHARED_PERMANENT_SOURCE_ID,
			destinationWishlistId: DESTINATION_ID,
			giftIds: [unreservedSourceId],
			removeUnreservedSources: true,
		});

		expect(result.removedSourceIds).toEqual([unreservedSourceId]);
		const [source] = await getDb()
			.select({ deletedAt: gift.deletedAt })
			.from(gift)
			.where(eq(gift.id, unreservedSourceId));
		expect(source?.deletedAt).not.toBeNull();
		expect(
			await getDb()
				.select()
				.from(gift)
				.where(and(eq(gift.wishlistId, DESTINATION_ID), isNull(gift.deletedAt))),
		).toHaveLength(1);
	});

	it('keeps the recipient copy-only once the permanent wishlist was shared, even after a revert to draft', async () => {
		const recipientGiftId = `${PREFIX}reverted-recipient-gift`;
		const managerGiftId = `${PREFIX}reverted-manager-gift`;
		await getDb()
			.insert(gift)
			.values([
				{
					id: recipientGiftId,
					wishlistId: REVERTED_PERMANENT_SOURCE_ID,
					name: 'Recipient gift',
				},
				{
					id: managerGiftId,
					wishlistId: REVERTED_PERMANENT_SOURCE_ID,
					name: 'Manager gift',
				},
			]);
		const lifecycleInput = { wishlistId: REVERTED_PERMANENT_SOURCE_ID };
		await executeOperation(copyActor(RECIPIENT_ID), shareWishlistOperation, lifecycleInput);
		await executeOperation(
			copyActor(MANAGER_ID),
			revertWishlistToDraftOperation,
			lifecycleInput,
		);
		const [revertedSource] = await getDb()
			.select({ sharedAt: wishlist.sharedAt, firstSharedAt: wishlist.firstSharedAt })
			.from(wishlist)
			.where(eq(wishlist.id, REVERTED_PERMANENT_SOURCE_ID));
		expect(revertedSource?.sharedAt).toBeNull();
		expect(revertedSource?.firstSharedAt).toBeInstanceOf(Date);

		const thrown = await copyGifts(RECIPIENT_ID, {
			sourceWishlistId: REVERTED_PERMANENT_SOURCE_ID,
			destinationWishlistId: DESTINATION_ID,
			giftIds: [recipientGiftId],
			removeUnreservedSources: true,
		}).catch((caught: unknown) => caught);
		expect(thrown).toMatchObject({
			status: 403,
			body: { message: SERVER_ERROR.BULK_COPY_RECIPIENT_CANNOT_MOVE },
		});

		const result = await copyGifts(MANAGER_ID, {
			sourceWishlistId: REVERTED_PERMANENT_SOURCE_ID,
			destinationWishlistId: DESTINATION_ID,
			giftIds: [managerGiftId],
			removeUnreservedSources: true,
		});
		expect(result.removedSourceIds).toEqual([managerGiftId]);
		const sources = await getDb()
			.select({ id: gift.id, deletedAt: gift.deletedAt })
			.from(gift)
			.where(eq(gift.wishlistId, REVERTED_PERMANENT_SOURCE_ID));
		expect(sources.find((row) => row.id === recipientGiftId)?.deletedAt).toBeNull();
		expect(sources.find((row) => row.id === managerGiftId)?.deletedAt).not.toBeNull();
	});

	it('rejects the recipient removing copied sources from a shared permanent wishlist, yet lets them copy', async () => {
		const unreservedSourceId = `${PREFIX}permanent-recipient-unreserved`;
		await getDb().insert(gift).values({
			id: unreservedSourceId,
			wishlistId: PERMANENT_SOURCE_ID,
			name: 'Recipient permanent gift',
		});

		const thrown = await copyGifts(RECIPIENT_ID, {
			sourceWishlistId: PERMANENT_SOURCE_ID,
			destinationWishlistId: DESTINATION_ID,
			giftIds: [unreservedSourceId],
			removeUnreservedSources: true,
		}).catch((caught: unknown) => caught);

		expect(thrown).toMatchObject({
			status: 403,
			body: { message: SERVER_ERROR.BULK_COPY_RECIPIENT_CANNOT_MOVE },
		});
		expect(
			await getDb().select().from(gift).where(eq(gift.wishlistId, DESTINATION_ID)),
		).toHaveLength(0);
		const readSourceDeletedAt = async () =>
			(
				await getDb()
					.select({ deletedAt: gift.deletedAt })
					.from(gift)
					.where(eq(gift.id, unreservedSourceId))
			)[0]?.deletedAt;
		expect(await readSourceDeletedAt()).toBeNull();

		const result = await copyGifts(RECIPIENT_ID, {
			sourceWishlistId: PERMANENT_SOURCE_ID,
			destinationWishlistId: DESTINATION_ID,
			giftIds: [unreservedSourceId],
		});
		expect(result.removedSourceIds).toEqual([]);
		expect(
			await getDb().select().from(gift).where(eq(gift.wishlistId, DESTINATION_ID)),
		).toHaveLength(1);
		expect(await readSourceDeletedAt()).toBeNull();
	});

	it('rejects removing copied sources from an occasion wishlist before copying', async () => {
		const thrown = await copyGifts(RECIPIENT_ID, {
			sourceWishlistId: SOURCE_ID,
			destinationWishlistId: DESTINATION_ID,
			giftIds: [SOURCE_GIFT_TWO],
			removeUnreservedSources: true,
		}).catch((caught: unknown) => caught);

		expect(thrown).toMatchObject({
			status: 400,
			body: { message: SERVER_ERROR.BULK_COPY_SOURCE_NOT_PERMANENT },
		});
		expect(
			await getDb().select().from(gift).where(eq(gift.wishlistId, DESTINATION_ID)),
		).toHaveLength(0);
		const [source] = await getDb()
			.select({ deletedAt: gift.deletedAt })
			.from(gift)
			.where(eq(gift.id, SOURCE_GIFT_TWO));
		expect(source?.deletedAt).toBeNull();
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
