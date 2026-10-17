import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_ID,
	RESERVER_NAME,
	SECOND_RESERVER_ID,
	captureError,
	createGiftFixture,
	createWishlistFixture,
	errorMessage,
	expectRejection,
	expectRejectionResult,
	managerActor,
	outsiderActor,
	recipientActor,
	raceBehindRowLock,
	removeFixtureRows,
	reserveGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { reservation } from '$lib/server/db/gift.schema.js';
import { moderatorAssignment, moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { executeOperation } from './runner.js';
import { OPERATION_CHANNEL, type OperationActor } from './actor.js';
import {
	cancelOwnReservationOperation,
	reserveGiftAsAnonymousVisitor,
	reserveGiftOperation,
	setReservationPurchasedOperation,
	unreserveGiftAsAnonymousVisitor,
	unreserveGiftOperation,
} from './reservation_operations.js';
import {
	readMyGiftReservationsOperation,
	readReservationLedgerOperation,
} from './reservation_read_operations.js';
import { readWishlistGiftsOperation } from './gift_read_operations.js';
import {
	acceptModeratorInviteOperation,
	generateModeratorInviteLinkOperation,
	readWishlistModeratorsOperation,
	removeModeratorOperation,
	revokeModeratorInviteOperation,
	selfPromoteToModeratorOperation,
} from './manager_invitation_operations.js';

const reserverActor: OperationActor = { ...outsiderActor, userId: RESERVER_ID, userName: 'Gifter' };
const secondReserverActor: OperationActor = { ...reserverActor, userId: SECOND_RESERVER_ID };
const administratorActor: OperationActor = { ...outsiderActor, isAppAdministrator: true };
/** The shared {@link managerActor} acts through an agent token; this one uses the app. */
const managerInterfaceActor: OperationActor = { ...managerActor, channel: OPERATION_CHANNEL.ui };
const GUEST_EMAIL = 'guest-gifter@example.com';
const GUEST_VISITOR_ID = 'guest-visitor-capability';

function reservationCancelledDispatches() {
	return vi
		.mocked(dispatchNotification)
		.mock.calls.filter(([payload]) => payload.type === NOTIFICATION_TYPE.RESERVATION_CANCELLED);
}

async function sharedWishlistWithGift(quantity = 1) {
	const wishlistFixture = await createWishlistFixture({ sharedAt: new Date() });
	const giftId = await createGiftFixture(wishlistFixture.id, { quantity });
	return { ...wishlistFixture, giftId };
}

async function reserveAsGuest(giftId: string, anonymousName = 'Teta Věra') {
	return reserveGiftAsAnonymousVisitor(
		{ giftId, quantity: 1, anonymousName, anonymousEmail: GUEST_EMAIL },
		() => GUEST_VISITOR_ID,
	);
}

async function activeReservations(giftId: string) {
	return getDb()
		.select()
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)));
}

async function activeModeratorUserIds(wishlistId: string) {
	const rows = await getDb()
		.select({ userId: moderatorAssignment.userId })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				isNull(moderatorAssignment.deletedAt),
			),
		);
	return rows.map((row) => row.userId);
}

