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
}

/** Input for accepting an invite */
export interface AcceptInviteInput {
	token: string;
}

/** Input for revoking an invite */
export interface RevokeInviteInput {
	inviteId: string;
}

/** Input for removing a moderator */
export interface RemoveModeratorInput {
	assignmentId: string;
}

/** Input for self-promoting to moderator */
export interface SelfPromoteInput {
	wishlistId: string;
}

/** Result of getting moderators for a wishlist */
export interface ModeratorsData {
	moderators: ModeratorWithUser[];
	pendingInvites: PendingInvite[];
	ownerIsModerator: boolean;
}
