import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, like } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL ?? '';

function isLocalDatabaseUrl(value: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return false;
	}
}

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => {
		throw new Error('no request context');
	}),
}));
vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: process.env.DATABASE_URL } }));
vi.mock('$lib/server/storage/r2.js', () => ({ deleteObjectsBestEffort: vi.fn() }));
vi.mock('$lib/server/anonymous_visitor.js', () => ({ getAnonVisitorId: vi.fn(() => null) }));
vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));
// Captures after-response work (the revision purge) so a test can await it.
vi.mock('$lib/server/background.js', () => ({ runAfterResponse: vi.fn() }));

import { closeDb, getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { giftRevision } from '$lib/server/db/gift_revision.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { DEFAULT_IMAGE_METADATA } from '$lib/modules/images/types.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { executeOperation, executeOperationBatch } from './runner.js';
import { OPERATION_CHANNEL, tokenChannel, type OperationActor } from './actor.js';
import { readWishlistGiftsOperation } from './gift_read_operations.js';
import {
	appendGiftDescriptionOperation,
	createGiftOperation,
	deleteGiftOperation,
	markGiftReceivedOperation,
	updateGiftOperation,
} from './gift_mutation_operations.js';
import { bulkUpdateGiftsOperation, reorderGiftsOperation } from './gift_bulk_operations.js';
import {
	undoGiftRevisionBatchOperation,
	undoGiftRevisionOperation,
} from './gift_undo_operations.js';
import {
	purgeExpiredGiftRevisions,
	resetGiftRevisionPurgeThrottleForTest,
} from './gift_revisions.js';
import { toGiftRevisionSnapshot } from './gift_revision_snapshot.js';
import { GIFT_REVISION_RETENTION_DAYS } from './constants.js';
import { runAfterResponse } from '$lib/server/background.js';

const PREFIX = `test-operations-${Date.now()}-`;
const RECIPIENT_ID = `${PREFIX}recipient`;
const MANAGER_ID = `${PREFIX}manager`;
const OUTSIDER_ID = `${PREFIX}outsider`;
const RESERVER_ID = `${PREFIX}reserver`;
const SECOND_RESERVER_ID = `${PREFIX}second-reserver`;
const RESERVER_NAME = 'Reserving gifter';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const recipientActor: OperationActor = {
	userId: RECIPIENT_ID,
	userName: 'Recipient',
	channel: OPERATION_CHANNEL.ui,
};
const managerActor: OperationActor = {
	userId: MANAGER_ID,
	userName: 'Manager',
	channel: tokenChannel('test-agent'),
};
const outsiderActor: OperationActor = {
	userId: OUTSIDER_ID,
	userName: 'Outsider',
	channel: OPERATION_CHANNEL.ui,
};

class ProbeRollback extends Error {}

async function isDbUsable(): Promise<boolean> {
	if (!isLocalDatabaseUrl(databaseUrl)) {
		return false;
	}
	try {
		await getDb().transaction(async (transaction) => {
			await transaction.select({ id: giftRevision.id }).from(giftRevision).limit(1);
			throw new ProbeRollback();
		});
		return true;
	} catch (caught) {
		if (caught instanceof ProbeRollback) {
			return true;
		}
		await closeDb().catch(() => undefined);
		return false;
	}
}

const DB_READY = await isDbUsable();

let fixtureCounter = 0;
function fixtureId(label: string): string {
	fixtureCounter += 1;
	return `${PREFIX}${label}-${fixtureCounter}`;
}

async function createWishlistFixture(
	options: {
		sharedAt?: Date | null;
		status?: 'draft' | 'active' | 'archived';
		recipientIsModerator?: boolean;
	} = {},
): Promise<{ id: string; shortId: string }> {
	const id = fixtureId('wishlist');
	const shortId = fixtureId('short');
	await getDb()
		.insert(wishlist)
		.values({
			id,
			shortId,
			title: 'Operation core wishlist',
			recipientUserId: RECIPIENT_ID,
			status: options.status ?? (options.sharedAt ? 'active' : 'draft'),
			sharedAt: options.sharedAt ?? null,
			recipientIsModerator: options.recipientIsModerator ?? false,
		});
	await getDb().insert(moderatorAssignment).values({ wishlistId: id, userId: MANAGER_ID });
	return { id, shortId };
}

async function createGiftFixture(
	wishlistId: string,
	values: Partial<typeof gift.$inferInsert> = {},
): Promise<string> {
	const id = fixtureId('gift');
	await getDb()
		.insert(gift)
		.values({ id, wishlistId, name: `Gift ${id}`, ...values });
	return id;
}

async function reserveGift(giftId: string, userId: string): Promise<void> {
	await getDb().insert(reservation).values({ giftId, userId });
}

async function reserveGiftForAnonymousEmail(giftId: string, email: string): Promise<void> {
	await getDb()
		.insert(reservation)
		.values({ giftId, anonymousName: 'Anonymous gifter', anonymousEmail: email });
}

function reservedGiftEditedNotifications() {
	return vi
		.mocked(dispatchNotification)
		.mock.calls.map(([input]) => input)
		.filter((input) => input.type === NOTIFICATION_TYPE.RESERVED_GIFT_EDITED);
}

async function seedRevision(giftId: string, wishlistId: string, createdAt: Date): Promise<string> {
	const id = fixtureId('seeded-revision');
	await getDb()
		.insert(giftRevision)
		.values({
			id,
			giftId,
			wishlistId,
			batchId: fixtureId('batch'),
			channel: OPERATION_CHANNEL.ui,
			operation: 'updateGift',
			after: toGiftRevisionSnapshot(await readGift(giftId)),
			createdAt,
		});
	return id;
}

async function readGift(giftId: string) {
	const [row] = await getDb().select().from(gift).where(eq(gift.id, giftId));
	if (row === undefined) {
		throw new Error(`Missing gift ${giftId}`);
	}
	return row;
}

async function revisionsForGift(giftId: string) {
	return getDb().select().from(giftRevision).where(eq(giftRevision.giftId, giftId));
}

function errorMessage(thrown: unknown): string {
	if (
		typeof thrown === 'object' &&
		thrown !== null &&
		'body' in thrown &&
		typeof thrown.body === 'object' &&
		thrown.body !== null &&
		'message' in thrown.body &&
		typeof thrown.body.message === 'string'
	) {
		return thrown.body.message;
	}
	return '';
}

async function captureError(work: Promise<unknown>): Promise<unknown> {
	try {
		await work;
	} catch (thrown) {
		return thrown;
	}
	throw new Error('Expected the operation to fail');
}

describe.skipIf(!DB_READY)('gift operation core [real DB]', () => {
	beforeAll(async () => {
		await getDb()
			.insert(user)
			.values([
				{ id: RECIPIENT_ID, name: 'Recipient', email: `${PREFIX}recipient@example.com` },
				{ id: MANAGER_ID, name: 'Manager', email: `${PREFIX}manager@example.com` },
				{ id: OUTSIDER_ID, name: 'Outsider', email: `${PREFIX}outsider@example.com` },
				{ id: RESERVER_ID, name: RESERVER_NAME, email: `${PREFIX}reserver@example.com` },
				{
					id: SECOND_RESERVER_ID,
					name: 'Second gifter',
					email: `${PREFIX}second-reserver@example.com`,
				},
			]);
	});

	beforeEach(() => {
		vi.mocked(dispatchNotification).mockClear();
		vi.mocked(deleteObjectsBestEffort).mockClear();
		vi.mocked(runAfterResponse).mockClear();
	});

	afterAll(async () => {
		if (!DB_READY) {
			return;
		}
		await getDb()
			.delete(wishlist)
			.where(like(wishlist.id, `${PREFIX}%`));
		await getDb()
			.delete(user)
			.where(like(user.id, `${PREFIX}%`));
		await closeDb();
	});

	describe('manager rights', () => {
		it('lets the recipient and a správce edit, and denies an outsider', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId);

			await executeOperation(recipientActor, updateGiftOperation, {
				id: giftId,
				name: 'Recipient name',
			});
			expect((await readGift(giftId)).name).toBe('Recipient name');
			await executeOperation(managerActor, updateGiftOperation, {
				id: giftId,
				name: 'Manager name',
			});
			expect((await readGift(giftId)).name).toBe('Manager name');

			const thrown = await captureError(
				executeOperation(outsiderActor, updateGiftOperation, {
					id: giftId,
					name: 'Outsider name',
				}),
			);
			expect(thrown).toMatchObject({ status: 403 });
			expect(errorMessage(thrown)).toBe(SERVER_ERROR.ACCESS_DENIED);
			expect((await readGift(giftId)).name).toBe('Manager name');
		});

		it('rejects writes on archived wishlists', async () => {
			const { id: wishlistId } = await createWishlistFixture({ status: 'archived' });
			const giftId = await createGiftFixture(wishlistId);

			const thrown = await captureError(
				executeOperation(recipientActor, deleteGiftOperation, { giftId }),
			);
			expect(thrown).toMatchObject({ status: 400 });
			expect(errorMessage(thrown)).toBe(SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
			expect((await readGift(giftId)).deletedAt).toBeNull();
		});
	});

	describe('post-share rules', () => {
		const sharedLongAgo = () => new Date(Date.now() - 60 * MINUTE_MS);
		const preShareCreation = () => new Date(Date.now() - 120 * MINUTE_MS);

		it('freezes the recipient name after share grace', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const giftId = await createGiftFixture(wishlistId, { createdAt: preShareCreation() });

			const thrown = await captureError(
				executeOperation(recipientActor, updateGiftOperation, {
					id: giftId,
					name: 'Renamed',
				}),
			);
			expect(thrown).toMatchObject({ status: 403 });
			expect(errorMessage(thrown)).toBe(SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING);
		});

		it('turns a recipient description edit into an append and keeps the original', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const giftId = await createGiftFixture(wishlistId, {
				createdAt: preShareCreation(),
				description: 'Original',
			});

			await executeOperation(recipientActor, updateGiftOperation, {
				id: giftId,
				description: 'Size M please',
			});
			const updated = await readGift(giftId);
			expect(updated.description).toBe('Original');
			expect(updated.descriptionAppends.map((append) => append.text)).toEqual([
				'Size M please',
			]);
		});

		it('appends a description segment for a správce through the dedicated operation', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const giftId = await createGiftFixture(wishlistId, {
				createdAt: preShareCreation(),
				description: 'Original',
			});

			await executeOperation(managerActor, appendGiftDescriptionOperation, {
				giftId,
				text: 'Blue preferred',
			});
			const updated = await readGift(giftId);
			expect(updated.description).toBe('Original');
			expect(updated.descriptionAppends.map((append) => append.text)).toEqual([
				'Blue preferred',
			]);
			expect(updated.editedAfterShareAt).not.toBeNull();
		});

		it('lets the recipient raise but never lower quantity', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const giftId = await createGiftFixture(wishlistId, {
				createdAt: preShareCreation(),
				quantity: 3,
			});

			const thrown = await captureError(
				executeOperation(recipientActor, updateGiftOperation, { id: giftId, quantity: 2 }),
			);
			expect(thrown).toMatchObject({ status: 400 });
			expect(errorMessage(thrown)).toBe(SERVER_ERROR.QUANTITY_CANNOT_BE_LOWERED);

			await executeOperation(recipientActor, updateGiftOperation, {
				id: giftId,
				quantity: 5,
			});
			expect((await readGift(giftId)).quantity).toBe(5);
		});

		it('applies share grace to pre-share gifts and creation grace to post-share gifts', async () => {
			const recentlyShared = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 30 * 1000),
			});
			const preShareInGrace = await createGiftFixture(recentlyShared.id, {
				createdAt: preShareCreation(),
			});
			await executeOperation(recipientActor, deleteGiftOperation, {
				giftId: preShareInGrace,
			});
			expect((await readGift(preShareInGrace)).deletedAt).not.toBeNull();

			const longShared = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const preShareAfterGrace = await createGiftFixture(longShared.id, {
				createdAt: preShareCreation(),
			});
			const thrown = await captureError(
				executeOperation(recipientActor, deleteGiftOperation, {
					giftId: preShareAfterGrace,
				}),
			);
			expect(thrown).toMatchObject({ status: 403 });
			expect(errorMessage(thrown)).toBe(SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING);

			const postShareInGrace = await createGiftFixture(longShared.id, {
				createdAt: new Date(Date.now() - 30 * 1000),
			});
			await executeOperation(recipientActor, deleteGiftOperation, {
				giftId: postShareInGrace,
			});
			expect((await readGift(postShareInGrace)).deletedAt).not.toBeNull();

			const postShareAfterGrace = await createGiftFixture(longShared.id, {
				createdAt: new Date(Date.now() - 10 * MINUTE_MS),
			});
			const lateDelete = await captureError(
				executeOperation(recipientActor, deleteGiftOperation, {
					giftId: postShareAfterGrace,
				}),
			);
			expect(errorMessage(lateDelete)).toBe(SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING);
		});

		it('blocks deleting a reserved gift even during grace, while a správce deletes unreserved gifts freely', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 30 * 1000),
			});
			const reservedGiftId = await createGiftFixture(wishlistId, {
				createdAt: preShareCreation(),
			});
			await reserveGift(reservedGiftId, RESERVER_ID);
			const thrown = await captureError(
				executeOperation(recipientActor, deleteGiftOperation, { giftId: reservedGiftId }),
			);
			expect(thrown).toMatchObject({ status: 400 });
			expect(errorMessage(thrown)).toBe(SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT);

			const longShared = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const unreservedGiftId = await createGiftFixture(longShared.id, {
				createdAt: preShareCreation(),
			});
			await executeOperation(managerActor, deleteGiftOperation, { giftId: unreservedGiftId });
			expect((await readGift(unreservedGiftId)).deletedAt).not.toBeNull();
		});

		it('lets a správce rename and lower quantity after share grace', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const giftId = await createGiftFixture(wishlistId, {
				createdAt: preShareCreation(),
				name: 'Original',
				quantity: 3,
			});

			await executeOperation(managerActor, updateGiftOperation, {
				id: giftId,
				name: 'Renamed by správce',
				quantity: 1,
			});

			expect(await readGift(giftId)).toMatchObject({
				name: 'Renamed by správce',
				quantity: 1,
			});
		});

		it('lets the recipient rename a pre-share gift during share grace', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 30 * 1000),
			});
			const giftId = await createGiftFixture(wishlistId, {
				createdAt: preShareCreation(),
				name: 'Original',
			});

			await executeOperation(recipientActor, updateGiftOperation, {
				id: giftId,
				name: 'Renamed in grace',
			});

			expect((await readGift(giftId)).name).toBe('Renamed in grace');
		});

		it('flags a manager edit on a shared wishlist as edited after sharing', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const giftId = await createGiftFixture(wishlistId, { createdAt: preShareCreation() });

			await executeOperation(managerActor, updateGiftOperation, { id: giftId, price: 500 });

			expect((await readGift(giftId)).editedAfterShareAt).not.toBeNull();
		});
	});

	describe('role-filtered reads', () => {
		async function reservedListFixture(recipientIsModerator: boolean) {
			const wishlistFixture = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 60 * MINUTE_MS),
				recipientIsModerator,
			});
			const giftId = await createGiftFixture(wishlistFixture.id);
			await reserveGift(giftId, RESERVER_ID);
			return { ...wishlistFixture, giftId };
		}

		it('strips reservation data, counts and likes for the recipient', async () => {
			const { shortId } = await reservedListFixture(false);
			const { gifts } = await executeOperation(recipientActor, readWishlistGiftsOperation, {
				wishlistShortId: shortId,
			});
			const [readGiftRow] = gifts;
			expect(Object.keys(readGiftRow ?? {}).sort()).toEqual(
				[
					'id',
					'wishlistId',
					'name',
					'description',
					'descriptionAppends',
					'editedAfterShareAt',
					'links',
					'price',
					'priceMax',
					'currency',
					'imageUrl',
					'imageKey',
					'imageMeta',
					'quantity',
					'sortOrder',
					'received',
					'createdAt',
					'priorityLevelId',
					'priorityLabel',
					'prioritySortOrder',
					'categoryId',
					'category',
				].sort(),
			);
		});

		it('shows counts but no names to a self-promoted recipient and a visitor, names to správci', async () => {
			const { shortId } = await reservedListFixture(true);

			const selfPromoted = await executeOperation(
				recipientActor,
				readWishlistGiftsOperation,
				{
					wishlistShortId: shortId,
				},
			);
			expect(selfPromoted.gifts[0]).toMatchObject({ reservedCount: 1, reserverNames: [] });

			const visitor = await executeOperation(outsiderActor, readWishlistGiftsOperation, {
				wishlistShortId: shortId,
			});
			expect(visitor.gifts[0]).toMatchObject({ reservedCount: 1, reserverNames: [] });

			const anonymous = await executeOperation(null, readWishlistGiftsOperation, {
				wishlistShortId: shortId,
			});
			expect(anonymous.gifts[0]).toMatchObject({ reservedCount: 1, reserverNames: [] });

			const manager = await executeOperation(managerActor, readWishlistGiftsOperation, {
				wishlistShortId: shortId,
			});
			expect(manager.gifts[0]).toMatchObject({
				reservedCount: 1,
				reserverNames: [RESERVER_NAME],
			});
		});
	});

	describe('revisions', () => {
		it('records actor, channel and before/after for every mutation', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const created = await executeOperation(managerActor, createGiftOperation, {
				wishlistId,
				name: 'Created by agent',
			});
			const giftId = created.gift.id;
			await executeOperation(managerActor, updateGiftOperation, {
				id: giftId,
				name: 'Renamed by agent',
			});
			await executeOperation(recipientActor, markGiftReceivedOperation, {
				giftId,
				received: true,
			});

			const revisions = await revisionsForGift(giftId);
			expect(revisions).toHaveLength(3);
			const byOperation = new Map(
				revisions.map((revision) => [revision.operation, revision]),
			);
			expect(byOperation.get('createGift')).toMatchObject({
				actorUserId: MANAGER_ID,
				channel: 'token:test-agent',
				before: null,
				after: { name: 'Created by agent' },
			});
			expect(byOperation.get('updateGift')).toMatchObject({
				actorUserId: MANAGER_ID,
				channel: 'token:test-agent',
				before: { name: 'Created by agent' },
				after: { name: 'Renamed by agent' },
			});
			expect(byOperation.get('markGiftReceived')).toMatchObject({
				actorUserId: RECIPIENT_ID,
				channel: 'ui',
				before: { received: false },
				after: { received: true },
			});
		});

		it('records one revision per changed gift for a bulk update, sharing a batch', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const [levelId] = (
				await getDb()
					.insert(priorityLevel)
					.values({ wishlistId, label: 'Top', sortOrder: 0 })
					.returning({ id: priorityLevel.id })
			).map((row) => row.id);
			const firstGiftId = await createGiftFixture(wishlistId, { sortOrder: 0 });
			const secondGiftId = await createGiftFixture(wishlistId, { sortOrder: 1 });

			await executeOperation(managerActor, bulkUpdateGiftsOperation, {
				wishlistId,
				giftIds: [firstGiftId, secondGiftId],
				action: 'priority',
				priorityLevelId: levelId ?? null,
			});
			const bulkRevisions = await getDb()
				.select()
				.from(giftRevision)
				.where(inArray(giftRevision.giftId, [firstGiftId, secondGiftId]));
			expect(bulkRevisions).toHaveLength(2);
			expect(new Set(bulkRevisions.map((revision) => revision.batchId)).size).toBe(1);
		});

		it('records reorder revisions only for gifts whose group changed, never for order alone', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const [levelId] = (
				await getDb()
					.insert(priorityLevel)
					.values({ wishlistId, label: 'Top', sortOrder: 0 })
					.returning({ id: priorityLevel.id })
			).map((row) => row.id);
			const firstGiftId = await createGiftFixture(wishlistId, { sortOrder: 0 });
			const secondGiftId = await createGiftFixture(wishlistId, { sortOrder: 1 });
			const thirdGiftId = await createGiftFixture(wishlistId, { sortOrder: 2 });
			const reorderRevisions = () =>
				getDb()
					.select()
					.from(giftRevision)
					.where(
						and(
							eq(giftRevision.wishlistId, wishlistId),
							eq(giftRevision.operation, 'reorderGifts'),
						),
					);

			await executeOperation(managerActor, reorderGiftsOperation, {
				wishlistId,
				orderedGiftIds: [thirdGiftId, secondGiftId, firstGiftId],
			});
			expect(await reorderRevisions()).toHaveLength(0);

			await executeOperation(managerActor, reorderGiftsOperation, {
				wishlistId,
				orderedGiftIds: [firstGiftId, secondGiftId, thirdGiftId],
				groupChanges: [{ giftId: secondGiftId, field: 'priority', value: levelId ?? null }],
			});
			const revisions = await reorderRevisions();
			expect(revisions).toHaveLength(1);
			expect(revisions[0]).toMatchObject({
				giftId: secondGiftId,
				before: { priorityLevelId: null },
				after: { priorityLevelId: levelId },
			});
			expect(revisions[0]?.after).not.toHaveProperty('sortOrder');
		});

		it('rolls back every step and dispatches no effects when a later batch step is rejected', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 60 * MINUTE_MS),
			});
			const replacedKey = `gifts/${fixtureId('upload')}.webp`;
			const editedGiftId = await createGiftFixture(wishlistId, {
				name: 'Edited first',
				imageUrl: `https://cdn.example.com/${replacedKey}`,
				imageKey: replacedKey,
				imageMeta: DEFAULT_IMAGE_METADATA,
			});
			await reserveGift(editedGiftId, RESERVER_ID);
			const reservedGiftId = await createGiftFixture(wishlistId, { name: 'Reserved' });
			await reserveGift(reservedGiftId, SECOND_RESERVER_ID);
			resetGiftRevisionPurgeThrottleForTest();

			const thrown = await captureError(
				executeOperationBatch(managerActor, [
					{
						operation: updateGiftOperation,
						input: {
							id: editedGiftId,
							name: 'Edited in batch',
							imageUrl: 'https://shop.example.com/replacement.jpg',
							imageKey: null,
						},
					},
					{ operation: deleteGiftOperation, input: { giftId: reservedGiftId } },
				]),
			);

			expect(errorMessage(thrown)).toBe(SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT);
			expect(await readGift(editedGiftId)).toMatchObject({
				name: 'Edited first',
				imageKey: replacedKey,
			});
			const revisions = await getDb()
				.select()
				.from(giftRevision)
				.where(eq(giftRevision.wishlistId, wishlistId));
			expect(revisions).toHaveLength(0);
			expect(vi.mocked(deleteObjectsBestEffort)).not.toHaveBeenCalled();
			expect(vi.mocked(dispatchNotification)).not.toHaveBeenCalled();
			expect(vi.mocked(runAfterResponse)).not.toHaveBeenCalled();
		});

		it('writes nothing for a rejected mutation or an unchanged edit', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 60 * MINUTE_MS),
			});
			const giftId = await createGiftFixture(wishlistId, {
				createdAt: new Date(Date.now() - 120 * MINUTE_MS),
				name: 'Frozen',
			});
			await captureError(
				executeOperation(recipientActor, updateGiftOperation, { id: giftId, name: 'New' }),
			);
			await executeOperation(recipientActor, updateGiftOperation, {
				id: giftId,
				name: 'Frozen',
			});
			expect(await revisionsForGift(giftId)).toHaveLength(0);
		});

		it('dry-runs a mutation without writing and returns the planned revisions', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId, { name: 'Before dry run' });

			const dryRun = await executeOperation(
				managerActor,
				updateGiftOperation,
				{ id: giftId, name: 'Planned name' },
				{ dryRun: true },
			);
			expect(dryRun.result.gift?.name).toBe('Planned name');
			expect(dryRun.revisions).toHaveLength(1);
			expect(dryRun.revisions[0]).toMatchObject({
				giftId,
				before: { name: 'Before dry run' },
				after: { name: 'Planned name' },
			});
			expect((await readGift(giftId)).name).toBe('Before dry run');
			expect(await revisionsForGift(giftId)).toHaveLength(0);
		});

		it('dry-runs a delete of an uploaded-image gift without deleting the object', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const uploadedKey = `gifts/${fixtureId('upload')}.webp`;
			const giftId = await createGiftFixture(wishlistId, {
				imageUrl: `https://cdn.example.com/${uploadedKey}`,
				imageKey: uploadedKey,
				imageMeta: DEFAULT_IMAGE_METADATA,
			});

			const dryRun = await executeOperation(
				managerActor,
				deleteGiftOperation,
				{ giftId },
				{ dryRun: true },
			);

			expect(dryRun.revisions).toHaveLength(1);
			expect((await readGift(giftId)).deletedAt).toBeNull();
			expect(vi.mocked(deleteObjectsBestEffort)).not.toHaveBeenCalled();
			expect(vi.mocked(dispatchNotification)).not.toHaveBeenCalled();
		});

		it('dry-runs a správce edit of a reserved gift without notifying the reserver', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 60 * MINUTE_MS),
			});
			const giftId = await createGiftFixture(wishlistId, { name: 'Reserved' });
			await reserveGift(giftId, RESERVER_ID);

			await executeOperation(
				managerActor,
				updateGiftOperation,
				{ id: giftId, name: 'Planned rename' },
				{ dryRun: true },
			);

			expect((await readGift(giftId)).name).toBe('Reserved');
			expect(vi.mocked(dispatchNotification)).not.toHaveBeenCalled();
			expect(vi.mocked(deleteObjectsBestEffort)).not.toHaveBeenCalled();
		});
	});

	describe('undo', () => {
		it('undoes a whole batch atomically and records the undo as a new batch', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const firstGiftId = await createGiftFixture(wishlistId, { name: 'First' });
			const secondGiftId = await createGiftFixture(wishlistId, { name: 'Second' });

			const batch = await executeOperationBatch(managerActor, [
				{
					operation: updateGiftOperation,
					input: { id: firstGiftId, name: 'First edited' },
				},
				{
					operation: updateGiftOperation,
					input: { id: secondGiftId, name: 'Second edited' },
				},
			]);
			const undo = await executeOperation(recipientActor, undoGiftRevisionBatchOperation, {
				batchId: batch.batchId,
			});

			expect(undo.restoredGiftIds.sort()).toEqual([firstGiftId, secondGiftId].sort());
			expect((await readGift(firstGiftId)).name).toBe('First');
			expect((await readGift(secondGiftId)).name).toBe('Second');
			const undoRevisions = await getDb()
				.select()
				.from(giftRevision)
				.where(
					and(
						inArray(giftRevision.giftId, [firstGiftId, secondGiftId]),
						eq(giftRevision.operation, 'undoGiftRevisionBatch'),
					),
				);
			expect(undoRevisions).toHaveLength(2);
			const [undoBatchId] = new Set(undoRevisions.map((revision) => revision.batchId));
			expect(undoBatchId).toBeDefined();
			expect(undoBatchId).not.toBe(batch.batchId);
			for (const revision of undoRevisions) {
				expect(revision).toMatchObject({
					batchId: undoBatchId,
					actorUserId: RECIPIENT_ID,
					channel: 'ui',
				});
			}
		});

		it('refuses to undo a batch that was already undone', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId, { name: 'Once' });
			const batch = await executeOperationBatch(managerActor, [
				{ operation: updateGiftOperation, input: { id: giftId, name: 'Once edited' } },
			]);
			await executeOperation(managerActor, undoGiftRevisionBatchOperation, {
				batchId: batch.batchId,
			});

			const thrown = await captureError(
				executeOperation(managerActor, undoGiftRevisionBatchOperation, {
					batchId: batch.batchId,
				}),
			);

			expect(thrown).toMatchObject({ status: 409 });
			expect((await readGift(giftId)).name).toBe('Once');
		});

		it('refuses to undo a revision that is no longer the latest, even when the gift looks unchanged', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId, { name: 'A' });
			const firstEdit = await executeOperationBatch(managerActor, [
				{ operation: updateGiftOperation, input: { id: giftId, name: 'B' } },
			]);
			await executeOperation(managerActor, updateGiftOperation, { id: giftId, name: 'C' });
			await executeOperation(managerActor, updateGiftOperation, { id: giftId, name: 'B' });

			const thrown = await captureError(
				executeOperation(managerActor, undoGiftRevisionBatchOperation, {
					batchId: firstEdit.batchId,
				}),
			);

			expect(thrown).toMatchObject({ status: 409 });
			expect((await readGift(giftId)).name).toBe('B');
		});

		it('undoes the latest edit of a single gift', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId, { name: 'Single' });
			await executeOperation(managerActor, updateGiftOperation, { id: giftId, price: 120 });

			await executeOperation(managerActor, undoGiftRevisionOperation, { giftId });

			expect((await readGift(giftId)).price).toBeNull();
		});

		it('undoes a single gift deletion', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId, { name: 'Deleted' });
			await executeOperation(managerActor, deleteGiftOperation, { giftId });

			await executeOperation(managerActor, undoGiftRevisionOperation, { giftId });

			expect((await readGift(giftId)).deletedAt).toBeNull();
		});

		it('undoes a single gift creation by deleting the gift', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const created = await executeOperation(recipientActor, createGiftOperation, {
				wishlistId,
				name: 'Created then undone',
			});

			await executeOperation(recipientActor, undoGiftRevisionOperation, {
				giftId: created.gift.id,
			});

			expect((await readGift(created.gift.id)).deletedAt).not.toBeNull();
		});

		it('restores a deleted gift without its uploaded image, whose object the deletion removed', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const uploadedKey = `gifts/${fixtureId('upload')}.webp`;
			const giftId = await createGiftFixture(wishlistId, {
				imageUrl: `https://cdn.example.com/${uploadedKey}`,
				imageKey: uploadedKey,
				imageMeta: DEFAULT_IMAGE_METADATA,
			});
			await executeOperation(managerActor, deleteGiftOperation, { giftId });
			vi.mocked(deleteObjectsBestEffort).mockClear();

			await executeOperation(managerActor, undoGiftRevisionOperation, { giftId });

			expect(await readGift(giftId)).toMatchObject({
				deletedAt: null,
				imageUrl: null,
				imageKey: null,
				imageMeta: null,
			});
			expect(vi.mocked(deleteObjectsBestEffort)).not.toHaveBeenCalled();
		});

		it('restores a deleted gift with its external image URL', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const externalUrl = 'https://shop.example.com/product.jpg';
			const giftId = await createGiftFixture(wishlistId, {
				imageUrl: externalUrl,
				imageMeta: DEFAULT_IMAGE_METADATA,
			});
			await executeOperation(managerActor, deleteGiftOperation, { giftId });

			await executeOperation(managerActor, undoGiftRevisionOperation, { giftId });

			expect(await readGift(giftId)).toMatchObject({
				deletedAt: null,
				imageUrl: externalUrl,
				imageKey: null,
				imageMeta: DEFAULT_IMAGE_METADATA,
			});
		});

		it('keeps the current image when undoing an upload replacement whose old object is gone', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const replacedKey = `gifts/${fixtureId('upload')}.webp`;
			const replacementKey = `gifts/${fixtureId('upload')}.webp`;
			const giftId = await createGiftFixture(wishlistId, {
				imageUrl: `https://cdn.example.com/${replacedKey}`,
				imageKey: replacedKey,
				imageMeta: DEFAULT_IMAGE_METADATA,
			});
			await executeOperation(managerActor, updateGiftOperation, {
				id: giftId,
				imageUrl: `https://cdn.example.com/${replacementKey}`,
				imageKey: replacementKey,
			});
			vi.mocked(deleteObjectsBestEffort).mockClear();

			await executeOperation(managerActor, undoGiftRevisionOperation, { giftId });

			expect(await readGift(giftId)).toMatchObject({
				imageUrl: `https://cdn.example.com/${replacementKey}`,
				imageKey: replacementKey,
			});
			expect(vi.mocked(deleteObjectsBestEffort)).not.toHaveBeenCalled();
		});

		it('reports a conflict after a later edit and leaves every gift of the batch untouched', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const firstGiftId = await createGiftFixture(wishlistId, { name: 'Alpha' });
			const secondGiftId = await createGiftFixture(wishlistId, { name: 'Beta' });
			const batch = await executeOperationBatch(managerActor, [
				{ operation: updateGiftOperation, input: { id: firstGiftId, name: 'Alpha 2' } },
				{ operation: updateGiftOperation, input: { id: secondGiftId, name: 'Beta 2' } },
			]);
			await executeOperation(recipientActor, updateGiftOperation, {
				id: secondGiftId,
				name: 'Beta 3',
			});

			const thrown = await captureError(
				executeOperation(managerActor, undoGiftRevisionBatchOperation, {
					batchId: batch.batchId,
				}),
			);
			expect(thrown).toMatchObject({ status: 409 });
			expect(JSON.parse(errorMessage(thrown))).toEqual({
				code: SERVER_ERROR.GIFT_REVISION_CONFLICT,
				giftIds: secondGiftId,
			});
			expect((await readGift(firstGiftId)).name).toBe('Alpha 2');
			expect((await readGift(secondGiftId)).name).toBe('Beta 3');
		});

		it('reports a conflict when the gift changed outside recorded revisions', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId, { name: 'Tracked' });
			await executeOperation(managerActor, updateGiftOperation, {
				id: giftId,
				name: 'Tracked 2',
			});
			await getDb().update(gift).set({ quantity: 7 }).where(eq(gift.id, giftId));

			const thrown = await captureError(
				executeOperation(managerActor, undoGiftRevisionOperation, { giftId }),
			);
			expect(thrown).toMatchObject({ status: 409 });
			expect((await readGift(giftId)).name).toBe('Tracked 2');
		});

		it('applies post-share rules to the undo itself', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 60 * MINUTE_MS),
			});
			const giftId = await createGiftFixture(wishlistId, {
				createdAt: new Date(Date.now() - 120 * MINUTE_MS),
				quantity: 1,
			});
			await executeOperation(recipientActor, updateGiftOperation, {
				id: giftId,
				quantity: 3,
			});

			const thrown = await captureError(
				executeOperation(recipientActor, undoGiftRevisionOperation, { giftId }),
			);
			expect(errorMessage(thrown)).toBe(SERVER_ERROR.QUANTITY_CANNOT_BE_LOWERED);
			expect((await readGift(giftId)).quantity).toBe(3);
		});

		it('is scoped to wishlists the actor manages', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId, { name: 'Private' });
			const result = await executeOperationBatch(managerActor, [
				{ operation: updateGiftOperation, input: { id: giftId, name: 'Private 2' } },
			]);

			const thrown = await captureError(
				executeOperation(outsiderActor, undoGiftRevisionBatchOperation, {
					batchId: result.batchId,
				}),
			);
			expect(thrown).toMatchObject({ status: 403 });
			expect((await readGift(giftId)).name).toBe('Private 2');
		});
	});

	describe('retention', () => {
		it('retains revisions for 90 days', () => {
			expect(GIFT_REVISION_RETENTION_DAYS).toBe(90);
		});

		it('purges revisions older than 90 days and keeps newer ones', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId);
			const now = new Date();
			await seedRevision(giftId, wishlistId, new Date(now.getTime() - 91 * DAY_MS));
			const retainedId = await seedRevision(
				giftId,
				wishlistId,
				new Date(now.getTime() - 89 * DAY_MS),
			);

			await purgeExpiredGiftRevisions(getDb(), now);

			const remainingIds = (await revisionsForGift(giftId)).map((revision) => revision.id);
			expect(remainingIds).toEqual([retainedId]);
		});

		it('purges expired revisions after a committed mutation', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId);
			const expiredId = await seedRevision(
				giftId,
				wishlistId,
				new Date(Date.now() - 91 * DAY_MS),
			);
			resetGiftRevisionPurgeThrottleForTest();

			await executeOperation(managerActor, updateGiftOperation, {
				id: giftId,
				name: 'Triggers the purge',
			});
			await Promise.all(vi.mocked(runAfterResponse).mock.calls.map(([task]) => task()));

			const remainingIds = (await revisionsForGift(giftId)).map((revision) => revision.id);
			expect(remainingIds).not.toContain(expiredId);
			expect(remainingIds).toHaveLength(1);
		});
	});

	describe('reserver notifications', () => {
		it('sends each reserver one notification listing every gift a bulk edit touched', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 60 * MINUTE_MS),
			});
			const firstGiftId = await createGiftFixture(wishlistId, { name: 'Lamp' });
			const secondGiftId = await createGiftFixture(wishlistId, { name: 'Book' });
			const thirdGiftId = await createGiftFixture(wishlistId, { name: 'Mug' });
			await reserveGift(firstGiftId, RESERVER_ID);
			await reserveGift(secondGiftId, RESERVER_ID);
			await reserveGift(thirdGiftId, SECOND_RESERVER_ID);

			await executeOperation(managerActor, bulkUpdateGiftsOperation, {
				wishlistId,
				giftIds: [firstGiftId, secondGiftId, thirdGiftId],
				action: 'imageBackground',
				background: '#000000',
			});

			const editedCalls = reservedGiftEditedNotifications();
			const reserverCalls = editedCalls.filter((input) =>
				(input.targetUserIds ?? []).includes(RESERVER_ID),
			);
			expect(reserverCalls).toHaveLength(1);
			expect([...(reserverCalls[0]?.giftNames ?? [])].sort()).toEqual(['Book', 'Lamp']);
			const secondReserverCalls = editedCalls.filter((input) =>
				(input.targetUserIds ?? []).includes(SECOND_RESERVER_ID),
			);
			expect(secondReserverCalls).toHaveLength(1);
			expect(secondReserverCalls[0]).toMatchObject({
				giftId: thirdGiftId,
				giftName: 'Mug',
			});
		});

		it('sends an anonymous-email reserver one notification for every gift they reserved', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 60 * MINUTE_MS),
			});
			const anonymousEmail = `${fixtureId('anonymous')}@example.com`;
			const firstGiftId = await createGiftFixture(wishlistId, { name: 'Scarf' });
			const secondGiftId = await createGiftFixture(wishlistId, { name: 'Gloves' });
			await reserveGiftForAnonymousEmail(firstGiftId, anonymousEmail);
			await reserveGiftForAnonymousEmail(secondGiftId, anonymousEmail);

			await executeOperation(managerActor, bulkUpdateGiftsOperation, {
				wishlistId,
				giftIds: [firstGiftId, secondGiftId],
				action: 'imageBackground',
				background: '#000000',
			});

			const anonymousCalls = reservedGiftEditedNotifications().filter((input) =>
				(input.targetEmails ?? []).includes(anonymousEmail),
			);
			expect(anonymousCalls).toHaveLength(1);
			expect([...(anonymousCalls[0]?.giftNames ?? [])].sort()).toEqual(['Gloves', 'Scarf']);
		});

		it('does not notify the správce about their own reservation', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 60 * MINUTE_MS),
			});
			const giftId = await createGiftFixture(wishlistId, { name: 'Self reserved' });
			await reserveGift(giftId, MANAGER_ID);

			await executeOperation(managerActor, updateGiftOperation, {
				id: giftId,
				name: 'Renamed by its reserver',
			});

			expect(
				reservedGiftEditedNotifications().filter((input) =>
					(input.targetUserIds ?? []).includes(MANAGER_ID),
				),
			).toHaveLength(0);
		});

		it('sends no reserver notification for a recipient edit', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 60 * MINUTE_MS),
			});
			const giftId = await createGiftFixture(wishlistId, { name: 'Recipient edited' });
			await reserveGift(giftId, RESERVER_ID);

			await executeOperation(recipientActor, bulkUpdateGiftsOperation, {
				wishlistId,
				giftIds: [giftId],
				action: 'imageBackground',
				background: '#000000',
			});

			expect(reservedGiftEditedNotifications()).toHaveLength(0);
		});
	});
});
