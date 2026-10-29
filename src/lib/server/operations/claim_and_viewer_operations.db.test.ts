import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_ID,
	createGiftFixture,
	createWishlistFixture,
	expectRejection,
	expectRejectionResult,
	managerActor,
	outsiderActor,
	raceBehindRowLock,
	recipientActor,
	removeFixtureRows,
	reserveGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { claimInvite } from '$lib/server/db/claim.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { wishlistVisit } from '$lib/server/db/wishlist_visit.schema.js';
import { gift, giftLike } from '$lib/server/db/gift.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	RESERVATION_RELEASE_CAPABILITY,
	REVERT_CAPABILITY,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import { executeOperation } from './runner.js';
import { OPERATION_CHANNEL, type OperationActor } from './actor.js';
import {
	acceptClaimInviteOperation,
	generateClaimInviteLinkOperation,
	readClaimInvitesOperation,
	revokeClaimInviteOperation,
} from './claim_invite_operations.js';
import {
	followWishlistOperation,
	recordWishlistVisitOperation,
	refollowWishlistOperation,
	unfollowWishlistOperation,
} from './wishlist_follow_operations.js';
import { readWishlistOperation } from './wishlist_read_operations.js';
import {
	readGiftCategoriesOperation,
	readGiftCategorySettingsRowsOperation,
} from './gift_grouping_operations.js';
import { toggleGiftLikeOperation } from './gift_like_operations.js';

/** A signed-in person who is neither the recipient nor a správce of the fixture lists. */
const claimerActor: OperationActor = { ...outsiderActor, userId: RESERVER_ID, userName: 'Klára' };
const managerInterfaceActor: OperationActor = { ...managerActor, channel: OPERATION_CHANNEL.ui };
const administratorActor: OperationActor = { ...outsiderActor, isAppAdministrator: true };

/** A list for a free-text recipient, managed by {@link MANAGER_ID}: the only kind with a claim. */
async function createForSomeoneWishlist(options: { sharedAt?: Date | null } = {}) {
	const fixture = await createWishlistFixture(options);
	await getDb()
		.update(wishlist)
		.set({ recipientUserId: null, recipientName: 'Babička' })
		.where(eq(wishlist.id, fixture.id));
	return fixture;
}

async function claimToken(wishlistId: string): Promise<string> {
	const { token } = await executeOperation(
		managerInterfaceActor,
		generateClaimInviteLinkOperation,
		{ wishlistId },
	);
	return token;
}

function lockWishlistRow(transaction: DatabaseTransaction, wishlistId: string) {
	return transaction
		.select({ id: wishlist.id })
		.from(wishlist)
		.where(eq(wishlist.id, wishlistId))
		.for('update');
}

/** Holds the wishlist the way claims and archiving change it: locked FOR UPDATE, then updated. */
function lockAndUpdateWishlist(wishlistId: string, values: Partial<typeof wishlist.$inferInsert>) {
	return async (transaction: DatabaseTransaction) => {
		await lockWishlistRow(transaction, wishlistId);
		await transaction.update(wishlist).set(values).where(eq(wishlist.id, wishlistId));
	};
}

function expectAllFulfilled(results: readonly PromiseSettledResult<unknown>[]): unknown[] {
	return results.map((result) => {
		if (result.status === 'rejected') {
			throw result.reason;
		}
		return result.value;
	});
}

async function readWishlistRow(wishlistId: string) {
	const [row] = await getDb().select().from(wishlist).where(eq(wishlist.id, wishlistId));
	return row;
}

async function followerRow(wishlistId: string, userId: string) {
	const [row] = await getDb()
		.select()
		.from(wishlistFollower)
		.where(
			and(eq(wishlistFollower.wishlistId, wishlistId), eq(wishlistFollower.userId, userId)),
		);
	return row;
}

async function visitRow(wishlistId: string, userId: string) {
	const [row] = await getDb()
		.select()
		.from(wishlistVisit)
		.where(and(eq(wishlistVisit.wishlistId, wishlistId), eq(wishlistVisit.userId, userId)));
	return row;
}

