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
	raceBehindRowLock,
	readGift,
	recipientActor,
	removeFixtureRows,
	reserveGift,
	revisionsForGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { gift, giftLike, giftLinkGroup, reservation } from '$lib/server/db/gift.schema.js';
import { GIFT_LINK_GROUP_KIND } from '$lib/server/db/enums.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_KIND } from '$lib/modules/wishlists/types.js';
import {
	GIFT_CURRENCIES,
	type GiftForRecipient,
	type GiftForVisitor,
} from '$lib/modules/gifts/types.js';
import {
	createCustomGiftCategoryWithDatabase,
	getActiveGiftCategories,
} from '$lib/modules/gift-categories/gift_categories_service.js';
import { AGENT_SCOPE, type AgentScope } from '$lib/modules/access_tokens/scopes.js';
import {
	authorizeAgentOperations,
	executeAgentOperationBatch,
	type AgentOperationRequest,
} from '$lib/server/agent_access/authorization.js';
import type { AgentAccessGrant } from '$lib/server/agent_access/agent_grant.js';
import { tokenChannel } from './actor.js';
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
import {
	archiveWishlistOperation,
	deleteWishlistOperation,
} from './wishlist_lifecycle_operations.js';
import { wishlistsShareRecipient } from './gift_link_group.js';

const reserverActor: OperationActor = { ...outsiderActor, userId: RESERVER_ID, userName: 'Gifter' };
const secondReserverActor: OperationActor = { ...reserverActor, userId: SECOND_RESERVER_ID };
const HOUR = 60 * 60 * 1000;

async function expectNoneAvailable(work: Promise<unknown>) {
	const thrown = await captureError(work);
	expect(thrown).toMatchObject({ status: 400 });
	expect(JSON.parse(errorMessage(thrown))).toEqual({
		code: SERVER_ERROR.NOT_ENOUGH_AVAILABLE,
		available: 0,
	});
}
const everyAgentScope = Object.values(AGENT_SCOPE);

function agentGrant(
	scopes: readonly AgentScope[],
	actor: Pick<OperationActor, 'userId' | 'userName'> = managerActor,
): AgentAccessGrant {
	return {
		userId: actor.userId,
		userName: actor.userName,
		tokenName: 'Agent',
		channel: tokenChannel('Agent'),
		scopes,
		wishlistIds: null,
	};
}

async function runAsAgent(grant: AgentAccessGrant, requests: AgentOperationRequest[]) {
	return executeAgentOperationBatch(grant, await authorizeAgentOperations(grant, requests));
}

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
		const syncedRevisions = await revisionsForGift(copyGiftId);
		expect(syncedRevisions.map((revision) => revision.after?.name)).toContain('Kolo');
		expect(
			syncedRevisions.find((revision) => revision.after?.name === 'Kolo')?.before?.name,
		).not.toBe('Kolo');

		const secondGiftId = await createGiftFixture(sourceWishlist.id, { sortOrder: 1 });
		const sortOrderBefore = copy.sortOrder;
		await executeOperation(managerActor, reorderGiftsOperation, {
			wishlistId: sourceWishlist.id,
			orderedGiftIds: [secondGiftId, sourceGiftId],
		});
		expect((await readGift(sourceGiftId)).sortOrder).toBe(1);
		expect((await readGift(secondGiftId)).sortOrder).toBe(0);
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

