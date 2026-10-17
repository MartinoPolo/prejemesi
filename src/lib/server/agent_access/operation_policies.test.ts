import { describe, expect, it } from 'vitest';
import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import { OPERATION_EXPOSURE, OPERATION_KIND } from '$lib/server/operations/operation.js';
import {
	AGENT_OPERATION_POLICIES,
	isOperationName,
	type AgentOperationPolicy,
	type OperationName,
} from './operation_policies.js';
import { TARGET_KIND } from './policy_lookups.js';
import type { AgentAccessGrant } from './agent_grant.js';
import { AGENT_SCOPE, type AgentScope } from '$lib/modules/access_tokens/scopes.js';

const RESERVATION_OPERATION_NAMES = [
	'reserveGift',
	'cancelOwnReservation',
	'setReservationPurchased',
] as const satisfies readonly OperationName[];
const MANAGER_INVITATION_OPERATION_NAME = 'generateModeratorInviteLink' satisfies OperationName;

const operationNames = Object.keys(OPERATION_REGISTRY).filter(isOperationName);
const agentOperationNames = operationNames.filter(
	(name) => OPERATION_REGISTRY[name].exposure === OPERATION_EXPOSURE.agent,
);

const grant: AgentAccessGrant = {
	userId: 'user-1',
	userName: 'Martin',
	tokenName: 'Claude',
	scopes: Object.values(AGENT_SCOPE),
	wishlistIds: null,
};

function expectedScope(name: OperationName): AgentScope {
	if (OPERATION_REGISTRY[name].kind === OPERATION_KIND.read) {
		return AGENT_SCOPE.read;
	}
	if ((RESERVATION_OPERATION_NAMES as readonly string[]).includes(name)) {
		return AGENT_SCOPE.reservationsWrite;
	}
	if (name === MANAGER_INVITATION_OPERATION_NAME) {
		return AGENT_SCOPE.managersInvite;
	}
	return AGENT_SCOPE.giftsWrite;
}

function policyOf(name: OperationName): AgentOperationPolicy<unknown, unknown> {
	const policy: AgentOperationPolicy<unknown, unknown> | null = AGENT_OPERATION_POLICIES[name];
	if (policy === null) {
		throw new Error(`${name} has no agent policy`);
	}
	return policy;
}

const createdAt = new Date('2026-10-01T10:00:00Z');

const wishlistRow = {
	id: 'wishlist-1',
	demoSessionId: 'demo-session',
	shortId: 'short-1',
	recipientUserId: 'recipient-user',
	recipientName: null,
	title: 'Vánoce',
	description: null,
	eventDate: null,
	status: 'draft',
	theme: 'default',
	customThemeColor: '#123456',
	palette: 'sky',
	imageKey: 'wishlists/banner.webp',
	imageSlots: null,
	recipientIsModerator: false,
	sharedAt: null,
	eventDateEditedAt: createdAt,
	archivedAt: null,
	deletedAt: null,
	createdAt,
	updatedAt: createdAt,
};

const INTERNAL_WISHLIST_FIELDS = [
	'demoSessionId',
	'recipientUserId',
	'theme',
	'customThemeColor',
	'imageKey',
	'imageSlots',
	'eventDateEditedAt',
	'deletedAt',
];

const giftRow = {
	id: 'gift-1',
	wishlistId: 'wishlist-1',
	priorityLevelId: null,
	categoryId: null,
	name: 'Kolo',
	description: null,
	descriptionAppends: [],
	editedAfterShareAt: null,
	preEditShareSnapshot: { name: 'Staré kolo' },
	links: [],
	price: 5000,
	priceMax: null,
	currency: 'CZK',
	imageUrl: null,
	imageKey: 'gifts/kolo.webp',
	imageMeta: null,
	quantity: 1,
	sortOrder: 0,
	received: false,
	deletedAt: null,
	createdAt,
	updatedAt: createdAt,
};

const INTERNAL_GIFT_FIELDS = ['preEditShareSnapshot', 'imageKey', 'deletedAt', 'updatedAt'];