function dispatchesOfType(type: string) {
	return vi.mocked(dispatchNotification).mock.calls.filter(([payload]) => payload.type === type);
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

describe.skipIf(!DB_READY)('claim invite operations', () => {
	it('lets any manager of a for-someone list issue and email a claim link, never an outsider', async () => {
		const { id: wishlistId, shortId } = await createForSomeoneWishlist({
			sharedAt: new Date(),
		});

		await expectRejection(
			executeOperation(outsiderActor, generateClaimInviteLinkOperation, { wishlistId }),
			403,
			SERVER_ERROR.ACCESS_DENIED,
		);
		const emailed = await executeOperation(
			managerInterfaceActor,
			generateClaimInviteLinkOperation,
			{ wishlistId, email: 'babicka@example.com' },
		);

		expect(emailed.claimPath).toBe(`/w/${shortId}/claim/${emailed.token}`);
		expect(emailed.unregisteredInvitee).toBe(true);
		expect(dispatchesOfType(NOTIFICATION_TYPE.CLAIM_INVITED)).toEqual([
			[
				expect.objectContaining({
					targetEmails: ['babicka@example.com'],
					urlPathOverride: emailed.claimPath,
				}),
			],
		]);
	});

	it('issues no claim link for a linked recipient or on an archived list', async () => {
		const linked = await createWishlistFixture({ sharedAt: new Date() });
		const archived = await createForSomeoneWishlist({ sharedAt: new Date() });
		await getDb()
			.update(wishlist)
			.set({ status: 'archived' })
			.where(eq(wishlist.id, archived.id));

		await expectRejection(
			executeOperation(recipientActor, generateClaimInviteLinkOperation, {
				wishlistId: linked.id,
			}),
			400,
			SERVER_ERROR.CLAIM_NOT_FOR_LINKED_RECIPIENT,
		);
		await expectRejection(
			executeOperation(managerInterfaceActor, generateClaimInviteLinkOperation, {
				wishlistId: archived.id,
			}),
			400,
			SERVER_ERROR.CANNOT_INVITE_ON_ARCHIVED,
		);
	});

	it('shows pending claim links to managers only', async () => {
		const { id: wishlistId } = await createForSomeoneWishlist();
		const token = await claimToken(wishlistId);

		await expectRejection(
			executeOperation(outsiderActor, readClaimInvitesOperation, { wishlistId }),
			403,
			SERVER_ERROR.ACCESS_DENIED,
		);
		const panel = await executeOperation(managerActor, readClaimInvitesOperation, {
			wishlistId,
		});

		expect(panel.pendingInvites.map((invite) => invite.token)).toEqual([token]);
		expect(panel).toMatchObject({ isForSomeoneElse: true, recipientName: 'Babička' });
	});

	it('links the claimer as recipient, clears the free-text name and notifies správci in-app', async () => {
		const { id: wishlistId, shortId } = await createForSomeoneWishlist({
			sharedAt: new Date(),
		});
		await getDb().insert(wishlistFollower).values({ wishlistId, userId: RESERVER_ID });
		const token = await claimToken(wishlistId);

		const claimed = await executeOperation(claimerActor, acceptClaimInviteOperation, { token });

		expect(claimed).toMatchObject({ wishlistId, wishlistShortId: shortId });
		expect(await readWishlistRow(wishlistId)).toMatchObject({
			recipientUserId: RESERVER_ID,
			recipientName: null,
		});
		const view = await executeOperation(claimerActor, readWishlistOperation, {
			wishlistShortId: shortId,
		});
		expect(view.role).toBe('recipient');
		expect((await followerRow(wishlistId, RESERVER_ID))?.unfollowedAt).not.toBeNull();
		expect(dispatchesOfType(NOTIFICATION_TYPE.RECIPIENT_CLAIMED)).toEqual([
			[expect.objectContaining({ targetUserIds: [MANAGER_ID], actorId: RESERVER_ID })],
		]);
		await expectRejection(
			executeOperation(outsiderActor, acceptClaimInviteOperation, { token }),
			400,
			SERVER_ERROR.INVITE_ALREADY_USED,
		);
	});

	it('rejects a claimer holding reservations or with any správce history on a shared list', async () => {
		const reserved = await createForSomeoneWishlist({ sharedAt: new Date() });
		await reserveGift(await createGiftFixture(reserved.id), RESERVER_ID);
		const formerlyManaged = await createForSomeoneWishlist({ sharedAt: new Date() });
		await getDb().insert(moderatorAssignment).values({
			wishlistId: formerlyManaged.id,
			userId: RESERVER_ID,
			deletedAt: new Date(),
		});

		await expectRejection(
			executeOperation(claimerActor, acceptClaimInviteOperation, {
				token: await claimToken(reserved.id),
			}),
			400,
			SERVER_ERROR.CLAIM_HAS_RESERVATIONS,
		);
		await expectRejection(
			executeOperation(claimerActor, acceptClaimInviteOperation, {
				token: await claimToken(formerlyManaged.id),
			}),
			400,
			SERVER_ERROR.CLAIM_EX_MANAGER,
		);
		expect((await readWishlistRow(reserved.id))?.recipientUserId).toBeNull();
		expect((await readWishlistRow(formerlyManaged.id))?.recipientUserId).toBeNull();
		expect(dispatchesOfType(NOTIFICATION_TYPE.RECIPIENT_CLAIMED)).toEqual([]);
	});

	it('claims a list once when two people accept the same link at the same time', async () => {
		const { id: wishlistId } = await createForSomeoneWishlist({ sharedAt: new Date() });
		const token = await claimToken(wishlistId);

		const results = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: claimInvite.id })
					.from(claimInvite)
					.where(eq(claimInvite.token, token))
					.for('update'),
			[
				() => executeOperation(claimerActor, acceptClaimInviteOperation, { token }),
				() => executeOperation(outsiderActor, acceptClaimInviteOperation, { token }),
			],
		);

		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		const [rejected] = results.filter((result) => result.status === 'rejected');
		if (rejected === undefined) {
			throw new Error('Expected one rejection');
		}
		expectRejectionResult(rejected, 400, SERVER_ERROR.INVITE_ALREADY_USED);
		expect([RESERVER_ID, outsiderActor.userId]).toContain(
			(await readWishlistRow(wishlistId))?.recipientUserId,
		);
	});

	it('rejects an unknown claim link and any further link once the list is claimed', async () => {
		const { id: wishlistId } = await createForSomeoneWishlist({ sharedAt: new Date() });
		const firstToken = await claimToken(wishlistId);
		const secondToken = await claimToken(wishlistId);
		await executeOperation(claimerActor, acceptClaimInviteOperation, { token: firstToken });

		await expectRejection(
			executeOperation(claimerActor, acceptClaimInviteOperation, { token: 'no-such-token' }),
			404,
			SERVER_ERROR.INVITE_NOT_FOUND,
		);
		await expectRejection(
			executeOperation(outsiderActor, acceptClaimInviteOperation, { token: secondToken }),
			400,
			SERVER_ERROR.CLAIM_ALREADY_LINKED,
		);
		expect((await readWishlistRow(wishlistId))?.recipientUserId).toBe(RESERVER_ID);
	});

	it('turns a správce claiming a never-shared list into the recipient, never also a správce', async () => {
		const { id: wishlistId, shortId } = await createForSomeoneWishlist();
		const token = await claimToken(wishlistId);

		await executeOperation(managerInterfaceActor, acceptClaimInviteOperation, { token });

		expect(await readWishlistRow(wishlistId)).toMatchObject({
			recipientUserId: MANAGER_ID,
			recipientIsModerator: false,
		});
		const [assignment] = await getDb()
			.select({ deletedAt: moderatorAssignment.deletedAt })
			.from(moderatorAssignment)
			.where(
				and(
					eq(moderatorAssignment.wishlistId, wishlistId),
					eq(moderatorAssignment.userId, MANAGER_ID),
				),
			);
		expect(assignment?.deletedAt).not.toBeNull();
		expect(
			(
				await executeOperation(managerInterfaceActor, readWishlistOperation, {
					wishlistShortId: shortId,
				})
			).role,
		).toBe('recipient');
	});

	it('lets only managers revoke a claim link, which then cannot be claimed', async () => {
		const { id: wishlistId } = await createForSomeoneWishlist();
		const token = await claimToken(wishlistId);
		const { pendingInvites } = await executeOperation(managerActor, readClaimInvitesOperation, {
			wishlistId,
		});
		const inviteId = pendingInvites[0]?.id ?? '';

		await expectRejection(
			executeOperation(outsiderActor, revokeClaimInviteOperation, { inviteId }),
			403,
			SERVER_ERROR.ACCESS_DENIED,
		);
		await executeOperation(managerInterfaceActor, revokeClaimInviteOperation, { inviteId });
		await expectRejection(
			executeOperation(claimerActor, acceptClaimInviteOperation, { token }),
			400,
			SERVER_ERROR.INVITE_ALREADY_REVOKED,
		);
	});
});

