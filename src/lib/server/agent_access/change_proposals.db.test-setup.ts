import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { changeProposal } from '$lib/server/db/change_proposal.schema.js';
import {
	CHANGE_DECISION,
	type ChangeRowDecision,
} from '$lib/modules/change_proposals/change_field_decisions.js';
import { applyChangeProposalRows } from './change_proposals.js';

/** Decisions accepting the listed rows as proposed and rejecting every other row. */
export async function acceptOnly(
	proposalId: string,
	acceptedRowIds: readonly string[],
): Promise<ChangeRowDecision[]> {
	const [stored] = await getDb()
		.select({ rows: changeProposal.rows })
		.from(changeProposal)
		.where(eq(changeProposal.id, proposalId));
	const accepted = new Set(acceptedRowIds);
	return (stored?.rows ?? []).map((row) => ({
		rowId: row.rowId,
		decision: accepted.has(row.rowId) ? CHANGE_DECISION.accepted : CHANGE_DECISION.rejected,
	}));
}

/** Applies the listed rows as proposed, rejecting the rest, as the review page would. */
export async function applyRows(
	reviewer: { id: string; name: string },
	proposalId: string,
	acceptedRowIds: readonly string[],
) {
	return applyChangeProposalRows(
		reviewer,
		proposalId,
		await acceptOnly(proposalId, acceptedRowIds),
	);
}
