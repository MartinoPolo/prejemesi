import { guardedCommand, guardedQueryWithArgs, singleFlightRefresh } from '$lib/server/remote.js';
import { rejectDemoOperation } from '$lib/server/demo/scope.js';
import {
	applyChangeProposalRows,
	discardChangeProposal as discardOwnChangeProposal,
	getChangeProposalForReview,
	listPendingChangeProposals,
	undoChangeProposal as undoOwnChangeProposal,
} from '$lib/server/agent_access/change_proposals.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import {
	ApplyChangeProposalInputSchema,
	CHANGE_PROPOSAL_OUTCOME,
	ChangeProposalAddressSchema,
	ChangeProposalIdInputSchema,
	PendingChangeProposalsInputSchema,
	type ChangeProposalView,
} from './types.js';

// Thin adapters for the review page; only a proposal's submitter sees or acts on it (others 404).

export const getChangeProposal = guardedQueryWithArgs(
	ChangeProposalAddressSchema,
	({ user }, address) => getChangeProposalForReview(user, address),
);

export const getPendingChangeProposals = guardedQueryWithArgs(
	PendingChangeProposalsInputSchema,
	({ user }, { wishlistShortId }) => listPendingChangeProposals(user, wishlistShortId),
);

/** The review page, the pending banner and, after a change, the wishlist's gifts. */
async function refreshProposalViews(
	proposal: ChangeProposalView,
	giftsChanged: boolean,
): Promise<void> {
	const { wishlistShortId } = proposal;
	if (wishlistShortId === null) {
		return;
	}
	await Promise.all([
		singleFlightRefresh(getChangeProposal, { wishlistShortId, proposalId: proposal.id }),
		singleFlightRefresh(getPendingChangeProposals, { wishlistShortId }),
		giftsChanged ? singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId) : undefined,
	]);
}

/** Conflicts and failing rows are results, not errors: nothing applied and the page shows why. */
export const applyChangeProposal = guardedCommand(
	ApplyChangeProposalInputSchema,
	async ({ user }, { proposalId, selectedRowIds }) => {
		rejectDemoOperation();
		const result = await applyChangeProposalRows(user, proposalId, selectedRowIds);
		if (result.outcome === CHANGE_PROPOSAL_OUTCOME.applied) {
			await refreshProposalViews(result.proposal, true);
		}
		return result;
	},
);

export const discardChangeProposal = guardedCommand(
	ChangeProposalIdInputSchema,
	async ({ user }, { proposalId }) => {
		rejectDemoOperation();
		const proposal = await discardOwnChangeProposal(user, proposalId);
		await refreshProposalViews(proposal, false);
		return proposal;
	},
);

/** A gift changed since apply is a result listing the changed gifts, not an error. */
export const undoChangeProposal = guardedCommand(
	ChangeProposalIdInputSchema,
	async ({ user }, { proposalId }) => {
		rejectDemoOperation();
		const result = await undoOwnChangeProposal(user, proposalId);
		if (result.outcome === CHANGE_PROPOSAL_OUTCOME.undone) {
			await refreshProposalViews(result.proposal, true);
		}
		return result;
	},
);
