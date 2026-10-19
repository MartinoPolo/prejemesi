import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_ID,
	RESERVER_NAME,
	SECOND_RESERVER_ID,
	createGiftFixture,
	createWishlistFixture,
	errorMessage,
	expectRejection,
	raceBehindRowLock,
	readGift,
	recipientActor,
	removeFixtureRows,
	reserveGift,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { giftRevision } from '$lib/server/db/gift_revision.schema.js';
import { moderatorAssignment, moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { SERVER_ERROR, encodeServerError } from '$lib/modules/errors/server_error_codes.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import {
	CHANGE_PROPOSAL_OUTCOME,
	CHANGE_PROPOSAL_STATE,
	CHANGE_ROW_STATUS,
	type ChangeProposalView,
} from '$lib/modules/change_proposals/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { wishlist as wishlistTable } from '$lib/server/db/wishlist.schema.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import {
	deleteGiftOperation,
	updateGiftOperation,
} from '$lib/server/operations/gift_mutation_operations.js';
import { reorderGiftsOperation } from '$lib/server/operations/gift_bulk_operations.js';
import { cancelOwnReservationOperation } from '$lib/server/operations/reservation_operations.js';
import { tokenChannel, userInterfaceActor } from '$lib/server/operations/actor.js';
import { authenticateAccessToken, createAccessToken, revokeAccessToken } from './access_tokens.js';
import type { AgentCaller } from './agent_caller.js';
import { submitChangeProposal } from './change_proposal_api.js';
import {
	applyChangeProposalRows,
	buildChangeProposalView,
	discardChangeProposal,
	getChangeProposalForReview,
	listPendingChangeProposals,
	requireOwnChangeProposal,
	undoChangeProposal,
} from './change_proposals.js';

const DEADLOCK_DETECTED = '40P01';
const HOUR_MS = 60 * 60 * 1000;

const MANAGER = { id: MANAGER_ID, name: 'Manager' };
const RECIPIENT = { id: RECIPIENT_ID, name: 'Recipient' };
const RESERVER = { id: RESERVER_ID, name: RESERVER_NAME };

type Row = [operation: string, input: Record<string, unknown>];

async function agentToken(
	userId: string,
	input: { scopes?: string[]; fastForward?: boolean; name?: string } = {},
): Promise<AgentCaller> {
	const { value } = await createAccessToken(
		userId,
		v.parse(CreateAccessTokenInputSchema, {
			name: input.name ?? 'Claude',
			scopes: input.scopes ?? ['gifts:write'],
			wishlistIds: null,
			fastForward: input.fastForward ?? false,
		}),
	);
	return authenticateAccessToken(`Bearer ${value}`);
}

async function submit(token: AgentCaller, wishlistShortId: string, rows: Row[]) {
	return submitChangeProposal(token, {
		wishlistShortId,
		operations: rows.map(([operation, input]) => ({ operation, input })),
	});
}

async function viewOf(
	reviewer: { id: string; name: string },
	wishlistShortId: string,
	proposalId: string,
): Promise<ChangeProposalView> {
	return getChangeProposalForReview(reviewer, { wishlistShortId, proposalId });
}

function rowStatuses(view: ChangeProposalView) {
	return Object.fromEntries(view.rows.map((row) => [row.rowId, row.status]));
}

async function renameAsRecipient(giftId: string, name: string) {
	await executeOperation(recipientActor, updateGiftOperation, { id: giftId, name });
}

async function activeReservations(giftId: string, userId: string) {
	return getDb()
		.select({ id: reservation.id })
		.from(reservation)
		.where(
			and(
				eq(reservation.giftId, giftId),
				eq(reservation.userId, userId),
				isNull(reservation.deletedAt),
			),
		);
}

/** The id of the gift a `createGift` row returned. */
function createdGiftIdOf(result: unknown): string {
	const parsed = v.parse(v.object({ gift: v.object({ id: v.string() }) }), result);
	return parsed.gift.id;
}

function postgresErrorCode(thrown: unknown): string | undefined {
	let current: unknown = thrown;
	while (typeof current === 'object' && current !== null) {
		if ('code' in current && typeof current.code === 'string') {
			return current.code;
		}
		current = 'cause' in current ? current.cause : undefined;
	}
	return undefined;
}

