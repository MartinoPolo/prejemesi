import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_ID,
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
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { gift, giftLike, giftLinkGroup, reservation } from '$lib/server/db/gift.schema.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { parseNewGiftDigestPayload } from '$lib/modules/notifications/new_gift_digest.js';
import { WISHLIST_KIND, type WishlistKind } from '$lib/modules/wishlists/types.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { getHomeOverview } from '$lib/modules/wishlists/home_overview_service.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { GIFT_LINK_GROUP_KIND } from '$lib/modules/gifts/gift_link_group_kind.js';
import type { GiftForRecipient, GiftForVisitor } from '$lib/modules/gifts/types.js';
import { createCustomGiftCategoryWithDatabase } from '$lib/modules/gift-categories/gift_categories_service.js';
import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import {
	authorizeAgentOperations,
	executeAgentOperationBatch,
	type AgentOperationRequest,
} from '$lib/server/agent_access/authorization.js';
import type { AgentAccessGrant } from '$lib/server/agent_access/agent_grant.js';
import { tokenChannel, type OperationActor } from './actor.js';
import { executeOperation } from './runner.js';
import { bulkCopyGiftsOperation } from './gift_bulk_operations.js';
import {
	appendGiftDescriptionOperation,
	deleteGiftOperation,
	markGiftReceivedOperation,
	unlinkGiftOperation,
	updateGiftOperation,
} from './gift_mutation_operations.js';
import { readWishlistGiftsOperation } from './gift_read_operations.js';
import { reserveGiftOperation, unreserveGiftOperation } from './reservation_operations.js';
import { readReservationLedgerOperation } from './reservation_read_operations.js';
import { toggleGiftLikeOperation } from './gift_like_operations.js';
import {
	archiveWishlistOperation,
	deleteWishlistOperation,
	revertWishlistToDraftOperation,
} from './wishlist_lifecycle_operations.js';
import { readWishlistOperation } from './wishlist_read_operations.js';
import { REVERT_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
import {
	readGiftShareDestinationsOperation,
	shareGiftsOperation,
} from './gift_share_operations.js';

const reserverActor: OperationActor = { ...outsiderActor, userId: RESERVER_ID, userName: 'Gifter' };

/** The second child: linked recipient of their own list and správce of their sibling's. */
const SIBLING_ID = fixtureId('sibling');
const siblingActor: OperationActor = { ...outsiderActor, userId: SIBLING_ID, userName: 'Sibling' };
/** A správce of the sibling's list only. */
const OTHER_MANAGER_ID = fixtureId('other-manager');
const otherManagerActor: OperationActor = {
	...outsiderActor,
	userId: OTHER_MANAGER_ID,
	userName: 'Other manager',
};
const LIKER_ID = fixtureId('liker');
const likerActor: OperationActor = { ...outsiderActor, userId: LIKER_ID, userName: 'Liker' };

/** A wishlist of the given recipient account, or of a written name, that the manager manages. */
async function recipientWishlist(
	recipient: { userId: string } | { name: string },
	options: {
		status?: 'draft' | 'active' | 'archived';
		recipientIsModerator?: boolean;
		sharedAt?: Date;
		kind?: WishlistKind;
	} = {},
): Promise<{ id: string; shortId: string }> {
	const id = fixtureId('wishlist');
	const shortId = fixtureId('short');
	const status = options.status ?? 'active';
	const sharedAt = status === 'draft' ? null : (options.sharedAt ?? new Date());
	await getDb()
		.insert(wishlist)
		.values({
			id,
			shortId,
			title: `List ${id}`,
			recipientUserId: 'userId' in recipient ? recipient.userId : null,
			recipientName: 'name' in recipient ? recipient.name : null,
			status,
			sharedAt,
			firstSharedAt: sharedAt,
			recipientIsModerator: options.recipientIsModerator ?? false,
			kind: options.kind ?? WISHLIST_KIND.occasion,
		});
	await getDb().insert(moderatorAssignment).values({ wishlistId: id, userId: MANAGER_ID });
	return { id, shortId };
}

async function assignManager(wishlistId: string, userId: string): Promise<void> {
	await getDb().insert(moderatorAssignment).values({ wishlistId, userId });
}

/** One gift shared by the manager between the first child's list and the second child's. */
async function sharedPair(
	options: {
		gift?: Parameters<typeof createGiftFixture>[1];
		first?: Parameters<typeof recipientWishlist>[1];
		second?: Parameters<typeof recipientWishlist>[1];
	} = {},
) {
	const firstWishlist = await recipientWishlist({ userId: RECIPIENT_ID }, options.first);
	const secondWishlist = await recipientWishlist({ userId: SIBLING_ID }, options.second);
	const firstGiftId = await createGiftFixture(firstWishlist.id, options.gift);
	const shared = await executeOperation(managerActor, shareGiftsOperation, {
		giftIds: [firstGiftId],
		wishlistIds: [secondWishlist.id],
	});
	const secondGiftId = shared.createdIds[0]!;
	return { firstWishlist, secondWishlist, firstGiftId, secondGiftId, shared };
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

function agentGrant(wishlistIds: string[] | null): AgentAccessGrant {
	return {
		userId: managerActor.userId,
		userName: managerActor.userName,
		tokenName: 'Agent',
		channel: tokenChannel('Agent'),
		scopes: [AGENT_SCOPE.read, AGENT_SCOPE.giftsWrite],
		wishlistIds,
	};
}

async function runAsAgent(grant: AgentAccessGrant, requests: AgentOperationRequest[]) {
	return executeAgentOperationBatch(grant, await authorizeAgentOperations(grant, requests));
}

async function linkGroupIdOf(giftId: string): Promise<string | null> {
	return (await readGift(giftId)).linkGroupId;
}

function notifiedUserIds(type: string): string[] {
	return vi
		.mocked(dispatchNotification)
		.mock.calls.filter(([payload]) => payload.type === type)
		.flatMap(([payload]) => payload.targetUserIds ?? []);
}

beforeAll(async () => {
	if (DB_READY) {
		await seedFixtureUsers();
		await getDb()
			.insert(user)
			.values([
				{ id: SIBLING_ID, name: 'Sourozenec', email: `${SIBLING_ID}@example.com` },
				{
					id: OTHER_MANAGER_ID,
					name: 'Druhý správce',
					email: `${OTHER_MANAGER_ID}@example.com`,
				},
				{ id: LIKER_ID, name: 'Liker', email: `${LIKER_ID}@example.com` },
			]);
	}
});
afterAll(removeFixtureRows);
beforeEach(() => {
	vi.mocked(dispatchNotification).mockClear();
});

describe.skipIf(!DB_READY)('sharing a gift across recipients (issue #737)', () => {
	it('puts a row on every list in one shared group, keeping priority and order per list', async () => {
		const firstWishlist = await recipientWishlist({ userId: RECIPIENT_ID });
		const secondWishlist = await recipientWishlist({ name: 'Babička' });
		await getDb()
			.insert(priorityLevel)
			.values([
				{ wishlistId: firstWishlist.id, label: 'high', sortOrder: 0 },
				{ wishlistId: secondWishlist.id, label: 'high', sortOrder: 0 },
			]);
		const [firstHigh] = await getDb()
			.select({ id: priorityLevel.id })
			.from(priorityLevel)
			.where(eq(priorityLevel.wishlistId, firstWishlist.id));
		const [secondHigh] = await getDb()
			.select({ id: priorityLevel.id })
			.from(priorityLevel)
			.where(eq(priorityLevel.wishlistId, secondWishlist.id));
		const category = await createCustomGiftCategoryWithDatabase(getDb(), {
			wishlistId: firstWishlist.id,
			label: 'Stavebnice',
			color: '#123456',
		});
		await createGiftFixture(secondWishlist.id, { sortOrder: 4 });
		const giftId = await createGiftFixture(firstWishlist.id, {
			name: 'LEGO hrad',
			description: 'Velký',
			price: 2500,
			quantity: 3,
			received: true,
			priorityLevelId: firstHigh!.id,
			categoryIds: [category.id],
		});

		const shared = await executeOperation(managerActor, shareGiftsOperation, {
			giftIds: [giftId],
			wishlistIds: [secondWishlist.id],
		});

		const sharedGiftId = shared.createdIds[0]!;
		const sharedRow = await readGift(sharedGiftId);
		expect(sharedRow).toMatchObject({
			wishlistId: secondWishlist.id,
			name: 'LEGO hrad',
			description: 'Velký',
			price: 2500,
			quantity: 3,
			received: true,
			priorityLevelId: secondHigh!.id,
			sortOrder: 5,
		});
		const linkGroupId = await linkGroupIdOf(giftId);
		expect(linkGroupId).not.toBeNull();
		expect(sharedRow.linkGroupId).toBe(linkGroupId);
		const [group] = await getDb()
			.select({ kind: giftLinkGroup.kind })
			.from(giftLinkGroup)
			.where(eq(giftLinkGroup.id, linkGroupId!));
		expect(group?.kind).toBe(GIFT_LINK_GROUP_KIND.sharedAcrossRecipients);
		const sharedCategory = await readListGift(
			managerActor,
			secondWishlist.shortId,
			sharedGiftId,
		);
		expect(sharedCategory.categories.map((listed) => listed.customLabel)).toEqual([
			'Stavebnice',
		]);
	});

	it('refuses a user who does not manage every participating list', async () => {
		const firstWishlist = await recipientWishlist({ userId: RECIPIENT_ID });
		const secondWishlist = await recipientWishlist({ userId: SIBLING_ID });
		const giftId = await createGiftFixture(firstWishlist.id);
		await expectRejection(
			executeOperation(recipientActor, shareGiftsOperation, {
				giftIds: [giftId],
				wishlistIds: [secondWishlist.id],
			}),
			403,
			SERVER_ERROR.GIFT_SHARE_NOT_MANAGER,
		);
		expect(await linkGroupIdOf(giftId)).toBeNull();
	});

	it('refuses lists of the same recipient', async () => {
		const firstWishlist = await recipientWishlist({ userId: RECIPIENT_ID });
		const sameRecipientWishlist = await recipientWishlist({ userId: RECIPIENT_ID });
		const giftId = await createGiftFixture(firstWishlist.id);
		await expectRejection(
			executeOperation(managerActor, shareGiftsOperation, {
				giftIds: [giftId],
				wishlistIds: [sameRecipientWishlist.id],
			}),
			400,
			SERVER_ERROR.GIFT_SHARE_SAME_RECIPIENT,
		);
	});

	it('refuses two destinations of one recipient', async () => {
		const firstWishlist = await recipientWishlist({ userId: RECIPIENT_ID });
		const siblingWishlist = await recipientWishlist({ userId: SIBLING_ID });
		const otherSiblingWishlist = await recipientWishlist({ userId: SIBLING_ID });
		const giftId = await createGiftFixture(firstWishlist.id);
		await expectRejection(
			executeOperation(managerActor, shareGiftsOperation, {
				giftIds: [giftId],
				wishlistIds: [siblingWishlist.id, otherSiblingWishlist.id],
			}),
			400,
			SERVER_ERROR.GIFT_SHARE_SAME_RECIPIENT,
		);
	});

	it('refuses an archived list', async () => {
		const firstWishlist = await recipientWishlist({ userId: RECIPIENT_ID });
		const archivedWishlist = await recipientWishlist(
			{ userId: SIBLING_ID },
			{ status: 'archived' },
		);
		const giftId = await createGiftFixture(firstWishlist.id);
		await expectRejection(
			executeOperation(managerActor, shareGiftsOperation, {
				giftIds: [giftId],
				wishlistIds: [archivedWishlist.id],
			}),
			400,
			SERVER_ERROR.GIFT_SHARE_DESTINATION_UNAVAILABLE,
		);
	});

	it('refuses a linked copy of one recipient’s gift', async () => {
		const sourceWishlist = await createWishlistFixture();
		const copyWishlist = await createWishlistFixture();
		const siblingWishlist = await recipientWishlist({ userId: SIBLING_ID });
		const giftId = await createGiftFixture(sourceWishlist.id);
		await executeOperation(managerActor, bulkCopyGiftsOperation, {
			sourceWishlistId: sourceWishlist.id,
			destinationWishlistId: copyWishlist.id,
			giftIds: [giftId],
		});
		await expectRejection(
			executeOperation(managerActor, shareGiftsOperation, {
				giftIds: [giftId],
				wishlistIds: [siblingWishlist.id],
			}),
			400,
			SERVER_ERROR.GIFT_SHARE_LINKED_COPY,
		);
	});

	it('adds another list to a shared gift, but only for a manager of every list', async () => {
		const { firstGiftId, secondGiftId, secondWishlist } = await sharedPair();
		const thirdWishlist = await recipientWishlist({ name: 'Bratranec' });
		await assignManager(thirdWishlist.id, OTHER_MANAGER_ID);
		await assignManager(secondWishlist.id, OTHER_MANAGER_ID);
		await expectRejection(
			executeOperation(otherManagerActor, shareGiftsOperation, {
				giftIds: [secondGiftId],
				wishlistIds: [thirdWishlist.id],
			}),
			403,
			SERVER_ERROR.GIFT_SHARE_NOT_MANAGER,
		);
		const added = await executeOperation(managerActor, shareGiftsOperation, {
			giftIds: [secondGiftId],
			wishlistIds: [thirdWishlist.id],
		});
		const groupId = await linkGroupIdOf(firstGiftId);
		expect(await linkGroupIdOf(added.createdIds[0]!)).toBe(groupId);
		expect(await linkGroupIdOf(secondGiftId)).toBe(groupId);
	});

	it('offers only managed active lists of other recipients as share destinations', async () => {
		const { firstGiftId, secondWishlist } = await sharedPair();
		const eligible = await recipientWishlist({ name: 'Bratranec' });
		const sameRecipient = await recipientWishlist({ userId: SIBLING_ID });
		const archived = await recipientWishlist({ name: 'Teta' }, { status: 'archived' });
		const destinations = await executeOperation(
			managerActor,
			readGiftShareDestinationsOperation,
			{ giftIds: [firstGiftId] },
		);
		const destinationIds = destinations.map((destination) => destination.id);
		expect(destinationIds).toContain(eligible.id);
		expect(destinationIds).not.toContain(sameRecipient.id);
		expect(destinationIds).not.toContain(secondWishlist.id);
		expect(destinationIds).not.toContain(archived.id);
		expect(destinations.find((destination) => destination.id === eligible.id)).toMatchObject({
			recipientDisplayName: 'Bratranec',
			recipientImage: null,
		});
	});
});

describe.skipIf(!DB_READY)('share destinations follow the share rule (issue #737)', () => {
	it('offers no destination to a správce who does not manage every list sharing the gift', async () => {
		const { secondWishlist, secondGiftId } = await sharedPair();
		await assignManager(secondWishlist.id, OTHER_MANAGER_ID);
		await recipientWishlist({ name: 'Bratranec' }).then(({ id }) =>
			assignManager(id, OTHER_MANAGER_ID),
		);
		const destinations = await executeOperation(
			otherManagerActor,
			readGiftShareDestinationsOperation,
			{ giftIds: [secondGiftId] },
		);
		expect(destinations).toEqual([]);
	});
});

describe.skipIf(!DB_READY)('agent sharing of a gift (issue #737)', () => {
	it('needs a wishlist-restricted token to cover every participating list', async () => {
		const firstWishlist = await recipientWishlist({ userId: RECIPIENT_ID });
		const secondWishlist = await recipientWishlist({ userId: SIBLING_ID });
		const giftId = await createGiftFixture(firstWishlist.id);
		const request: AgentOperationRequest = {
			operationName: 'shareGifts',
			input: { giftIds: [giftId], wishlistIds: [secondWishlist.id] },
		};
		const thrown = await captureError(runAsAgent(agentGrant([firstWishlist.id]), [request]));
		expect(thrown).toMatchObject({ status: 403 });
		expect(errorMessage(thrown)).toBe(SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED);
		expect(await linkGroupIdOf(giftId)).toBeNull();

		await runAsAgent(agentGrant([firstWishlist.id, secondWishlist.id]), [request]);
		expect(await linkGroupIdOf(giftId)).not.toBeNull();
	});

	it('needs the token to cover the lists the gift is already shared with', async () => {
		const { firstGiftId, firstWishlist } = await sharedPair();
		const thirdWishlist = await recipientWishlist({ name: 'Bratranec' });
		const thrown = await captureError(
			runAsAgent(agentGrant([firstWishlist.id, thirdWishlist.id]), [
				{
					operationName: 'shareGifts',
					input: { giftIds: [firstGiftId], wishlistIds: [thirdWishlist.id] },
				},
			]),
		);
		expect(thrown).toMatchObject({ status: 403 });
	});
});

describe.skipIf(!DB_READY)('one shared gift on every list (issue #737)', () => {
	it('shares units across lists and never over-reserves', async () => {
		const { firstWishlist, secondWishlist, firstGiftId, secondGiftId } = await sharedPair({
			gift: { quantity: 2 },
		});
		await reserve(reserverActor, firstGiftId, 2);
		const secondRow = asVisitorGift(
			await readListGift(managerActor, secondWishlist.shortId, secondGiftId),
		);
		expect(secondRow.reservedCount).toBe(2);
		expect(secondRow.isFullyReserved).toBe(true);
		const firstRow = asVisitorGift(
			await readListGift(outsiderActor, firstWishlist.shortId, firstGiftId),
		);
		expect(firstRow.reservedCount).toBe(2);
		const thrown = await captureError(reserve(outsiderActor, secondGiftId));
		expect(thrown).toMatchObject({ status: 400 });
		expect(JSON.parse(errorMessage(thrown))).toMatchObject({
			code: SERVER_ERROR.NOT_ENOUGH_AVAILABLE,
		});
	});

	it('shares received state and edits made from any list', async () => {
		const { firstGiftId, secondGiftId } = await sharedPair();
		await executeOperation(managerActor, markGiftReceivedOperation, {
			giftId: secondGiftId,
			received: true,
		});
		expect((await readGift(firstGiftId)).received).toBe(true);
		await executeOperation(managerActor, updateGiftOperation, {
			id: secondGiftId,
			name: 'Společné LEGO',
		});
		expect((await readGift(firstGiftId)).name).toBe('Společné LEGO');
	});

	it('counts a liker of any list once and lets them unlike from another list', async () => {
		const { firstWishlist, secondWishlist, firstGiftId, secondGiftId } = await sharedPair();
		const liked = await executeOperation(likerActor, toggleGiftLikeOperation, {
			giftId: firstGiftId,
		});
		expect(liked).toEqual({ liked: true, likeCount: 1 });
		await executeOperation(outsiderActor, toggleGiftLikeOperation, { giftId: secondGiftId });
		const secondRow = asVisitorGift(
			await readListGift(managerActor, secondWishlist.shortId, secondGiftId),
		);
		expect(secondRow.likeCount).toBe(2);
		const unliked = await executeOperation(likerActor, toggleGiftLikeOperation, {
			giftId: secondGiftId,
		});
		expect(unliked).toEqual({ liked: false, likeCount: 1 });
		const firstRow = asVisitorGift(
			await readListGift(managerActor, firstWishlist.shortId, firstGiftId),
		);
		expect(firstRow.likeCount).toBe(1);
	});

	it('lists the other lists by recipient, and the list itself only to their managers', async () => {
		const { firstWishlist, secondWishlist, firstGiftId, secondGiftId } = await sharedPair();
		const managerView = await readListGift(managerActor, firstWishlist.shortId, firstGiftId);
		expect(managerView.linkGroupKind).toBe(GIFT_LINK_GROUP_KIND.sharedAcrossRecipients);
		expect(managerView.linkedCopies).toEqual([]);
		expect(managerView.sharedWith).toEqual([
			{
				recipientDisplayName: 'Sourozenec',
				recipientImage: null,
				giftId: secondGiftId,
				wishlistId: secondWishlist.id,
				wishlistShortId: secondWishlist.shortId,
				wishlistTitle: `List ${secondWishlist.id}`,
			},
		]);
		const visitorView = await readListGift(null, firstWishlist.shortId, firstGiftId);
		expect(visitorView.linkGroupKind).toBe(GIFT_LINK_GROUP_KIND.sharedAcrossRecipients);
		expect(visitorView.sharedWith).toEqual([
			{
				recipientDisplayName: 'Sourozenec',
				recipientImage: null,
				giftId: null,
				wishlistId: null,
				wishlistShortId: null,
				wishlistTitle: null,
			},
		]);
	});
});

describe.skipIf(!DB_READY)('surprise protection of a shared gift (issue #737)', () => {
	it('hides the shared gift’s reservation state from a recipient who manages the other list', async () => {
		const { firstWishlist, firstGiftId } = await sharedPair();
		await assignManager(firstWishlist.id, SIBLING_ID);
		const ordinaryGiftId = await createGiftFixture(firstWishlist.id);
		await reserve(reserverActor, firstGiftId);
		await reserve(reserverActor, ordinaryGiftId);

		const { role, gifts } = await executeOperation(siblingActor, readWishlistGiftsOperation, {
			wishlistShortId: firstWishlist.shortId,
		});
		expect(role).toBe('moderator');
		const sharedRow = gifts.find((listed) => listed.id === firstGiftId)!;
		expect(sharedRow).not.toHaveProperty('reservedCount');
		expect(sharedRow).not.toHaveProperty('likeCount');
		expect(sharedRow).not.toHaveProperty('reserverNames');
		expect(sharedRow.sharedWith.map((member) => member.recipientDisplayName)).toEqual([
			'Sourozenec',
		]);
		// The rest of the list they manage keeps its reservation state.
		const ordinaryRow = asVisitorGift(gifts.find((listed) => listed.id === ordinaryGiftId)!);
		expect(ordinaryRow.reservedCount).toBe(1);
	});

	it('hides it from a recipient visiting the other list too', async () => {
		const { firstWishlist, firstGiftId } = await sharedPair();
		await reserve(reserverActor, firstGiftId);
		const visitedRow = await readListGift(siblingActor, firstWishlist.shortId, firstGiftId);
		expect(carriesReservationState(visitedRow)).toBe(false);
	});

	it('refuses a recipient reserving or liking the shared gift on another list', async () => {
		const { firstWishlist, firstGiftId } = await sharedPair();
		await assignManager(firstWishlist.id, SIBLING_ID);
		await expectRejection(
			reserve(siblingActor, firstGiftId),
			403,
			SERVER_ERROR.RECIPIENT_CANNOT_RESERVE_OWN_GIFTS,
		);
		await expectRejection(
			executeOperation(siblingActor, toggleGiftLikeOperation, { giftId: firstGiftId }),
			403,
			SERVER_ERROR.RECIPIENT_CANNOT_LIKE_OWN_GIFTS,
		);
	});

	it('refuses a recipient who only visits the other list reserving or liking it there', async () => {
		const { firstWishlist, firstGiftId, secondGiftId } = await sharedPair();
		const { role } = await executeOperation(siblingActor, readWishlistGiftsOperation, {
			wishlistShortId: firstWishlist.shortId,
		});
		expect(role).toBe('visitor');
		await expectRejection(
			reserve(siblingActor, firstGiftId),
			403,
			SERVER_ERROR.RECIPIENT_CANNOT_RESERVE_OWN_GIFTS,
		);
		await expectRejection(
			executeOperation(siblingActor, toggleGiftLikeOperation, { giftId: firstGiftId }),
			403,
			SERVER_ERROR.RECIPIENT_CANNOT_LIKE_OWN_GIFTS,
		);
		const groupGiftIds = [firstGiftId, secondGiftId];
		expect(
			await getDb()
				.select({ id: reservation.id })
				.from(reservation)
				.where(inArray(reservation.giftId, groupGiftIds)),
		).toEqual([]);
		expect(
			await getDb()
				.select({ id: giftLike.id })
				.from(giftLike)
				.where(inArray(giftLike.giftId, groupGiftIds)),
		).toEqual([]);
	});

	it('shows a self-promoted recipient reservations on their own list as today', async () => {
		const { secondWishlist, secondGiftId } = await sharedPair({
			second: { recipientIsModerator: true },
		});
		await reserve(reserverActor, secondGiftId);
		const ownRow = asVisitorGift(
			await readListGift(siblingActor, secondWishlist.shortId, secondGiftId),
		);
		expect(ownRow.reservedCount).toBe(1);
		expect(ownRow.reserverNames).toEqual([]);
	});

	it('tells správci of every list about a reservation, never a recipient', async () => {
		const { firstWishlist, secondWishlist, firstGiftId } = await sharedPair();
		await assignManager(secondWishlist.id, OTHER_MANAGER_ID);
		await assignManager(firstWishlist.id, SIBLING_ID);
		await reserve(reserverActor, firstGiftId);
		const reservedTargets = notifiedUserIds(NOTIFICATION_TYPE.GIFT_RESERVED);
		expect(reservedTargets).toContain(OTHER_MANAGER_ID);
		expect(reservedTargets).toContain(MANAGER_ID);
		expect(reservedTargets.filter((userId) => userId === MANAGER_ID)).toHaveLength(1);
		expect(reservedTargets).not.toContain(SIBLING_ID);
		expect(reservedTargets).not.toContain(RECIPIENT_ID);
		expect(reservedTargets).not.toContain(RESERVER_ID);
		for (const [payload] of vi.mocked(dispatchNotification).mock.calls) {
			expect(payload).not.toHaveProperty('actorName');
		}
	});

	it('tells likers of every list once, excluding recipients', async () => {
		const { firstGiftId, secondGiftId } = await sharedPair();
		await executeOperation(likerActor, toggleGiftLikeOperation, { giftId: secondGiftId });
		await reserve(reserverActor, firstGiftId);
		expect(notifiedUserIds(NOTIFICATION_TYPE.LIKED_GIFT_RESERVED)).toEqual([LIKER_ID]);
	});
});

describe.skipIf(!DB_READY)('editing a shared gift under the strictest list (issue #737)', () => {
	const HOUR = 60 * 60 * 1000;

	/** List A is an occasion list shared an hour ago, its gift from before, so past grace. */
	async function strictFirstList() {
		const sharedAt = new Date(Date.now() - HOUR);
		return sharedPair({
			first: { sharedAt },
			second: { kind: WISHLIST_KIND.permanent },
			gift: {
				name: 'LEGO hrad',
				description: 'Velký',
				quantity: 2,
				createdAt: new Date(sharedAt.getTime() - HOUR),
			},
		});
	}

	it('refuses list B’s recipient renaming it or lowering its quantity', async () => {
		const { secondGiftId } = await strictFirstList();
		await expectRejection(
			executeOperation(siblingActor, updateGiftOperation, {
				id: secondGiftId,
				name: 'Jiný hrad',
			}),
			403,
			SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING,
		);
		await expectRejection(
			executeOperation(siblingActor, updateGiftOperation, {
				id: secondGiftId,
				quantity: 1,
			}),
			400,
			SERVER_ERROR.QUANTITY_CANNOT_BE_LOWERED,
		);
		expect(await readGift(secondGiftId)).toMatchObject({ name: 'LEGO hrad', quantity: 2 });
	});

	it('turns a description addition from list B into a dated segment on every list', async () => {
		const { firstGiftId, secondGiftId } = await strictFirstList();
		await executeOperation(siblingActor, appendGiftDescriptionOperation, {
			giftId: secondGiftId,
			text: 'Bez figurek',
		});
		for (const giftId of [firstGiftId, secondGiftId]) {
			const row = await readGift(giftId);
			expect(row.description).toBe('Velký');
			expect(row.descriptionAppends.map((segment) => segment.text)).toEqual(['Bez figurek']);
		}
	});
});

describe.skipIf(!DB_READY)('new-gift digest for shared rows (issue #737)', () => {
	async function digestsFor(userId: string) {
		const rows = await getDb()
			.select({ payload: notification.payload })
			.from(notification)
			.where(eq(notification.userId, userId));
		return rows.flatMap((row) => {
			const digest = parseNewGiftDigestPayload(row.payload);
			return digest === null ? [] : [digest];
		});
	}

	it('tells followers of an active destination, not of a draft one', async () => {
		const sourceWishlist = await recipientWishlist({ userId: RECIPIENT_ID });
		const activeDestination = await recipientWishlist({ userId: SIBLING_ID });
		const draftDestination = await recipientWishlist(
			{ name: 'Bratranec' },
			{ status: 'draft' },
		);
		const activeFollowerId = fixtureId('active-follower');
		const draftFollowerId = fixtureId('draft-follower');
		await getDb()
			.insert(user)
			.values([
				{ id: activeFollowerId, name: 'Active', email: `${activeFollowerId}@example.com` },
				{ id: draftFollowerId, name: 'Draft', email: `${draftFollowerId}@example.com` },
			]);
		await getDb()
			.insert(wishlistFollower)
			.values([
				{ wishlistId: activeDestination.id, userId: activeFollowerId },
				{ wishlistId: draftDestination.id, userId: draftFollowerId },
			]);
		const giftId = await createGiftFixture(sourceWishlist.id, { name: 'LEGO hrad' });

		await executeOperation(managerActor, shareGiftsOperation, {
			giftIds: [giftId],
			wishlistIds: [activeDestination.id, draftDestination.id],
		});

		const activeDigests = await digestsFor(activeFollowerId);
		expect(activeDigests).toHaveLength(1);
		expect(activeDigests[0]?.totalCount).toBe(1);
		expect(await digestsFor(draftFollowerId)).toEqual([]);
	});
});

describe.skipIf(!DB_READY)('lifecycle of a shared gift (issue #737)', () => {
	it('blocks removing it from any list while it is reserved anywhere', async () => {
		const { firstGiftId, secondGiftId } = await sharedPair();
		await reserve(reserverActor, firstGiftId);
		await expectRejection(
			executeOperation(managerActor, deleteGiftOperation, { giftId: secondGiftId }),
			400,
			SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT,
		);
		expect((await readGift(secondGiftId)).deletedAt).toBeNull();
	});

	it('lets a removed row leave and dissolves the group at one list', async () => {
		const { firstGiftId, secondGiftId } = await sharedPair();
		const thirdWishlist = await recipientWishlist({ name: 'Bratranec' });
		const added = await executeOperation(managerActor, shareGiftsOperation, {
			giftIds: [firstGiftId],
			wishlistIds: [thirdWishlist.id],
		});
		const thirdGiftId = added.createdIds[0]!;
		await executeOperation(managerActor, deleteGiftOperation, { giftId: thirdGiftId });
		expect(await linkGroupIdOf(firstGiftId)).not.toBeNull();
		expect(await linkGroupIdOf(secondGiftId)).toBe(await linkGroupIdOf(firstGiftId));
		await executeOperation(managerActor, deleteGiftOperation, { giftId: secondGiftId });
		expect(await linkGroupIdOf(firstGiftId)).toBeNull();
	});

	it('detaches the row of a deleted wishlist', async () => {
		const { firstGiftId, secondGiftId, secondWishlist } = await sharedPair({
			second: { status: 'draft' },
		});
		await executeOperation(managerActor, deleteWishlistOperation, {
			wishlistId: secondWishlist.id,
		});
		expect(await linkGroupIdOf(secondGiftId)).toBeNull();
		expect(await linkGroupIdOf(firstGiftId)).toBeNull();
	});

	it('keeps the other two lists grouped when one of three lists is deleted', async () => {
		const { firstWishlist, firstGiftId, secondGiftId, secondWishlist } = await sharedPair({
			second: { status: 'draft' },
		});
		const thirdWishlist = await recipientWishlist({ name: 'Bratranec' });
		const added = await executeOperation(managerActor, shareGiftsOperation, {
			giftIds: [firstGiftId],
			wishlistIds: [thirdWishlist.id],
		});
		const thirdGiftId = added.createdIds[0]!;
		await executeOperation(managerActor, deleteWishlistOperation, {
			wishlistId: secondWishlist.id,
		});
		expect(await linkGroupIdOf(secondGiftId)).toBeNull();
		const remainingGroupId = await linkGroupIdOf(firstGiftId);
		expect(remainingGroupId).not.toBeNull();
		expect(await linkGroupIdOf(thirdGiftId)).toBe(remainingGroupId);
		const firstRow = await readListGift(managerActor, firstWishlist.shortId, firstGiftId);
		expect(firstRow.sharedWith.map((member) => member.wishlistId)).toEqual([thirdWishlist.id]);
	});

	it('keeps an archived list read-only while the others accept reservations', async () => {
		const { secondWishlist, firstGiftId, secondGiftId } = await sharedPair({
			gift: { quantity: 2 },
		});
		await executeOperation(managerActor, archiveWishlistOperation, {
			wishlistId: secondWishlist.id,
		});
		await expectRejection(
			reserve(reserverActor, secondGiftId),
			400,
			SERVER_ERROR.CANNOT_RESERVE_ON_ARCHIVED,
		);
		await reserve(reserverActor, firstGiftId);
	});

	it('is removed from a list by deleting it there, never by unlinking', async () => {
		const { secondGiftId } = await sharedPair();
		await expectRejection(
			executeOperation(managerActor, unlinkGiftOperation, { giftId: secondGiftId }),
			400,
			SERVER_ERROR.SHARED_GIFT_CANNOT_UNLINK,
		);
	});

	it('copies a shared gift to a list of the same recipient without joining its group', async () => {
		const { firstGiftId, firstWishlist } = await sharedPair();
		const otherOwnWishlist = await recipientWishlist({ userId: RECIPIENT_ID });
		const copy = await executeOperation(managerActor, bulkCopyGiftsOperation, {
			sourceWishlistId: firstWishlist.id,
			destinationWishlistId: otherOwnWishlist.id,
			giftIds: [firstGiftId],
		});
		expect(copy.linkedIds).toEqual([]);
		expect(await linkGroupIdOf(copy.createdIds[0]!)).toBeNull();
	});
});

describe.skipIf(!DB_READY)(
	'a shared gift’s reservation state on other surfaces (issue #737)',
	() => {
		const longAgo = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

		async function moderatedCounts(userId: string, wishlistId: string) {
			const overview = await getHomeOverview(userId);
			const item = overview.moderated.items.find((listed) => listed.id === wishlistId);
			return item === undefined ? undefined : [item.totalGifts, item.reservedGifts];
		}

		async function followedAvailableGifts(userId: string, wishlistId: string) {
			const overview = await getHomeOverview(userId);
			return overview.followed.items.find((listed) => listed.id === wishlistId)
				?.availableGifts;
		}

		async function follow(wishlistId: string, userId: string) {
			await getDb().insert(wishlistFollower).values({ wishlistId, userId });
		}

		it('counts a reservation on any row of the group in správce progress and follower availability', async () => {
			const { firstWishlist, secondGiftId } = await sharedPair();
			await follow(firstWishlist.id, LIKER_ID);
			await reserve(reserverActor, secondGiftId);
			expect(await moderatedCounts(MANAGER_ID, firstWishlist.id)).toEqual([1, 1]);
			expect(await followedAvailableGifts(LIKER_ID, firstWishlist.id)).toBe(0);
		});

		it('keeps the shared gift out of a recipient’s správce progress', async () => {
			const { firstWishlist, firstGiftId } = await sharedPair();
			await assignManager(firstWishlist.id, SIBLING_ID);
			const ordinaryGiftId = await createGiftFixture(firstWishlist.id);
			await reserve(reserverActor, firstGiftId);
			await reserve(reserverActor, ordinaryGiftId);
			expect(await moderatedCounts(SIBLING_ID, firstWishlist.id)).toEqual([2, 1]);
			expect(await moderatedCounts(MANAGER_ID, firstWishlist.id)).toEqual([2, 2]);
		});

		it('keeps the shared gift available to a recipient following another of its lists', async () => {
			const { firstWishlist, firstGiftId } = await sharedPair();
			await follow(firstWishlist.id, SIBLING_ID);
			await reserve(reserverActor, firstGiftId);
			expect(await followedAvailableGifts(SIBLING_ID, firstWishlist.id)).toBe(1);
		});

		it('leaves the shared gift out of a recipient’s release ledger and refuses their release', async () => {
			const { firstWishlist, firstGiftId } = await sharedPair({ gift: { quantity: 2 } });
			await assignManager(firstWishlist.id, SIBLING_ID);
			const ordinaryGiftId = await createGiftFixture(firstWishlist.id);
			await reserve(reserverActor, firstGiftId);
			await reserve(reserverActor, ordinaryGiftId);
			const [guestReservation] = await getDb()
				.insert(reservation)
				.values({ giftId: firstGiftId, userId: null, anonymousName: 'Host' })
				.returning({ id: reservation.id });

			const siblingLedger = await executeOperation(
				siblingActor,
				readReservationLedgerOperation,
				{
					wishlistShortId: firstWishlist.shortId,
				},
			);
			expect(Object.keys(siblingLedger.reservationsByGiftId)).toEqual([ordinaryGiftId]);
			const managerLedger = await executeOperation(
				managerActor,
				readReservationLedgerOperation,
				{
					wishlistShortId: firstWishlist.shortId,
				},
			);
			expect(managerLedger.reservationsByGiftId[firstGiftId]).toHaveLength(2);

			await expectRejection(
				executeOperation(siblingActor, unreserveGiftOperation, {
					reservationId: guestReservation!.id,
				}),
				404,
				SERVER_ERROR.RESERVATION_NOT_FOUND,
			);
			const [stillActive] = await getDb()
				.select({ deletedAt: reservation.deletedAt })
				.from(reservation)
				.where(eq(reservation.id, guestReservation!.id));
			expect(stillActive?.deletedAt).toBeNull();
		});

		it('lets a recipient managing another list revert it as if the shared gift were unreserved', async () => {
			const { firstWishlist, firstGiftId } = await sharedPair();
			await assignManager(firstWishlist.id, SIBLING_ID);
			const { reservationId } = await reserve(reserverActor, firstGiftId);
			const siblingView = await executeOperation(siblingActor, readWishlistOperation, {
				wishlistShortId: firstWishlist.shortId,
			});
			expect(siblingView.revertCapability).toBe(REVERT_CAPABILITY.clean);
			const managerView = await executeOperation(managerActor, readWishlistOperation, {
				wishlistShortId: firstWishlist.shortId,
			});
			expect(managerView.revertCapability).toBe(REVERT_CAPABILITY.reservedBlocked);

			await executeOperation(siblingActor, revertWishlistToDraftOperation, {
				wishlistId: firstWishlist.id,
			});
			// The reservation the recipient cannot see stays: it reserves the gift for every list.
			const [kept] = await getDb()
				.select({ deletedAt: reservation.deletedAt })
				.from(reservation)
				.where(eq(reservation.id, reservationId));
			expect(kept?.deletedAt).toBeNull();
			expect(notifiedUserIds(NOTIFICATION_TYPE.RESERVATION_CANCELLED)).toEqual([]);
		});

		it('refuses a recipient managing another list its removal past grace, reserved or not', async () => {
			const reserved = await sharedPair({ first: { sharedAt: longAgo() } });
			const unreserved = await sharedPair({ first: { sharedAt: longAgo() } });
			for (const pair of [reserved, unreserved]) {
				await getDb()
					.update(gift)
					.set({ createdAt: new Date(longAgo().getTime() - 60_000) })
					.where(eq(gift.id, pair.firstGiftId));
				await assignManager(pair.firstWishlist.id, SIBLING_ID);
			}
			await reserve(reserverActor, reserved.firstGiftId);
			for (const pair of [reserved, unreserved]) {
				await expectRejection(
					executeOperation(siblingActor, deleteGiftOperation, {
						giftId: pair.firstGiftId,
					}),
					403,
					SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING,
				);
			}
		});

		it('keeps a shared gift a recipient moves out of a permanent list they manage, reserved or not', async () => {
			const { firstWishlist, firstGiftId, secondWishlist } = await sharedPair({
				first: { sharedAt: longAgo() },
				second: { sharedAt: longAgo() },
			});
			await getDb()
				.update(wishlist)
				.set({ kind: 'permanent', occasion: 'permanent' })
				.where(eq(wishlist.id, firstWishlist.id));
			const reservedGiftId = await createGiftFixture(firstWishlist.id);
			await executeOperation(managerActor, shareGiftsOperation, {
				giftIds: [reservedGiftId],
				wishlistIds: [secondWishlist.id],
			});
			await getDb()
				.update(gift)
				.set({ createdAt: longAgo() })
				.where(eq(gift.linkGroupId, (await linkGroupIdOf(firstGiftId))!));
			const ordinaryGiftId = await createGiftFixture(firstWishlist.id);
			await reserve(reserverActor, reservedGiftId);
			await assignManager(firstWishlist.id, SIBLING_ID);
			const destinationWishlist = await recipientWishlist({ name: 'Někdo jiný' });
			await assignManager(destinationWishlist.id, SIBLING_ID);

			const move = await executeOperation(siblingActor, bulkCopyGiftsOperation, {
				sourceWishlistId: firstWishlist.id,
				destinationWishlistId: destinationWishlist.id,
				giftIds: [firstGiftId, reservedGiftId, ordinaryGiftId],
				removeUnreservedSources: true,
			});
			expect(move.removedSourceIds).toEqual([ordinaryGiftId]);
			expect((await readGift(firstGiftId)).deletedAt).toBeNull();
			expect((await readGift(reservedGiftId)).deletedAt).toBeNull();
		});

		it('applies the grace of every list to a recipient removing it from their own list', async () => {
			const { firstGiftId, secondGiftId } = await sharedPair({
				second: { sharedAt: longAgo() },
			});
			await getDb()
				.update(gift)
				.set({ createdAt: longAgo() })
				.where(eq(gift.id, secondGiftId));
			await reserve(reserverActor, secondGiftId);
			await expectRejection(
				executeOperation(recipientActor, deleteGiftOperation, { giftId: firstGiftId }),
				403,
				SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING,
			);
		});
	},
);
