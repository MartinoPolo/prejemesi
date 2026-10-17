import * as v from 'valibot';
import type { DescriptionAppend, GiftLink } from '$lib/modules/gifts/types.js';
import type { ImageMetadata } from '$lib/modules/images/types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

/** The stored lifecycle of a proposal; a proposal applies, is discarded or is undone once. */
export const CHANGE_PROPOSAL_STATUS = {
	pending: 'pending',
	applied: 'applied',
	discarded: 'discarded',
	undone: 'undone',
} as const;

export type ChangeProposalStatus =
	(typeof CHANGE_PROPOSAL_STATUS)[keyof typeof CHANGE_PROPOSAL_STATUS];

/** What a viewer sees: a pending proposal past its expiry reads as expired. */
export const CHANGE_PROPOSAL_STATE = {
	...CHANGE_PROPOSAL_STATUS,
	expired: 'expired',
} as const;

export type ChangeProposalState =
	(typeof CHANGE_PROPOSAL_STATE)[keyof typeof CHANGE_PROPOSAL_STATE];

/**
 * One row's status. Before apply: `ready`, `conflict` (a target gift changed since submission),
 * `rejected` (the dry run failed under the ordinary rules) or `needsConfirmation` (deletion,
 * reservation, invitation: applies only when explicitly selected). After apply: `applied` or
 * `notApplied`; after undo, applied rows read `undone`.
 */
export const CHANGE_ROW_STATUS = {
	ready: 'ready',
	conflict: 'conflict',
	rejected: 'rejected',
	needsConfirmation: 'needsConfirmation',
	applied: 'applied',
	notApplied: 'notApplied',
	undone: 'undone',
} as const;

export type ChangeRowStatus = (typeof CHANGE_ROW_STATUS)[keyof typeof CHANGE_ROW_STATUS];

/** What a row does, for the review page's badges and the summary counts. */
export const CHANGE_KIND = {
	giftCreation: 'giftCreation',
	giftEdit: 'giftEdit',
	descriptionAppend: 'descriptionAppend',
	giftDeletion: 'giftDeletion',
	received: 'received',
	reorder: 'reorder',
	category: 'category',
	priorityLevel: 'priorityLevel',
	reservation: 'reservation',
	managerInvitation: 'managerInvitation',
	wishlistDetails: 'wishlistDetails',
	wishlistCreation: 'wishlistCreation',
	undo: 'undo',
} as const;

export type ChangeKind = (typeof CHANGE_KIND)[keyof typeof CHANGE_KIND];

/** Apply and undo answer conflicts and rule failures as results, not thrown errors. */
export const CHANGE_PROPOSAL_OUTCOME = {
	applied: 'applied',
	undone: 'undone',
	conflict: 'conflict',
	failed: 'failed',
} as const;

export function changeProposalReviewPath(wishlistShortId: string, proposalId: string): string {
	return `/w/${wishlistShortId}/changes/${proposalId}`;
}

/** The most rows one proposal holds: the agent batch cap, which a unit test keeps equal. */
export const CHANGE_PROPOSAL_MAX_ROWS = 200;

export const NonEmptyIdSchema = v.pipe(v.string(), v.minLength(1));

export const ChangeProposalAddressSchema = v.strictObject({
	wishlistShortId: NonEmptyIdSchema,
	proposalId: NonEmptyIdSchema,
});

export const PendingChangeProposalsInputSchema = v.strictObject({
	wishlistShortId: NonEmptyIdSchema,
});

export const ChangeProposalIdInputSchema = v.strictObject({ proposalId: NonEmptyIdSchema });

export const ApplyChangeProposalInputSchema = v.strictObject({
	proposalId: NonEmptyIdSchema,
	/** The rows to apply; confirmation rows apply only when listed here. */
	selectedRowIds: v.pipe(
		v.array(NonEmptyIdSchema),
		v.minLength(1),
		v.maxLength(CHANGE_PROPOSAL_MAX_ROWS),
		v.check((rowIds) => new Set(rowIds).size === rowIds.length),
	),
});