describe.skipIf(!DB_READY)('linked copies under concurrency (issue #742)', () => {
	function lockGiftRows(giftIds: readonly string[]) {
		return (transaction: DatabaseTransaction) =>
			transaction
				.select({ id: gift.id })
				.from(gift)
				.where(inArray(gift.id, [...giftIds]))
				.orderBy(asc(gift.id))
				.for('update');
	}

	it('lets exactly one of two concurrent reservations on different copies take the last unit', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
		});
		const outcomes = await raceBehindRowLock(lockGiftRows([sourceGiftId, copyGiftId]), [
			() => reserve(reserverActor, sourceGiftId),
			() => reserve(secondReserverActor, copyGiftId),
		]);
		expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
		const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
		expect(errorMessage(rejected?.status === 'rejected' ? rejected.reason : null)).toContain(
			SERVER_ERROR.NOT_ENOUGH_AVAILABLE,
		);
		const active = await getDb()
			.select({ quantity: reservation.quantity })
			.from(reservation)
			.where(
				and(
					inArray(reservation.giftId, [sourceGiftId, copyGiftId]),
					isNull(reservation.deletedAt),
				),
			);
		expect(active.reduce((sum, row) => sum + row.quantity, 0)).toBe(1);
	});

	it('completes a reservation racing a linked edit of the other copy', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
			gift: { quantity: 2 },
		});
		const outcomes = await raceBehindRowLock(
			lockGiftRows([sourceGiftId, copyGiftId]),
			[
				() => reserve(reserverActor, sourceGiftId),
				() =>
					executeOperation(managerActor, updateGiftOperation, {
						id: copyGiftId,
						price: 450,
					}),
			],
			{ queueInOrder: true },
		);
		expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
		expect((await readGift(sourceGiftId)).price).toBe(450);
	});

	it('queues two agent batches editing one group from opposite copies instead of deadlocking', async () => {
		const { sourceWishlist, destinationWishlist, sourceGiftId, copyGiftId } =
			await linkedPair();
		const outcomes = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: wishlist.id })
					.from(wishlist)
					.where(inArray(wishlist.id, [sourceWishlist.id, destinationWishlist.id]))
					.orderBy(asc(wishlist.id))
					.for('update'),
			[
				() =>
					runAsAgent(agentGrant(everyAgentScope), [
						{ operationName: 'updateGift', input: { id: sourceGiftId, price: 100 } },
					]),
				() =>
					runAsAgent(agentGrant(everyAgentScope, recipientActor), [
						{ operationName: 'updateGift', input: { id: copyGiftId, price: 200 } },
					]),
			],
		);
		expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
		expect((await readGift(sourceGiftId)).price).toBe((await readGift(copyGiftId)).price);
	});
});

describe.skipIf(!DB_READY)('the strictest copy freezes the others (issue #742)', () => {
	it('freezes a permanent copy for the recipient once another copy is reserved', async () => {
		const sharedAt = new Date(Date.now() - HOUR);
		const createdAt = new Date(sharedAt.getTime() - HOUR);
		const firstWishlist = await createWishlistFixture({
			kind: WISHLIST_KIND.permanent,
			sharedAt,
		});
		const secondWishlist = await createWishlistFixture({
			kind: WISHLIST_KIND.permanent,
			sharedAt,
		});
		const linkGroupId = await createLinkGroupFixture();
		const firstGiftId = await createGiftFixture(firstWishlist.id, {
			name: 'Kolo',
			linkGroupId,
			createdAt,
		});
		const secondGiftId = await createGiftFixture(secondWishlist.id, {
			name: 'Kolo',
			linkGroupId,
			createdAt,
		});
		await executeOperation(recipientActor, updateGiftOperation, {
			id: firstGiftId,
			name: 'Kolo bez rezervace',
		});
		await reserve(reserverActor, secondGiftId);
		await expectRejection(
			executeOperation(recipientActor, updateGiftOperation, {
				id: firstGiftId,
				name: 'Jiné kolo',
			}),
			403,
			SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING,
		);
	});

	async function lenientCopyOfStrictGift() {
		const sharedAt = new Date(Date.now() - HOUR);
		const occasionWishlist = await createWishlistFixture({
			kind: WISHLIST_KIND.occasion,
			sharedAt,
		});
		const permanentWishlist = await createWishlistFixture({ kind: WISHLIST_KIND.permanent });
		const linkGroupId = await createLinkGroupFixture();
		const createdAt = new Date(sharedAt.getTime() - HOUR);
		const values = { linkGroupId, createdAt, quantity: 2, description: 'Základ' };
		const occasionGiftId = await createGiftFixture(occasionWishlist.id, values);
		const permanentGiftId = await createGiftFixture(permanentWishlist.id, values);
		return { occasionGiftId, permanentGiftId };
	}

	it('only lets the recipient raise the quantity of a lenient copy while another is strict', async () => {
		const { occasionGiftId, permanentGiftId } = await lenientCopyOfStrictGift();
		await expectRejection(
			executeOperation(recipientActor, updateGiftOperation, {
				id: permanentGiftId,
				quantity: 1,
			}),
			400,
			SERVER_ERROR.QUANTITY_CANNOT_BE_LOWERED,
		);
		await executeOperation(recipientActor, updateGiftOperation, {
			id: permanentGiftId,
			quantity: 3,
		});
		expect((await readGift(occasionGiftId)).quantity).toBe(3);
	});

	it('adds a dated segment to a lenient copy’s description while another is strict', async () => {
		const { occasionGiftId, permanentGiftId } = await lenientCopyOfStrictGift();
		await executeOperation(managerActor, appendGiftDescriptionOperation, {
			giftId: permanentGiftId,
			text: 'Velikost M',
		});
		for (const giftId of [permanentGiftId, occasionGiftId]) {
			const copy = await readGift(giftId);
			expect(copy.description).toBe('Základ');
			expect(copy.descriptionAppends.map((segment) => segment.text)).toEqual(['Velikost M']);
		}
	});
});

