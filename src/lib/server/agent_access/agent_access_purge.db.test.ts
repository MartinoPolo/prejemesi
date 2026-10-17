import {
	DB_READY,
	RECIPIENT_ID,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { agentIdempotencyKey, changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import {
	CHANGE_PROPOSAL_STATUS,
	type ChangeProposalStatus,
} from '$lib/modules/change_proposals/types.js';
import { DAY_MS, GIFT_REVISION_RETENTION_MS } from '$lib/server/operations/constants.js';
import { createAccessToken } from './access_tokens.js';
import { purgeAgentAccessRecords } from './agent_access_purge.js';
import {
	AGENT_ACCESS_PURGE_CHUNK_SIZE,
	CHANGE_PROPOSAL_EXPIRED_RETENTION_MS,
	CHANGE_PROPOSAL_LIFETIME_MS,
	IDEMPOTENCY_KEY_RETENTION_MS,
} from './limits.js';

interface ProposalTimes {
	createdAt: Date;
	appliedAt?: Date;
	discardedAt?: Date;
	undoneAt?: Date;
}

function proposalValues(status: ChangeProposalStatus, times: ProposalTimes) {
	return {
		wishlistId: null,
		submitterUserId: RECIPIENT_ID,
		channel: 'token:Claude',
		tokenName: 'Claude',
		grant: { scopes: [], wishlistIds: null },
		status,
		rows: [],
		rowCount: 1,
		expiresAt: new Date(times.createdAt.getTime() + CHANGE_PROPOSAL_LIFETIME_MS),
		...times,
	};
}

async function insertProposal(status: ChangeProposalStatus, times: ProposalTimes) {
	const [inserted] = await getDb()
		.insert(changeProposal)
		.values(proposalValues(status, times))
		.returning({ id: changeProposal.id });
	if (inserted === undefined) {
		throw new Error('Inserting the proposal returned no row');
	}
	return inserted.id;
}

async function remainingProposalIds(proposalIds: readonly string[]): Promise<string[]> {
	const remaining = await getDb()
		.select({ id: changeProposal.id })
		.from(changeProposal)
		.where(inArray(changeProposal.id, [...proposalIds]));
	return remaining.map((row) => row.id).sort();
}

describe.skipIf(!DB_READY)('agent access purge', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('keeps expired and discarded proposals readable for a grace period, settled ones while undo is possible', async () => {
		const now = new Date();
		const ago = (milliseconds: number) => new Date(now.getTime() - milliseconds);
		const pastGrace = ago(
			CHANGE_PROPOSAL_LIFETIME_MS + CHANGE_PROPOSAL_EXPIRED_RETENTION_MS + DAY_MS,
		);
		const purgedIds = [
			await insertProposal(CHANGE_PROPOSAL_STATUS.pending, { createdAt: pastGrace }),
			await insertProposal(CHANGE_PROPOSAL_STATUS.discarded, {
				createdAt: pastGrace,
				discardedAt: ago(CHANGE_PROPOSAL_EXPIRED_RETENTION_MS + DAY_MS),
			}),
			await insertProposal(CHANGE_PROPOSAL_STATUS.applied, {
				createdAt: ago(GIFT_REVISION_RETENTION_MS + 2 * DAY_MS),
				appliedAt: ago(GIFT_REVISION_RETENTION_MS + DAY_MS),
			}),
			await insertProposal(CHANGE_PROPOSAL_STATUS.undone, {
				createdAt: ago(GIFT_REVISION_RETENTION_MS + 2 * DAY_MS),
				appliedAt: ago(GIFT_REVISION_RETENTION_MS + DAY_MS),
				undoneAt: ago(DAY_MS),
			}),
		];
		const keptIds = [
			await insertProposal(CHANGE_PROPOSAL_STATUS.pending, {
				createdAt: ago(CHANGE_PROPOSAL_LIFETIME_MS + DAY_MS),
			}),
			await insertProposal(CHANGE_PROPOSAL_STATUS.discarded, {
				createdAt: pastGrace,
				discardedAt: ago(CHANGE_PROPOSAL_EXPIRED_RETENTION_MS - DAY_MS),
			}),
			// Applied late in its lifetime: undo stays possible until its gift revisions expire.
			await insertProposal(CHANGE_PROPOSAL_STATUS.applied, {
				createdAt: ago(GIFT_REVISION_RETENTION_MS + DAY_MS),
				appliedAt: ago(GIFT_REVISION_RETENTION_MS - DAY_MS),
			}),
		];

		await purgeAgentAccessRecords(now);

		expect(await remainingProposalIds([...purgedIds, ...keptIds])).toEqual([...keptIds].sort());
	});

	it('purges more than one bounded chunk in a run', async () => {
		const now = new Date();
		const createdAt = new Date(
			now.getTime() -
				CHANGE_PROPOSAL_LIFETIME_MS -
				CHANGE_PROPOSAL_EXPIRED_RETENTION_MS -
				DAY_MS,
		);
		const inserted = await getDb()
			.insert(changeProposal)
			.values(
				Array.from({ length: AGENT_ACCESS_PURGE_CHUNK_SIZE + 1 }, () =>
					proposalValues(CHANGE_PROPOSAL_STATUS.pending, { createdAt }),
				),
			)
			.returning({ id: changeProposal.id });

		await purgeAgentAccessRecords(now);

		expect(await remainingProposalIds(inserted.map((row) => row.id))).toEqual([]);
	});

	it('removes idempotency keys past their retention', async () => {
		const now = new Date();
		const { token } = await createAccessToken(
			RECIPIENT_ID,
			v.parse(CreateAccessTokenInputSchema, {
				name: 'Claude',
				scopes: [],
				wishlistIds: null,
			}),
		);
		await getDb()
			.insert(agentIdempotencyKey)
			.values([
				{
					tokenId: token.id,
					key: 'stale',
					requestFingerprint: 'stale',
					createdAt: new Date(now.getTime() - IDEMPOTENCY_KEY_RETENTION_MS - 1000),
				},
				{
					tokenId: token.id,
					key: 'fresh',
					requestFingerprint: 'fresh',
					createdAt: new Date(now.getTime() - 1000),
				},
			]);

		await purgeAgentAccessRecords(now);

		const keys = await getDb()
			.select({ key: agentIdempotencyKey.key })
			.from(agentIdempotencyKey)
			.where(eq(agentIdempotencyKey.tokenId, token.id));
		expect(keys).toEqual([{ key: 'fresh' }]);
	});
});
