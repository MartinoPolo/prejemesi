import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	createGiftFixture,
	createWishlistFixture,
	expectRejection,
	raceBehindRowLock,
	readGift,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { agentImage } from '$lib/server/db/agent_image.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { agentImageStorage, type AgentImageBucket } from '$lib/server/storage/r2.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { CHANGE_PROPOSAL_OUTCOME } from '$lib/modules/change_proposals/types.js';
import { DEFAULT_IMAGE_METADATA } from '$lib/modules/images/types.js';
import { GIFT_REVISION_RETENTION_MS } from '$lib/server/operations/constants.js';
import {
	EXIF_ORIENTATION_ROTATE_CLOCKWISE,
	identifyingTextIn,
	structuralJpeg,
	structuralPng,
	withExifOrientation,
	withPhoneMetadata,
} from '$lib/modules/uploads/image_metadata.test_fixtures.js';
import { authenticateAccessToken, createAccessToken } from './access_tokens.js';
import type { AgentCaller } from './agent_caller.js';
import { submitChangeProposal } from './change_proposal_api.js';
import { undoChangeProposal } from './change_proposals.js';
import { applyRows } from './change_proposals.db.test-setup.js';
import { uploadAgentImage } from './image_upload.js';
import { purgeAgentAccessRecords } from './agent_access_purge.js';
import { AGENT_IMAGE_PURGE_DELAY_MS } from './limits.js';

const MANAGER = { id: MANAGER_ID, name: 'Manager' };
const HOUR_MS = 60 * 60 * 1000;

type Row = [operation: string, input: Record<string, unknown>];

function pngResponse(): Response {
	return new Response(structuralPng(320, 240), { headers: { 'content-type': 'image/png' } });
}

const storedObjects = new Set<string>();
const storedBodies = new Map<string, unknown>();
const bucket: AgentImageBucket = {
	put: async (key, body) => {
		storedObjects.add(key);
		storedBodies.set(key, body);
		return null;
	},
	delete: async (keys) => {
		for (const key of keys) {
			storedObjects.delete(key);
		}
	},
};
const storage = agentImageStorage(bucket);

async function agentToken(userId: string): Promise<AgentCaller> {
	const { value } = await createAccessToken(
		userId,
		v.parse(CreateAccessTokenInputSchema, {
			name: 'Claude',
			scopes: ['gifts:write'],
			wishlistIds: null,
		}),
	);
	return authenticateAccessToken(`Bearer ${value}`);
}

async function uploadFor(token: AgentCaller, wishlistId: string) {
	const image = await uploadAgentImage(
		token,
		{ wishlistId, url: 'https://shop.example/kolo.png' },
		{ fetch: async () => pngResponse(), storage },
	);
	const [row] = await getDb().select().from(agentImage).where(eq(agentImage.id, image.reference));
	if (row === undefined) {
		throw new Error('The uploaded image has no row');
	}
	return row;
}

async function submit(token: AgentCaller, wishlistShortId: string, rows: Row[]) {
	return submitChangeProposal(token, {
		wishlistShortId,
		operations: rows.map(([operation, input]) => ({ operation, input })),
	});
}

async function applyAll(proposalId: string, rowIds = ['r1']) {
	const result = await applyRows(MANAGER, proposalId, rowIds);
	if (result.outcome !== CHANGE_PROPOSAL_OUTCOME.applied) {
		throw new Error(`Expected the proposal to apply, got ${JSON.stringify(result)}`);
	}
	return result;
}

function createdGiftIdOf(result: unknown): string {
	return v.parse(v.object({ gift: v.object({ id: v.string() }) }), result).gift.id;
}

async function storedImage(referenceId: string) {
	const [row] = await getDb().select().from(agentImage).where(eq(agentImage.id, referenceId));
	return row;
}

