import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_EMAIL,
	RESERVER_ID,
	RESERVER_NAME,
	createGiftFixture,
	createWishlistFixture,
	expectRejection,
	raceBehindRowLock,
	readGift,
	removeFixtureRows,
	reserveGift,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftCategory, giftLike, reservation } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	authorizeAgentOperation,
	authorizeAgentOperations,
	executeAgentOperationBatch,
	executeAgentRead,
	type AgentOperationRequest,
} from './authorization.js';
import type { AgentAccessGrant } from './agent_grant.js';
import { AGENT_SCOPE, type AgentScope } from '$lib/modules/access_tokens/scopes.js';

const ANONYMOUS_GIFTER_NAME = 'Anonymní teta';
const ANONYMOUS_GIFTER_EMAIL = 'teta@example.com';
const RESERVATION_AND_LIKE_FIELDS = [
	'likeCount',
	'reservedCount',
	'isFullyReserved',
	'reserverNames',
	'myReservationId',
	'myReservationPurchasedAt',
];

function grantFor(
	user: 'recipient' | 'manager',
	scopes: readonly AgentScope[],
	wishlistIds: readonly string[] | null = null,
): AgentAccessGrant {
	return user === 'recipient'
		? { userId: RECIPIENT_ID, userName: 'Recipient', tokenName: 'Agent', scopes, wishlistIds }
		: { userId: MANAGER_ID, userName: 'Manager', tokenName: 'Agent', scopes, wishlistIds };
}

const everyScope = Object.values(AGENT_SCOPE);
const managerGrant = grantFor('manager', everyScope);

/** What the API would return for a read: authorized, run as the token actor, then projected. */
async function readAsAgent(grant: AgentAccessGrant, operationName: string, input: unknown) {
	return executeAgentRead(grant, await authorizeAgentOperation(grant, operationName, input));
}

async function runAsAgent(grant: AgentAccessGrant, requests: AgentOperationRequest[]) {
	return executeAgentOperationBatch(grant, await authorizeAgentOperations(grant, requests));
}

function expectNoGifterIdentity(projected: unknown) {
	const serialized = JSON.stringify(projected);
	expect(serialized).not.toContain(RESERVER_NAME);
	expect(serialized).not.toContain(RESERVER_EMAIL);
	expect(serialized).not.toContain(ANONYMOUS_GIFTER_NAME);
	expect(serialized).not.toContain(ANONYMOUS_GIFTER_EMAIL);
}