/** A gift as a proposal shows it before or after a change; never reservation or like data. */
export interface ChangeProposalGift {
	name: string;
	description: string | null;
	descriptionAppends: DescriptionAppend[];
	links: GiftLink[];
	price: number | null;
	priceMax: number | null;
	currency: string | null;
	imageUrl: string | null;
	imageMeta: ImageMetadata | null;
	quantity: number | null;
	priorityLevelId: string | null;
	categoryId: string | null;
	received: boolean;
	deleted: boolean;
	editedAfterShareAt: string | null;
}

/** Why the core rejected a row: its status, error code and the code's parameters. */
export interface ChangeRowError {
	status: number;
	code: string;
	details: Record<string, unknown>;
}

/** A target gift that changed after submission, with who changed it last when known. */
export interface ChangeRowConflict {
	giftId: string;
	changedByName: string | null;
	changedAt: Date | null;
	/** The gift as it is now; null once it no longer exists. */
	current: ChangeProposalGift | null;
}

export interface ChangeProposalRowView {
	rowId: string;
	operation: string;
	kind: ChangeKind;
	/** The operation input as the agent submitted it, e.g. the exact email of an invitation. */
	input: unknown;
	requiresConfirmation: boolean;
	status: ChangeRowStatus;
	error: ChangeRowError | null;
	conflicts: ChangeRowConflict[];
	/** What the dry run would change; null for a rejected row. */
	preview: {
		gifts: { giftId: string; before: ChangeProposalGift | null; after: ChangeProposalGift }[];
		result: unknown;
	} | null;
	/** What the applied row returned, e.g. the ids it created; null unless it applied. */
	appliedResult: unknown;
}

export type ChangeKindCounts = Partial<Record<ChangeKind, number>>;

export interface ChangeProposalView {
	id: string;
	state: ChangeProposalState;
	/** Null for a proposal that only created wishlists, which has no review page. */
	wishlistShortId: string | null;
	reviewUrl: string | null;
	submitterName: string;
	/** The submitter's current role on the wishlist; null for a proposal without one. */
	viewerRole: WishlistRole | null;
	channel: string;
	tokenName: string;
	/** The submitting token was revoked since; its pending proposal still applies. */
	tokenRevoked: boolean;
	createdAt: Date;
	expiresAt: Date;
	appliedAt: Date | null;
	discardedAt: Date | null;
	undoneAt: Date | null;
	rowCount: number;
	kindCounts: ChangeKindCounts;
	/** For an applied proposal: undo refuses while rows it cannot reverse were applied. */
	undo: { available: boolean; blockingRowIds: string[] } | null;
	rows: ChangeProposalRowView[];
}

export interface PendingChangeProposalSummary {
	id: string;
	reviewUrl: string;
	channel: string;
	tokenName: string;
	createdAt: Date;
	expiresAt: Date;
	rowCount: number;
	kindCounts: ChangeKindCounts;
}

/** Rows the core refused; nothing applied or was undone. */
export interface FailedChangeRows {
	outcome: typeof CHANGE_PROPOSAL_OUTCOME.failed;
	rows: { rowId: string; error: ChangeRowError }[];
}

export type ApplyChangeProposalResult =
	| { outcome: typeof CHANGE_PROPOSAL_OUTCOME.applied; proposal: ChangeProposalView }
	| {
			outcome: typeof CHANGE_PROPOSAL_OUTCOME.conflict;
			rows: { rowId: string; conflicts: ChangeRowConflict[] }[];
	  }
	| FailedChangeRows;

export type UndoChangeProposalResult =
	| { outcome: typeof CHANGE_PROPOSAL_OUTCOME.undone; proposal: ChangeProposalView }
	| {
			outcome: typeof CHANGE_PROPOSAL_OUTCOME.conflict;
			changedGifts: { giftId: string; name: string | null }[];
	  }
	| FailedChangeRows;
