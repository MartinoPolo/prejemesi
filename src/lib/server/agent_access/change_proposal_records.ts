import type { AgentScope } from '$lib/modules/access_tokens/scopes.js';
import type { ChangeRowError } from '$lib/modules/change_proposals/types.js';
import type { GiftRevisionSnapshot } from '$lib/server/operations/gift_revision_snapshot.js';

/** The token's grant when the proposal was submitted; apply runs within it even after revocation. */
export interface ChangeProposalGrantSnapshot {
	scopes: AgentScope[];
	wishlistIds: string[] | null;
}

/** One gift a row's dry run changed: `before` is null for a gift the row creates. */
export interface StoredGiftChange {
	giftId: string;
	before: GiftRevisionSnapshot | null;
	after: GiftRevisionSnapshot;
}

/** A target gift as it was at submission; any difference at apply time is a conflict. */
export interface StoredGiftBaseline {
	giftId: string;
	snapshot: GiftRevisionSnapshot;
}

/** One submitted operation with its dry-run outcome, stored with the proposal. */
export interface StoredChangeRow {
	rowId: string;
	operation: string;
	input: unknown;
	requiresConfirmation: boolean;
	/** Null when the dry run accepted the row. */
	rejection: ChangeRowError | null;
	/** Null for a rejected row. */
	preview: { giftChanges: StoredGiftChange[]; result: unknown } | null;
	baseline: StoredGiftBaseline[];
	/** The projected output of the applied row; set once the proposal applies. */
	appliedResult?: unknown;
}

/** What the applied rows created that undo must cancel or revoke besides the gift revisions. */
export interface ChangeProposalUndoTargets {
	reservations: { rowId: string; reservationId: string }[];
	moderatorInvites: { rowId: string; inviteId: string }[];
}