describe.skipIf(!DB_READY)('follow and visit operations', () => {
	it('records every signed-in visit but auto-follows only a first-time visitor', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });

		for (const actor of [recipientActor, managerActor, outsiderActor]) {
			await executeOperation(actor, recordWishlistVisitOperation, { wishlistId });
		}

		for (const userId of [RECIPIENT_ID, MANAGER_ID, outsiderActor.userId]) {
			expect(await visitRow(wishlistId, userId)).toBeDefined();
		}
		expect(await followerRow(wishlistId, RECIPIENT_ID)).toBeUndefined();
		expect(await followerRow(wishlistId, MANAGER_ID)).toBeUndefined();
		expect(await followerRow(wishlistId, outsiderActor.userId)).toMatchObject({
			unfollowedAt: null,
		});
	});

	it('keeps an unfollowed list unfollowed on later visits until the visitor follows again', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });
		await executeOperation(outsiderActor, recordWishlistVisitOperation, { wishlistId });

		await executeOperation(outsiderActor, unfollowWishlistOperation, { wishlistId });
		await executeOperation(outsiderActor, recordWishlistVisitOperation, { wishlistId });
		expect((await followerRow(wishlistId, outsiderActor.userId))?.unfollowedAt).not.toBeNull();
		await executeOperation(outsiderActor, refollowWishlistOperation, { wishlistId });

		expect((await followerRow(wishlistId, outsiderActor.userId))?.unfollowedAt).toBeNull();
	});

	it('never makes the linked recipient a follower of their own list', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });

		const recipientFollow = await executeOperation(recipientActor, followWishlistOperation, {
			wishlistId,
		});
		const visitorFollow = await executeOperation(outsiderActor, followWishlistOperation, {
			wishlistId,
		});
		const repeatedFollow = await executeOperation(outsiderActor, followWishlistOperation, {
			wishlistId,
		});

		expect(recipientFollow).toEqual({ followed: false, alreadyFollowing: false });
		expect(await followerRow(wishlistId, RECIPIENT_ID)).toBeUndefined();
		expect(visitorFollow).toEqual({ followed: true, alreadyFollowing: false });
		expect(repeatedFollow).toEqual({ followed: false, alreadyFollowing: true });
	});

	it('never makes a viewer a follower of a list they claim while the visit waits', async () => {
		const { id: wishlistId } = await createForSomeoneWishlist({ sharedAt: new Date() });

		const results = await raceBehindRowLock(
			lockAndUpdateWishlist(wishlistId, {
				recipientUserId: RESERVER_ID,
				recipientName: null,
			}),
			[
				() => executeOperation(claimerActor, recordWishlistVisitOperation, { wishlistId }),
				() => executeOperation(claimerActor, followWishlistOperation, { wishlistId }),
			],
		);

		const [, followResult] = expectAllFulfilled(results);
		expect(followResult).toEqual({ followed: false, alreadyFollowing: false });
		expect(await followerRow(wishlistId, RESERVER_ID)).toBeUndefined();
	});

	it('follows once when the same person follows twice at the same time', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });
		const follow = () =>
			executeOperation(outsiderActor, followWishlistOperation, { wishlistId });

		// The follower insert's foreign key waits on the held user row, so both requests find no
		// follower before either inserts one.
		const results = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: user.id })
					.from(user)
					.where(eq(user.id, outsiderActor.userId))
					.for('update'),
			[follow, follow],
		);

		expect(expectAllFulfilled(results)).toEqual(
			expect.arrayContaining([
				{ followed: true, alreadyFollowing: false },
				{ followed: false, alreadyFollowing: true },
			]),
		);
		expect(await followerRow(wishlistId, outsiderActor.userId)).toMatchObject({
			unfollowedAt: null,
		});
	});

	it('follows draft and archived lists through their permanent link, never deleted ones', async () => {
		const draft = await createWishlistFixture();
		const archived = await createWishlistFixture({ sharedAt: new Date(), status: 'archived' });
		const deleted = await createWishlistFixture({ sharedAt: new Date() });
		await getDb()
			.update(wishlist)
			.set({ deletedAt: new Date() })
			.where(eq(wishlist.id, deleted.id));

		for (const wishlistId of [draft.id, archived.id]) {
			await executeOperation(outsiderActor, recordWishlistVisitOperation, { wishlistId });
			expect(await followerRow(wishlistId, outsiderActor.userId)).toBeDefined();
		}
		await expectRejection(
			executeOperation(outsiderActor, recordWishlistVisitOperation, {
				wishlistId: deleted.id,
			}),
			404,
			'Wishlist not found',
		);
		await expectRejection(
			executeOperation(outsiderActor, followWishlistOperation, { wishlistId: deleted.id }),
			404,
			'Wishlist not found',
		);
		expect(await visitRow(deleted.id, outsiderActor.userId)).toBeUndefined();
	});
});

