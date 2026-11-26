import {
	DB_READY,
	MANAGER_ID,
	RESERVER_ID,
	RESERVER_NAME,
	SECOND_RESERVER_ID,
	captureError,
	createGiftFixture,
	createWishlistFixture,
	errorMessage,
	expectRejection,
	fixtureId,
	managerActor,
	outsiderActor,
	readGift,
	recipientActor,
	removeFixtureRows,
	revisionsForGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { giftLike, giftLinkGroup, reservation } from '$lib/server/db/gift.schema.js';
import { GIFT_LINK_GROUP_KIND } from '$lib/server/db/enums.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_KIND } from '$lib/modules/wishlists/types.js';
import type { GiftForRecipient, GiftForVisitor } from '$lib/modules/gifts/types.js';
import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import { AGENT_OPERATION_POLICIES } from '$lib/server/agent_access/operation_policies.js';
import { executeOperation, executeOperationBatch } from './runner.js';
import type { OperationActor } from './actor.js';
import { bulkCopyGiftsOperation, reorderGiftsOperation } from './gift_bulk_operations.js';
import {
	appendGiftDescriptionOperation,
	deleteGiftOperation,
	markGiftReceivedOperation,
	unlinkGiftOperation,
	updateGiftOperation,
} from './gift_mutation_operations.js';
import {
	readBulkCopyDestinationsOperation,
	readWishlistGiftsOperation,
} from './gift_read_operations.js';
import { cancelOwnReservationOperation, reserveGiftOperation } from './reservation_operations.js';
import { undoGiftRevisionBatchOperation } from './gift_undo_operations.js';

const reserverActor: OperationActor = { ...outsiderActor, userId: RESERVER_ID, userName: 'Gifter' };
const secondReserverActor: OperationActor = { ...reserverActor, userId: SECOND_RESERVER_ID };
const HOUR = 60 * 60 * 1000;

async function linkGroupIdOf(giftId: string): Promise<string | null> {
	return (await readGift(giftId)).linkGroupId;
}

/** Two copies of one gift linked by a bulk copy, from the first wishlist to the second. */
async function linkedPair(
	options: {
		source?: Parameters<typeof createWishlistFixture>[0];
		destination?: Parameters<typeof createWishlistFixture>[0];
		gift?: Parameters<typeof createGiftFixture>[1];
	} = {},
) {
	const sourceWishlist = await createWishlistFixture(options.source);
	const destinationWishlist = await createWishlistFixture(options.destination);
	const sourceGiftId = await createGiftFixture(sourceWishlist.id, options.gift);
	const copy = await executeOperation(managerActor, bulkCopyGiftsOperation, {
		sourceWishlistId: sourceWishlist.id,
		destinationWishlistId: destinationWishlist.id,
		giftIds: [sourceGiftId],
	});
	const copyGiftId = copy.createdIds[0]!;
	return { sourceWishlist, destinationWishlist, sourceGiftId, copyGiftId, copy };
}

/** A wishlist of another recipient, without an account, that the manager also manages. */
async function otherRecipientWishlist(recipientName = 'Babička') {
	const id = fixtureId('wishlist');
	const shortId = fixtureId('short');
	await getDb().insert(wishlist).values({
		id,
		shortId,
		title: 'Another recipient',
		recipientName,
		status: 'draft',
	});
	await getDb().insert(moderatorAssignment).values({ wishlistId: id, userId: MANAGER_ID });
	return { id, shortId };
}

async function readListGift(actor: OperationActor | null, wishlistShortId: string, giftId: string) {
	const { gifts } = await executeOperation(actor, readWishlistGiftsOperation, {
		wishlistShortId,
	});
	const found = gifts.find((listedGift) => listedGift.id === giftId);
	if (found === undefined) {
		throw new Error(`Missing gift ${giftId} on ${wishlistShortId}`);
	}
	return found;
}

async function createLinkGroupFixture(): Promise<string> {
	const id = fixtureId('link-group');
	await getDb().insert(giftLinkGroup).values({ id, kind: GIFT_LINK_GROUP_KIND.linkedCopies });
	return id;
}

function carriesReservationState(
	listedGift: GiftForRecipient | GiftForVisitor,
): listedGift is GiftForVisitor {
	return 'reservedCount' in listedGift;
}

function asVisitorGift(listedGift: GiftForRecipient | GiftForVisitor): GiftForVisitor {
	if (!carriesReservationState(listedGift)) {
		throw new Error('Expected reservation state');
	}
	return listedGift;
}

async function reserve(actor: OperationActor, giftId: string, quantity = 1) {
	return executeOperation(actor, reserveGiftOperation, { giftId, quantity });
}

beforeAll(async () => {
	if (DB_READY) {
		await seedFixtureUsers();
	}
});
afterAll(removeFixtureRows);
beforeEach(() => {
	vi.mocked(dispatchNotification).mockClear();
});

describe.skipIf(!DB_READY)('linking copies (issue #742)', () => {
	it('links a copy to its source by default between lists of the same recipient', async () => {
		const { sourceGiftId, copyGiftId, copy, sourceWishlist, destinationWishlist } =
			await linkedPair({ gift: { description: 'Modrý', received: true } });
		expect(copy.linkedIds).toEqual([copyGiftId]);
		const linkGroupId = await linkGroupIdOf(sourceGiftId);
		expect(linkGroupId).not.toBeNull();
		expect(await linkGroupIdOf(copyGiftId)).toBe(linkGroupId);
		expect(await readGift(copyGiftId)).toMatchObject({ description: 'Modrý', received: true });
		const destinations = await executeOperation(
			managerActor,
			readBulkCopyDestinationsOperation,
			{ sourceWishlistId: sourceWishlist.id },
		);
		expect(destinations.find((row) => row.id === destinationWishlist.id)?.linkable).toBe(true);
	});

	it('never links copies to another recipient’s list and rejects asking for it', async () => {
		const sourceWishlist = await createWishlistFixture();
		const otherWishlist = await otherRecipientWishlist();
		const sourceGiftId = await createGiftFixture(sourceWishlist.id);
		const input = {
			sourceWishlistId: sourceWishlist.id,
			destinationWishlistId: otherWishlist.id,
			giftIds: [sourceGiftId],
		};
		await expectRejection(
			executeOperation(managerActor, bulkCopyGiftsOperation, { ...input, linkCopies: true }),
			400,
			SERVER_ERROR.BULK_COPY_LINK_NOT_ALLOWED,
		);
		const copy = await executeOperation(managerActor, bulkCopyGiftsOperation, input);
		expect(copy.linkedIds).toEqual([]);
		expect(await linkGroupIdOf(sourceGiftId)).toBeNull();
		expect(await linkGroupIdOf(copy.createdIds[0]!)).toBeNull();
		const destinations = await executeOperation(
			managerActor,
			readBulkCopyDestinationsOperation,
			{ sourceWishlistId: sourceWishlist.id },
		);
		expect(destinations.find((row) => row.id === otherWishlist.id)?.linkable).toBe(false);
	});

	it('copies without a link when asked not to link', async () => {
		const sourceWishlist = await createWishlistFixture();
		const destinationWishlist = await createWishlistFixture();
		const sourceGiftId = await createGiftFixture(sourceWishlist.id);
		const copy = await executeOperation(managerActor, bulkCopyGiftsOperation, {
			sourceWishlistId: sourceWishlist.id,
			destinationWishlistId: destinationWishlist.id,
			giftIds: [sourceGiftId],
			linkCopies: false,
		});
		expect(copy.linkedIds).toEqual([]);
		expect(await linkGroupIdOf(sourceGiftId)).toBeNull();
	});

	it('joins the group when a copy is copied again', async () => {
		const { sourceGiftId, copyGiftId, destinationWishlist } = await linkedPair();
		const thirdWishlist = await createWishlistFixture();
		const secondCopy = await executeOperation(managerActor, bulkCopyGiftsOperation, {
			sourceWishlistId: destinationWishlist.id,
			destinationWishlistId: thirdWishlist.id,
			giftIds: [copyGiftId],
		});
		const linkGroupId = await linkGroupIdOf(sourceGiftId);
		expect(await linkGroupIdOf(secondCopy.createdIds[0]!)).toBe(linkGroupId);
		expect(await linkGroupIdOf(copyGiftId)).toBe(linkGroupId);
	});

	it('links only the reserved gifts a move leaves behind', async () => {
		const sourceWishlist = await createWishlistFixture({
			kind: WISHLIST_KIND.permanent,
			sharedAt: new Date(),
		});
		const destinationWishlist = await createWishlistFixture();
		const reservedGiftId = await createGiftFixture(sourceWishlist.id, { name: 'Reserved' });
		const movedGiftId = await createGiftFixture(sourceWishlist.id, { name: 'Moved' });
		await reserve(reserverActor, reservedGiftId);
		const move = await executeOperation(managerActor, bulkCopyGiftsOperation, {
			sourceWishlistId: sourceWishlist.id,
			destinationWishlistId: destinationWishlist.id,
			giftIds: [reservedGiftId, movedGiftId],
			removeUnreservedSources: true,
		});
		const [reservedCopyId, movedCopyId] = move.createdIds;
		expect(move.removedSourceIds).toEqual([movedGiftId]);
		expect(move.linkedIds).toEqual([reservedCopyId]);
		expect(await linkGroupIdOf(reservedCopyId!)).toBe(await linkGroupIdOf(reservedGiftId));
		expect(await linkGroupIdOf(movedCopyId!)).toBeNull();
	});
});

describe.skipIf(!DB_READY)('linked copies share their units (issue #742)', () => {
	it('counts a reservation on one copy on every copy and never over-reserves the group', async () => {
		const { sourceGiftId, copyGiftId, destinationWishlist } = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
			gift: { quantity: 2 },
		});
		await reserve(reserverActor, sourceGiftId);
		const onCopy = asVisitorGift(
			await readListGift(outsiderActor, destinationWishlist.shortId, copyGiftId),
		);
		expect(onCopy).toMatchObject({ reservedCount: 1, isFullyReserved: false });
		await reserve(secondReserverActor, copyGiftId);
		const thrown = await captureError(reserve(outsiderActor, sourceGiftId));
		expect(thrown).toMatchObject({ status: 400 });
		expect(errorMessage(thrown)).toContain(SERVER_ERROR.NOT_ENOUGH_AVAILABLE);
		const fullOnCopy = asVisitorGift(
			await readListGift(outsiderActor, destinationWishlist.shortId, copyGiftId),
		);
		expect(fullOnCopy).toMatchObject({ reservedCount: 2, isFullyReserved: true });
	});

	it('tells the likers of every copy about a reservation', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
		});
		await getDb().insert(giftLike).values({ giftId: copyGiftId, userId: SECOND_RESERVER_ID });
		await reserve(reserverActor, sourceGiftId);
		const likedReservedCalls = vi
			.mocked(dispatchNotification)
			.mock.calls.filter(
				([payload]) => payload.type === NOTIFICATION_TYPE.LIKED_GIFT_RESERVED,
			);
		expect(likedReservedCalls.flatMap(([payload]) => payload.targetUserIds)).toEqual([
			SECOND_RESERVER_ID,
		]);
	});

	it('lets a gifter see and cancel from either copy the reservation made on the other', async () => {
		const { sourceGiftId, copyGiftId, destinationWishlist } = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
		});
		const { reservationId } = await reserve(reserverActor, sourceGiftId);
		const onCopy = asVisitorGift(
			await readListGift(reserverActor, destinationWishlist.shortId, copyGiftId),
		);
		expect(onCopy).toMatchObject({
			myReservationId: reservationId,
			myReservationOnLinkedCopy: true,
			myReservationQuantity: 1,
		});
		await executeOperation(reserverActor, cancelOwnReservationOperation, {
			reservationId: onCopy.myReservationId,
		});
		const remaining = await getDb()
			.select()
			.from(reservation)
			.where(and(eq(reservation.giftId, sourceGiftId), isNull(reservation.deletedAt)));
		expect(remaining).toEqual([]);
	});
});