describe.skipIf(!DB_READY)('change proposals', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	describe('submission', () => {
		it('dry-runs every row without changing anything and stores it pending for review', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
			const token = await agentToken(MANAGER_ID);

			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Červené kolo' }],
				['deleteGift', { giftId: 'no-such-gift' }],
			]);

			expect(submitted).toMatchObject({
				status: CHANGE_PROPOSAL_STATE.pending,
				reviewUrl: `/w/${wishlist.shortId}/changes/${submitted.id}`,
				rows: [
					{ rowId: 'r1', status: CHANGE_ROW_STATUS.ready, error: null },
					{
						rowId: 'r2',
						status: CHANGE_ROW_STATUS.rejected,
						error: { status: 404, code: SERVER_ERROR.GIFT_NOT_FOUND },
					},
				],
			});
			expect((await readGift(giftId)).name).toBe('Kolo');
			const view = await viewOf(MANAGER, wishlist.shortId, submitted.id);
			expect(view.rows[0]?.preview?.gifts).toEqual([
				{
					giftId,
					before: expect.objectContaining({ name: 'Kolo' }),
					after: expect.objectContaining({ name: 'Červené kolo' }),
				},
			]);
			expect(view).toMatchObject({
				submitterName: 'Manager',
				viewerRole: WISHLIST_ROLES.moderator,
				channel: tokenChannel('Claude'),
				tokenName: 'Claude',
				tokenRevoked: false,
				kindCounts: { giftEdit: 1, giftDeletion: 1 },
			});
		});

		it('shows a recipient’s proposal without any reservation state', async () => {
			const wishlist = await createWishlistFixture({
				sharedAt: new Date(Date.now() - HOUR_MS),
			});
			const giftId = await createGiftFixture(wishlist.id, { quantity: 2 });
			await reserveGift(giftId, RESERVER_ID);
			const token = await agentToken(RECIPIENT_ID);

			const submitted = await submit(token, wishlist.shortId, [
				['appendGiftDescription', { giftId, text: 'Ideálně modrou.' }],
			]);
			const view = await viewOf(RECIPIENT, wishlist.shortId, submitted.id);

			expect(view.rows[0]?.status).toBe(CHANGE_ROW_STATUS.ready);
			expect(view.viewerRole).toBe(WISHLIST_ROLES.recipient);
			const serialized = JSON.stringify(view);
			expect(serialized).not.toContain(RESERVER_NAME);
			for (const field of [
				'reservedCount',
				'isFullyReserved',
				'likeCount',
				'reserverNames',
			]) {
				expect(serialized).not.toContain(field);
			}
		});
	});

	describe('apply', () => {
		it('applies none of the selected rows when one of them fails', async () => {
			const wishlist = await createWishlistFixture({
				sharedAt: new Date(Date.now() - HOUR_MS),
			});
			const firstGiftId = await createGiftFixture(wishlist.id, { quantity: 1 });
			const secondGiftId = await createGiftFixture(wishlist.id, { quantity: 1 });
			const token = await agentToken(RESERVER_ID, { scopes: ['reservations:write'] });
			const submitted = await submit(token, wishlist.shortId, [
				['reserveGift', { giftId: firstGiftId, quantity: 1 }],
				['reserveGift', { giftId: secondGiftId, quantity: 1 }],
			]);
			await reserveGift(secondGiftId, SECOND_RESERVER_ID);

			const result = await applyChangeProposalRows(RESERVER, submitted.id, ['r1', 'r2']);

			expect(result).toEqual({
				outcome: CHANGE_PROPOSAL_OUTCOME.failed,
				rows: [
					{
						rowId: 'r2',
						error: {
							status: 400,
							code: SERVER_ERROR.NOT_ENOUGH_AVAILABLE,
							details: { available: 0 },
						},
					},
				],
			});
			expect(await activeReservations(firstGiftId, RESERVER_ID)).toHaveLength(0);
			const view = await viewOf(RESERVER, wishlist.shortId, submitted.id);
			expect(view.state).toBe(CHANGE_PROPOSAL_STATE.pending);
		});

		it('reports a gift changed after submission as that row’s conflict and applies nothing', async () => {
			const wishlist = await createWishlistFixture();
			const keptGiftId = await createGiftFixture(wishlist.id, { name: 'Míč' });
			const changedGiftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: keptGiftId, name: 'Fotbalový míč' }],
				['updateGift', { id: changedGiftId, name: 'Horské kolo' }],
			]);
			await renameAsRecipient(changedGiftId, 'Silniční kolo');

			const view = await viewOf(MANAGER, wishlist.shortId, submitted.id);
			expect(rowStatuses(view)).toEqual({
				r1: CHANGE_ROW_STATUS.ready,
				r2: CHANGE_ROW_STATUS.conflict,
			});
			const result = await applyChangeProposalRows(MANAGER, submitted.id, ['r1', 'r2']);

			expect(result).toEqual({
				outcome: CHANGE_PROPOSAL_OUTCOME.conflict,
				rows: [
					{
						rowId: 'r2',
						conflicts: [
							{
								giftId: changedGiftId,
								changedByName: 'Recipient',
								changedAt: expect.any(Date),
								current: expect.objectContaining({ name: 'Silniční kolo' }),
							},
						],
					},
				],
			});
			expect((await readGift(keptGiftId)).name).toBe('Míč');
			expect((await readGift(changedGiftId)).name).toBe('Silniční kolo');
		});

		it('does not count a reorder by someone else as a conflict', async () => {
			const wishlist = await createWishlistFixture();
			const firstGiftId = await createGiftFixture(wishlist.id, { sortOrder: 0 });
			const secondGiftId = await createGiftFixture(wishlist.id, { sortOrder: 1 });
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: firstGiftId, name: 'Upraveno' }],
			]);
			await executeOperation(recipientActor, reorderGiftsOperation, {
				wishlistId: wishlist.id,
				orderedGiftIds: [secondGiftId, firstGiftId],
			});

			const result = await applyChangeProposalRows(MANAGER, submitted.id, ['r1']);

			expect(result.outcome).toBe(CHANGE_PROPOSAL_OUTCOME.applied);
		});

		it('drops the unselected rows, applies once and refuses a second apply', async () => {
			const wishlist = await createWishlistFixture();
			const selectedGiftId = await createGiftFixture(wishlist.id, { name: 'Míč' });
			const skippedGiftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: selectedGiftId, name: 'Fotbalový míč' }],
				['deleteGift', { giftId: skippedGiftId }],
			]);

			const result = await applyChangeProposalRows(MANAGER, submitted.id, ['r1']);

			if (result.outcome !== CHANGE_PROPOSAL_OUTCOME.applied) {
				throw new Error(`Expected the proposal to apply, got ${result.outcome}`);
			}
			expect(result.proposal.state).toBe(CHANGE_PROPOSAL_STATE.applied);
			expect(rowStatuses(result.proposal)).toEqual({
				r1: CHANGE_ROW_STATUS.applied,
				r2: CHANGE_ROW_STATUS.notApplied,
			});
			expect((await readGift(selectedGiftId)).name).toBe('Fotbalový míč');
			expect((await readGift(skippedGiftId)).deletedAt).toBeNull();
			await expectRejection(
				applyChangeProposalRows(MANAGER, submitted.id, ['r2']),
				409,
				SERVER_ERROR.AGENT_PROPOSAL_NOT_PENDING,
			);
			expect((await readGift(skippedGiftId)).deletedAt).toBeNull();
		});

		it('refuses selecting a rejected, unknown or repeated row', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id);
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Upraveno' }],
				['deleteGift', { giftId: 'no-such-gift' }],
			]);

			await expectRejection(
				applyChangeProposalRows(MANAGER, submitted.id, ['r1', 'r2', 'r9', 'r1']),
				400,
				encodeServerError(SERVER_ERROR.AGENT_PROPOSAL_SELECTION_INVALID, {
					rowIds: 'r2,r9,r1',
				}),
			);
			expect((await readGift(giftId)).name).not.toBe('Upraveno');
		});

		it('refuses an expired proposal', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id);
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Upraveno' }],
			]);
			await getDb()
				.update(changeProposal)
				.set({ expiresAt: new Date(Date.now() - 1000) })
				.where(eq(changeProposal.id, submitted.id));

			expect((await viewOf(MANAGER, wishlist.shortId, submitted.id)).state).toBe(
				CHANGE_PROPOSAL_STATE.expired,
			);
			await expectRejection(
				applyChangeProposalRows(MANAGER, submitted.id, ['r1']),
				410,
				SERVER_ERROR.AGENT_PROPOSAL_EXPIRED,
			);
			await expectRejection(
				discardChangeProposal(MANAGER, submitted.id),
				410,
				SERVER_ERROR.AGENT_PROPOSAL_EXPIRED,
			);
			expect((await readGift(giftId)).name).not.toBe('Upraveno');
		});

		it('still applies the pending proposal of a revoked token, through the token’s channel', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id);
			const token = await agentToken(MANAGER_ID, { name: 'Odvolaný' });
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Upraveno' }],
			]);
			await revokeAccessToken(MANAGER_ID, token.credential.id);

			expect((await viewOf(MANAGER, wishlist.shortId, submitted.id)).tokenRevoked).toBe(true);
			const result = await applyChangeProposalRows(MANAGER, submitted.id, ['r1']);

			expect(result.outcome).toBe(CHANGE_PROPOSAL_OUTCOME.applied);
			expect((await readGift(giftId)).name).toBe('Upraveno');
			const [revision] = await getDb()
				.select()
				.from(giftRevision)
				.where(eq(giftRevision.giftId, giftId));
			expect(revision).toMatchObject({
				actorUserId: MANAGER_ID,
				channel: tokenChannel('Odvolaný'),
			});
		});

		it('never deadlocks when proposals on one wishlist apply and are discarded concurrently', async () => {
			const wishlist = await createWishlistFixture();
			const gateGiftId = await createGiftFixture(wishlist.id);
			const firstGiftId = await createGiftFixture(wishlist.id);
			const secondGiftId = await createGiftFixture(wishlist.id);
			const token = await agentToken(MANAGER_ID);
			// Opposite gift order: without one lock taken first, each apply would hold the gift the
			// other needs once the gate opens.
			const first = await submit(token, wishlist.shortId, [
				['updateGift', { id: firstGiftId, name: 'První' }],
				['updateGift', { id: gateGiftId, name: 'Brána' }],
				['updateGift', { id: secondGiftId, name: 'První' }],
			]);
			const second = await submit(token, wishlist.shortId, [
				['updateGift', { id: secondGiftId, name: 'Druhý' }],
				['updateGift', { id: gateGiftId, name: 'Druhá brána' }],
				['updateGift', { id: firstGiftId, name: 'Druhý' }],
			]);

			const outcomes = await raceBehindRowLock(
				(transaction) =>
					transaction
						.select({ id: gift.id })
						.from(gift)
						.where(eq(gift.id, gateGiftId))
						.for('update'),
				[
					() => applyChangeProposalRows(MANAGER, first.id, ['r1', 'r2', 'r3']),
					() => applyChangeProposalRows(MANAGER, second.id, ['r1', 'r2', 'r3']),
					() => discardChangeProposal(MANAGER, first.id),
				],
				{ queueInOrder: true },
			);

			for (const outcome of outcomes) {
				if (outcome.status === 'rejected') {
					expect(postgresErrorCode(outcome.reason)).not.toBe(DEADLOCK_DETECTED);
				}
			}
			const [firstApply, secondApply, firstDiscard] = outcomes;
			expect(firstApply).toMatchObject({
				status: 'fulfilled',
				value: { outcome: CHANGE_PROPOSAL_OUTCOME.applied },
			});
			// The first apply changed every gift the second one was based on.
			expect(secondApply).toMatchObject({
				status: 'fulfilled',
				value: { outcome: CHANGE_PROPOSAL_OUTCOME.conflict },
			});
			expect(firstDiscard?.status).toBe('rejected');
			if (firstDiscard?.status === 'rejected') {
				expect(errorMessage(firstDiscard.reason)).toBe(
					SERVER_ERROR.AGENT_PROPOSAL_NOT_PENDING,
				);
			}
			for (const giftId of [firstGiftId, secondGiftId]) {
				expect((await readGift(giftId)).name).toBe('První');
			}
			expect((await readGift(gateGiftId)).name).toBe('Brána');
		});

		it('answers a gift deleted after submission as a conflict showing it deleted', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Horské kolo' }],
			]);
			await executeOperation(recipientActor, deleteGiftOperation, { giftId });

			const result = await applyChangeProposalRows(MANAGER, submitted.id, ['r1']);

			expect(result).toEqual({
				outcome: CHANGE_PROPOSAL_OUTCOME.conflict,
				rows: [
					{
						rowId: 'r1',
						conflicts: [
							expect.objectContaining({
								giftId,
								changedByName: 'Recipient',
								current: expect.objectContaining({ name: 'Kolo', deleted: true }),
							}),
						],
					},
				],
			});
			expect((await readGift(giftId)).name).toBe('Kolo');
		});

		it('answers a bulk edit whose gift was edited meanwhile as a conflict on that gift', async () => {
			const wishlist = await createWishlistFixture();
			const keptGiftId = await createGiftFixture(wishlist.id);
			const editedGiftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				[
					'bulkUpdateGifts',
					{
						wishlistId: wishlist.id,
						giftIds: [keptGiftId, editedGiftId],
						action: 'received',
						received: true,
					},
				],
			]);
			await renameAsRecipient(editedGiftId, 'Silniční kolo');

			const result = await applyChangeProposalRows(MANAGER, submitted.id, ['r1']);

			expect(result).toEqual({
				outcome: CHANGE_PROPOSAL_OUTCOME.conflict,
				rows: [
					{
						rowId: 'r1',
						conflicts: [
							expect.objectContaining({
								giftId: editedGiftId,
								current: expect.objectContaining({ name: 'Silniční kolo' }),
							}),
						],
					},
				],
			});
			expect((await readGift(keptGiftId)).received).toBe(false);
		});

		it('answers a row the submitted grant no longer covers as that row’s failure', async () => {
			const wishlist = await createWishlistFixture();
			const keptGiftId = await createGiftFixture(wishlist.id, { name: 'Míč' });
			const purgedGiftId = await createGiftFixture(wishlist.id);
			const { value } = await createAccessToken(
				MANAGER_ID,
				v.parse(CreateAccessTokenInputSchema, {
					name: 'Omezený',
					scopes: ['gifts:write'],
					wishlistIds: [wishlist.id],
				}),
			);
			const token = await authenticateAccessToken(`Bearer ${value}`);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: keptGiftId, name: 'Fotbalový míč' }],
				['updateGift', { id: purgedGiftId, name: 'Pryč' }],
			]);
			// Gone for good: the restricted grant can no longer place the row on its wishlist.
			await getDb().delete(gift).where(eq(gift.id, purgedGiftId));

			const result = await applyChangeProposalRows(MANAGER, submitted.id, ['r1', 'r2']);

			expect(result).toEqual({
				outcome: CHANGE_PROPOSAL_OUTCOME.failed,
				rows: [
					{
						rowId: 'r2',
						error: {
							status: 403,
							code: SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED,
							details: {},
						},
					},
				],
			});
			expect((await readGift(keptGiftId)).name).toBe('Míč');
		});

		it('answers a role lost since submission as the row’s failure and keeps the proposal pending', async () => {
			const wishlist = await createWishlistFixture({
				sharedAt: new Date(Date.now() - HOUR_MS),
			});
			const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Horské kolo' }],
			]);
			await getDb()
				.update(moderatorAssignment)
				.set({ deletedAt: new Date() })
				.where(eq(moderatorAssignment.wishlistId, wishlist.id));

			const result = await applyChangeProposalRows(MANAGER, submitted.id, ['r1']);

			expect(result).toEqual({
				outcome: CHANGE_PROPOSAL_OUTCOME.failed,
				rows: [{ rowId: 'r1', error: expect.objectContaining({ status: 403 }) }],
			});
			expect((await readGift(giftId)).name).toBe('Kolo');
			const view = await viewOf(MANAGER, wishlist.shortId, submitted.id);
			expect(view).toMatchObject({
				state: CHANGE_PROPOSAL_STATE.pending,
				viewerRole: WISHLIST_ROLES.visitor,
			});
		});
	});

	describe('fast-forward', () => {
		it('applies a proposal of ready rows at once', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id);
			const token = await agentToken(MANAGER_ID, { fastForward: true });

			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Rovnou' }],
				['createGift', { wishlistId: wishlist.id, name: 'Nový' }],
			]);

			expect(submitted.status).toBe(CHANGE_PROPOSAL_STATE.applied);
			expect(submitted.rows.map((row) => row.status)).toEqual([
				CHANGE_ROW_STATUS.applied,
				CHANGE_ROW_STATUS.applied,
			]);
			expect((await readGift(giftId)).name).toBe('Rovnou');
			const createdGiftId = createdGiftIdOf(submitted.rows[1]?.result);
			expect((await readGift(createdGiftId)).name).toBe('Nový');
		});

		it('keeps a proposal with a rejected row pending and applies none of it', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
			const token = await agentToken(MANAGER_ID, { fastForward: true });

			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Rovnou' }],
				['updateGift', { id: 'no-such-gift', name: 'Nikde' }],
			]);

			expect(submitted.status).toBe(CHANGE_PROPOSAL_STATE.pending);
			expect(submitted.rows.map((row) => row.status)).toEqual([
				CHANGE_ROW_STATUS.ready,
				CHANGE_ROW_STATUS.rejected,
			]);
			expect((await readGift(giftId)).name).toBe('Kolo');
		});

		it('never applies gift deletions, reservations or manager invitations', async () => {
			const wishlist = await createWishlistFixture({
				sharedAt: new Date(Date.now() - HOUR_MS),
			});
			const editedGiftId = await createGiftFixture(wishlist.id, { name: 'Míč' });
			const deletedGiftId = await createGiftFixture(wishlist.id);
			const reservedGiftId = await createGiftFixture(wishlist.id);
			const sourceWishlist = await createWishlistFixture({ kind: 'permanent' });
			const copiedGiftId = await createGiftFixture(sourceWishlist.id);
			const managerToken = await agentToken(MANAGER_ID, {
				scopes: ['gifts:write', 'managers:invite'],
				fastForward: true,
			});
			const reserverToken = await agentToken(RESERVER_ID, {
				scopes: ['reservations:write'],
				fastForward: true,
			});

			const deletion = await submit(managerToken, wishlist.shortId, [
				['updateGift', { id: editedGiftId, name: 'Fotbalový míč' }],
				['deleteGift', { giftId: deletedGiftId }],
			]);
			const invitation = await submit(managerToken, wishlist.shortId, [
				[
					'generateModeratorInviteLink',
					{ wishlistId: wishlist.id, email: 'teta@example.com' },
				],
			]);
			const reservationProposal = await submit(reserverToken, wishlist.shortId, [
				['reserveGift', { giftId: reservedGiftId, quantity: 1 }],
			]);
			const sourceRemoval = await submit(managerToken, sourceWishlist.shortId, [
				[
					'bulkCopyGifts',
					{
						sourceWishlistId: sourceWishlist.id,
						destinationWishlistId: wishlist.id,
						giftIds: [copiedGiftId],
						removeUnreservedSources: true,
					},
				],
			]);

			for (const proposal of [deletion, invitation, reservationProposal, sourceRemoval]) {
				expect(proposal.status).toBe(CHANGE_PROPOSAL_STATE.pending);
			}
			expect(deletion.rows.map((row) => row.status)).toEqual([
				CHANGE_ROW_STATUS.ready,
				CHANGE_ROW_STATUS.needsConfirmation,
			]);
			expect((await readGift(editedGiftId)).name).toBe('Míč');
			expect((await readGift(deletedGiftId)).deletedAt).toBeNull();
			expect((await readGift(copiedGiftId)).deletedAt).toBeNull();
			expect(await activeReservations(reservedGiftId, RESERVER_ID)).toHaveLength(0);
			const invites = await getDb()
				.select()
				.from(moderatorInvite)
				.where(eq(moderatorInvite.wishlistId, wishlist.id));
			expect(invites).toHaveLength(0);
		});
	});

	describe('discard', () => {
		it('ends a pending proposal, which can then neither apply nor be discarded again', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id);
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Upraveno' }],
			]);

			const discarded = await discardChangeProposal(MANAGER, submitted.id);

			expect(discarded.state).toBe(CHANGE_PROPOSAL_STATE.discarded);
			await expectRejection(
				applyChangeProposalRows(MANAGER, submitted.id, ['r1']),
				409,
				SERVER_ERROR.AGENT_PROPOSAL_NOT_PENDING,
			);
			await expectRejection(
				discardChangeProposal(MANAGER, submitted.id),
				409,
				SERVER_ERROR.AGENT_PROPOSAL_NOT_PENDING,
			);
			expect((await readGift(giftId)).name).not.toBe('Upraveno');
		});
	});

	describe('submitter only', () => {
		it('answers 404 to anyone else, another manager of the wishlist included', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id);
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Upraveno' }],
			]);
			const notFound = SERVER_ERROR.AGENT_PROPOSAL_NOT_FOUND;

			await expectRejection(viewOf(RECIPIENT, wishlist.shortId, submitted.id), 404, notFound);
			await expectRejection(
				applyChangeProposalRows(RECIPIENT, submitted.id, ['r1']),
				404,
				notFound,
			);
			await expectRejection(discardChangeProposal(RECIPIENT, submitted.id), 404, notFound);
			await expectRejection(undoChangeProposal(RECIPIENT, submitted.id), 404, notFound);
			expect(await listPendingChangeProposals(RECIPIENT, wishlist.shortId)).toEqual([]);
			expect((await readGift(giftId)).name).not.toBe('Upraveno');
		});

		it('answers 404 to a submitter who can no longer read the wishlist, conflicts included', async () => {
			const wishlist = await createWishlistFixture();
			const pendingGiftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
			const appliedGiftId = await createGiftFixture(wishlist.id, { name: 'Míč' });
			const token = await agentToken(MANAGER_ID);
			const pending = await submit(token, wishlist.shortId, [
				['updateGift', { id: pendingGiftId, name: 'Horské kolo' }],
			]);
			const applied = await submit(token, wishlist.shortId, [
				['updateGift', { id: appliedGiftId, name: 'Fotbalový míč' }],
			]);
			await applyChangeProposalRows(MANAGER, applied.id, ['r1']);
			// A conflict whose view would show the gift as it is now.
			await renameAsRecipient(pendingGiftId, 'Tajné kolo');
			await getDb()
				.update(wishlistTable)
				.set({ deletedAt: new Date() })
				.where(eq(wishlistTable.id, wishlist.id));
			const notFound = SERVER_ERROR.AGENT_PROPOSAL_NOT_FOUND;

			await expectRejection(viewOf(MANAGER, wishlist.shortId, pending.id), 404, notFound);
			await expectRejection(
				applyChangeProposalRows(MANAGER, pending.id, ['r1']),
				404,
				notFound,
			);
			await expectRejection(undoChangeProposal(MANAGER, applied.id), 404, notFound);
			await expectRejection(
				listPendingChangeProposals(MANAGER, wishlist.shortId),
				404,
				SERVER_ERROR.WISHLIST_NOT_FOUND,
			);
			expect((await readGift(appliedGiftId)).name).toBe('Fotbalový míč');
		});

		it('answers 404 to the submitter under another wishlist’s address', async () => {
			const wishlist = await createWishlistFixture();
			const otherWishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id);
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Upraveno' }],
			]);

			await expectRejection(
				viewOf(MANAGER, otherWishlist.shortId, submitted.id),
				404,
				SERVER_ERROR.AGENT_PROPOSAL_NOT_FOUND,
			);
		});
	});

	describe('pending proposals', () => {
		it('lists only the user’s own pending, unexpired proposals for the wishlist', async () => {
			const wishlist = await createWishlistFixture();
			const otherWishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id);
			const otherGiftId = await createGiftFixture(otherWishlist.id);
			const managerToken = await agentToken(MANAGER_ID, { name: 'Asistent' });
			const recipientToken = await agentToken(RECIPIENT_ID);
			const edit: Row = ['updateGift', { id: giftId, name: 'Upraveno' }];
			const pending = await submit(managerToken, wishlist.shortId, [
				edit,
				['deleteGift', { giftId }],
			]);
			const applied = await submit(managerToken, wishlist.shortId, [edit]);
			await applyChangeProposalRows(MANAGER, applied.id, ['r1']);
			const expired = await submit(managerToken, wishlist.shortId, [edit]);
			await getDb()
				.update(changeProposal)
				.set({ expiresAt: new Date(Date.now() - 1000) })
				.where(eq(changeProposal.id, expired.id));
			await submit(managerToken, otherWishlist.shortId, [
				['updateGift', { id: otherGiftId, name: 'Jinde' }],
			]);
			await submit(recipientToken, wishlist.shortId, [edit]);

			const listed = await listPendingChangeProposals(MANAGER, wishlist.shortId);

			expect(listed).toEqual([
				{
					id: pending.id,
					reviewUrl: `/w/${wishlist.shortId}/changes/${pending.id}`,
					channel: tokenChannel('Asistent'),
					tokenName: 'Asistent',
					createdAt: expect.any(Date),
					expiresAt: expect.any(Date),
					rowCount: 2,
					kindCounts: { giftEdit: 1, giftDeletion: 1 },
				},
			]);
		});
	});

	describe('undo', () => {
		it('reverts the whole applied batch: gift changes, created gifts and invitations', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id, { name: 'Míč' });
			const token = await agentToken(MANAGER_ID, {
				scopes: ['gifts:write', 'managers:invite'],
			});
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, name: 'Fotbalový míč' }],
				['createGift', { wishlistId: wishlist.id, name: 'Nový' }],
				[
					'generateModeratorInviteLink',
					{ wishlistId: wishlist.id, email: 'teta@example.com' },
				],
			]);
			const applied = await applyChangeProposalRows(MANAGER, submitted.id, [
				'r1',
				'r2',
				'r3',
			]);
			if (applied.outcome !== CHANGE_PROPOSAL_OUTCOME.applied) {
				throw new Error(`Expected the proposal to apply, got ${applied.outcome}`);
			}
			const createdGiftId = createdGiftIdOf(applied.proposal.rows[1]?.appliedResult);
			expect(applied.proposal.undo).toEqual({ available: true, blockingRowIds: [] });

			const result = await undoChangeProposal(MANAGER, submitted.id);

			if (result.outcome !== CHANGE_PROPOSAL_OUTCOME.undone) {
				throw new Error(`Expected the proposal to be undone, got ${result.outcome}`);
			}
			expect(result.proposal.state).toBe(CHANGE_PROPOSAL_STATE.undone);
			expect(rowStatuses(result.proposal)).toEqual({
				r1: CHANGE_ROW_STATUS.undone,
				r2: CHANGE_ROW_STATUS.undone,
				r3: CHANGE_ROW_STATUS.undone,
			});
			expect((await readGift(giftId)).name).toBe('Míč');
			expect((await readGift(createdGiftId)).deletedAt).not.toBeNull();
			const [invite] = await getDb()
				.select()
				.from(moderatorInvite)
				.where(eq(moderatorInvite.wishlistId, wishlist.id));
			expect(invite?.revokedAt).not.toBeNull();
			await expectRejection(
				undoChangeProposal(MANAGER, submitted.id),
				409,
				SERVER_ERROR.AGENT_PROPOSAL_NOT_APPLIED,
			);
		});

		it('cancels the reservations the proposal made', async () => {
			const wishlist = await createWishlistFixture({
				sharedAt: new Date(Date.now() - HOUR_MS),
			});
			const giftId = await createGiftFixture(wishlist.id, { quantity: 1 });
			const token = await agentToken(RESERVER_ID, { scopes: ['reservations:write'] });
			const submitted = await submit(token, wishlist.shortId, [
				['reserveGift', { giftId, quantity: 1 }],
			]);
			await applyChangeProposalRows(RESERVER, submitted.id, ['r1']);
			expect(await activeReservations(giftId, RESERVER_ID)).toHaveLength(1);

			const result = await undoChangeProposal(RESERVER, submitted.id);

			expect(result.outcome).toBe(CHANGE_PROPOSAL_OUTCOME.undone);
			expect(await activeReservations(giftId, RESERVER_ID)).toHaveLength(0);
		});

		it('reports the gifts changed since apply instead of undoing anything', async () => {
			const wishlist = await createWishlistFixture();
			const changedGiftId = await createGiftFixture(wishlist.id, { name: 'Míč' });
			const untouchedGiftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
			const token = await agentToken(MANAGER_ID);
			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: changedGiftId, name: 'Fotbalový míč' }],
				['updateGift', { id: untouchedGiftId, name: 'Horské kolo' }],
			]);
			await applyChangeProposalRows(MANAGER, submitted.id, ['r1', 'r2']);
			await renameAsRecipient(changedGiftId, 'Basketbalový míč');

			const result = await undoChangeProposal(MANAGER, submitted.id);

			expect(result).toEqual({
				outcome: CHANGE_PROPOSAL_OUTCOME.conflict,
				changedGifts: [{ giftId: changedGiftId, name: 'Basketbalový míč' }],
			});
			expect((await readGift(untouchedGiftId)).name).toBe('Horské kolo');
			const { proposal } = await requireOwnChangeProposal(MANAGER_ID, submitted.id);
			expect(proposal.status).toBe('applied');
		});

		interface IrreversibleCase {
			reviewer: { id: string; name: string };
			proposalId: string;
			blockingRowId: string;
		}

		async function appliedByManager(rows: (wishlistId: string, giftId: string) => Row[]) {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id, { sortOrder: 0 });
			const token = await agentToken(MANAGER_ID, { scopes: ['gifts:write'] });
			const submitted = await submit(token, wishlist.shortId, rows(wishlist.id, giftId));
			const rowIds = submitted.rows.map((row) => row.rowId);
			const applied = await applyChangeProposalRows(MANAGER, submitted.id, rowIds);
			expect(applied.outcome).toBe(CHANGE_PROPOSAL_OUTCOME.applied);
			return submitted.id;
		}

		async function appliedByReserver(operation: string, input: Record<string, unknown>) {
			const wishlist = await createWishlistFixture({
				sharedAt: new Date(Date.now() - HOUR_MS),
			});
			const giftId = await createGiftFixture(wishlist.id, { quantity: 1 });
			await reserveGift(giftId, RESERVER_ID);
			const [reserved] = await activeReservations(giftId, RESERVER_ID);
			const token = await agentToken(RESERVER_ID, { scopes: ['reservations:write'] });
			const submitted = await submit(token, wishlist.shortId, [
				[operation, { reservationId: reserved?.id, ...input }],
			]);
			const applied = await applyChangeProposalRows(RESERVER, submitted.id, ['r1']);
			expect(applied.outcome).toBe(CHANGE_PROPOSAL_OUTCOME.applied);
			return submitted.id;
		}

		const irreversibleCases: [string, () => Promise<IrreversibleCase>][] = [
			[
				'reorderGifts',
				async () => ({
					reviewer: MANAGER,
					proposalId: await appliedByManager((wishlistId, giftId) => [
						['updateGift', { id: giftId, name: 'Upraveno' }],
						['reorderGifts', { wishlistId, orderedGiftIds: [giftId] }],
					]),
					blockingRowId: 'r2',
				}),
			],
			[
				'updateWishlist',
				async () => ({
					reviewer: MANAGER,
					proposalId: await appliedByManager((wishlistId, giftId) => [
						['updateGift', { id: giftId, name: 'Upraveno' }],
						['updateWishlist', { id: wishlistId, title: 'Nový název' }],
					]),
					blockingRowId: 'r2',
				}),
			],
			[
				'cancelOwnReservation',
				async () => ({
					reviewer: RESERVER,
					proposalId: await appliedByReserver('cancelOwnReservation', {}),
					blockingRowId: 'r1',
				}),
			],
			[
				'setReservationPurchased',
				async () => ({
					reviewer: RESERVER,
					proposalId: await appliedByReserver('setReservationPurchased', {
						purchased: true,
					}),
					blockingRowId: 'r1',
				}),
			],
			[
				'createWishlist',
				async () => {
					const token = await agentToken(MANAGER_ID, { fastForward: true });
					const created = await submitChangeProposal(token, {
						operations: [
							{
								operation: 'createWishlist',
								input: {
									title: 'Narozeniny',
									recipientKind: 'other',
									recipientName: 'Jana',
								},
							},
						],
					});
					expect(created.status).toBe(CHANGE_PROPOSAL_STATE.applied);
					return { reviewer: MANAGER, proposalId: created.id, blockingRowId: 'r1' };
				},
			],
			[
				'an accepted manager invitation',
				async () => {
					const wishlist = await createWishlistFixture();
					const token = await agentToken(MANAGER_ID, { scopes: ['managers:invite'] });
					const submitted = await submit(token, wishlist.shortId, [
						[
							'generateModeratorInviteLink',
							{ wishlistId: wishlist.id, email: 'teta@example.com' },
						],
					]);
					await applyChangeProposalRows(MANAGER, submitted.id, ['r1']);
					await getDb()
						.update(moderatorInvite)
						.set({ usedAt: new Date() })
						.where(eq(moderatorInvite.wishlistId, wishlist.id));
					return { reviewer: MANAGER, proposalId: submitted.id, blockingRowId: 'r1' };
				},
			],
		];

		it.each(irreversibleCases)(
			'refuses to undo a batch with %s and undoes nothing',
			async (_label, applyIrreversible) => {
				const { reviewer, proposalId, blockingRowId } = await applyIrreversible();

				const record = await requireOwnChangeProposal(reviewer.id, proposalId);
				const view = await buildChangeProposalView(record);
				expect(view.undo).toEqual({ available: false, blockingRowIds: [blockingRowId] });
				await expectRejection(
					undoChangeProposal(reviewer, proposalId),
					409,
					encodeServerError(SERVER_ERROR.AGENT_PROPOSAL_UNDO_UNSUPPORTED, {
						rowIds: blockingRowId,
					}),
				);
				expect(
					(await requireOwnChangeProposal(reviewer.id, proposalId)).proposal.status,
				).toBe(CHANGE_PROPOSAL_STATE.applied);
			},
		);

		it('answers a reservation cancelled between planning and undo as that row’s failure', async () => {
			const wishlist = await createWishlistFixture({
				sharedAt: new Date(Date.now() - HOUR_MS),
			});
			const giftId = await createGiftFixture(wishlist.id, { quantity: 1 });
			const token = await agentToken(RESERVER_ID, { scopes: ['reservations:write'] });
			const submitted = await submit(token, wishlist.shortId, [
				['reserveGift', { giftId, quantity: 1 }],
			]);
			await applyChangeProposalRows(RESERVER, submitted.id, ['r1']);
			const [reserved] = await activeReservations(giftId, RESERVER_ID);
			const reservationId = reserved?.id ?? '';

			const [directCancel, undo] = await raceBehindRowLock(
				(transaction) =>
					transaction
						.select({ id: reservation.id })
						.from(reservation)
						.where(eq(reservation.id, reservationId))
						.for('update'),
				[
					() =>
						executeOperation(
							userInterfaceActor(RESERVER),
							cancelOwnReservationOperation,
							{ reservationId },
						),
					() => undoChangeProposal(RESERVER, submitted.id),
				],
				{ queueInOrder: true },
			);

			expect(directCancel?.status).toBe('fulfilled');
			expect(undo).toEqual({
				status: 'fulfilled',
				value: {
					outcome: CHANGE_PROPOSAL_OUTCOME.failed,
					rows: [
						{
							rowId: 'r1',
							error: {
								status: 404,
								code: SERVER_ERROR.RESERVATION_NOT_FOUND,
								details: {},
							},
						},
					],
				},
			});
			const { proposal } = await requireOwnChangeProposal(RESERVER_ID, submitted.id);
			expect(proposal.status).toBe(CHANGE_PROPOSAL_STATE.applied);
		});
	});
});