describe.skipIf(!DB_READY)('linked copies on deleted and archived lists (issue #742)', () => {
	it('keeps a copy on a deleted list in the group, counting its reservations and syncing received', async () => {
		const { sourceWishlist, sourceGiftId, copyGiftId, destinationWishlist } = await linkedPair({
			source: { sharedAt: new Date() },
		});
		await reserveGift(copyGiftId, RESERVER_ID);
		await executeOperation(recipientActor, deleteWishlistOperation, {
			wishlistId: destinationWishlist.id,
		});
		const linkGroupId = await linkGroupIdOf(sourceGiftId);
		expect(linkGroupId).not.toBeNull();
		expect(await linkGroupIdOf(copyGiftId)).toBe(linkGroupId);
		await expectNoneAvailable(reserve(secondReserverActor, sourceGiftId));
		await executeOperation(managerActor, markGiftReceivedOperation, {
			giftId: sourceGiftId,
			received: true,
		});
		expect((await readGift(copyGiftId)).received).toBe(true);
		const listed = await readListGift(managerActor, sourceWishlist.shortId, sourceGiftId);
		expect(listed.linkedCopies).toEqual([]);
	});

	it('rejects new reservations on an archived copy while its reservations keep counting', async () => {
		const { sourceGiftId, copyGiftId, destinationWishlist } = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
			gift: { quantity: 2 },
		});
		await reserve(reserverActor, copyGiftId);
		await executeOperation(recipientActor, archiveWishlistOperation, {
			wishlistId: destinationWishlist.id,
		});
		await expectRejection(
			reserve(secondReserverActor, copyGiftId),
			400,
			SERVER_ERROR.CANNOT_RESERVE_ON_ARCHIVED,
		);
		await reserve(secondReserverActor, sourceGiftId);
		await expectNoneAvailable(reserve(outsiderActor, sourceGiftId));
	});

	it('lets a správce delete a copy past its grace when only another copy is reserved', async () => {
		const sharedAt = new Date(Date.now() - HOUR);
		const createdAt = new Date(sharedAt.getTime() - HOUR);
		const pair = async () => {
			const firstWishlist = await createWishlistFixture({
				kind: WISHLIST_KIND.occasion,
				sharedAt,
			});
			const secondWishlist = await createWishlistFixture({
				kind: WISHLIST_KIND.occasion,
				sharedAt,
			});
			const linkGroupId = await createLinkGroupFixture();
			return {
				firstGiftId: await createGiftFixture(firstWishlist.id, {
					linkGroupId,
					createdAt,
					quantity: 2,
				}),
				secondGiftId: await createGiftFixture(secondWishlist.id, {
					linkGroupId,
					createdAt,
					quantity: 2,
				}),
			};
		};
		const siblingReserved = await pair();
		await reserve(reserverActor, siblingReserved.secondGiftId);
		await executeOperation(managerActor, deleteGiftOperation, {
			giftId: siblingReserved.firstGiftId,
		});
		expect((await readGift(siblingReserved.firstGiftId)).deletedAt).not.toBeNull();

		const ownReserved = await pair();
		await reserve(reserverActor, ownReserved.firstGiftId);
		await expectRejection(
			executeOperation(managerActor, deleteGiftOperation, {
				giftId: ownReserved.firstGiftId,
			}),
			400,
			SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT,
		);
	});
});