describe.skipIf(!DB_READY)('linked copies stay in sync (issue #742)', () => {
	it('writes synced fields to every copy with a revision each, but keeps priority and order per copy', async () => {
		const { sourceWishlist, sourceGiftId, copyGiftId } = await linkedPair();
		const [level] = await getDb()
			.insert(priorityLevel)
			.values({ wishlistId: sourceWishlist.id, label: 'Top', sortOrder: 0 })
			.returning();
		await executeOperation(managerActor, updateGiftOperation, {
			id: sourceGiftId,
			name: 'Kolo',
			price: 9000,
			links: [{ url: 'https://example.com/kolo' }],
			quantity: 3,
			priorityLevelId: level!.id,
		});
		const copy = await readGift(copyGiftId);
		expect(copy).toMatchObject({
			name: 'Kolo',
			price: 9000,
			links: [{ url: 'https://example.com/kolo' }],
			quantity: 3,
			priorityLevelId: null,
		});
		expect((await revisionsForGift(copyGiftId)).length).toBeGreaterThan(1);

		const secondGiftId = await createGiftFixture(sourceWishlist.id);
		const sortOrderBefore = copy.sortOrder;
		await executeOperation(managerActor, reorderGiftsOperation, {
			wishlistId: sourceWishlist.id,
			orderedGiftIds: [secondGiftId, sourceGiftId],
		});
		expect((await readGift(copyGiftId)).sortOrder).toBe(sortOrderBefore);
	});

	it('syncs received to every copy', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair();
		await executeOperation(managerActor, markGiftReceivedOperation, {
			giftId: copyGiftId,
			received: true,
		});
		expect((await readGift(sourceGiftId)).received).toBe(true);
	});

	it('syncs an appended description segment', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
			gift: { description: 'Základ' },
		});
		await executeOperation(managerActor, appendGiftDescriptionOperation, {
			giftId: sourceGiftId,
			text: 'Modrou barvu',
		});
		const copy = await readGift(copyGiftId);
		expect(copy.descriptionAppends.map((segment) => segment.text)).toEqual(['Modrou barvu']);
	});

	it('runs linked edits of one batch in order', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair();
		await executeOperationBatch(managerActor, [
			{ operation: updateGiftOperation, input: { id: sourceGiftId, name: 'První' } },
			{ operation: updateGiftOperation, input: { id: copyGiftId, name: 'Druhý' } },
		]);
		expect((await readGift(sourceGiftId)).name).toBe('Druhý');
		expect((await readGift(copyGiftId)).name).toBe('Druhý');
	});

	it('edits copies concurrently from both lists without deadlocking', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair();
		const outcomes = await Promise.allSettled([
			executeOperation(managerActor, updateGiftOperation, { id: sourceGiftId, price: 100 }),
			executeOperation(recipientActor, updateGiftOperation, { id: copyGiftId, price: 200 }),
		]);
		expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
		expect((await readGift(sourceGiftId)).price).toBe((await readGift(copyGiftId)).price);
	});

	it('undoes a linked edit on every copy', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair({ gift: { name: 'Původní' } });
		const edit = await executeOperationBatch(managerActor, [
			{ operation: updateGiftOperation, input: { id: sourceGiftId, name: 'Nový' } },
		]);
		expect((await readGift(copyGiftId)).name).toBe('Nový');
		await executeOperation(managerActor, undoGiftRevisionBatchOperation, {
			batchId: edit.batchId,
		});
		expect((await readGift(sourceGiftId)).name).toBe('Původní');
		expect((await readGift(copyGiftId)).name).toBe('Původní');
	});
});