describe.skipIf(!DB_READY)('agent access', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	async function sharedWishlistWithReservedLikedGift() {
		const wishlistFixture = await createWishlistFixture({
			sharedAt: new Date(Date.now() - 60 * 60 * 1000),
		});
		const giftId = await createGiftFixture(wishlistFixture.id, { quantity: 3 });
		await reserveGift(giftId, RESERVER_ID);
		await getDb().insert(reservation).values({
			giftId,
			anonymousName: ANONYMOUS_GIFTER_NAME,
			anonymousEmail: ANONYMOUS_GIFTER_EMAIL,
		});
		await getDb().insert(giftLike).values({ giftId, userId: RESERVER_ID });
		return { ...wishlistFixture, giftId };
	}

	describe('gift reads', () => {
		it('gives the recipient no reservation or like data, even with every scope', async () => {
			const { shortId } = await sharedWishlistWithReservedLikedGift();

			const projected = await readAsAgent(
				grantFor('recipient', everyScope),
				'readWishlistGifts',
				{ wishlistShortId: shortId },
			);

			expect(projected).toMatchObject({ role: 'recipient', gifts: [expect.any(Object)] });
			const [recipientGift] = (projected as { gifts: object[] }).gifts;
			for (const field of RESERVATION_AND_LIKE_FIELDS) {
				expect(recipientGift).not.toHaveProperty(field);
			}
			expectNoGifterIdentity(projected);
		});

		it('gives a správce reservation state and counts only without the identities scope', async () => {
			const { shortId } = await sharedWishlistWithReservedLikedGift();

			const projected = await readAsAgent(
				grantFor('manager', [AGENT_SCOPE.read]),
				'readWishlistGifts',
				{ wishlistShortId: shortId },
			);

			const [managerGift] = (projected as { gifts: object[] }).gifts;
			expect(managerGift).toMatchObject({
				reservedCount: 2,
				isFullyReserved: false,
				likeCount: 1,
			});
			expect(managerGift).not.toHaveProperty('reserverNames');
			expectNoGifterIdentity(projected);
		});

		it('names the reservers with the identities scope but never a gifter email', async () => {
			const { shortId } = await sharedWishlistWithReservedLikedGift();

			const projected = await readAsAgent(
				grantFor('manager', [AGENT_SCOPE.read, AGENT_SCOPE.reservationsIdentities]),
				'readWishlistGifts',
				{ wishlistShortId: shortId },
			);

			const [managerGift] = (projected as { gifts: object[] }).gifts;
			expect(managerGift).toMatchObject({
				reserverNames: expect.arrayContaining([RESERVER_NAME, ANONYMOUS_GIFTER_NAME]),
			});
			const serialized = JSON.stringify(projected);
			expect(serialized).not.toContain(ANONYMOUS_GIFTER_EMAIL);
			expect(serialized).not.toContain(RESERVER_EMAIL);
		});
	});

	it('reads a wishlist without its internal columns', async () => {
		const { shortId } = await createWishlistFixture();

		const projected = await readAsAgent(
			grantFor('manager', [AGENT_SCOPE.read]),
			'readWishlist',
			{ wishlistShortId: shortId },
		);

		expect(projected).toMatchObject({ shortId, role: 'moderator' });
		expect(projected).not.toHaveProperty('demoSessionId');
		expect(projected).not.toHaveProperty('recipientUserId');
		expect(JSON.stringify(projected)).not.toContain(RECIPIENT_ID);
	});

	it('lets the read scope insert the default categories once, on the first category read', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const categoryRows = () =>
			getDb().select().from(giftCategory).where(eq(giftCategory.wishlistId, wishlistId));
		const readGrant = grantFor('manager', [AGENT_SCOPE.read]);
		expect(await categoryRows()).toHaveLength(0);

		const firstRead = await readAsAgent(readGrant, 'readGiftCategories', { wishlistId });
		const defaultCategoryCount = (await categoryRows()).length;
		const secondRead = await readAsAgent(readGrant, 'readGiftCategories', { wishlistId });

		expect(firstRead).toEqual(expect.arrayContaining([expect.any(Object)]));
		expect(defaultCategoryCount).toBeGreaterThan(0);
		expect(await categoryRows()).toHaveLength(defaultCategoryCount);
		expect(secondRead).toEqual(firstRead);
	});

	it('returns a created gift and wishlist without internal columns', async () => {
		const { id: wishlistId } = await createWishlistFixture();

		const { results } = await runAsAgent(managerGrant, [
			{ operationName: 'createGift', input: { wishlistId, name: 'Kolo' } },
			{
				operationName: 'createWishlist',
				input: { title: 'Narozeniny', recipientKind: 'other', recipientName: 'Jana' },
			},
		]);

		const [giftResult, wishlistResult] = results;
		expect(giftResult).toMatchObject({ gift: { name: 'Kolo', wishlistId } });
		expect((giftResult as { gift: object }).gift).not.toHaveProperty('deletedAt');
		expect(wishlistResult).toMatchObject({ title: 'Narozeniny', recipientName: 'Jana' });
		expect(wishlistResult).not.toHaveProperty('demoSessionId');
		expect(wishlistResult).not.toHaveProperty('recipientUserId');
	});

	describe('wishlist restriction', () => {
		it('resolves gift, deleted gift, reservation and short id inputs to their wishlist', async () => {
			const { id: wishlistId, shortId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId);
			const deletedGiftId = await createGiftFixture(wishlistId, { deletedAt: new Date() });
			const [reservationRow] = await getDb()
				.insert(reservation)
				.values({ giftId, userId: MANAGER_ID })
				.returning({ id: reservation.id });

			const authorized = await authorizeAgentOperations(
				grantFor('manager', everyScope, [wishlistId]),
				[
					{ operationName: 'updateGift', input: { id: giftId, name: 'Nové jméno' } },
					{ operationName: 'undoGiftRevision', input: { giftId: deletedGiftId } },
					{
						operationName: 'cancelOwnReservation',
						input: { reservationId: reservationRow?.id },
					},
					{ operationName: 'readWishlistGifts', input: { wishlistShortId: shortId } },
				],
			);

			expect(authorized.map((step) => step.targetWishlistIds)).toEqual([
				[wishlistId],
				[wishlistId],
				[wishlistId],
				[wishlistId],
			]);
		});

		it('rejects a gift outside the allowed wishlists and, without telling them apart, a missing gift', async () => {
			const allowed = await createWishlistFixture();
			const other = await createWishlistFixture();
			const otherGiftId = await createGiftFixture(other.id);
			const restrictedGrant = grantFor('manager', everyScope, [allowed.id]);

			for (const giftId of [otherGiftId, 'missing-gift']) {
				await expectRejection(
					authorizeAgentOperation(restrictedGrant, 'deleteGift', { giftId }),
					403,
					SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED,
				);
			}
		});
	});

	describe('undo', () => {
		async function confirmationOf(operationName: string, input: unknown) {
			return (await authorizeAgentOperation(managerGrant, operationName, input))
				.requiresConfirmation;
		}

		async function createGiftAsAgent(wishlistId: string) {
			const creation = await runAsAgent(managerGrant, [
				{ operationName: 'createGift', input: { wishlistId, name: 'Nový dárek' } },
			]);
			const [createdGift] = creation.results as { gift: { id: string } }[];
			if (createdGift === undefined) {
				throw new Error('Missing created gift');
			}
			return { batchId: creation.batchId, giftId: createdGift.gift.id };
		}

		it('requires confirmation when undoing a creation deletes the gift', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const creation = await createGiftAsAgent(wishlistId);

			expect(
				await confirmationOf('undoGiftRevisionBatch', { batchId: creation.batchId }),
			).toBe(true);
			expect(await confirmationOf('undoGiftRevision', { giftId: creation.giftId })).toBe(
				true,
			);
		});

		it('needs no confirmation to undo a later edit of a created gift', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const creation = await createGiftAsAgent(wishlistId);
			const edit = await runAsAgent(managerGrant, [
				{ operationName: 'updateGift', input: { id: creation.giftId, name: 'Upraveno' } },
			]);

			expect(await confirmationOf('undoGiftRevisionBatch', { batchId: edit.batchId })).toBe(
				false,
			);
			expect(await confirmationOf('undoGiftRevision', { giftId: creation.giftId })).toBe(
				false,
			);
		});

		it('requires confirmation to undo a batch that created and then edited a gift', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const priorGiftId = await createGiftFixture(wishlistId);
			const batch = await runAsAgent(managerGrant, [
				{ operationName: 'createGift', input: { wishlistId, name: 'Nový dárek' } },
				{ operationName: 'updateGift', input: { id: priorGiftId, name: 'Upraveno' } },
			]);
			const [createdGift] = batch.results as { gift: { id: string } }[];

			expect(await confirmationOf('undoGiftRevisionBatch', { batchId: batch.batchId })).toBe(
				true,
			);
			expect(await confirmationOf('undoGiftRevision', { giftId: priorGiftId })).toBe(false);
			expect(await confirmationOf('undoGiftRevision', { giftId: createdGift?.gift.id })).toBe(
				true,
			);
		});

		it('needs no confirmation to undo a deletion, which restores the gift', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId);
			const deletion = await runAsAgent(managerGrant, [
				{ operationName: 'deleteGift', input: { giftId } },
			]);

			expect(
				await confirmationOf('undoGiftRevisionBatch', { batchId: deletion.batchId }),
			).toBe(false);
			expect(await confirmationOf('undoGiftRevision', { giftId })).toBe(false);
			await runAsAgent(managerGrant, [
				{ operationName: 'undoGiftRevisionBatch', input: { batchId: deletion.batchId } },
			]);
			expect((await readGift(giftId)).deletedAt).toBeNull();
		});

		it('targets every wishlist a batch changed', async () => {
			const first = await createWishlistFixture();
			const second = await createWishlistFixture();
			const firstGiftId = await createGiftFixture(first.id);
			const secondGiftId = await createGiftFixture(second.id);
			const batch = await runAsAgent(managerGrant, [
				{ operationName: 'updateGift', input: { id: firstGiftId, name: 'První' } },
				{ operationName: 'updateGift', input: { id: secondGiftId, name: 'Druhý' } },
			]);

			const undo = await authorizeAgentOperation(managerGrant, 'undoGiftRevisionBatch', {
				batchId: batch.batchId,
			});

			expect([...undo.targetWishlistIds].sort()).toEqual([first.id, second.id].sort());
		});
	});

	describe('re-verification under the wishlist lock', () => {
		it('rejects an undo whose confirmation changed after authorization and applies nothing', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const otherGiftId = await createGiftFixture(wishlistId);
			const creation = await runAsAgent(managerGrant, [
				{ operationName: 'createGift', input: { wishlistId, name: 'Nový dárek' } },
			]);
			const [createdGift] = creation.results as { gift: { id: string } }[];
			const createdGiftId = createdGift?.gift.id ?? '';
			const authorized = await authorizeAgentOperations(managerGrant, [
				{ operationName: 'updateGift', input: { id: otherGiftId, name: 'Nezměněno' } },
				{ operationName: 'undoGiftRevision', input: { giftId: createdGiftId } },
			]);
			expect(authorized[1]?.requiresConfirmation).toBe(true);
			// Now the undo would revert this edit instead of deleting the gift.
			await runAsAgent(managerGrant, [
				{ operationName: 'updateGift', input: { id: createdGiftId, name: 'Upraveno' } },
			]);

			await expectRejection(
				executeAgentOperationBatch(managerGrant, authorized),
				409,
				SERVER_ERROR.AGENT_AUTHORIZATION_OUTDATED,
			);
			expect((await readGift(otherGiftId)).name).not.toBe('Nezměněno');
			expect((await readGift(createdGiftId)).name).toBe('Upraveno');
		});

		it('rejects a call whose target wishlist changed after authorization', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlistId);
			const [reservationRow] = await getDb()
				.insert(reservation)
				.values({ giftId, userId: MANAGER_ID })
				.returning({ id: reservation.id });
			const authorized = await authorizeAgentOperations(managerGrant, [
				{
					operationName: 'setReservationPurchased',
					input: { reservationId: reservationRow?.id, purchased: true },
				},
			]);
			expect(authorized[0]?.targetWishlistIds).toEqual([wishlistId]);
			await getDb().delete(reservation).where(eq(reservation.giftId, giftId));

			await expectRejection(
				executeAgentOperationBatch(managerGrant, authorized),
				409,
				SERVER_ERROR.AGENT_AUTHORIZATION_OUTDATED,
			);
		});
	});

	it('runs no read inside a batch', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const authorized = await authorizeAgentOperations(managerGrant, [
			{ operationName: 'readPriorityLevels', input: { wishlistId } },
		]);

		await expectRejection(
			executeAgentOperationBatch(managerGrant, authorized),
			400,
			SERVER_ERROR.INVALID_OPERATION_INPUT,
		);
	});

	it('dry-runs a batch without writing and still returns its projected outputs', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlistId);

		const { results } = await executeAgentOperationBatch(
			managerGrant,
			await authorizeAgentOperations(managerGrant, [
				{ operationName: 'updateGift', input: { id: giftId, name: 'Jen zkouška' } },
			]),
			{ dryRun: true },
		);

		expect(results).toEqual([
			expect.objectContaining({ gift: expect.objectContaining({ name: 'Jen zkouška' }) }),
		]);
		expect((await readGift(giftId)).name).not.toBe('Jen zkouška');
		const giftRows = await getDb()
			.select({ id: gift.id })
			.from(gift)
			.where(eq(gift.wishlistId, wishlistId));
		expect(giftRows).toHaveLength(1);
	});

	it('locks every target wishlist first, so overlapping batches in opposite directions never deadlock', async () => {
		const first = await createWishlistFixture();
		const second = await createWishlistFixture();
		const gateGiftId = await createGiftFixture(first.id, { sortOrder: 0 });
		const copiedGiftId = await createGiftFixture(first.id, { sortOrder: 1 });
		const secondGiftId = await createGiftFixture(second.id);
		const forwardBatch = await authorizeAgentOperations(managerGrant, [
			{ operationName: 'updateGift', input: { id: gateGiftId, name: 'Upraveno' } },
			{
				operationName: 'bulkCopyGifts',
				input: {
					sourceWishlistId: first.id,
					destinationWishlistId: second.id,
					giftIds: [copiedGiftId],
				},
			},
			{ operationName: 'reserveGift', input: { giftId: secondGiftId, quantity: 1 } },
		]);
		const backwardBatch = await authorizeAgentOperations(managerGrant, [
			{ operationName: 'updateGift', input: { id: secondGiftId, name: 'Upraveno' } },
			{
				operationName: 'reorderGifts',
				input: { wishlistId: first.id, orderedGiftIds: [copiedGiftId, gateGiftId] },
			},
			{
				operationName: 'bulkCopyGifts',
				input: {
					sourceWishlistId: second.id,
					destinationWishlistId: first.id,
					giftIds: [secondGiftId],
				},
			},
		]);

		const outcomes = await raceBehindRowLock(
			(transaction) =>
				transaction
					.select({ id: gift.id })
					.from(gift)
					.where(eq(gift.id, gateGiftId))
					.for('update'),
			[
				() => executeAgentOperationBatch(managerGrant, forwardBatch),
				() => executeAgentOperationBatch(managerGrant, backwardBatch),
			],
			{ queueInOrder: true },
		);

		const [forwardOutcome] = outcomes;
		for (const outcome of outcomes) {
			if (outcome.status === 'rejected') {
				throw outcome.reason;
			}
		}
		const forwardBatchId =
			forwardOutcome?.status === 'fulfilled'
				? (forwardOutcome.value as { batchId: string }).batchId
				: '';
		const undo = await authorizeAgentOperation(managerGrant, 'undoGiftRevisionBatch', {
			batchId: forwardBatchId,
		});
		expect([...undo.targetWishlistIds].sort()).toEqual([first.id, second.id].sort());
		expect(undo.requiresConfirmation).toBe(true);
		for (const wishlistId of [first.id, second.id]) {
			const giftRows = await getDb()
				.select({ id: gift.id })
				.from(gift)
				.where(eq(gift.wishlistId, wishlistId));
			expect(giftRows).toHaveLength(wishlistId === first.id ? 3 : 2);
		}
	});
});
