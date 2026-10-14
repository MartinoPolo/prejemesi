import { describe, expect, it, vi } from 'vitest';
import type * as DatabaseModule from '$lib/server/db/index.js';

vi.mock('$lib/server/db/index.js', async (importOriginal) => ({
	...(await importOriginal<typeof DatabaseModule>()),
	// Every call that gets this far names its wishlist in the input, so nothing may query.
	getDb: () =>
		new Proxy(
			{},
			{
				get() {
					throw new Error('Authorization must not query the database here');
				},
			},
		),
}));

import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import { OPERATION_EXPOSURE } from '$lib/server/operations/operation.js';
import { MAX_OPERATION_BATCH_STEPS } from '$lib/server/operations/constants.js';
import { SERVER_ERROR, type ServerErrorCode } from '$lib/modules/errors/server_error_codes.js';
import {
	authorizeAgentOperation,
	authorizeAgentOperations,
	type AgentOperationRequest,
} from './authorization.js';
import { tokenActor, type AgentAccessGrant } from './agent_grant.js';
import { AGENT_SCOPE, type AgentScope } from './scopes.js';

const ALLOWED_WISHLIST_ID = 'allowed-wishlist';
const OTHER_WISHLIST_ID = 'other-wishlist';

function grantWith(
	scopes: readonly AgentScope[],
	wishlistIds: readonly string[] | null = null,
): AgentAccessGrant {
	return { userId: 'user-1', userName: 'Martin', tokenName: 'Claude', scopes, wishlistIds };
}

const everyScope = Object.values(AGENT_SCOPE);

async function captureRejection(work: Promise<unknown>): Promise<unknown> {
	try {
		await work;
	} catch (thrown) {
		return thrown;
	}
	throw new Error('Expected the authorization to fail');
}

async function expectServerError(
	work: Promise<unknown>,
	status: number,
	code: ServerErrorCode,
	label?: string,
) {
	expect(await captureRejection(work), label).toMatchObject({ status, body: { message: code } });
}

describe('tokenActor', () => {
	it('acts as the token user through the named token channel, never as an administrator', () => {
		expect(tokenActor(grantWith(everyScope))).toEqual({
			userId: 'user-1',
			userName: 'Martin',
			channel: 'token:Claude',
			isAppAdministrator: false,
		});
	});
});

