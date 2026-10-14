import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_ID,
	captureError,
	createGiftFixture,
	createWishlistFixture,
	errorMessage,
	managerActor,
	outsiderActor,
	readGift,
	recipientActor,
	removeFixtureRows,
	reserveGift,
	revisionsForGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { giftCategory, reservation } from '$lib/server/db/gift.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { SaveGiftCategorySettingsInput } from '$lib/modules/gift-categories/types.js';
import {
	MAX_PRIORITY_LEVELS,
	PRIORITY_LEVEL_LABEL_MAX_LENGTH,
} from '$lib/modules/wishlists/types.js';
import { executeOperation } from './runner.js';
import type { OperationActor } from './actor.js';
import { appendGiftDescriptionOperation } from './gift_mutation_operations.js';
import { undoGiftRevisionBatchOperation } from './gift_undo_operations.js';
import {
	saveGiftCategorySettingsOperation,
	savePriorityLevelsOperation,
} from './gift_grouping_operations.js';
import {
	renameRecipientOperation,
	saveWishlistSettingsOperation,
	setWishlistPaletteOperation,
	updateWishlistOperation,
} from './wishlist_detail_operations.js';
import {
	archiveWishlistOperation,
	deleteWishlistOperation,
	flipRecipientToFreeTextOperation,
	revertWishlistToDraftOperation,
	shareWishlistOperation,
} from './wishlist_lifecycle_operations.js';
import { importGiftsOperation } from './import_operations.js';

const administratorActor: OperationActor = { ...outsiderActor, isAppAdministrator: true };
const BOOKS_PRESET = { key: 'books', color: '#2563EB' } as const;

async function expectRejection(work: Promise<unknown>, status: number, message: string) {
	const thrown = await captureError(work);
	expect(thrown).toMatchObject({ status });
	expect(errorMessage(thrown)).toBe(message);
}

async function latestBatchIdForGift(giftId: string): Promise<string> {
	const revisions = await revisionsForGift(giftId);
	const latest = [...revisions].sort(
		(first, second) => second.createdAt.getTime() - first.createdAt.getTime(),
	)[0];
	if (latest === undefined) {
		throw new Error(`No revision for gift ${giftId}`);
	}
	return latest.batchId;
}

async function revisionOf(giftId: string, operation: string) {
	const revisions = await revisionsForGift(giftId);
	return revisions.find((revision) => revision.operation === operation);
}

async function readLevels(wishlistId: string) {
	return getDb()
		.select({ id: priorityLevel.id, label: priorityLevel.label })
		.from(priorityLevel)
		.where(eq(priorityLevel.wishlistId, wishlistId))
		.orderBy(asc(priorityLevel.sortOrder));
}

async function saveLevels(
	actor: OperationActor,
	wishlistId: string,
	levels: { id: string | null; label: string }[],
) {
	return executeOperation(actor, savePriorityLevelsOperation, { wishlistId, levels });
}

function categorySettings(
	wishlistId: string,
	overrides: Partial<SaveGiftCategorySettingsInput> = {},
): SaveGiftCategorySettingsInput {
	return {
		wishlistId,
		customCategories: [],
		presetKeys: [],
		presetColors: [],
		confirmedRemovalCategoryIds: [],
		...overrides,
	};
}

async function createCategoryFixture(
	wishlistId: string,
	values: { customLabel?: string; presetKey?: string; color: string },
): Promise<string> {
	const [created] = await getDb()
		.insert(giftCategory)
		.values({ wishlistId, ...values })
		.returning({ id: giftCategory.id });
	if (created === undefined) {
		throw new Error('Category fixture was not created');
	}
	return created.id;
}

async function readWishlist(wishlistId: string) {
	const [row] = await getDb().select().from(wishlist).where(eq(wishlist.id, wishlistId));
	if (row === undefined) {
		throw new Error(`Missing wishlist ${wishlistId}`);
	}
	return row;
}

const sharedLongAgo = () => new Date(Date.now() - 60 * 60 * 1000);