describe.skipIf(!DB_READY)('read wishlist operation', () => {
	async function reservedSharedWishlist() {
		const fixture = await createWishlistFixture({ sharedAt: new Date() });
		await reserveGift(await createGiftFixture(fixture.id), RESERVER_ID);
		return fixture;
	}

	function readAs(actor: OperationActor | null, wishlistShortId: string) {
		return executeOperation(actor, readWishlistOperation, { wishlistShortId });
	}

	it('resolves each viewer role, signed in or anonymous', async () => {
		const { shortId } = await createWishlistFixture({ sharedAt: new Date() });

		expect((await readAs(recipientActor, shortId)).role).toBe('recipient');
		expect((await readAs(managerActor, shortId)).role).toBe('moderator');
		expect((await readAs(outsiderActor, shortId)).role).toBe('visitor');
		expect((await readAs(null, shortId)).role).toBe('visitor');
	});

	it('never tells the recipient, even an administrator recipient, whether reservations exist', async () => {
		const unreserved = await createWishlistFixture({ sharedAt: new Date() });
		const reserved = await reservedSharedWishlist();
		const administratorRecipient: OperationActor = {
			...recipientActor,
			isAppAdministrator: true,
		};

		for (const actor of [recipientActor, administratorRecipient]) {
			for (const { shortId } of [unreserved, reserved]) {
				expect(await readAs(actor, shortId)).toMatchObject({
					revertCapability: REVERT_CAPABILITY.hidden,
					reservationReleaseCapability: RESERVATION_RELEASE_CAPABILITY.none,
				});
			}
		}
	});

	it('lets a správce revert only a reservation-free list and an administrator a reserved one', async () => {
		const unreserved = await createWishlistFixture({ sharedAt: new Date() });
		const reserved = await reservedSharedWishlist();

		expect(await readAs(managerActor, unreserved.shortId)).toMatchObject({
			revertCapability: REVERT_CAPABILITY.clean,
			reservationReleaseCapability: RESERVATION_RELEASE_CAPABILITY.guestOnly,
		});
		expect((await readAs(managerActor, reserved.shortId)).revertCapability).toBe(
			REVERT_CAPABILITY.reservedBlocked,
		);
		expect(await readAs(administratorActor, reserved.shortId)).toMatchObject({
			role: 'visitor',
			revertCapability: REVERT_CAPABILITY.reservedAdmin,
			reservationReleaseCapability: RESERVATION_RELEASE_CAPABILITY.any,
		});
		expect((await readAs(outsiderActor, reserved.shortId)).revertCapability).toBe(
			REVERT_CAPABILITY.hidden,
		);
	});

	it('names every správce, including a self-promoted recipient', async () => {
		const plain = await createWishlistFixture();
		const selfPromoted = await createWishlistFixture({ recipientIsModerator: true });

		expect((await readAs(null, plain.shortId)).managerNames).toEqual(['Manager']);
		expect((await readAs(null, selfPromoted.shortId)).managerNames).toEqual([
			'Recipient',
			'Manager',
		]);
	});

	it('does not find a deleted wishlist', async () => {
		const { id, shortId } = await createWishlistFixture({ sharedAt: new Date() });
		await getDb().update(wishlist).set({ deletedAt: new Date() }).where(eq(wishlist.id, id));

		await expectRejection(readAs(managerActor, shortId), 404, 'Wishlist not found');
	});
});

