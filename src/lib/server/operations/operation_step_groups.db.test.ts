import {
	DB_READY,
	captureError,
	createGiftFixture,
	createWishlistFixture,
	errorMessage,
	managerActor,
	readGift,
	removeFixtureRows,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { executeOperationBatch, previewOperationBatch } from './runner.js';
import {
	appendGiftDescriptionOperation,
	markGiftReceivedOperation,
	updateGiftOperation,
} from './gift_mutation_operations.js';

describe.skipIf(!DB_READY)('batch steps on distinct gifts', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('apply as a sequential run would: later steps on a gift see earlier ones, revisions in step order', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const firstGiftId = await createGiftFixture(wishlistId, {
			name: 'Kolo',
			description: null,
		});
		const secondGiftId = await createGiftFixture(wishlistId, { name: 'Helma' });
		const thirdGiftId = await createGiftFixture(wishlistId, { name: 'Zvonek' });

		const result = await executeOperationBatch(managerActor, [
			{
				operation: appendGiftDescriptionOperation,
				input: { giftId: firstGiftId, text: 'Modré' },
			},
			{ operation: updateGiftOperation, input: { id: secondGiftId, price: 900 } },
			{
				operation: markGiftReceivedOperation,
				input: { giftId: thirdGiftId, received: true },
			},
			{
				operation: appendGiftDescriptionOperation,
				input: { giftId: firstGiftId, text: 'S košíkem' },
			},
		]);

		const firstDescription = (await readGift(firstGiftId)).description ?? '';
		expect(firstDescription.indexOf('Modré')).toBeGreaterThanOrEqual(0);
		expect(firstDescription.indexOf('S košíkem')).toBeGreaterThan(
			firstDescription.indexOf('Modré'),
		);
		expect((await readGift(secondGiftId)).price).toBe(900);
		expect((await readGift(thirdGiftId)).received).toBe(true);
		expect(result.revisions.map((revision) => revision.giftId)).toEqual([
			firstGiftId,
			secondGiftId,
			thirdGiftId,
		]);
		expect(new Set(result.revisions.map((revision) => revision.batchId))).toEqual(
			new Set([result.batchId]),
		);
	});

	it('names the first failing step, even behind a step of another operation that also fails', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlistId, { name: 'Kolo' });
		const failedSteps: number[] = [];

		const thrown = await captureError(
			executeOperationBatch(
				managerActor,
				[
					{ operation: updateGiftOperation, input: { id: giftId, name: 'Horské kolo' } },
					{
						operation: updateGiftOperation,
						input: { id: 'no-such-gift', name: 'Helma' },
					},
					{
						operation: markGiftReceivedOperation,
						input: { giftId: 'no-other-gift', received: true },
					},
				],
				{ onStepFailed: (stepIndex) => failedSteps.push(stepIndex) },
			),
		);

		expect(failedSteps).toEqual([1]);
		expect(errorMessage(thrown)).toBe(SERVER_ERROR.GIFT_NOT_FOUND);
		expect((await readGift(giftId)).name).toBe('Kolo');
	});

	it('preview each step with only its own gift’s revisions when one of them is rejected', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const firstGiftId = await createGiftFixture(wishlistId, { name: 'Kolo' });
		const secondGiftId = await createGiftFixture(wishlistId, { name: 'Helma' });
		const thirdGiftId = await createGiftFixture(wishlistId, { name: 'Zvonek' });
		const steps = [
			{ operation: updateGiftOperation, input: { id: firstGiftId, name: 'Horské kolo' } },
			{ operation: updateGiftOperation, input: { id: 'no-such-gift', name: 'Brašna' } },
			{ operation: updateGiftOperation, input: { id: secondGiftId, name: 'Přilba' } },
			{
				operation: markGiftReceivedOperation,
				input: { giftId: thirdGiftId, received: true },
			},
		];
		const ownRevision = (giftId: string) => ({
			accepted: true,
			result: expect.anything(),
			revisions: [expect.objectContaining({ giftId })],
		});

		expect(await previewOperationBatch(managerActor, steps)).toEqual([
			ownRevision(firstGiftId),
			{ accepted: false, rejection: { status: 404, message: SERVER_ERROR.GIFT_NOT_FOUND } },
			ownRevision(secondGiftId),
			ownRevision(thirdGiftId),
		]);
		expect(
			await previewOperationBatch(
				managerActor,
				steps.filter((_, index) => index !== 1),
			),
		).toEqual([ownRevision(firstGiftId), ownRevision(secondGiftId), ownRevision(thirdGiftId)]);
		expect((await readGift(firstGiftId)).name).toBe('Kolo');
		expect((await readGift(thirdGiftId)).received).toBe(false);
	});
});
