import * as v from 'valibot';
import { and, count, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment, moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { rejectDemoOperation } from '$lib/server/demo/scope.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { resolveUserImageUrl } from '$lib/modules/images/public_url.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { resolveRoleOnWishlistRow } from '$lib/modules/wishlists/wishlist_access.js';
import {
	AcceptInviteInputSchema,
	GenerateInviteInputSchema,
	RemoveModeratorInputSchema,
	RevokeInviteInputSchema,
	SelfPromoteInputSchema,
	type ModeratorsData,
} from '$lib/modules/moderators/types.js';
import { OPERATION_CHANNEL, requireOperationActor } from './actor.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import {
	assertWishlistTakesInvites,
	createInviteLink,
	lockAcceptableInvite,
	markInviteUsed,
	readPendingInvites,
	revokePendingInvite,
} from './invite_links.js';
import { optionalEmail } from './optional_email.js';
import {
	activeFollowerUserIds,
	requireLiveWishlistRow,
	requireWishlistManagement,
	type WishlistRow,
} from './wishlist_management.js';

async function readActiveModerators(
	database: ReturnType<typeof getDb>,
	wishlistId: string,
): Promise<ModeratorsData['moderators']> {
	const moderatorRows = await database
		.select({
			id: moderatorAssignment.id,
			userId: moderatorAssignment.userId,
			userName: user.name,
			userImage: user.image,
			assignedAt: moderatorAssignment.assignedAt,
		})
		.from(moderatorAssignment)
		.innerJoin(user, eq(moderatorAssignment.userId, user.id))
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.orderBy(moderatorAssignment.assignedAt);
	return moderatorRows.map((row) => ({ ...row, userImage: resolveUserImageUrl(row.userImage) }));
}

/**
 * The správci panel: only managers (recipient or správce) may view it. Human-only because it
 * returns live invite tokens, and agent reads flow to third-party AI providers.
 */
export const readWishlistModeratorsOperation = defineOperation({
	name: 'readWishlistModerators',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: v.strictObject({ wishlistId: v.string() }),
	async run(context, input): Promise<ModeratorsData> {
		const actor = requireOperationActor(context.actor);
		const database = getDb();
		const { wishlistRow } = await requireWishlistManagement(
			database,
			actor.userId,
			input.wishlistId,
			{ lock: false },
		);
		return {
			moderators: await readActiveModerators(database, input.wishlistId),
			pendingInvites: await readPendingInvites(database, moderatorInvite, input.wishlistId),
			recipientIsModerator: wishlistRow.recipientIsModerator,
			isForSomeoneElse: wishlistRow.recipientUserId === null,
			recipientName: wishlistRow.recipientName,
		};
	},
});

/** A UI invite returns its shareable link; an agent's invite reaches the invitee only by email. */
interface GeneratedModeratorInvite {
	link: { token: string; invitePath: string } | null;
	unregisteredInvitee: boolean;
}

/**
 * Any manager may invite a správce; with an email the invitee is mailed the link. An agent must
 * name the exact invitee email and never receives the link, so it cannot hand the invite to anyone else.
 */
export const generateModeratorInviteLinkOperation = defineOperation({
	name: 'generateModeratorInviteLink',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: GenerateInviteInputSchema,
	async run(context, input): Promise<GeneratedModeratorInvite> {
		const inviteeEmail = optionalEmail(input.email);
		const linkReturned = context.actor.channel === OPERATION_CHANNEL.ui;
		if (!linkReturned && inviteeEmail === null) {
			error(400, SERVER_ERROR.INVALID_OPERATION_INPUT);
		}
		rejectDemoOperation();
		const { wishlistRow } = await requireWishlistManagement(
			context.transaction,
			context.actor.userId,
			input.wishlistId,
			{ lock: true },
		);
		assertWishlistTakesInvites(wishlistRow);
		const invite = await createInviteLink(context, {
			inviteTable: moderatorInvite,
			wishlistRow,
			pathSegment: 'invite',
			email: inviteeEmail,
		});
		if (inviteeEmail !== null) {
			notifyInviteeAfterCommit(context, {
				email: inviteeEmail,
				invitePath: invite.path,
				wishlistRow,
			});
		}
		return {
			link: linkReturned ? { token: invite.token, invitePath: invite.path } : null,
			unregisteredInvitee: invite.unregisteredInvitee,
		};
	},
});

function notifyInviteeAfterCommit(
	context: MutationOperationContext,
	params: { email: string; invitePath: string; wishlistRow: WishlistRow },
): void {
	const { email, invitePath, wishlistRow } = params;
	context.deferEffect(() =>
		dispatchNotification({
			type: NOTIFICATION_TYPE.MODERATOR_INVITED,
			targetEmails: [email],
			wishlistId: wishlistRow.id,
			actorId: context.actor.userId,
			actorName: context.actor.userName,
			urlPathOverride: invitePath,
			wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
		}),
	);
}

