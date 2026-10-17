import {
	DB_READY,
	captureError,
	createGiftFixture,
	createWishlistFixture,
	managerActor,
	readGift,
	removeFixtureRows,
	revisionsForGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { executeOperationBatch, previewOperationBatch } from './runner.js';
import { deleteGiftOperation, updateGiftOperation } from './gift_mutation_operations.js';

describe.skipIf(!DB_READY)('operation batch preview', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('reports each step’s outcome, later steps seeing earlier ones, and commits nothing', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlistId, { name: 'Kolo' });

		const previews = await previewOperationBatch(managerActor, [
			{ operation: updateGiftOperation, input: { id: giftId, name: 'Horské kolo' } },
			{ operation: deleteGiftOperation, input: { giftId: 'no-such-gift' } },
			{ operation: updateGiftOperation, input: { id: giftId, name: 'Silniční kolo' } },
		]);

		expect(previews).toEqual([
			{
				accepted: true,
				result: expect.anything(),
				revisions: [
					expect.objectContaining({
						giftId,
						before: expect.objectContaining({ name: 'Kolo' }),
						after: expect.objectContaining({ name: 'Horské kolo' }),
					}),
				],
			},
			{ accepted: false, rejection: { status: 404, message: SERVER_ERROR.GIFT_NOT_FOUND } },
			{
				accepted: true,
				result: expect.anything(),
				revisions: [
					expect.objectContaining({
						before: expect.objectContaining({ name: 'Horské kolo' }),
						after: expect.objectContaining({ name: 'Silniční kolo' }),
					}),
				],
			},
		]);
		expect((await readGift(giftId)).name).toBe('Kolo');
		expect(await revisionsForGift(giftId)).toEqual([]);
	});

	it('runs the commit hook inside the batch and rolls everything back when it throws', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlistId, { name: 'Kolo' });
		const hookRefusal = new Error('refused before commit');
		let hookSawResults: unknown[] = [];

		const thrown = await captureError(
			executeOperationBatch(
				managerActor,
				[{ operation: updateGiftOperation, input: { id: giftId, name: 'Horské kolo' } }],
				{
					beforeCommit: async (_transaction, { results }) => {
						hookSawResults = results;
						throw hookRefusal;
					},
				},
			),
		);

		expect(thrown).toBe(hookRefusal);
		expect(hookSawResults).toHaveLength(1);
		expect((await readGift(giftId)).name).toBe('Kolo');
	});

	it('names the failing step before the batch rolls back', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlistId, { name: 'Kolo' });
		const failedSteps: number[] = [];

		await captureError(
			executeOperationBatch(
				managerActor,
				[
					{ operation: updateGiftOperation, input: { id: giftId, name: 'Horské kolo' } },
					{ operation: deleteGiftOperation, input: { giftId: 'no-such-gift' } },
				],
				{ onStepFailed: (stepIndex) => failedSteps.push(stepIndex) },
			),
		);

		expect(failedSteps).toEqual([1]);
		expect((await readGift(giftId)).name).toBe('Kolo');
	});
});