describe.skipIf(!DB_READY)('unlinking a copy (issue #742)', () => {
	it('keeps its own reservation and received state and stops sharing units and received', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
			gift: { received: true },
		});
		const { reservationId } = await reserve(reserverActor, copyGiftId);
		await executeOperation(managerActor, unlinkGiftOperation, { giftId: copyGiftId });
		const ownReservations = await getDb()
			.select({ id: reservation.id })
			.from(reservation)
			.where(and(eq(reservation.giftId, copyGiftId), isNull(reservation.deletedAt)));
		expect(ownReservations).toEqual([{ id: reservationId }]);
		expect((await readGift(copyGiftId)).received).toBe(true);
		await reserve(secondReserverActor, sourceGiftId);
		await executeOperation(managerActor, markGiftReceivedOperation, {
			giftId: sourceGiftId,
			received: false,
		});
		expect((await readGift(copyGiftId)).received).toBe(true);
	});

	it('keeps the other two copies of a three-copy group linked', async () => {
		const { sourceGiftId, copyGiftId, destinationWishlist } = await linkedPair();
		const thirdWishlist = await createWishlistFixture();
		const third = await executeOperation(managerActor, bulkCopyGiftsOperation, {
			sourceWishlistId: destinationWishlist.id,
			destinationWishlistId: thirdWishlist.id,
			giftIds: [copyGiftId],
		});
		const thirdGiftId = third.createdIds[0]!;
		const linkGroupId = await linkGroupIdOf(sourceGiftId);
		await executeOperation(managerActor, unlinkGiftOperation, { giftId: copyGiftId });
		expect(await linkGroupIdOf(copyGiftId)).toBeNull();
		expect(await linkGroupIdOf(sourceGiftId)).toBe(linkGroupId);
		expect(await linkGroupIdOf(thirdGiftId)).toBe(linkGroupId);
		await executeOperation(managerActor, updateGiftOperation, { id: sourceGiftId, price: 77 });
		expect((await readGift(thirdGiftId)).price).toBe(77);
		expect((await readGift(copyGiftId)).price).not.toBe(77);
	});

	it('refuses a správce of only the other list', async () => {
		const sourceWishlist = await createWishlistFixture();
		const destinationWishlist = await createWishlistFixture();
		await getDb()
			.insert(moderatorAssignment)
			.values({ wishlistId: sourceWishlist.id, userId: SECOND_RESERVER_ID });
		const linkGroupId = await createLinkGroupFixture();
		const sourceGiftId = await createGiftFixture(sourceWishlist.id, { linkGroupId });
		const copyGiftId = await createGiftFixture(destinationWishlist.id, { linkGroupId });
		await expectRejection(
			executeOperation(secondReserverActor, unlinkGiftOperation, { giftId: copyGiftId }),
			403,
			SERVER_ERROR.ACCESS_DENIED,
		);
		expect(await linkGroupIdOf(copyGiftId)).toBe(linkGroupId);
		const listed = await readListGift(
			secondReserverActor,
			sourceWishlist.shortId,
			sourceGiftId,
		);
		expect(listed.linkedCopies).toEqual([
			expect.objectContaining({ giftId: copyGiftId, viewerManages: false }),
		]);
		const recipientListed = await readListGift(
			recipientActor,
			sourceWishlist.shortId,
			sourceGiftId,
		);
		expect(recipientListed.linkedCopies).toEqual([
			expect.objectContaining({ giftId: copyGiftId, viewerManages: true }),
		]);
	});
});