describe('agent operation policies', () => {
	it('gives every agent-exposed operation a policy and no human-only operation one', () => {
		expect(Object.keys(AGENT_OPERATION_POLICIES).sort()).toEqual([...operationNames].sort());
		for (const name of operationNames) {
			const isAgentExposed = OPERATION_REGISTRY[name].exposure === OPERATION_EXPOSURE.agent;
			expect(AGENT_OPERATION_POLICIES[name] !== null, name).toBe(isAgentExposed);
		}
	});

	it('requires read for reads, reservations:write for reserving, managers:invite for inviting and gifts:write for every other change', () => {
		for (const name of agentOperationNames) {
			expect(AGENT_OPERATION_POLICIES[name]?.scope, name).toBe(expectedScope(name));
		}
	});

	it('never grants anything through the identities scope alone', () => {
		const scopes = agentOperationNames.map((name) => AGENT_OPERATION_POLICIES[name]?.scope);
		expect(scopes).not.toContain(AGENT_SCOPE.reservationsIdentities);
	});

	it('requires confirmation for gift deletion, every reservation operation and manager invitations', () => {
		const alwaysConfirmedNames: OperationName[] = [
			'deleteGift',
			...RESERVATION_OPERATION_NAMES,
			MANAGER_INVITATION_OPERATION_NAME,
		];
		for (const name of agentOperationNames) {
			if (name === 'undoGiftRevisionBatch' || name === 'undoGiftRevision') {
				continue;
			}
			expect(policyOf(name).confirmation({}), name).toBe(alwaysConfirmedNames.includes(name));
		}
	});

	it('decides undo confirmation from the stored revisions of the batch or gift', () => {
		expect(policyOf('undoGiftRevisionBatch').confirmation({ batchId: 'batch-1' })).toEqual({
			undoesGiftCreationsOfBatch: 'batch-1',
		});
		expect(policyOf('undoGiftRevision').confirmation({ giftId: 'gift-1' })).toEqual({
			undoesGiftCreationOfGift: 'gift-1',
		});
	});

	it('targets both wishlists of a copy and none of a newly created wishlist', () => {
		expect(
			policyOf('bulkCopyGifts').targets({
				sourceWishlistId: 'source',
				destinationWishlistId: 'destination',
				giftIds: ['gift'],
			}),
		).toEqual([
			{ kind: TARGET_KIND.wishlistId, id: 'source' },
			{ kind: TARGET_KIND.wishlistId, id: 'destination' },
		]);
		for (const name of ['createWishlist', 'createWishlistFromImport'] as const) {
			expect(policyOf(name).targets({})).toEqual([]);
		}
	});
});

describe('agent output projections', () => {
	it('returns created and changed wishlists without their internal columns', () => {
		const projectedOutputs = [
			policyOf('createWishlist').projectOutput(wishlistRow, grant),
			policyOf('createWishlistFromImport').projectOutput(wishlistRow, grant),
			...(['updateWishlist', 'renameRecipient', 'setWishlistPalette'] as const).map(
				(name) =>
					(
						policyOf(name).projectOutput(
							{ wishlist: wishlistRow, wishlistShortId: 'short-1' },
							grant,
						) as { wishlist: object }
					).wishlist,
			),
		];
		for (const projected of projectedOutputs) {
			for (const internalField of INTERNAL_WISHLIST_FIELDS) {
				expect(projected).not.toHaveProperty(internalField);
			}
			expect(projected).toMatchObject({ id: 'wishlist-1', shortId: 'short-1' });
			expect(JSON.stringify(projected)).not.toContain('recipient-user');
			expect(JSON.stringify(projected)).not.toContain('demo-session');
		}
	});

	it('returns created and changed gifts without internal columns, with a public image URL', () => {
		for (const name of [
			'createGift',
			'updateGift',
			'appendGiftDescription',
			'markGiftReceived',
		] as const) {
			const projected = policyOf(name).projectOutput(
				{ gift: giftRow, wishlistShortId: 'short-1', didCategoryChange: false },
				grant,
			) as { gift: object };
			for (const internalField of INTERNAL_GIFT_FIELDS) {
				expect(projected.gift, name).not.toHaveProperty(internalField);
			}
			expect(projected.gift, name).toMatchObject({
				id: 'gift-1',
				name: 'Kolo',
				imageUrl: expect.stringContaining('gifts/kolo.webp'),
			});
			expect(JSON.stringify(projected), name).not.toContain('Staré kolo');
		}
	});

	it('returns only the ids of imported gifts', () => {
		const projected = policyOf('importGifts').projectOutput(
			{ outcome: { status: 'created', gifts: [giftRow] }, wishlistShortId: 'short-1' },
			grant,
		);
		expect(projected).toEqual({
			outcome: { status: 'created', gifts: [{ id: 'gift-1' }] },
			wishlistShortId: 'short-1',
		});
	});

	it('never passes on fields a mutation output gains beyond its projection', () => {
		const projected = policyOf('reserveGift').projectOutput(
			{
				reservationId: 'reservation-1',
				wishlistShortId: 'short-1',
				anonymousEmail: 'gifter@example.com',
			},
			grant,
		);
		expect(projected).toEqual({ reservationId: 'reservation-1', wishlistShortId: 'short-1' });
	});
});