describe('authorizeAgentOperation', () => {
	it('reports human-only and unknown operations alike as not found', async () => {
		const humanOnlyNames = Object.values(OPERATION_REGISTRY)
			.filter((operation) => operation.exposure === OPERATION_EXPOSURE.humanOnly)
			.map((operation) => operation.name);
		expect(humanOnlyNames.length).toBeGreaterThan(0);
		for (const name of [...humanOnlyNames, 'missingOperation', 'toString', '__proto__']) {
			await expectServerError(
				authorizeAgentOperation(grantWith(everyScope), name, {}),
				404,
				SERVER_ERROR.AGENT_OPERATION_NOT_FOUND,
				name,
			);
		}
	});

	it('rejects a call outside the token scopes', async () => {
		const deniedCalls: Array<[readonly AgentScope[], string, unknown]> = [
			[[], 'readPriorityLevels', { wishlistId: ALLOWED_WISHLIST_ID }],
			[[AGENT_SCOPE.read], 'createGift', { wishlistId: ALLOWED_WISHLIST_ID, name: 'Kolo' }],
			[
				[AGENT_SCOPE.read, AGENT_SCOPE.giftsWrite, AGENT_SCOPE.reservationsIdentities],
				'generateModeratorInviteLink',
				{ wishlistId: ALLOWED_WISHLIST_ID, email: 'invitee@example.com' },
			],
			[
				[AGENT_SCOPE.read, AGENT_SCOPE.giftsWrite],
				'reserveGift',
				{ giftId: 'g', quantity: 1 },
			],
		];
		for (const [scopes, name, input] of deniedCalls) {
			await expectServerError(
				authorizeAgentOperation(grantWith(scopes), name, input),
				403,
				SERVER_ERROR.AGENT_SCOPE_MISSING,
				name,
			);
		}
	});

	it('allows a call within the token scopes and reports its target wishlists', async () => {
		const authorized = await authorizeAgentOperation(
			grantWith([AGENT_SCOPE.read, AGENT_SCOPE.giftsWrite]),
			'createGift',
			{ wishlistId: ALLOWED_WISHLIST_ID, name: 'Kolo' },
		);
		expect(authorized).toMatchObject({
			operation: OPERATION_REGISTRY.createGift,
			input: { wishlistId: ALLOWED_WISHLIST_ID, name: 'Kolo' },
			targetWishlistIds: [ALLOWED_WISHLIST_ID],
			requiresConfirmation: false,
		});
	});

	it('flags a manager invitation as needing confirmation', async () => {
		const authorized = await authorizeAgentOperation(
			grantWith([AGENT_SCOPE.read, AGENT_SCOPE.managersInvite]),
			'generateModeratorInviteLink',
			{ wishlistId: ALLOWED_WISHLIST_ID, email: 'invitee@example.com' },
		);
		expect(authorized.requiresConfirmation).toBe(true);
	});

	it('limits a wishlist-restricted token to its wishlists, copies and new wishlists included', async () => {
		const restrictedGrant = grantWith(everyScope, [ALLOWED_WISHLIST_ID]);
		const deniedCalls: Array<[string, unknown]> = [
			['createGift', { wishlistId: OTHER_WISHLIST_ID, name: 'Kolo' }],
			[
				'bulkCopyGifts',
				{
					sourceWishlistId: ALLOWED_WISHLIST_ID,
					destinationWishlistId: OTHER_WISHLIST_ID,
					giftIds: ['gift'],
				},
			],
			['createWishlist', { title: 'Narozeniny', recipientKind: 'self' }],
		];
		for (const [name, input] of deniedCalls) {
			await expectServerError(
				authorizeAgentOperation(restrictedGrant, name, input),
				403,
				SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED,
				name,
			);
		}
		await expect(
			authorizeAgentOperation(restrictedGrant, 'createGift', {
				wishlistId: ALLOWED_WISHLIST_ID,
				name: 'Kolo',
			}),
		).resolves.toMatchObject({ targetWishlistIds: [ALLOWED_WISHLIST_ID] });
	});

	it('lets an unrestricted token create wishlists', async () => {
		const authorized = await authorizeAgentOperation(grantWith(everyScope), 'createWishlist', {
			title: 'Narozeniny',
			recipientKind: 'self',
		});
		expect(authorized.targetWishlistIds).toEqual([]);
	});

	it('rejects input that does not match the operation schema', async () => {
		await expectServerError(
			authorizeAgentOperation(grantWith(everyScope), 'createGift', { wishlistId: 42 }),
			400,
			SERVER_ERROR.INVALID_OPERATION_INPUT,
		);
	});

	it('rejects image references in gift, wishlist and import inputs', async () => {
		const imageCalls: Array<[string, unknown]> = [
			[
				'createGift',
				{ wishlistId: ALLOWED_WISHLIST_ID, name: 'Kolo', imageKey: 'gifts/foreign.webp' },
			],
			[
				'createGift',
				{
					wishlistId: ALLOWED_WISHLIST_ID,
					name: 'Kolo',
					imageUrl: 'https://example.com/kolo.jpg',
				},
			],
			['updateGift', { id: 'gift', imageKey: 'gifts/foreign.webp' }],
			['updateGift', { id: 'gift', imageUrl: null }],
			['updateWishlist', { id: ALLOWED_WISHLIST_ID, imageKey: 'wishlists/foreign.webp' }],
			[
				'saveWishlistSettings',
				{
					wishlistId: ALLOWED_WISHLIST_ID,
					image: { imageKey: 'wishlists/foreign.webp', imageSlots: null },
				},
			],
			[
				'importGifts',
				{
					wishlistId: ALLOWED_WISHLIST_ID,
					gifts: [{ name: 'Kolo', imageUrl: 'https://example.com/kolo.jpg' }],
				},
			],
			[
				'createWishlistFromImport',
				{
					title: 'Narozeniny',
					recipientKind: 'self',
					gifts: [{ name: 'Kolo', imageUrl: 'https://example.com/kolo.jpg' }],
				},
			],
		];
		for (const [name, input] of imageCalls) {
			await expectServerError(
				authorizeAgentOperation(grantWith(everyScope), name, input),
				400,
				SERVER_ERROR.AGENT_IMAGE_INPUT_UNSUPPORTED,
				name,
			);
		}
	});

	it('still accepts image presentation changes and imports without images', async () => {
		await expect(
			authorizeAgentOperation(grantWith(everyScope), 'createGift', {
				wishlistId: ALLOWED_WISHLIST_ID,
				name: 'Kolo',
				imageMeta: { fitMode: 'cover-crop' },
			}),
		).resolves.toMatchObject({ targetWishlistIds: [ALLOWED_WISHLIST_ID] });
		await expect(
			authorizeAgentOperation(grantWith(everyScope), 'importGifts', {
				wishlistId: ALLOWED_WISHLIST_ID,
				gifts: [{ name: 'Kolo' }],
			}),
		).resolves.toMatchObject({ targetWishlistIds: [ALLOWED_WISHLIST_ID] });
	});
});