describe.skipIf(!DB_READY)('the strictest copy’s post-share rules apply (issue #742)', () => {
	async function permanentCopyOfSharedOccasionGift(sharedAt: Date) {
		const occasionWishlist = await createWishlistFixture({
			kind: WISHLIST_KIND.occasion,
			sharedAt,
		});
		const permanentWishlist = await createWishlistFixture({ kind: WISHLIST_KIND.permanent });
		const linkGroupId = await createLinkGroupFixture();
		const createdAt = new Date(sharedAt.getTime() - HOUR);
		const occasionGiftId = await createGiftFixture(occasionWishlist.id, {
			name: 'Kolo',
			linkGroupId,
			createdAt,
		});
		const permanentGiftId = await createGiftFixture(permanentWishlist.id, {
			name: 'Kolo',
			linkGroupId,
			createdAt,
		});
		return { occasionWishlist, permanentWishlist, occasionGiftId, permanentGiftId };
	}

	it('freezes the recipient’s rename on a permanent copy once a shared occasion copy is past its grace', async () => {
		const { permanentWishlist, permanentGiftId, occasionGiftId, occasionWishlist } =
			await permanentCopyOfSharedOccasionGift(new Date(Date.now() - HOUR));
		await expectRejection(
			executeOperation(recipientActor, updateGiftOperation, {
				id: permanentGiftId,
				name: 'Jiné kolo',
			}),
			403,
			SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING,
		);
		const listed = await readListGift(
			recipientActor,
			permanentWishlist.shortId,
			permanentGiftId,
		);
		expect(listed.linkedCopies).toEqual([
			expect.objectContaining({
				giftId: occasionGiftId,
				wishlistShortId: occasionWishlist.shortId,
				status: 'active',
				editsFrozenFrom: expect.any(Date),
			}),
		]);
	});

	it('leaves the recipient’s rename free while every copy is unrestricted', async () => {
		const permanentWishlist = await createWishlistFixture({ kind: WISHLIST_KIND.permanent });
		const draftWishlist = await createWishlistFixture({ kind: WISHLIST_KIND.occasion });
		const linkGroupId = await createLinkGroupFixture();
		const permanentGiftId = await createGiftFixture(permanentWishlist.id, { linkGroupId });
		const draftGiftId = await createGiftFixture(draftWishlist.id, { linkGroupId });
		await executeOperation(recipientActor, updateGiftOperation, {
			id: permanentGiftId,
			name: 'Jiné kolo',
		});
		expect((await readGift(draftGiftId)).name).toBe('Jiné kolo');
	});
});