async function managerAssignmentId(wishlistId: string, userId = MANAGER_ID): Promise<string> {
	const [row] = await getDb()
		.select({ id: moderatorAssignment.id })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				eq(moderatorAssignment.userId, userId),
			),
		);
	if (row === undefined) {
		throw new Error('Missing manager assignment');
	}
	return row.id;
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
describe.skipIf(!DB_READY)('reservation operations', () => {
	it('reserves for a signed-in gifter and lists it among their own reservations', async () => {
		const { giftId, id: wishlistId } = await sharedWishlistWithGift();
		await getDb()
			.insert(wishlistFollower)
			.values([
				{ wishlistId, userId: SECOND_RESERVER_ID },
				{ wishlistId, userId: RECIPIENT_ID },
			]);

		await executeOperation(reserverActor, reserveGiftOperation, { giftId, quantity: 1 });

		const mine = await executeOperation(reserverActor, readMyGiftReservationsOperation, {
			giftId,
		});
		expect(mine).toHaveLength(1);
		expect(vi.mocked(dispatchNotification)).toHaveBeenCalledWith(
			expect.objectContaining({
				type: NOTIFICATION_TYPE.GIFT_RESERVED,
				targetUserIds: [SECOND_RESERVER_ID],
			}),
		);
	});

	it('never lets the recipient reserve their own gifts', async () => {
		const { giftId } = await sharedWishlistWithGift();

		await expectRejection(
			executeOperation(recipientActor, reserveGiftOperation, { giftId, quantity: 1 }),
			403,
			SERVER_ERROR.RECIPIENT_CANNOT_RESERVE_OWN_GIFTS,
		);
	});

	it('never reserves more units than the gift has left', async () => {
		const { giftId } = await sharedWishlistWithGift(2);
		await executeOperation(reserverActor, reserveGiftOperation, { giftId, quantity: 1 });

		const thrown = await captureError(
			executeOperation(secondReserverActor, reserveGiftOperation, { giftId, quantity: 2 }),
		);

		expect(thrown).toMatchObject({ status: 400 });
		expect(JSON.parse(errorMessage(thrown))).toEqual({
			code: SERVER_ERROR.NOT_ENOUGH_AVAILABLE,
			available: 1,
		});
		expect(await activeReservations(giftId)).toHaveLength(1);
	});

	it('rejects reservations on an archived wishlist', async () => {
		const wishlistFixture = await createWishlistFixture({
			sharedAt: new Date(),
			status: 'archived',
		});
		const giftId = await createGiftFixture(wishlistFixture.id);

		await expectRejection(
			executeOperation(reserverActor, reserveGiftOperation, { giftId, quantity: 1 }),
			400,
			SERVER_ERROR.CANNOT_RESERVE_ON_ARCHIVED,
		);
	});

	it('lets a gifter cancel and mark bought only their own reservation', async () => {
		const { giftId } = await sharedWishlistWithGift(2);
		await reserveGift(giftId, SECOND_RESERVER_ID);
		const { reservationId } = await executeOperation(reserverActor, reserveGiftOperation, {
			giftId,
			quantity: 1,
		});
		const [othersReservation] = (await activeReservations(giftId)).filter(
			(row) => row.userId === SECOND_RESERVER_ID,
		);
		if (othersReservation === undefined) {
			throw new Error('Missing second reservation');
		}

		await expectRejection(
			executeOperation(reserverActor, setReservationPurchasedOperation, {
				reservationId: othersReservation.id,
				purchased: true,
			}),
			403,
			SERVER_ERROR.CANNOT_CANCEL_OTHERS_RESERVATION,
		);
		await expectRejection(
			executeOperation(reserverActor, cancelOwnReservationOperation, {
				reservationId: othersReservation.id,
			}),
			403,
			SERVER_ERROR.CANNOT_CANCEL_OTHERS_RESERVATION,
		);
		await expect(
			executeOperation(reserverActor, setReservationPurchasedOperation, {
				reservationId,
				purchased: true,
			}),
		).resolves.toMatchObject({ purchased: true });
		await executeOperation(reserverActor, cancelOwnReservationOperation, { reservationId });

		expect((await activeReservations(giftId)).map((row) => row.userId)).toEqual([
			SECOND_RESERVER_ID,
		]);
	});

	it('reserves for an anonymous visitor who alone may cancel it', async () => {
		const { giftId } = await sharedWishlistWithGift();

		await expectRejection(
			reserveGiftAsAnonymousVisitor(
				{ giftId, quantity: 1, anonymousName: '  ' },
				() => 'unused',
			),
			400,
			SERVER_ERROR.ANONYMOUS_NAME_REQUIRED,
		);
		const { reservationId } = await reserveAsGuest(giftId);
		await expectRejection(
			unreserveGiftAsAnonymousVisitor({ reservationId }, 'another-browser'),
			403,
			SERVER_ERROR.ANONYMOUS_CANNOT_CANCEL_RESERVATIONS,
		);
		await unreserveGiftAsAnonymousVisitor({ reservationId }, GUEST_VISITOR_ID);

		expect(await activeReservations(giftId)).toHaveLength(0);
	});

	it('mints the anonymous visitor cookie only for a reservation that is made', async () => {
		const { giftId: fullGiftId } = await sharedWishlistWithGift();
		await reserveGift(fullGiftId, RESERVER_ID);
		const { giftId: openGiftId } = await sharedWishlistWithGift();
		const claimVisitorId = vi.fn(() => GUEST_VISITOR_ID);

		await expectRejection(
			reserveGiftAsAnonymousVisitor(
				{ giftId: openGiftId, quantity: 1, anonymousName: '  ' },
				claimVisitorId,
			),
			400,
			SERVER_ERROR.ANONYMOUS_NAME_REQUIRED,
		);
		const overbooking = await captureError(
			reserveGiftAsAnonymousVisitor(
				{ giftId: fullGiftId, quantity: 1, anonymousName: 'Teta Věra' },
				claimVisitorId,
			),
		);
		expect(overbooking).toMatchObject({ status: 400 });
		expect(JSON.parse(errorMessage(overbooking))).toEqual({
			code: SERVER_ERROR.NOT_ENOUGH_AVAILABLE,
			available: 0,
		});
		expect(claimVisitorId).not.toHaveBeenCalled();

		await reserveGiftAsAnonymousVisitor(
			{ giftId: openGiftId, quantity: 1, anonymousName: 'Teta Věra' },
			claimVisitorId,
		);
		expect(claimVisitorId).toHaveBeenCalledTimes(1);
	});

	it('lets a správce release a guest reservation but only an administrator a signed-in one', async () => {
		const { giftId } = await sharedWishlistWithGift(2);
		const guest = await reserveAsGuest(giftId);
		const signedIn = await executeOperation(reserverActor, reserveGiftOperation, {
			giftId,
			quantity: 1,
		});

		await expectRejection(
			executeOperation(managerActor, unreserveGiftOperation, {
				reservationId: signedIn.reservationId,
			}),
			403,
			SERVER_ERROR.RELEASE_REQUIRES_ADMIN,
		);
		await expectRejection(
			executeOperation(recipientActor, unreserveGiftOperation, {
				reservationId: guest.reservationId,
			}),
			403,
			SERVER_ERROR.CANNOT_CANCEL_ANONYMOUS_RESERVATION,
		);
		await expectRejection(
			executeOperation(outsiderActor, unreserveGiftOperation, {
				reservationId: guest.reservationId,
			}),
			403,
			SERVER_ERROR.CANNOT_CANCEL_ANONYMOUS_RESERVATION,
		);
		await executeOperation(managerActor, unreserveGiftOperation, {
			reservationId: guest.reservationId,
		});
		await executeOperation(administratorActor, unreserveGiftOperation, {
			reservationId: signedIn.reservationId,
		});

		expect(await activeReservations(giftId)).toHaveLength(0);
		expect(vi.mocked(dispatchNotification)).toHaveBeenCalledWith(
			expect.objectContaining({
				type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
				targetUserIds: [RESERVER_ID],
			}),
		);
	});

	it('keeps reservations from the recipient and guest emails from managers', async () => {
		const { giftId, shortId } = await sharedWishlistWithGift(2);
		await reserveAsGuest(giftId, 'Teta Věra');
		await reserveGift(giftId, RESERVER_ID);
		expect(
			(await activeReservations(giftId)).find((row) => row.anonymousName === 'Teta Věra')
				?.anonymousEmail,
		).toBe(GUEST_EMAIL);

		const recipientGifts = await executeOperation(recipientActor, readWishlistGiftsOperation, {
			wishlistShortId: shortId,
		});
		const visitorGifts = await executeOperation(
			secondReserverActor,
			readWishlistGiftsOperation,
			{ wishlistShortId: shortId },
		);
		const recipientLedger = await executeOperation(
			recipientActor,
			readReservationLedgerOperation,
			{ wishlistShortId: shortId },
		);
		const managerLedger = await executeOperation(managerActor, readReservationLedgerOperation, {
			wishlistShortId: shortId,
		});
		const managerGifts = await executeOperation(managerActor, readWishlistGiftsOperation, {
			wishlistShortId: shortId,
		});

		expect(recipientGifts.gifts.map((recipientGift) => recipientGift.id)).toEqual([giftId]);
		for (const recipientGift of recipientGifts.gifts) {
			expect(recipientGift).not.toHaveProperty('reservedCount');
			expect(recipientGift).not.toHaveProperty('reserverNames');
		}
		expect(managerGifts.gifts).toEqual([
			expect.objectContaining({ id: giftId, reservedCount: 2, isFullyReserved: true }),
		]);
		expect(visitorGifts.gifts).toEqual([
			expect.objectContaining({ id: giftId, reservedCount: 2, isFullyReserved: true }),
		]);
		expect(recipientLedger.reservationsByGiftId).toEqual({});
		expect(managerLedger.reservationsByGiftId[giftId]?.map((row) => row.displayName)).toEqual([
			'Teta Věra',
			RESERVER_NAME,
		]);
		expect(JSON.stringify([managerLedger, managerGifts])).not.toContain(GUEST_EMAIL);
	});

	it('lets only one of a concurrent cancel and release end a reservation', async () => {
		const { giftId } = await sharedWishlistWithGift();
		const { reservationId } = await reserveAsGuest(giftId);

		const results = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: reservation.id })
					.from(reservation)
					.where(eq(reservation.id, reservationId))
					.for('update'),
			[
				() => unreserveGiftAsAnonymousVisitor({ reservationId }, GUEST_VISITOR_ID),
				() => executeOperation(managerActor, unreserveGiftOperation, { reservationId }),
			],
		);

		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		const [rejected] = results.filter((result) => result.status === 'rejected');
		if (rejected === undefined) {
			throw new Error('Expected one rejection');
		}
		expectRejectionResult(rejected, 404, SERVER_ERROR.RESERVATION_NOT_FOUND);
		expect(await activeReservations(giftId)).toHaveLength(0);
		expect(reservationCancelledDispatches().length).toBeLessThanOrEqual(1);
	});
});