describe.skipIf(!DB_READY)('gift category reads', () => {
	it('show categories with their settings rows to managers only', async () => {
		const { id: wishlistId } = await createWishlistFixture();

		for (const operation of [
			readGiftCategoriesOperation,
			readGiftCategorySettingsRowsOperation,
		]) {
			await expectRejection(
				executeOperation(outsiderActor, operation, { wishlistId }),
				403,
				SERVER_ERROR.ACCESS_DENIED,
			);
		}
		const categories = await executeOperation(recipientActor, readGiftCategoriesOperation, {
			wishlistId,
		});
		const settingsRows = await executeOperation(
			managerActor,
			readGiftCategorySettingsRowsOperation,
			{ wishlistId },
		);

		expect(categories.length).toBeGreaterThan(0);
		expect(settingsRows.filter((row) => row.enabled).map((row) => row.id)).toEqual(
			categories.map((category) => category.id),
		);
	});
});

describe.skipIf(!DB_READY)('gift like operation', () => {
	function toggleLike(actor: OperationActor, giftId: string) {
		return executeOperation(actor, toggleGiftLikeOperation, { giftId });
	}

	async function activeLikeCount(giftId: string): Promise<number> {
		const activeLikes = await getDb()
			.select({ id: giftLike.id })
			.from(giftLike)
			.where(and(eq(giftLike.giftId, giftId), isNull(giftLike.deletedAt)));
		return activeLikes.length;
	}

	it('lets visitors and správci like, unlike and like a gift again', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });
		const giftId = await createGiftFixture(wishlistId);

		expect(await toggleLike(outsiderActor, giftId)).toEqual({ liked: true, likeCount: 1 });
		expect(await toggleLike(managerActor, giftId)).toEqual({ liked: true, likeCount: 2 });
		expect(await toggleLike(outsiderActor, giftId)).toEqual({ liked: false, likeCount: 1 });
		expect(await toggleLike(outsiderActor, giftId)).toEqual({ liked: true, likeCount: 2 });
	});

	it('never lets the recipient like their own gifts, even after self-promotion', async () => {
		const plain = await createWishlistFixture({ sharedAt: new Date() });
		const selfPromoted = await createWishlistFixture({
			sharedAt: new Date(),
			recipientIsModerator: true,
		});

		for (const { id } of [plain, selfPromoted]) {
			await expectRejection(
				toggleLike(recipientActor, await createGiftFixture(id)),
				403,
				SERVER_ERROR.RECIPIENT_CANNOT_LIKE_OWN_GIFTS,
			);
		}
	});

	it('rejects a like waiting on a list that is being archived', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });
		const giftId = await createGiftFixture(wishlistId);

		const [likeResult] = await raceBehindRowLock(
			lockAndUpdateWishlist(wishlistId, { status: 'archived', archivedAt: new Date() }),
			[() => toggleLike(outsiderActor, giftId)],
		);

		if (likeResult === undefined) {
			throw new Error('Expected the like to settle');
		}
		expectRejectionResult(likeResult, 400, SERVER_ERROR.CANNOT_LIKE_ON_ARCHIVED);
		expect(await activeLikeCount(giftId)).toBe(0);
	});

	it('likes once when the same person likes a gift twice at the same time', async () => {
		const { id: wishlistId } = await createWishlistFixture({ sharedAt: new Date() });
		const giftId = await createGiftFixture(wishlistId);
		const like = () => toggleLike(outsiderActor, giftId);

		// The like insert's foreign key waits on the held gift row, so both requests find no like
		// before either inserts one.
		const results = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: gift.id })
					.from(gift)
					.where(eq(gift.id, giftId))
					.for('update'),
			[like, like],
		);

		expect(expectAllFulfilled(results)).toEqual([
			{ liked: true, likeCount: 1 },
			{ liked: true, likeCount: 1 },
		]);
		expect(await activeLikeCount(giftId)).toBe(1);
	});

	it('rejects likes on an archived list and on a deleted gift', async () => {
		const archived = await createWishlistFixture({ sharedAt: new Date(), status: 'archived' });
		const active = await createWishlistFixture({ sharedAt: new Date() });
		const deletedGiftId = await createGiftFixture(active.id, { deletedAt: new Date() });

		await expectRejection(
			toggleLike(outsiderActor, await createGiftFixture(archived.id)),
			400,
			SERVER_ERROR.CANNOT_LIKE_ON_ARCHIVED,
		);
		await expectRejection(toggleLike(outsiderActor, deletedGiftId), 404, 'Gift not found');
	});
});