describe.skipIf(!DB_READY)('agent image references', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	describe('attaching through a proposal', () => {
		it('creates a gift whose image is the owned stored copy, never an external URL', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const image = await uploadFor(token, wishlist.id);

			const submitted = await submit(token, wishlist.shortId, [
				['createGift', { wishlistId: wishlist.id, name: 'Kolo', imageReference: image.id }],
			]);
			const applied = await applyAll(submitted.id);

			const created = await readGift(
				createdGiftIdOf(applied.proposal.rows[0]?.appliedResult),
			);
			expect(created.imageKey).toBe(image.objectKey);
			expect(created.imageUrl).toBeNull();
			expect(created.imageMeta).toEqual(DEFAULT_IMAGE_METADATA);
			expect((await storedImage(image.id))?.attachedAt).not.toBeNull();
		});

		it('replaces a gift’s image, and undo restores the previous one', async () => {
			const wishlist = await createWishlistFixture();
			const giftId = await createGiftFixture(wishlist.id, {
				name: 'Míč',
				imageUrl: 'https://shop.example/old.png',
			});
			const token = await agentToken(MANAGER_ID);
			const image = await uploadFor(token, wishlist.id);

			const submitted = await submit(token, wishlist.shortId, [
				['updateGift', { id: giftId, imageReference: image.id }],
			]);
			await applyAll(submitted.id);

			const updated = await readGift(giftId);
			expect(updated.imageKey).toBe(image.objectKey);
			expect(updated.imageUrl).toBeNull();

			const undone = await undoChangeProposal(MANAGER, submitted.id);

			expect(undone.outcome).toBe(CHANGE_PROPOSAL_OUTCOME.undone);
			const restored = await readGift(giftId);
			expect(restored.imageUrl).toBe('https://shop.example/old.png');
			expect(restored.imageKey).toBeNull();
		});

		it('still rejects an image URL or storage key in a gift input', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const image = await uploadFor(token, wishlist.id);

			for (const input of [
				{ imageUrl: 'https://shop.example/kolo.png' },
				{ imageKey: image.objectKey },
				{ imageReference: image.id, imageKey: image.objectKey },
			]) {
				await expectRejection(
					submit(token, wishlist.shortId, [
						['createGift', { wishlistId: wishlist.id, name: 'Kolo', ...input }],
					]),
					400,
					SERVER_ERROR.AGENT_IMAGE_INPUT_UNSUPPORTED,
				);
			}
		});

		it('rejects a reference on an operation that takes no image', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const image = await uploadFor(token, wishlist.id);

			for (const row of [
				['updateWishlist', { id: wishlist.id, title: 'Nový', imageReference: image.id }],
				[
					'importGifts',
					{
						wishlistId: wishlist.id,
						gifts: [{ name: 'Kolo', imageReference: image.id }],
					},
				],
			] satisfies Row[]) {
				await expectRejection(
					submit(token, wishlist.shortId, [row]),
					400,
					SERVER_ERROR.AGENT_IMAGE_INPUT_UNSUPPORTED,
				);
			}
			expect((await storedImage(image.id))?.attachedAt).toBeNull();
		});

		it('previews the stored image key on submission without attaching the reference', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const image = await uploadFor(token, wishlist.id);

			const submitted = await submit(token, wishlist.shortId, [
				['createGift', { wishlistId: wishlist.id, name: 'Kolo', imageReference: image.id }],
			]);

			const [stored] = await getDb()
				.select({ rows: changeProposal.rows })
				.from(changeProposal)
				.where(eq(changeProposal.id, submitted.id));
			expect(stored?.rows[0]?.preview?.giftChanges[0]?.after.imageKey).toBe(image.objectKey);
			expect((await storedImage(image.id))?.attachedAt).toBeNull();
		});

		it('attaches a reference to one gift when two proposals apply it at once', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const image = await uploadFor(token, wishlist.id);
			const createRow = (name: string): Row => [
				'createGift',
				{ wishlistId: wishlist.id, name, imageReference: image.id },
			];
			const first = await submit(token, wishlist.shortId, [createRow('A')]);
			const second = await submit(token, wishlist.shortId, [createRow('B')]);

			const outcomes = await raceBehindRowLock(
				(transaction) =>
					transaction
						.select({ id: agentImage.id })
						.from(agentImage)
						.where(eq(agentImage.id, image.id))
						.for('update'),
				[
					() => applyRows(MANAGER, first.id, ['r1']),
					() => applyRows(MANAGER, second.id, ['r1']),
				],
			);

			const results = outcomes.map((outcome) =>
				outcome.status === 'fulfilled' ? outcome.value : outcome.reason,
			);
			expect(results).toContainEqual(
				expect.objectContaining({ outcome: CHANGE_PROPOSAL_OUTCOME.applied }),
			);
			expect(results).toContainEqual(
				expect.objectContaining({
					outcome: CHANGE_PROPOSAL_OUTCOME.failed,
					rows: [
						expect.objectContaining({
							error: expect.objectContaining({
								status: 409,
								code: SERVER_ERROR.AGENT_IMAGE_REFERENCE_USED,
							}),
						}),
					],
				}),
			);
			const giftsWithImage = await getDb()
				.select({ id: gift.id })
				.from(gift)
				.where(and(eq(gift.wishlistId, wishlist.id), eq(gift.imageKey, image.objectKey)));
			expect(giftsWithImage).toHaveLength(1);
		});
	});

	describe('stored bytes', () => {
		it('stores a downloaded phone photo without its GPS and camera metadata, keeping its orientation', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const photo = withPhoneMetadata(structuralJpeg(), EXIF_ORIENTATION_ROTATE_CLOCKWISE);

			const image = await uploadAgentImage(
				token,
				{ wishlistId: wishlist.id, url: 'https://shop.example/foto.jpg' },
				{
					fetch: async () =>
						new Response(photo, { headers: { 'content-type': 'image/jpeg' } }),
					storage,
				},
			);

			const [row] = await getDb()
				.select()
				.from(agentImage)
				.where(eq(agentImage.id, image.reference));
			const stored = storedBodies.get(row!.objectKey) as Uint8Array;
			expect(identifyingTextIn(stored)).toEqual([]);
			expect(stored).toEqual(
				withExifOrientation(structuralJpeg(), EXIF_ORIENTATION_ROTATE_CLOCKWISE),
			);
			expect(image.byteLength).toBe(stored.byteLength);
			expect(row!.byteLength).toBe(stored.byteLength);
		});
	});

	describe('ownership and validity', () => {
		it('rejects a reference another user uploaded, even for the same wishlist', async () => {
			const wishlist = await createWishlistFixture();
			const recipientImage = await uploadFor(await agentToken(RECIPIENT_ID), wishlist.id);
			const token = await agentToken(MANAGER_ID);

			await expectRejection(
				submit(token, wishlist.shortId, [
					[
						'createGift',
						{
							wishlistId: wishlist.id,
							name: 'Kolo',
							imageReference: recipientImage.id,
						},
					],
				]),
				400,
				SERVER_ERROR.AGENT_IMAGE_REFERENCE_INVALID,
			);
		});

		it('rejects a reference uploaded for another wishlist, and an unknown one', async () => {
			const wishlist = await createWishlistFixture();
			const otherWishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const otherImage = await uploadFor(token, otherWishlist.id);

			for (const imageReference of [otherImage.id, 'no-such-reference']) {
				await expectRejection(
					submit(token, wishlist.shortId, [
						['createGift', { wishlistId: wishlist.id, name: 'Kolo', imageReference }],
					]),
					400,
					SERVER_ERROR.AGENT_IMAGE_REFERENCE_INVALID,
				);
			}
		});

		it('rejects an expired reference with 410', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const image = await uploadFor(token, wishlist.id);
			await getDb()
				.update(agentImage)
				.set({ expiresAt: new Date(Date.now() - 1000) })
				.where(eq(agentImage.id, image.id));

			await expectRejection(
				submit(token, wishlist.shortId, [
					[
						'createGift',
						{ wishlistId: wishlist.id, name: 'Kolo', imageReference: image.id },
					],
				]),
				410,
				SERVER_ERROR.AGENT_IMAGE_REFERENCE_EXPIRED,
			);
		});

		it('attaches a reference once: reuse answers 409 and a repeat in one proposal 400', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const image = await uploadFor(token, wishlist.id);
			const createRow = (name: string): Row => [
				'createGift',
				{ wishlistId: wishlist.id, name, imageReference: image.id },
			];

			await expectRejection(
				submit(token, wishlist.shortId, [createRow('A'), createRow('B')]),
				400,
				SERVER_ERROR.AGENT_IMAGE_REFERENCE_INVALID,
			);
			await applyAll((await submit(token, wishlist.shortId, [createRow('A')])).id);
			await expectRejection(
				submit(token, wishlist.shortId, [createRow('B')]),
				409,
				SERVER_ERROR.AGENT_IMAGE_REFERENCE_USED,
			);
		});

		it('re-checks at apply: a reference another proposal attached first fails the row', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const image = await uploadFor(token, wishlist.id);
			const createRow = (name: string): Row => [
				'createGift',
				{ wishlistId: wishlist.id, name, imageReference: image.id },
			];
			const first = await submit(token, wishlist.shortId, [createRow('A')]);
			const second = await submit(token, wishlist.shortId, [createRow('B')]);

			await applyAll(first.id);
			const result = await applyRows(MANAGER, second.id, ['r1']);

			expect(result).toMatchObject({
				outcome: CHANGE_PROPOSAL_OUTCOME.failed,
				rows: [
					{
						rowId: 'r1',
						error: { status: 409, code: SERVER_ERROR.AGENT_IMAGE_REFERENCE_USED },
					},
				],
			});
		});

		it('re-checks at apply: a reference that expired since submission fails the row', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const image = await uploadFor(token, wishlist.id);
			const submitted = await submit(token, wishlist.shortId, [
				['createGift', { wishlistId: wishlist.id, name: 'Kolo', imageReference: image.id }],
			]);
			await getDb()
				.update(agentImage)
				.set({ expiresAt: new Date(Date.now() - 1000) })
				.where(eq(agentImage.id, image.id));

			const result = await applyRows(MANAGER, submitted.id, ['r1']);

			expect(result).toMatchObject({
				outcome: CHANGE_PROPOSAL_OUTCOME.failed,
				rows: [
					{
						rowId: 'r1',
						error: { status: 410, code: SERVER_ERROR.AGENT_IMAGE_REFERENCE_EXPIRED },
					},
				],
			});
		});
	});

	describe('purge', () => {
		it('deletes unattached expired images with their objects and keeps the copy a gift uses', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const unattached = await uploadFor(token, wishlist.id);
			const fresh = await uploadFor(token, wishlist.id);
			const used = await uploadFor(token, wishlist.id);
			const detached = await uploadFor(token, wishlist.id);
			await createGiftFixture(wishlist.id, { imageKey: used.objectKey });
			const now = new Date();
			const longExpired = new Date(now.getTime() - AGENT_IMAGE_PURGE_DELAY_MS - HOUR_MS);
			const pastUndoWindow = new Date(
				now.getTime() - GIFT_REVISION_RETENTION_MS - AGENT_IMAGE_PURGE_DELAY_MS - HOUR_MS,
			);
			await getDb()
				.update(agentImage)
				.set({ expiresAt: longExpired })
				.where(eq(agentImage.id, unattached.id));
			for (const attached of [used, detached]) {
				await getDb()
					.update(agentImage)
					.set({ expiresAt: pastUndoWindow, attachedAt: pastUndoWindow })
					.where(eq(agentImage.id, attached.id));
			}

			await purgeAgentAccessRecords(now, storage);

			expect(await storedImage(unattached.id)).toBeUndefined();
			expect(storedObjects.has(unattached.objectKey)).toBe(false);
			expect(await storedImage(used.id)).toBeUndefined();
			expect(storedObjects.has(used.objectKey)).toBe(true);
			expect(await storedImage(detached.id)).toBeUndefined();
			expect(storedObjects.has(detached.objectKey)).toBe(false);
			expect(await storedImage(fresh.id)).toBeDefined();
			expect(storedObjects.has(fresh.objectKey)).toBe(true);
		});

		it('keeps an attached image while undo could still detach it, and every row when storage fails', async () => {
			const wishlist = await createWishlistFixture();
			const token = await agentToken(MANAGER_ID);
			const recentlyAttached = await uploadFor(token, wishlist.id);
			const expired = await uploadFor(token, wishlist.id);
			const now = new Date();
			const longExpired = new Date(now.getTime() - AGENT_IMAGE_PURGE_DELAY_MS - HOUR_MS);
			await getDb()
				.update(agentImage)
				.set({ expiresAt: longExpired, attachedAt: new Date(now.getTime() - 30 * HOUR_MS) })
				.where(eq(agentImage.id, recentlyAttached.id));
			await getDb()
				.update(agentImage)
				.set({ expiresAt: longExpired })
				.where(eq(agentImage.id, expired.id));
			const failingStorage = agentImageStorage({
				put: bucket.put,
				delete: vi.fn(async () => {
					throw new Error('R2 unavailable');
				}),
			});

			await expect(purgeAgentAccessRecords(now, failingStorage)).rejects.toThrow(
				'R2 unavailable',
			);
			expect(await storedImage(expired.id)).toBeDefined();

			await purgeAgentAccessRecords(now, storage);
			expect(await storedImage(expired.id)).toBeUndefined();
			expect(await storedImage(recentlyAttached.id)).toBeDefined();
			expect(storedObjects.has(recentlyAttached.objectKey)).toBe(true);
		});
	});
});