describe.skipIf(!DB_READY)('who learns about linked copies (issue #742)', () => {
	async function reservedOnBothLists() {
		const pair = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
			gift: { quantity: 3 },
		});
		await reserve(reserverActor, pair.sourceGiftId);
		await reserve(secondReserverActor, pair.copyGiftId);
		return pair;
	}

	it('names reservers to a správce only on the list they reserved on', async () => {
		const { sourceWishlist, sourceGiftId, destinationWishlist } = await reservedOnBothLists();
		const listed = asVisitorGift(
			await readListGift(managerActor, sourceWishlist.shortId, sourceGiftId),
		);
		expect(listed).toMatchObject({
			reservedCount: 2,
			reserverNames: [RESERVER_NAME],
			reservedOnLinkedCopiesCount: 1,
		});
		expect(listed.linkedCopies.map((linkedCopy) => linkedCopy.wishlistShortId)).toEqual([
			destinationWishlist.shortId,
		]);
	});

	it('gives a visitor the shared count without any link information', async () => {
		const { sourceWishlist, sourceGiftId } = await reservedOnBothLists();
		const listed = asVisitorGift(
			await readListGift(outsiderActor, sourceWishlist.shortId, sourceGiftId),
		);
		expect(listed).toMatchObject({
			reservedCount: 2,
			reserverNames: [],
			reservedOnLinkedCopiesCount: 0,
			linkedCopies: [],
			myReservationId: null,
		});
	});

	it('gives an undisclosed recipient the copies but no reservation state', async () => {
		const { sourceWishlist, sourceGiftId } = await reservedOnBothLists();
		const listed = await readListGift(recipientActor, sourceWishlist.shortId, sourceGiftId);
		expect(listed).not.toHaveProperty('reservedCount');
		expect(listed).not.toHaveProperty('reservedOnLinkedCopiesCount');
		expect(listed.linkedCopies).toHaveLength(1);
	});

	it('counts for a self-promoted recipient only copies on lists they promoted themselves on', async () => {
		const promotedWishlist = await createWishlistFixture({
			sharedAt: new Date(),
			recipientIsModerator: true,
		});
		const undisclosedWishlist = await createWishlistFixture({ sharedAt: new Date() });
		const otherPromotedWishlist = await createWishlistFixture({
			sharedAt: new Date(),
			recipientIsModerator: true,
		});
		const linkGroupId = await createLinkGroupFixture();
		const giftIds = await Promise.all(
			[promotedWishlist, undisclosedWishlist, otherPromotedWishlist].map((listed) =>
				createGiftFixture(listed.id, { linkGroupId, quantity: 5 }),
			),
		);
		for (const giftId of giftIds) {
			await reserve(reserverActor, giftId);
		}
		const listed = asVisitorGift(
			await readListGift(recipientActor, promotedWishlist.shortId, giftIds[0]!),
		);
		expect(listed).toMatchObject({
			reservedCount: 2,
			reservedOnLinkedCopiesCount: 1,
			reserverNames: [],
		});
	});
});

