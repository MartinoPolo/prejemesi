import * as v from 'valibot';
import type { claimInvite } from '$lib/server/db/claim.schema.js';

/** Full claim invite row from DB */
export type ClaimInvite = typeof claimInvite.$inferSelect;

/** Pending claim invite for display in the správce panel */
export interface PendingClaimInvite {
	id: string;
	token: string;
	createdAt: Date;
	usedAt: Date | null;
	revokedAt: Date | null;
}

/** Input for generating a claim link */
export interface GenerateClaimInviteInput {
	wishlistId: string;
	email?: string;
}

export const GenerateClaimInviteInputSchema = v.object({
	wishlistId: v.string(),
	email: v.optional(v.pipe(v.string(), v.trim(), v.email())),
});

/** Input for accepting (claiming) a claim invite */
export interface AcceptClaimInviteInput {
	token: string;
}

export const AcceptClaimInviteInputSchema = v.object({
	token: v.string(),
});

/** Input for revoking a claim invite */
export interface RevokeClaimInviteInput {
	inviteId: string;
}

export const RevokeClaimInviteInputSchema = v.object({
	inviteId: v.string(),
});

/** Result of getting claim invites for a wishlist (správce panel nudge) */
export interface ClaimInvitesData {
	pendingInvites: PendingClaimInvite[];
	/** True when the list is for a free-text recipient (no linked account) — claiming is possible. */
	isForSomeoneElse: boolean;
	/** Current free-text recipient name (for-someone lists only); null on linked lists. */
	recipientName: string | null;
}