describe.skipIf(!DB_READY)('synced fields of linked copies (issue #742)', () => {
	const sharedUpload = {
		imageUrl: null,
		imageKey: 'gifts/linked-shared.webp',
		imageMeta: { fitMode: 'contain-padded' as const },
	};

	function releasedImageKeys(): string[] {
		return vi
			.mocked(deleteObjectsBestEffort)
			.mock.calls.flatMap(([keys]) =>
				keys.filter((key): key is string => typeof key === 'string'),
			);
	}

	it('keeps an upload another copy still shows when one copy drops it', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair();
		await executeOperation(managerActor, updateGiftOperation, {
			id: sourceGiftId,
			images: [sharedUpload],
		});
		expect((await readGift(copyGiftId)).images).toEqual([sharedUpload]);
		await executeOperation(managerActor, unlinkGiftOperation, { giftId: copyGiftId });
		vi.mocked(deleteObjectsBestEffort).mockClear();
		await executeOperation(managerActor, updateGiftOperation, { id: sourceGiftId, images: [] });
		expect(releasedImageKeys()).not.toContain(sharedUpload.imageKey);
		await executeOperation(managerActor, deleteGiftOperation, { giftId: copyGiftId });
		expect(releasedImageKeys()).toContain(sharedUpload.imageKey);
	});

	it('maps categories into the copy’s list, reusing a matching label or adding it', async () => {
		const { sourceWishlist, destinationWishlist, sourceGiftId, copyGiftId } =
			await linkedPair();
		const sourceCategory = await createCustomGiftCategoryWithDatabase(getDb(), {
			wishlistId: sourceWishlist.id,
			label: 'Kola na výlety',
		});
		await executeOperation(managerActor, updateGiftOperation, {
			id: sourceGiftId,
			categoryIds: [sourceCategory.id],
		});
		const destinationCategories = await getActiveGiftCategories(destinationWishlist.id);
		const added = destinationCategories.find(
			(category) => category.customLabel === 'Kola na výlety',
		);
		expect(added).toBeDefined();
		expect((await readGift(copyGiftId)).categoryIds).toEqual([added?.id]);

		const secondSourceCategory = await createCustomGiftCategoryWithDatabase(getDb(), {
			wishlistId: sourceWishlist.id,
			label: 'Deskovky pro dva',
		});
		const existingDestinationCategory = await createCustomGiftCategoryWithDatabase(getDb(), {
			wishlistId: destinationWishlist.id,
			label: 'Deskovky pro dva',
		});
		await executeOperation(managerActor, updateGiftOperation, {
			id: sourceGiftId,
			categoryIds: [secondSourceCategory.id],
		});
		expect((await readGift(copyGiftId)).categoryIds).toEqual([existingDestinationCategory.id]);
	});

	it('syncs the price range, currency and description', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair();
		await executeOperation(managerActor, updateGiftOperation, {
			id: copyGiftId,
			price: 100,
			priceMax: 200,
			currency: GIFT_CURRENCIES.EUR,
			description: 'Modrá',
		});
		expect(await readGift(sourceGiftId)).toMatchObject({
			price: 100,
			priceMax: 200,
			currency: GIFT_CURRENCIES.EUR,
			description: 'Modrá',
		});
	});
});

describe.skipIf(!DB_READY)('copying links (issue #742)', () => {
	it('gives each copied gift of one call its own group', async () => {
		const sourceWishlist = await createWishlistFixture();
		const destinationWishlist = await createWishlistFixture();
		const firstGiftId = await createGiftFixture(sourceWishlist.id);
		const secondGiftId = await createGiftFixture(sourceWishlist.id);
		const copy = await executeOperation(managerActor, bulkCopyGiftsOperation, {
			sourceWishlistId: sourceWishlist.id,
			destinationWishlistId: destinationWishlist.id,
			giftIds: [firstGiftId, secondGiftId],
		});
		const [firstCopyId, secondCopyId] = copy.createdIds;
		const firstGroupId = await linkGroupIdOf(firstGiftId);
		const secondGroupId = await linkGroupIdOf(secondGiftId);
		expect(firstGroupId).not.toBeNull();
		expect(secondGroupId).not.toBeNull();
		expect(firstGroupId).not.toBe(secondGroupId);
		expect(await linkGroupIdOf(firstCopyId!)).toBe(firstGroupId);
		expect(await linkGroupIdOf(secondCopyId!)).toBe(secondGroupId);
	});

	it('links a copy carrying its source’s appended segments', async () => {
		const descriptionAppends = [
			{ text: 'Velikost M', addedAt: new Date(Date.now() - HOUR).toISOString() },
		];
		const { copyGiftId, sourceGiftId } = await linkedPair({
			gift: { description: 'Základ', descriptionAppends },
		});
		expect(await linkGroupIdOf(copyGiftId)).toBe(await linkGroupIdOf(sourceGiftId));
		const copy = await readGift(copyGiftId);
		expect(copy.descriptionAppends.map((segment) => segment.text)).toEqual(['Velikost M']);
	});

	it('links copies between lists of the same written recipient name', async () => {
		const sourceWishlist = await otherRecipientWishlist('Babička');
		const destinationWishlist = await otherRecipientWishlist(' Babička ');
		const sourceGiftId = await createGiftFixture(sourceWishlist.id);
		const copy = await executeOperation(managerActor, bulkCopyGiftsOperation, {
			sourceWishlistId: sourceWishlist.id,
			destinationWishlistId: destinationWishlist.id,
			giftIds: [sourceGiftId],
		});
		expect(copy.linkedIds).toEqual(copy.createdIds);
		expect(await linkGroupIdOf(copy.createdIds[0]!)).toBe(await linkGroupIdOf(sourceGiftId));
	});
});