describe.skipIf(!DB_READY)('leaving a link group (issue #742)', () => {
	it('takes a deleted copy out of the group while the others keep their state', async () => {
		const { sourceGiftId, copyGiftId, destinationWishlist } = await linkedPair({
			gift: { quantity: 2 },
		});
		const thirdWishlist = await createWishlistFixture({ sharedAt: new Date() });
		const third = await executeOperation(managerActor, bulkCopyGiftsOperation, {
			sourceWishlistId: destinationWishlist.id,
			destinationWishlistId: thirdWishlist.id,
			giftIds: [copyGiftId],
		});
		const thirdGiftId = third.createdIds[0]!;
		await reserve(reserverActor, thirdGiftId);
		const linkGroupId = await linkGroupIdOf(sourceGiftId);
		await executeOperation(managerActor, deleteGiftOperation, { giftId: sourceGiftId });
		expect(await linkGroupIdOf(sourceGiftId)).toBeNull();
		expect(await linkGroupIdOf(copyGiftId)).toBe(linkGroupId);
		expect(await linkGroupIdOf(thirdGiftId)).toBe(linkGroupId);
		const thirdReservations = await getDb()
			.select()
			.from(reservation)
			.where(and(eq(reservation.giftId, thirdGiftId), isNull(reservation.deletedAt)));
		expect(thirdReservations).toHaveLength(1);
	});

	it('dissolves a group left with a single copy', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair();
		await executeOperation(managerActor, deleteGiftOperation, { giftId: copyGiftId });
		expect(await linkGroupIdOf(sourceGiftId)).toBeNull();
	});

	it('stops syncing an unlinked copy', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair({ gift: { name: 'Kolo' } });
		await expectRejection(
			executeOperation(outsiderActor, unlinkGiftOperation, { giftId: copyGiftId }),
			403,
			SERVER_ERROR.ACCESS_DENIED,
		);
		await executeOperation(recipientActor, unlinkGiftOperation, { giftId: copyGiftId });
		expect(await linkGroupIdOf(copyGiftId)).toBeNull();
		expect(await linkGroupIdOf(sourceGiftId)).toBeNull();
		await executeOperation(managerActor, updateGiftOperation, {
			id: sourceGiftId,
			name: 'Koloběžka',
		});
		expect((await readGift(copyGiftId)).name).toBe('Kolo');
		await expectRejection(
			executeOperation(managerActor, unlinkGiftOperation, { giftId: copyGiftId }),
			400,
			SERVER_ERROR.GIFT_NOT_LINKED,
		);
	});
});

describe('agent parity of linked copies (issue #742)', () => {
	it('exposes unlinking to agents with the gifts write scope', () => {
		expect(AGENT_OPERATION_POLICIES.unlinkGift?.scope).toBe(AGENT_SCOPE.giftsWrite);
	});
});