async function requireInvitableWishlist(
	context: MutationOperationContext,
	wishlistId: string,
): Promise<WishlistRow> {
	const wishlistRow = await requireLiveWishlistRow(context.transaction, wishlistId, {
		lock: true,
	});
	assertWishlistTakesInvites(wishlistRow);
	// The linked recipient already manages the list, so a správce invite is redundant.
	if (wishlistRow.recipientUserId === context.actor.userId) {
		error(400, SERVER_ERROR.RECIPIENT_CANNOT_ACCEPT_OWN_INVITE);
	}
	const role = await resolveRoleOnWishlistRow(context.actor.userId, wishlistRow, {
		database: context.transaction,
	});
	if (role === WISHLIST_ROLES.moderator) {
		error(400, SERVER_ERROR.ALREADY_MODERATOR);
	}
	return wishlistRow;
}

/** The invitee becomes a správce; an invite works once. */
export const acceptModeratorInviteOperation = defineOperation({
	name: 'acceptModeratorInvite',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: AcceptInviteInputSchema,
	async run(context, input) {
		const invite = await lockAcceptableInvite(context, moderatorInvite, input.token);
		const wishlistRow = await requireInvitableWishlist(context, invite.wishlistId);
		await markInviteUsed(context, moderatorInvite, invite.id);
		const [assignment] = await context.transaction
			.insert(moderatorAssignment)
			.values({ wishlistId: invite.wishlistId, userId: context.actor.userId })
			.returning();
		if (assignment === undefined) {
			error(500, SERVER_ERROR.FAILED_TO_ASSIGN_MODERATOR);
		}
		return {
			wishlistId: invite.wishlistId,
			wishlistShortId: wishlistRow.shortId,
			wishlistTitle: wishlistRow.title,
		};
	},
});

export const revokeModeratorInviteOperation = defineOperation({
	name: 'revokeModeratorInvite',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: RevokeInviteInputSchema,
	run: (context, input) => revokePendingInvite(context, moderatorInvite, input.inviteId),
});

/**
 * Orphan guard: a for-someone list (free-text recipient, no linked account) must keep at least
 * one správce, or nobody can manage it. Self-recipient lists are exempt.
 */
async function assertNotLastManager(
	transaction: DatabaseTransaction,
	wishlistRow: WishlistRow,
): Promise<void> {
	if (wishlistRow.recipientUserId !== null) {
		return;
	}
	const [activeModerators] = await transaction
		.select({ value: count() })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistRow.id),
				isNull(moderatorAssignment.deletedAt),
			),
		);
	if ((activeModerators?.value ?? 0) <= 1) {
		error(403, SERVER_ERROR.CANNOT_REMOVE_LAST_MANAGER);
	}
}

/** Any manager (recipient or správce) may remove a správce, including themselves. */
export const removeModeratorOperation = defineOperation({
	name: 'removeModerator',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: RemoveModeratorInputSchema,
	async run(context, input): Promise<void> {
		const activeAssignment = and(
			eq(moderatorAssignment.id, input.assignmentId),
			isNull(moderatorAssignment.deletedAt),
		);
		// Read without a lock: the wishlist is locked next, before any assignment (lock order).
		const [assignment] = await context.transaction
			.select()
			.from(moderatorAssignment)
			.where(activeAssignment)
			.limit(1);
		if (assignment === undefined) {
			error(404, SERVER_ERROR.MODERATOR_NOT_FOUND);
		}
		const { wishlistRow } = await requireWishlistManagement(
			context.transaction,
			context.actor.userId,
			assignment.wishlistId,
			{ lock: true },
		);
		// Every removal locks the wishlist, so a concurrent one has committed by now: re-check.
		const [lockedAssignment] = await context.transaction
			.select({ id: moderatorAssignment.id })
			.from(moderatorAssignment)
			.where(activeAssignment)
			.for('update');
		if (lockedAssignment === undefined) {
			error(404, SERVER_ERROR.MODERATOR_NOT_FOUND);
		}
		await assertNotLastManager(context.transaction, wishlistRow);
		await context.transaction
			.update(moderatorAssignment)
			.set({ deletedAt: context.now })
			.where(activeAssignment);
	},
});

/**
 * The linked recipient opts into seeing reservation state. Správci already see it; a free-text
 * recipient has no account.
 */
export const selfPromoteToModeratorOperation = defineOperation({
	name: 'selfPromoteToModerator',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: SelfPromoteInputSchema,
	async run(context, input) {
		const wishlistRow = await requireLiveWishlistRow(context.transaction, input.wishlistId, {
			lock: true,
		});
		if (wishlistRow.recipientUserId !== context.actor.userId) {
			error(403, SERVER_ERROR.ACCESS_DENIED);
		}
		if (wishlistRow.status === 'archived') {
			error(400, SERVER_ERROR.CANNOT_SELF_PROMOTE_ON_ARCHIVED);
		}
		if (wishlistRow.recipientIsModerator) {
			error(400, SERVER_ERROR.ALREADY_SEEING_RESERVATIONS);
		}
		await context.transaction
			.update(wishlist)
			.set({ recipientIsModerator: true, updatedAt: context.now })
			.where(eq(wishlist.id, input.wishlistId));
		const followerUserIds = await activeFollowerUserIds(context.transaction, input.wishlistId);
		context.deferEffect(() =>
			dispatchNotification({
				type: NOTIFICATION_TYPE.RECIPIENT_SELF_PROMOTED,
				targetUserIds: followerUserIds.filter((userId) => userId !== context.actor.userId),
				wishlistId: input.wishlistId,
				actorId: context.actor.userId,
				actorName: context.actor.userName,
				wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
			}),
		);
		return { wishlistShortId: wishlistRow.shortId };
	},
});