describe('which wishlists share a recipient (issue #742)', () => {
	const account = (recipientUserId: string) => ({ recipientUserId, recipientName: null });
	const written = (recipientName: string | null) => ({ recipientUserId: null, recipientName });

	it('matches equal written names ignoring surrounding whitespace', () => {
		expect(wishlistsShareRecipient(written('Babička'), written('  Babička '))).toBe(true);
	});

	it('never matches different or empty written names', () => {
		expect(wishlistsShareRecipient(written('Babička'), written('Dědeček'))).toBe(false);
		expect(wishlistsShareRecipient(written(''), written(''))).toBe(false);
		expect(wishlistsShareRecipient(written(null), written(null))).toBe(false);
	});

	it('matches accounts by id and never an account with a written name', () => {
		expect(wishlistsShareRecipient(account('user-1'), account('user-1'))).toBe(true);
		expect(wishlistsShareRecipient(account('user-1'), account('user-2'))).toBe(false);
		expect(wishlistsShareRecipient(account('user-1'), written('user-1'))).toBe(false);
	});
});

describe.skipIf(!DB_READY)('notifications across linked copies (issue #742)', () => {
	it('tells the reservers of every copy once about a správce edit', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
			gift: { quantity: 3 },
		});
		await reserve(reserverActor, sourceGiftId);
		await reserve(secondReserverActor, copyGiftId);
		vi.mocked(dispatchNotification).mockClear();
		await executeOperation(managerActor, updateGiftOperation, {
			id: sourceGiftId,
			name: 'Nové kolo',
		});
		const editedTargets = vi
			.mocked(dispatchNotification)
			.mock.calls.filter(
				([payload]) => payload.type === NOTIFICATION_TYPE.RESERVED_GIFT_EDITED,
			)
			.flatMap(([payload]) => payload.targetUserIds);
		expect(editedTargets).toHaveLength(2);
		expect(new Set(editedTargets)).toEqual(new Set([RESERVER_ID, SECOND_RESERVER_ID]));
	});

	it('tells a liker of both copies once about a reservation', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair({
			source: { sharedAt: new Date() },
			destination: { sharedAt: new Date() },
		});
		await getDb()
			.insert(giftLike)
			.values([
				{ giftId: sourceGiftId, userId: SECOND_RESERVER_ID },
				{ giftId: copyGiftId, userId: SECOND_RESERVER_ID },
			]);
		await reserve(reserverActor, copyGiftId);
		const likedTargets = vi
			.mocked(dispatchNotification)
			.mock.calls.filter(
				([payload]) => payload.type === NOTIFICATION_TYPE.LIKED_GIFT_RESERVED,
			)
			.flatMap(([payload]) => payload.targetUserIds);
		expect(likedTargets).toEqual([SECOND_RESERVER_ID]);
	});
});

describe.skipIf(!DB_READY)('agent parity of linked copies (issue #742)', () => {
	it('lets an agent with the gifts write scope unlink a copy', async () => {
		const { sourceGiftId, copyGiftId } = await linkedPair();
		await runAsAgent(agentGrant([AGENT_SCOPE.giftsWrite]), [
			{ operationName: 'unlinkGift', input: { giftId: copyGiftId } },
		]);
		expect(await linkGroupIdOf(copyGiftId)).toBeNull();
		expect(await linkGroupIdOf(sourceGiftId)).toBeNull();
	});

	it('refuses unlinking to an agent without the gifts write scope', async () => {
		const { copyGiftId } = await linkedPair();
		const thrown = await captureError(
			runAsAgent(agentGrant([AGENT_SCOPE.read]), [
				{ operationName: 'unlinkGift', input: { giftId: copyGiftId } },
			]),
		);
		expect(thrown).toMatchObject({ status: 403 });
		expect(await linkGroupIdOf(copyGiftId)).not.toBeNull();
	});
});
