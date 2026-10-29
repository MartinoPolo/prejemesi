import {
	DB_READY,
	MANAGER_ID,
	createGiftFixture,
	createWishlistFixture,
	expectRejectionResult,
	managerActor,
	raceBehindRowLock,
	readGift,
	removeFixtureRows,
	revisionsForGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { executeOperation, executeOperationBatch, type OperationBatchStep } from './runner.js';
import { updateGiftOperation } from './gift_mutation_operations.js';
import { bulkCopyGiftsOperation, reorderGiftsOperation } from './gift_bulk_operations.js';
import { savePriorityLevelsOperation } from './gift_grouping_operations.js';
import { reserveGiftOperation } from './reservation_operations.js';

const DEADLOCK_DETECTED = '40P01';

function lockGift(giftId: string) {
	return (transaction: Parameters<Parameters<typeof raceBehindRowLock>[0]>[0]) =>
		transaction.select({ id: gift.id }).from(gift).where(eq(gift.id, giftId)).for('update');
}

/** Drizzle wraps the driver error, which carries the SQLSTATE code. */
function postgresErrorCode(thrown: unknown): unknown {
	if (typeof thrown !== 'object' || thrown === null) {
		return undefined;
	}
	if ('code' in thrown) {
		return thrown.code;
	}
	return 'cause' in thrown ? postgresErrorCode(thrown.cause) : undefined;
}

function expectEveryContenderSucceeded(results: readonly PromiseSettledResult<unknown>[]) {
	for (const result of results) {
		if (result.status === 'rejected') {
			expect(postgresErrorCode(result.reason)).not.toBe(DEADLOCK_DETECTED);
			throw result.reason;
		}
	}
}

async function createPriorityLevel(wishlistId: string, label: string, sortOrder: number) {
	const [level] = await getDb()
		.insert(priorityLevel)
		.values({ wishlistId, label, sortOrder })
		.returning({ id: priorityLevel.id });
	if (level === undefined) {
		throw new Error('Missing priority level');
	}
	return level.id;
}

async function activeReservationCount(giftId: string): Promise<number> {
	const rows = await getDb()
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)));
	return rows.length;
}

/**
 * Every mutation locks the wishlist, then its gifts, then reservations. Each race makes the
 * contenders hold their first locks before the gate row is released, which deadlocks (40P01)
 * whenever one of them takes a gift before its wishlist.
 */