describe.skipIf(!DB_READY)('wishlist operation core [real DB]', () => {
	beforeAll(seedFixtureUsers);

	beforeEach(() => {
		vi.mocked(dispatchNotification).mockClear();
	});

	afterAll(removeFixtureRows);

	describe('manager rights', () => {
		it('lets the recipient and a správce edit wishlist details, and denies an outsider', async () => {
			const { id: wishlistId } = await createWishlistFixture();

			await executeOperation(recipientActor, updateWishlistOperation, {
				id: wishlistId,
				title: 'Recipient title',
			});
			expect((await readWishlist(wishlistId)).title).toBe('Recipient title');
			await executeOperation(managerActor, updateWishlistOperation, {
				id: wishlistId,
				title: 'Manager title',
			});
			expect((await readWishlist(wishlistId)).title).toBe('Manager title');

			await expectRejection(
				executeOperation(outsiderActor, updateWishlistOperation, {
					id: wishlistId,
					title: 'Outsider title',
				}),
				403,
				SERVER_ERROR.ACCESS_DENIED,
			);
			await expectRejection(
				saveLevels(outsiderActor, wishlistId, [{ id: null, label: 'Outsider' }]),
				403,
				SERVER_ERROR.ACCESS_DENIED,
			);
		});

		it('rejects detail, category and priority changes on an archived wishlist', async () => {
			const { id: wishlistId } = await createWishlistFixture({ status: 'archived' });
			const archivedAttempts = [
				() =>
					executeOperation(managerActor, updateWishlistOperation, {
						id: wishlistId,
						title: 'Archived title',
					}),
				() =>
					executeOperation(
						managerActor,
						saveGiftCategorySettingsOperation,
						categorySettings(wishlistId),
					),
				() => saveLevels(managerActor, wishlistId, [{ id: null, label: 'Archived' }]),
				() =>
					executeOperation(managerActor, importGiftsOperation, {
						wishlistId,
						gifts: [{ name: 'Archived import' }],
					}),
			];

			for (const attempt of archivedAttempts) {
				await expectRejection(attempt(), 400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
			}
		});

		it.each([
			[
				'renameRecipient',
				(wishlistId: string) =>
					executeOperation(outsiderActor, renameRecipientOperation, {
						id: wishlistId,
						recipientName: 'Outsider name',
					}),
			],
			[
				'setWishlistPalette',
				(wishlistId: string) =>
					executeOperation(outsiderActor, setWishlistPaletteOperation, {
						wishlistId,
						palette: 'ocean',
					}),
			],
			[
				'saveGiftCategorySettings',
				(wishlistId: string) =>
					executeOperation(
						outsiderActor,
						saveGiftCategorySettingsOperation,
						categorySettings(wishlistId),
					),
			],
			[
				'importGifts',
				(wishlistId: string) =>
					executeOperation(outsiderActor, importGiftsOperation, {
						wishlistId,
						gifts: [{ name: 'Outsider import' }],
					}),
			],
			[
				'archiveWishlist',
				(wishlistId: string) =>
					executeOperation(outsiderActor, archiveWishlistOperation, { wishlistId }),
			],
			[
				'deleteWishlist',
				(wishlistId: string) =>
					executeOperation(outsiderActor, deleteWishlistOperation, { wishlistId }),
			],
		])('denies %s to an outsider without changing the wishlist', async (_name, attempt) => {
			const { id: wishlistId } = await createWishlistFixture();
			const before = await readWishlist(wishlistId);

			await expectRejection(attempt(wishlistId), 403, SERVER_ERROR.ACCESS_DENIED);

			expect(await readWishlist(wishlistId)).toEqual(before);
		});

		it('lets only one of two concurrent recipient flips succeed; the other is denied', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const flip = () =>
				executeOperation(recipientActor, flipRecipientToFreeTextOperation, {
					id: wishlistId,
					recipientName: 'Grandma',
				});

			const outcomes = await Promise.allSettled([flip(), flip()]);

			expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
			const [rejected] = outcomes.flatMap((outcome) =>
				outcome.status === 'rejected' ? [outcome.reason] : [],
			);
			expect(rejected).toMatchObject({ status: 403 });
			expect(errorMessage(rejected)).toBe(SERVER_ERROR.ACCESS_DENIED);
		});

		it('keeps sharing and the recipient flip with their own roles', async () => {
			const { id: wishlistId } = await createWishlistFixture();

			await expectRejection(
				executeOperation(outsiderActor, shareWishlistOperation, { wishlistId }),
				403,
				SERVER_ERROR.ACCESS_DENIED,
			);
			await expectRejection(
				executeOperation(managerActor, flipRecipientToFreeTextOperation, {
					id: wishlistId,
					recipientName: 'Grandma',
				}),
				403,
				SERVER_ERROR.ACCESS_DENIED,
			);

			await executeOperation(recipientActor, flipRecipientToFreeTextOperation, {
				id: wishlistId,
				recipientName: 'Grandma',
			});
			const flipped = await readWishlist(wishlistId);
			expect(flipped.recipientUserId).toBeNull();
			expect(flipped.recipientName).toBe('Grandma');
			const assignments = await getDb()
				.select({ userId: moderatorAssignment.userId })
				.from(moderatorAssignment)
				.where(
					and(
						eq(moderatorAssignment.wishlistId, wishlistId),
						isNull(moderatorAssignment.deletedAt),
					),
				);
			expect(assignments.map((assignment) => assignment.userId).sort()).toEqual(
				[MANAGER_ID, RECIPIENT_ID].sort(),
			);
		});
	});

	describe('priority levels', () => {
		it('renames, adds, reorders and removes levels in one step', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const created = await saveLevels(managerActor, wishlistId, [
				{ id: null, label: 'High' },
				{ id: null, label: 'Medium' },
				{ id: null, label: 'Low' },
			]);
			const [high, medium] = created.levels;
			if (high === undefined || medium === undefined) {
				throw new Error('Levels were not created');
			}

			await saveLevels(managerActor, wishlistId, [
				{ id: null, label: 'Urgent' },
				{ id: medium.id, label: 'Normal' },
				{ id: high.id, label: 'Important' },
			]);

			expect(await readLevels(wishlistId)).toEqual([
				{ id: expect.any(String), label: 'Urgent' },
				{ id: medium.id, label: 'Normal' },
				{ id: high.id, label: 'Important' },
			]);
		});

		it.each([
			['no levels', []],
			[
				'too many levels',
				Array.from({ length: MAX_PRIORITY_LEVELS + 1 }, (_, index) => ({
					id: null,
					label: `Level ${index}`,
				})),
			],
			['a blank label', [{ id: null, label: '   ' }]],
			[
				'a too long label',
				[{ id: null, label: 'x'.repeat(PRIORITY_LEVEL_LABEL_MAX_LENGTH + 1) }],
			],
		])('rejects %s as invalid input', async (_case, levels) => {
			const { id: wishlistId } = await createWishlistFixture();
			const created = await saveLevels(managerActor, wishlistId, [
				{ id: null, label: 'Only' },
			]);

			await expectRejection(
				saveLevels(managerActor, wishlistId, levels),
				400,
				SERVER_ERROR.INVALID_OPERATION_INPUT,
			);
			expect(await readLevels(wishlistId)).toEqual(
				created.levels.map(({ id, label }) => ({ id, label })),
			);
		});

		it('leaves soft-deleted gifts without a revision when their level is removed', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const created = await saveLevels(managerActor, wishlistId, [
				{ id: null, label: 'High' },
				{ id: null, label: 'Low' },
			]);
			const [high, low] = created.levels;
			if (high === undefined || low === undefined) {
				throw new Error('Levels were not created');
			}
			const deletedGiftId = await createGiftFixture(wishlistId, {
				priorityLevelId: high.id,
				deletedAt: new Date(),
			});
			const deletedGiftBefore = await readGift(deletedGiftId);

			await saveLevels(managerActor, wishlistId, [{ id: low.id, label: 'Low' }]);

			expect(await revisionsForGift(deletedGiftId)).toEqual([]);
			expect((await readGift(deletedGiftId)).updatedAt).toEqual(deletedGiftBefore.updatedAt);
		});

		it('rejects a level of another wishlist', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const { id: otherWishlistId } = await createWishlistFixture();
			const other = await saveLevels(managerActor, otherWishlistId, [
				{ id: null, label: 'Other' },
			]);

			await expectRejection(
				saveLevels(managerActor, wishlistId, [
					{ id: other.levels[0]?.id ?? null, label: 'Stolen' },
				]),
				400,
				SERVER_ERROR.GIFT_PRIORITY_WISHLIST_MISMATCH,
			);
		});

		it('unassigns gifts of a removed level with revisions, and refuses to undo onto the gone level', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const created = await saveLevels(recipientActor, wishlistId, [
				{ id: null, label: 'High' },
				{ id: null, label: 'Low' },
			]);
			const [high, low] = created.levels;
			if (high === undefined || low === undefined) {
				throw new Error('Levels were not created');
			}
			const giftId = await createGiftFixture(wishlistId, { priorityLevelId: high.id });

			await saveLevels(managerActor, wishlistId, [{ id: low.id, label: 'Low' }]);

			expect((await readGift(giftId)).priorityLevelId).toBeNull();
			expect(await revisionOf(giftId, 'savePriorityLevels')).toMatchObject({
				actorUserId: MANAGER_ID,
				channel: managerActor.channel,
				before: { priorityLevelId: high.id },
				after: { priorityLevelId: null },
			});
			await expectRejection(
				executeOperation(managerActor, undoGiftRevisionBatchOperation, {
					batchId: await latestBatchIdForGift(giftId),
				}),
				400,
				SERVER_ERROR.GIFT_PRIORITY_WISHLIST_MISMATCH,
			);
			expect((await readGift(giftId)).priorityLevelId).toBeNull();
		});
	});

	describe('gift categories', () => {
		it('unassigns gifts of a removed category with revisions, and refuses to undo onto the gone category', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const categoryId = await createCategoryFixture(wishlistId, {
				customLabel: 'Garden',
				color: BOOKS_PRESET.color,
			});
			const giftId = await createGiftFixture(wishlistId, { categoryId });

			await executeOperation(
				managerActor,
				saveGiftCategorySettingsOperation,
				categorySettings(wishlistId, { confirmedRemovalCategoryIds: [categoryId] }),
			);

			expect((await readGift(giftId)).categoryId).toBeNull();
			expect(await revisionOf(giftId, 'saveGiftCategorySettings')).toMatchObject({
				actorUserId: MANAGER_ID,
				channel: managerActor.channel,
				before: { categoryId },
				after: { categoryId: null },
			});
			await expectRejection(
				executeOperation(managerActor, undoGiftRevisionBatchOperation, {
					batchId: await latestBatchIdForGift(giftId),
				}),
				400,
				SERVER_ERROR.GIFT_CATEGORY_WISHLIST_MISMATCH,
			);
		});

		it('restores the assignment when the removed preset category is enabled again', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const categoryId = await createCategoryFixture(wishlistId, {
				presetKey: BOOKS_PRESET.key,
				color: BOOKS_PRESET.color,
			});
			const giftId = await createGiftFixture(wishlistId, { categoryId });

			await executeOperation(
				recipientActor,
				saveGiftCategorySettingsOperation,
				categorySettings(wishlistId, { confirmedRemovalCategoryIds: [categoryId] }),
			);
			const removalBatchId = await latestBatchIdForGift(giftId);
			await executeOperation(
				recipientActor,
				saveGiftCategorySettingsOperation,
				categorySettings(wishlistId, {
					presetKeys: [BOOKS_PRESET.key],
					presetColors: [BOOKS_PRESET],
				}),
			);
			await executeOperation(recipientActor, undoGiftRevisionBatchOperation, {
				batchId: removalBatchId,
			});

			expect((await readGift(giftId)).categoryId).toBe(categoryId);
		});
	});

	describe('wishlist settings', () => {
		it('records a revision for a gift whose category a správce removes in the settings draft', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const categoryId = await createCategoryFixture(wishlistId, {
				customLabel: 'Garden',
				color: BOOKS_PRESET.color,
			});
			const giftId = await createGiftFixture(wishlistId, { categoryId });
			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				categories: {
					customCategories: [],
					presetKeys: [],
					presetColors: [],
					confirmedRemovalCategoryIds: [categoryId],
				},
			});

			expect((await readGift(giftId)).categoryId).toBeNull();
			expect(await revisionOf(giftId, 'saveWishlistSettings')).toMatchObject({
				actorUserId: MANAGER_ID,
				channel: managerActor.channel,
				before: { categoryId },
				after: { categoryId: null },
			});
		});

		it('denies an outsider and rejects an archived wishlist', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const { id: archivedWishlistId } = await createWishlistFixture({ status: 'archived' });
			const details = { title: 'Settings title', description: null };

			await expectRejection(
				executeOperation(outsiderActor, saveWishlistSettingsOperation, {
					wishlistId,
					details,
				}),
				403,
				SERVER_ERROR.ACCESS_DENIED,
			);
			await expectRejection(
				executeOperation(managerActor, saveWishlistSettingsOperation, {
					wishlistId: archivedWishlistId,
					details,
				}),
				400,
				SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
			);
			expect((await readWishlist(wishlistId)).title).not.toBe(details.title);
		});
	});

	describe('revert to draft', () => {
		it('clears post-share gift state with revisions, so undoing an earlier append conflicts', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const giftId = await createGiftFixture(wishlistId, {
				createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
				description: 'Original',
			});
			await executeOperation(managerActor, appendGiftDescriptionOperation, {
				giftId,
				text: 'Blue preferred',
			});
			const appendBatchId = await latestBatchIdForGift(giftId);

			await executeOperation(managerActor, revertWishlistToDraftOperation, { wishlistId });

			const reverted = await readWishlist(wishlistId);
			expect(reverted).toMatchObject({ status: 'draft', sharedAt: null });
			const clearedGift = await readGift(giftId);
			expect(clearedGift.description).toBe('Original');
			expect(clearedGift.descriptionAppends).toEqual([]);
			expect(clearedGift.editedAfterShareAt).toBeNull();
			expect(await revisionOf(giftId, 'revertWishlistToDraft')).toMatchObject({
				actorUserId: MANAGER_ID,
				channel: managerActor.channel,
				after: { descriptionAppends: [] },
			});
			expect(dispatchNotification).not.toHaveBeenCalled();

			const thrown = await captureError(
				executeOperation(managerActor, undoGiftRevisionBatchOperation, {
					batchId: appendBatchId,
				}),
			);
			expect(thrown).toMatchObject({ status: 409 });
			expect(JSON.parse(errorMessage(thrown))).toMatchObject({
				code: SERVER_ERROR.GIFT_REVISION_CONFLICT,
			});
		});

		it('denies the recipient and blocks a správce on a reserved list', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			await reserveGift(await createGiftFixture(wishlistId), RESERVER_ID);

			await expectRejection(
				executeOperation(recipientActor, revertWishlistToDraftOperation, { wishlistId }),
				403,
				SERVER_ERROR.ACCESS_DENIED,
			);
			await expectRejection(
				executeOperation(managerActor, revertWishlistToDraftOperation, { wishlistId }),
				403,
				SERVER_ERROR.REVERT_REQUIRES_ADMIN,
			);
			expect((await readWishlist(wishlistId)).status).toBe('active');
		});

		it('lets an administrator revert a reserved list, cancelling and notifying the reservers', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const giftId = await createGiftFixture(wishlistId);
			await reserveGift(giftId, RESERVER_ID);

			await executeOperation(administratorActor, revertWishlistToDraftOperation, {
				wishlistId,
			});

			const [cancelled] = await getDb()
				.select()
				.from(reservation)
				.where(eq(reservation.giftId, giftId));
			expect(cancelled).toMatchObject({ cancelledByUserId: administratorActor.userId });
			expect(cancelled?.deletedAt).not.toBeNull();
			expect(dispatchNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
					targetUserIds: [RESERVER_ID],
					wishlistId,
				}),
			);
		});

		it('asks to unarchive an archived list first', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: sharedLongAgo(),
				status: 'archived',
			});

			await expectRejection(
				executeOperation(managerActor, revertWishlistToDraftOperation, { wishlistId }),
				400,
				SERVER_ERROR.CANNOT_REVERT_ARCHIVED,
			);
		});
	});

	describe('import', () => {
		it('records created gifts as one revision batch of the importing actor', async () => {
			const { id: wishlistId } = await createWishlistFixture();

			const { outcome } = await executeOperation(managerActor, importGiftsOperation, {
				wishlistId,
				gifts: [{ name: 'Imported one' }, { name: 'Imported two' }],
			});

			if (outcome.status !== 'created') {
				throw new Error('Import did not create gifts');
			}
			const revisions = await Promise.all(
				outcome.gifts.map(async (created) => revisionOf(created.id, 'importGifts')),
			);
			const importRevision = expect.objectContaining({
				actorUserId: MANAGER_ID,
				channel: managerActor.channel,
				before: null,
			});
			expect(revisions).toEqual([importRevision, importRevision]);
			expect(new Set(revisions.map((revision) => revision?.batchId)).size).toBe(1);
		});
	});
});
