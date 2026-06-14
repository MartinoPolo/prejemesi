import * as v from 'valibot';
import type { moderatorAssignment, moderatorInvite } from '$lib/server/db/moderator.schema.js';

/** Full moderator assignment row from DB */
export type ModeratorAssignment = typeof moderatorAssignment.$inferSelect;

/** Full moderator invite row from DB */
export type ModeratorInvite = typeof moderatorInvite.$inferSelect;

/** Moderator with user info for display */
export interface ModeratorWithUser {
	id: string;
	userId: string;
	userName: string;
	userImage: string | null;
	assignedAt: Date;
}

/** Pending invite for display */
export interface PendingInvite {
	id: string;
	token: string;
	createdAt: Date;
	usedAt: Date | null;
	revokedAt: Date | null;
}

/** Input for generating an invite link */
export interface GenerateInviteInput {
	wishlistId: string;
	email?: string;
}

export const GenerateInviteInputSchema = v.object({
	wishlistId: v.string(),
	email: v.optional(v.pipe(v.string(), v.trim(), v.email())),
});

/** Input for accepting an invite */
export interface AcceptInviteInput {
	token: string;
}

export const AcceptInviteInputSchema = v.object({
	token: v.string(),
});

/** Input for revoking an invite */
export interface RevokeInviteInput {
	inviteId: string;
}

export const RevokeInviteInputSchema = v.object({
	inviteId: v.string(),
});

/** Input for removing a moderator */
export interface RemoveModeratorInput {
	assignmentId: string;
}

export const RemoveModeratorInputSchema = v.object({
	assignmentId: v.string(),
});

/** Input for self-promoting to moderator */
export interface SelfPromoteInput {
	wishlistId: string;
}

export const SelfPromoteInputSchema = v.object({
	wishlistId: v.string(),
});

/** Result of getting moderators for a wishlist */
export interface ModeratorsData {
	moderators: ModeratorWithUser[];
	pendingInvites: PendingInvite[];
	ownerIsModerator: boolean;
}