describe('authorization precedence', () => {
	it('checks the scope before validating the input', async () => {
		await expectServerError(
			authorizeAgentOperation(grantWith([AGENT_SCOPE.read]), 'createGift', {
				wishlistId: 42,
			}),
			403,
			SERVER_ERROR.AGENT_SCOPE_MISSING,
		);
	});

	it('checks the scope before the wishlist restriction', async () => {
		await expectServerError(
			authorizeAgentOperation(
				grantWith([AGENT_SCOPE.read], [ALLOWED_WISHLIST_ID]),
				'createGift',
				{
					wishlistId: OTHER_WISHLIST_ID,
					name: 'Kolo',
				},
			),
			403,
			SERVER_ERROR.AGENT_SCOPE_MISSING,
		);
	});

	it('validates the input before the wishlist restriction', async () => {
		await expectServerError(
			authorizeAgentOperation(grantWith(everyScope, [ALLOWED_WISHLIST_ID]), 'createGift', {
				wishlistId: OTHER_WISHLIST_ID,
			}),
			400,
			SERVER_ERROR.INVALID_OPERATION_INPUT,
		);
	});

	it('checks every step of a batch for scope before validating any input', async () => {
		await expectServerError(
			authorizeAgentOperations(grantWith([AGENT_SCOPE.read, AGENT_SCOPE.giftsWrite]), [
				{ operationName: 'createGift', input: { wishlistId: 42 } },
				{ operationName: 'reserveGift', input: { giftId: 'gift', quantity: 1 } },
			]),
			403,
			SERVER_ERROR.AGENT_SCOPE_MISSING,
		);
	});
});

describe('authorizeAgentOperations', () => {
	it('authorizes every step with its own target wishlists and confirmation', async () => {
		const authorized = await authorizeAgentOperations(grantWith(everyScope), [
			{
				operationName: 'createGift',
				input: { wishlistId: ALLOWED_WISHLIST_ID, name: 'Kolo' },
			},
			{
				operationName: 'bulkCopyGifts',
				input: {
					sourceWishlistId: ALLOWED_WISHLIST_ID,
					destinationWishlistId: OTHER_WISHLIST_ID,
					giftIds: ['gift'],
				},
			},
			{
				operationName: 'generateModeratorInviteLink',
				input: { wishlistId: OTHER_WISHLIST_ID, email: 'invitee@example.com' },
			},
		]);
		expect(
			authorized.map(({ targetWishlistIds, requiresConfirmation }) => ({
				targetWishlistIds,
				requiresConfirmation,
			})),
		).toEqual([
			{ targetWishlistIds: [ALLOWED_WISHLIST_ID], requiresConfirmation: false },
			{
				targetWishlistIds: [ALLOWED_WISHLIST_ID, OTHER_WISHLIST_ID],
				requiresConfirmation: false,
			},
			{ targetWishlistIds: [OTHER_WISHLIST_ID], requiresConfirmation: true },
		]);
	});

	it('rejects the whole batch when one step leaves the wishlist restriction', async () => {
		await expectServerError(
			authorizeAgentOperations(grantWith(everyScope, [ALLOWED_WISHLIST_ID]), [
				{
					operationName: 'createGift',
					input: { wishlistId: ALLOWED_WISHLIST_ID, name: 'A' },
				},
				{
					operationName: 'createGift',
					input: { wishlistId: OTHER_WISHLIST_ID, name: 'B' },
				},
			]),
			403,
			SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED,
		);
	});

	it('rejects an empty batch and one beyond the step limit', async () => {
		const createGift: AgentOperationRequest = {
			operationName: 'createGift',
			input: { wishlistId: ALLOWED_WISHLIST_ID, name: 'Kolo' },
		};
		for (const requests of [
			[],
			Array.from({ length: MAX_OPERATION_BATCH_STEPS + 1 }, () => createGift),
		]) {
			await expectServerError(
				authorizeAgentOperations(grantWith(everyScope), requests),
				400,
				SERVER_ERROR.INVALID_OPERATION_INPUT,
				String(requests.length),
			);
		}
	});
});
