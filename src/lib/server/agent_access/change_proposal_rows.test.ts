import { describe, expect, it } from 'vitest';
import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import { OPERATION_EXPOSURE, OPERATION_KIND } from '$lib/server/operations/operation.js';
import { CHANGE_KIND } from '$lib/modules/change_proposals/types.js';
import { AGENT_OPERATION_POLICIES, isOperationName } from './operation_policies.js';
import { baselineGiftIds, changeKindOf, countChangeKinds } from './change_proposal_rows.js';
import { TARGET_KIND } from './policy_lookups.js';

const agentMutationNames = Object.values(OPERATION_REGISTRY)
	.filter(
		(operation) =>
			operation.exposure === OPERATION_EXPOSURE.agent &&
			operation.kind === OPERATION_KIND.mutation &&
			isOperationName(operation.name) &&
			AGENT_OPERATION_POLICIES[operation.name] !== null,
	)
	.map((operation) => operation.name);

describe('change proposal rows', () => {
	it('give every agent mutation a change kind for the review page', () => {
		expect(agentMutationNames.length).toBeGreaterThan(0);
		for (const name of agentMutationNames) {
			expect(Object.values(CHANGE_KIND), name).toContain(changeKindOf(name));
		}
	});

	it('count the rows of each kind', () => {
		expect(
			countChangeKinds([
				{ operation: 'updateGift' },
				{ operation: 'bulkUpdateGifts' },
				{ operation: 'deleteGift' },
			]),
		).toEqual({ [CHANGE_KIND.giftEdit]: 2, [CHANGE_KIND.giftDeletion]: 1 });
	});

	it('compare the gifts a row names and the existing gifts it changes, not those it creates', () => {
		expect(
			baselineGiftIds(
				[
					{ kind: TARGET_KIND.giftId, id: 'named' },
					{ kind: TARGET_KIND.wishlistId, id: 'wishlist' },
				],
				[
					{ giftId: 'named', before: { name: 'Kolo' } },
					{ giftId: 'bulk-edited', before: { name: 'Míč' } },
					{ giftId: 'created', before: null },
				],
			),
		).toEqual(['named', 'bulk-edited']);
	});
});