describe.skipIf(!DB_READY)('operation lock order', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('serializes a single gift edit behind a priority level restructure of its wishlist', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const keptLevelId = await createPriorityLevel(wishlistId, 'Kept', 1);
		const removedLevelId = await createPriorityLevel(wishlistId, 'Removed', 2);
		const giftId = await createGiftFixture(wishlistId, { priorityLevelId: removedLevelId });

		const results = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: priorityLevel.id })
					.from(priorityLevel)
					.where(eq(priorityLevel.id, keptLevelId))
					.for('update'),
			[
				() =>
					executeOperation(managerActor, savePriorityLevelsOperation, {
						wishlistId,
						levels: [{ id: keptLevelId, label: 'Kept' }],
					}),
				() =>
					executeOperation(managerActor, updateGiftOperation, {
						id: giftId,
						priorityLevelId: keptLevelId,
					}),
			],
			{ queueInOrder: true },
		);

		expectEveryContenderSucceeded(results);
		expect((await readGift(giftId)).priorityLevelId).toBe(keptLevelId);
	});

	it('never deadlocks copies between two wishlists in opposite directions', async () => {
		const first = await createWishlistFixture();
		const second = await createWishlistFixture();
		const firstGiftId = await createGiftFixture(first.id);
		const secondGiftId = await createGiftFixture(second.id);

		const results = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: moderatorAssignment.id })
					.from(moderatorAssignment)
					.where(
						and(
							eq(moderatorAssignment.wishlistId, first.id),
							eq(moderatorAssignment.userId, MANAGER_ID),
						),
					)
					.for('update'),
			[
				() =>
					executeOperation(managerActor, bulkCopyGiftsOperation, {
						sourceWishlistId: first.id,
						destinationWishlistId: second.id,
						giftIds: [firstGiftId],
					}),
				() =>
					executeOperation(managerActor, bulkCopyGiftsOperation, {
						sourceWishlistId: second.id,
						destinationWishlistId: first.id,
						giftIds: [secondGiftId],
					}),
			],
			{ queueInOrder: true },
		);

		expectEveryContenderSucceeded(results);
		for (const wishlistId of [first.id, second.id]) {
			const giftRows = await getDb()
				.select({ id: gift.id })
				.from(gift)
				.where(eq(gift.wishlistId, wishlistId));
			expect(giftRows).toHaveLength(2);
		}
	});

	describe('a gift edit waiting for its wishlist lock', () => {
		function lockWishlistThen(
			wishlistId: string,
			changeGift: (
				transaction: Parameters<Parameters<typeof raceBehindRowLock>[0]>[0],
			) => Promise<unknown>,
		) {
			return async (transaction: Parameters<Parameters<typeof raceBehindRowLock>[0]>[0]) => {
				await transaction
					.select({ id: wishlist.id })
					.from(wishlist)
					.where(eq(wishlist.id, wishlistId))
					.for('update');
				await changeGift(transaction);
			};
		}

		it('reports the gift as not found when it was deleted meanwhile', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId);

			const [outcome] = await raceBehindRowLock(
				lockWishlistThen(wishlistId, (transaction) =>
					transaction
						.update(gift)
						.set({ deletedAt: new Date() })
						.where(eq(gift.id, giftId)),
				),
				[
					() =>
						executeOperation(managerActor, updateGiftOperation, {
							id: giftId,
							name: 'Too late',
						}),
				],
			);

			if (outcome === undefined) {
				throw new Error('Missing contender outcome');
			}
			expectRejectionResult(outcome, 404, SERVER_ERROR.GIFT_NOT_FOUND);
			expect((await readGift(giftId)).name).not.toBe('Too late');
		});

		it('edits the gift as it is after the wait', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId, { description: 'Before the wait' });

			const results = await raceBehindRowLock(
				lockWishlistThen(wishlistId, (transaction) =>
					transaction
						.update(gift)
						.set({ description: 'Changed during the wait' })
						.where(eq(gift.id, giftId)),
				),
				[
					() =>
						executeOperation(managerActor, updateGiftOperation, {
							id: giftId,
							name: 'Edited after the wait',
						}),
				],
			);

			expectEveryContenderSucceeded(results);
			expect(await readGift(giftId)).toMatchObject({
				name: 'Edited after the wait',
				description: 'Changed during the wait',
			});
			const [revision] = await revisionsForGift(giftId);
			expect(revision?.before?.description).toBe('Changed during the wait');
		});
	});

	describe('batches that lock their wishlists first', () => {
		async function wishlistWithGifts() {
			const { id: wishlistId } = await createWishlistFixture();
			const editedGiftId = await createGiftFixture(wishlistId, { sortOrder: 0 });
			const gateGiftId = await createGiftFixture(wishlistId, { sortOrder: 1 });
			const reservedGiftId = await createGiftFixture(wishlistId, { sortOrder: 2 });
			return { wishlistId, editedGiftId, gateGiftId, reservedGiftId };
		}

		function editThenReorder(
			fixture: Awaited<ReturnType<typeof wishlistWithGifts>>,
		): OperationBatchStep[] {
			return [
				{
					operation: updateGiftOperation,
					input: { id: fixture.editedGiftId, name: 'Edited first' },
				},
				{ operation: updateGiftOperation, input: { id: fixture.gateGiftId, name: 'Gate' } },
				{
					operation: reorderGiftsOperation,
					input: {
						wishlistId: fixture.wishlistId,
						orderedGiftIds: [
							fixture.reservedGiftId,
							fixture.gateGiftId,
							fixture.editedGiftId,
						],
					},
				},
			];
		}

		it('never deadlocks gift edits and a reorder applied in opposing orders', async () => {
			const fixture = await wishlistWithGifts();
			const exclusiveWishlistIds = [fixture.wishlistId];

			const results = await raceBehindRowLock(
				lockGift(fixture.gateGiftId),
				[
					() =>
						executeOperationBatch(managerActor, editThenReorder(fixture), {
							exclusiveWishlistIds,
						}),
					() =>
						executeOperationBatch(
							managerActor,
							[
								{
									operation: updateGiftOperation,
									input: { id: fixture.reservedGiftId, name: 'Edited between' },
								},
								{
									operation: reorderGiftsOperation,
									input: {
										wishlistId: fixture.wishlistId,
										orderedGiftIds: [
											fixture.editedGiftId,
											fixture.reservedGiftId,
											fixture.gateGiftId,
										],
									},
								},
								{
									operation: updateGiftOperation,
									input: { id: fixture.editedGiftId, name: 'Edited last' },
								},
							],
							{ exclusiveWishlistIds },
						),
				],
				{ queueInOrder: true },
			);

			expectEveryContenderSucceeded(results);
			expect((await readGift(fixture.editedGiftId)).name).toBe('Edited last');
		});

		it('never deadlocks a reservation followed by a reorder against gift edits', async () => {
			const fixture = await wishlistWithGifts();
			const exclusiveWishlistIds = [fixture.wishlistId];

			const results = await raceBehindRowLock(
				lockGift(fixture.gateGiftId),
				[
					() =>
						executeOperationBatch(managerActor, editThenReorder(fixture), {
							exclusiveWishlistIds,
						}),
					() =>
						executeOperationBatch(
							managerActor,
							[
								{
									operation: reserveGiftOperation,
									input: { giftId: fixture.reservedGiftId, quantity: 1 },
								},
								{
									operation: reorderGiftsOperation,
									input: {
										wishlistId: fixture.wishlistId,
										orderedGiftIds: [
											fixture.editedGiftId,
											fixture.gateGiftId,
											fixture.reservedGiftId,
										],
									},
								},
							],
							{ exclusiveWishlistIds },
						),
				],
				{ queueInOrder: true },
			);

			expectEveryContenderSucceeded(results);
			expect(await activeReservationCount(fixture.reservedGiftId)).toBe(1);
		});
	});
});