describe.skipIf(!DB_READY)('manager invitation operations', () => {
	async function inviteLink(actor: OperationActor, wishlistId: string, email?: string) {
		return executeOperation(actor, generateModeratorInviteLinkOperation, { wishlistId, email });
	}

	async function inviteToken(actor: OperationActor, wishlistId: string): Promise<string> {
		const { link } = await inviteLink(actor, wishlistId);
		if (link === null) {
			throw new Error('Expected an invite link');
		}
		return link.token;
	}

	async function pendingInviteTokens(wishlistId: string): Promise<string[]> {
		const { pendingInvites } = await executeOperation(
			recipientActor,
			readWishlistModeratorsOperation,
			{ wishlistId },
		);
		return pendingInvites.map((invite) => invite.token);
	}

	it('lets the recipient and a správce invite, never an outsider', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });

		await expectRejection(
			inviteLink(outsiderActor, wishlistId),
			403,
			SERVER_ERROR.ACCESS_DENIED,
		);
		await expect(inviteLink(recipientActor, wishlistId)).resolves.toMatchObject({
			unregisteredInvitee: false,
		});
		const emailed = await inviteLink(
			managerInterfaceActor,
			wishlistId,
			'nobody-yet@example.com',
		);

		expect(emailed.unregisteredInvitee).toBe(true);
		expect(vi.mocked(dispatchNotification)).toHaveBeenCalledWith(
			expect.objectContaining({
				type: NOTIFICATION_TYPE.MODERATOR_INVITED,
				targetEmails: ['nobody-yet@example.com'],
				urlPathOverride: emailed.link?.invitePath,
			}),
		);
	});

	it('returns the invite link in the app, with or without an email', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });

		const linkOnly = await inviteLink(managerInterfaceActor, wishlistId);
		const emailed = await inviteLink(managerInterfaceActor, wishlistId, 'invitee@example.com');

		expect(new Set(await pendingInviteTokens(wishlistId))).toEqual(
			new Set([linkOnly.link?.token, emailed.link?.token]),
		);
		expect(vi.mocked(dispatchNotification)).toHaveBeenCalledTimes(1);
	});

	it('lets an agent invite only by the exact email, never handing it the link', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });

		await expectRejection(
			inviteLink(managerActor, wishlistId),
			400,
			SERVER_ERROR.INVALID_OPERATION_INPUT,
		);
		expect(await pendingInviteTokens(wishlistId)).toEqual([]);
		const invited = await inviteLink(managerActor, wishlistId, 'invitee@example.com');
		const [token] = await pendingInviteTokens(wishlistId);

		expect(invited).toEqual({
			inviteId: expect.any(String),
			link: null,
			unregisteredInvitee: true,
		});
		expect(token).toBeDefined();
		expect(JSON.stringify(invited)).not.toContain(token);
		expect(vi.mocked(dispatchNotification)).toHaveBeenCalledWith(
			expect.objectContaining({
				type: NOTIFICATION_TYPE.MODERATOR_INVITED,
				targetEmails: ['invitee@example.com'],
				urlPathOverride: expect.stringContaining(`/invite/${token}`),
			}),
		);
	});

	it('makes the invitee a správce once, never the recipient', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });
		const token = await inviteToken(managerInterfaceActor, wishlistId);

		await expectRejection(
			executeOperation(recipientActor, acceptModeratorInviteOperation, { token }),
			400,
			SERVER_ERROR.RECIPIENT_CANNOT_ACCEPT_OWN_INVITE,
		);
		await executeOperation(outsiderActor, acceptModeratorInviteOperation, { token });
		await expectRejection(
			executeOperation(reserverActor, acceptModeratorInviteOperation, { token }),
			400,
			SERVER_ERROR.INVITE_ALREADY_USED,
		);

		expect((await activeModeratorUserIds(wishlistId)).sort()).toEqual(
			[MANAGER_ID, outsiderActor.userId].sort(),
		);
	});

	it('accepts one invite once when two people accept it at the same time', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });
		const token = await inviteToken(recipientActor, wishlistId);

		const results = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: moderatorInvite.id })
					.from(moderatorInvite)
					.where(eq(moderatorInvite.token, token))
					.for('update'),
			[
				() => executeOperation(outsiderActor, acceptModeratorInviteOperation, { token }),
				() => executeOperation(reserverActor, acceptModeratorInviteOperation, { token }),
			],
		);

		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		const [rejected] = results.filter((result) => result.status === 'rejected');
		if (rejected === undefined) {
			throw new Error('Expected one rejection');
		}
		expectRejectionResult(rejected, 400, SERVER_ERROR.INVITE_ALREADY_USED);
		const newModeratorUserIds = (await activeModeratorUserIds(wishlistId)).filter(
			(userId) => userId !== MANAGER_ID,
		);
		expect(newModeratorUserIds).toHaveLength(1);
	});

	it('lets only managers revoke a pending invite, which then cannot be accepted', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });
		const token = await inviteToken(recipientActor, wishlistId);
		const { pendingInvites } = await executeOperation(
			managerActor,
			readWishlistModeratorsOperation,
			{ wishlistId },
		);
		const inviteId = pendingInvites[0]?.id ?? '';

		await expectRejection(
			executeOperation(outsiderActor, revokeModeratorInviteOperation, { inviteId }),
			403,
			SERVER_ERROR.ACCESS_DENIED,
		);
		await executeOperation(managerActor, revokeModeratorInviteOperation, { inviteId });
		await expectRejection(
			executeOperation(outsiderActor, acceptModeratorInviteOperation, { token }),
			400,
			SERVER_ERROR.INVITE_ALREADY_REVOKED,
		);
	});

	it('shows the správci panel to managers only', async () => {
		const { id: wishlistId } = await createWishlistFixture();

		await expectRejection(
			executeOperation(outsiderActor, readWishlistModeratorsOperation, { wishlistId }),
			403,
			SERVER_ERROR.ACCESS_DENIED,
		);
		const panel = await executeOperation(recipientActor, readWishlistModeratorsOperation, {
			wishlistId,
		});
		expect(panel.moderators.map((moderator) => moderator.userId)).toEqual([MANAGER_ID]);
	});

	it('lets managers remove a správce but keeps the last one of a for-someone list', async () => {
		const linked = await createWishlistFixture();
		const forSomeone = await createWishlistFixture();
		await getDb()
			.update(wishlist)
			.set({ recipientUserId: null, recipientName: 'Babička' })
			.where(eq(wishlist.id, forSomeone.id));

		await expectRejection(
			executeOperation(outsiderActor, removeModeratorOperation, {
				assignmentId: await managerAssignmentId(linked.id),
			}),
			403,
			SERVER_ERROR.ACCESS_DENIED,
		);
		await expectRejection(
			executeOperation(managerActor, removeModeratorOperation, {
				assignmentId: await managerAssignmentId(forSomeone.id),
			}),
			403,
			SERVER_ERROR.CANNOT_REMOVE_LAST_MANAGER,
		);
		await executeOperation(recipientActor, removeModeratorOperation, {
			assignmentId: await managerAssignmentId(linked.id),
		});

		expect(await activeModeratorUserIds(linked.id)).toEqual([]);
		expect(await activeModeratorUserIds(forSomeone.id)).toEqual([MANAGER_ID]);
	});

	it('removes a správce once when two managers remove them at the same time', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		await getDb()
			.insert(moderatorAssignment)
			.values({ wishlistId, userId: outsiderActor.userId });
		const assignmentId = await managerAssignmentId(wishlistId, outsiderActor.userId);

		const results = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: wishlist.id })
					.from(wishlist)
					.where(eq(wishlist.id, wishlistId))
					.for('update'),
			[
				() => executeOperation(recipientActor, removeModeratorOperation, { assignmentId }),
				() => executeOperation(managerActor, removeModeratorOperation, { assignmentId }),
			],
		);

		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		const [rejected] = results.filter((result) => result.status === 'rejected');
		if (rejected === undefined) {
			throw new Error('Expected one rejection');
		}
		expectRejectionResult(rejected, 404, SERVER_ERROR.MODERATOR_NOT_FOUND);
		expect(await activeModeratorUserIds(wishlistId)).toEqual([MANAGER_ID]);
	});

	it('keeps a správce on a for-someone list when two správci remove each other at once', async () => {
		const forSomeone = await createWishlistFixture();
		await getDb()
			.update(wishlist)
			.set({ recipientUserId: null, recipientName: 'Babička' })
			.where(eq(wishlist.id, forSomeone.id));
		await getDb()
			.insert(moderatorAssignment)
			.values({ wishlistId: forSomeone.id, userId: outsiderActor.userId });
		const managerAssignment = await managerAssignmentId(forSomeone.id);
		const outsiderAssignment = await managerAssignmentId(forSomeone.id, outsiderActor.userId);

		const results = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: wishlist.id })
					.from(wishlist)
					.where(eq(wishlist.id, forSomeone.id))
					.for('update'),
			[
				() =>
					executeOperation(managerActor, removeModeratorOperation, {
						assignmentId: outsiderAssignment,
					}),
				() =>
					executeOperation(outsiderActor, removeModeratorOperation, {
						assignmentId: managerAssignment,
					}),
			],
		);

		expect(results.some((result) => result.status === 'rejected')).toBe(true);
		expect((await activeModeratorUserIds(forSomeone.id)).length).toBeGreaterThanOrEqual(1);
	});

	it('lets only the linked recipient opt into seeing reservations, once', async () => {
		const { id: wishlistId, shortId } = await createWishlistFixture({ sharedAt: new Date() });
		const giftId = await createGiftFixture(wishlistId);
		await reserveGift(giftId, RESERVER_ID);

		await expectRejection(
			executeOperation(managerActor, selfPromoteToModeratorOperation, { wishlistId }),
			403,
			SERVER_ERROR.ACCESS_DENIED,
		);
		await executeOperation(recipientActor, selfPromoteToModeratorOperation, { wishlistId });
		await expectRejection(
			executeOperation(recipientActor, selfPromoteToModeratorOperation, { wishlistId }),
			400,
			SERVER_ERROR.ALREADY_SEEING_RESERVATIONS,
		);

		// Self-promotion reveals reservation state and counts, never gifter identities.
		const recipientGifts = await executeOperation(recipientActor, readWishlistGiftsOperation, {
			wishlistShortId: shortId,
		});
		const recipientLedger = await executeOperation(
			recipientActor,
			readReservationLedgerOperation,
			{ wishlistShortId: shortId },
		);
		expect(recipientGifts.gifts).toEqual([
			expect.objectContaining({ id: giftId, reservedCount: 1, reserverNames: [] }),
		]);
		expect(recipientLedger.reservationsByGiftId).toEqual({});
	});
});
