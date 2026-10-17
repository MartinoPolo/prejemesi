import type * as v from 'valibot';
import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import type { GiftDraftInput } from '$lib/modules/gifts/types.js';
import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';
import { AGENT_SCOPE, type AgentScope } from '$lib/modules/access_tokens/scopes.js';
import { hasAgentScope, type AgentAccessGrant } from './agent_grant.js';
import { TARGET_KIND, type ConfirmationRule, type TargetReference } from './policy_lookups.js';
import {
	projectAgentAccessibleWishlists,
	projectAgentBulkCopyDestinations,
	projectAgentGiftRow,
	projectAgentWishlist,
	projectAgentWishlistGifts,
	projectAgentWishlistRow,
} from './read_projections.js';

type OperationRegistry = typeof OPERATION_REGISTRY;
export type OperationName = keyof OperationRegistry;
type OperationInput<TName extends OperationName> = v.InferOutput<OperationRegistry[TName]['input']>;
type OperationOutput<TName extends OperationName> = Awaited<
	ReturnType<OperationRegistry[TName]['run']>
>;

/** Whether an operation's calls need the user's confirmation, as the generated docs state it. */
const CONFIRMATION_MODE = {
	never: 'never',
	always: 'always',
	dependsOnInput: 'dependsOnInput',
} as const;

type ConfirmationMode = (typeof CONFIRMATION_MODE)[keyof typeof CONFIRMATION_MODE];

/** A policy's declared confirmation: its documented mode and the rule the server applies. */
interface ConfirmationDeclaration<TInput> {
	mode: ConfirmationMode;
	rule: (input: TInput) => ConfirmationRule;
}

/** How the agent surface treats one operation; human-only operations have none. */
export interface AgentOperationPolicy<TInput, TOutput> {
	readonly scope: AgentScope;
	readonly confirmationMode: ConfirmationMode;
	/**
	 * What the call reads or changes; their wishlists are checked against the token's wishlist
	 * restriction and locked first when a batch runs. Empty when the call only creates a wishlist.
	 */
	targets(input: TInput): TargetReference[];
	/** Deleting gifts, reservations and manager invitations always need the user's confirmation. */
	confirmation(input: TInput): ConfirmationRule;
	/**
	 * Agents cannot set image references yet: the core trusts a given upload key, so a token could
	 * point a gift at another user's upload and later trigger its deletion. Images by URL, with an
	 * ownership-checked reference, replace this rejection.
	 */
	setsImageReference(input: TInput): boolean;
	/** What the API returns: listed fields only, no internal columns or out-of-scope identities. */
	projectOutput(output: TOutput, grant: AgentAccessGrant): unknown;
}

const HUMAN_ONLY = null;

type AgentOperationPolicies = {
	readonly [TName in OperationName]:
		| AgentOperationPolicy<OperationInput<TName>, OperationOutput<TName>>
		| typeof HUMAN_ONLY;
};

function agentOperation<TInput, TOutput>(policy: {
	scope: AgentScope;
	targets: (input: TInput) => TargetReference[];
	confirmation?: ConfirmationDeclaration<NoInfer<TInput>>;
	setsImageReference?: (input: NoInfer<TInput>) => boolean;
	projectOutput: (output: TOutput, grant: AgentAccessGrant) => unknown;
}): AgentOperationPolicy<TInput, TOutput> {
	return {
		scope: policy.scope,
		confirmationMode: policy.confirmation?.mode ?? CONFIRMATION_MODE.never,
		targets: policy.targets,
		confirmation: policy.confirmation?.rule ?? (() => false),
		setsImageReference: policy.setsImageReference ?? (() => false),
		projectOutput: policy.projectOutput,
	};
}

const ALWAYS_CONFIRMED: ConfirmationDeclaration<unknown> = {
	mode: CONFIRMATION_MODE.always,
	rule: () => true,
};

function confirmedDependingOnInput<TInput>(
	rule: (input: TInput) => ConfirmationRule,
): ConfirmationDeclaration<TInput> {
	return { mode: CONFIRMATION_MODE.dependsOnInput, rule };
}

/** Creating a wishlist or listing the user's wishlists names no existing wishlist. */
const namesNoWishlist = (): TargetReference[] => [];

function byWishlistId<TInput>(wishlistIdOf: (input: TInput) => string) {
	return (input: TInput): TargetReference[] => [
		{ kind: TARGET_KIND.wishlistId, id: wishlistIdOf(input) },
	];
}

function byWishlistShortId<TInput>(shortIdOf: (input: TInput) => string) {
	return (input: TInput): TargetReference[] => [
		{ kind: TARGET_KIND.wishlistShortId, id: shortIdOf(input) },
	];
}

function byGiftId<TInput>(giftIdOf: (input: TInput) => string) {
	return (input: TInput): TargetReference[] => [
		{ kind: TARGET_KIND.giftId, id: giftIdOf(input) },
	];
}

function byReservationId<TInput>(reservationIdOf: (input: TInput) => string) {
	return (input: TInput): TargetReference[] => [
		{ kind: TARGET_KIND.reservationId, id: reservationIdOf(input) },
	];
}

function setsGiftImage(input: { imageUrl?: string | null; imageKey?: string | null }): boolean {
	return input.imageUrl !== undefined || input.imageKey !== undefined;
}

function setsDraftImage(input: { gifts: readonly GiftDraftInput[] }): boolean {
	return input.gifts.some((draft) => draft.imageUrl !== null);
}

function projectWishlistChange(output: {
	wishlist: Parameters<typeof projectAgentWishlistRow>[0] | undefined;
	wishlistShortId: string;
}) {
	return {
		wishlist: output.wishlist === undefined ? null : projectAgentWishlistRow(output.wishlist),
		wishlistShortId: output.wishlistShortId,
	};
}

function projectGiftChange(output: {
	gift: Parameters<typeof projectAgentGiftRow>[0] | undefined;
	wishlistShortId: string;
}) {
	return {
		gift: output.gift === undefined ? null : projectAgentGiftRow(output.gift),
		wishlistShortId: output.wishlistShortId,
	};
}

function projectUndo(output: { restoredGiftIds: string[]; wishlistShortIds: string[] }) {
	return { restoredGiftIds: output.restoredGiftIds, wishlistShortIds: output.wishlistShortIds };
}

function projectWishlistShortId(output: { wishlistShortId: string }) {
	return { wishlistShortId: output.wishlistShortId };
}

function projectCategory(category: ManagedGiftCategory) {
	return {
		id: category.id,
		presetKey: category.presetKey,
		customLabel: category.customLabel,
		color: category.color,
		sortOrder: category.sortOrder,
		usedCount: category.usedCount,
	};
}

function projectPriorityLevels(
	levels: readonly { id: string; label: string; sortOrder: number }[],
) {
	return levels.map((level) => ({
		id: level.id,
		label: level.label,
		sortOrder: level.sortOrder,
	}));
}

/**
 * The agent surface of every registry operation. Sharing, archiving, reverting and deleting
 * wishlists, reservation release, správce administration beyond inviting, claim links and
 * personal follows and likes stay human-only.
 */
export const AGENT_OPERATION_POLICIES: AgentOperationPolicies = {
	readWishlistGifts: agentOperation({
		scope: AGENT_SCOPE.read,
		targets: byWishlistShortId((input) => input.wishlistShortId),
		projectOutput: (output, grant) =>
			projectAgentWishlistGifts(output, {
				includeReserverNames: hasAgentScope(grant, AGENT_SCOPE.reservationsIdentities),
			}),
	}),
	readBulkCopyDestinations: agentOperation({
		scope: AGENT_SCOPE.read,
		targets: byWishlistId((input) => input.sourceWishlistId),
		projectOutput: (output, grant) =>
			projectAgentBulkCopyDestinations(output, grant.wishlistIds),
	}),
	readPriorityLevels: agentOperation({
		scope: AGENT_SCOPE.read,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: projectPriorityLevels,
	}),
	readWishlist: agentOperation({
		scope: AGENT_SCOPE.read,
		targets: byWishlistShortId((input) => input.wishlistShortId),
		projectOutput: projectAgentWishlist,
	}),
	// Names no wishlist: the projection applies the token's wishlist restriction instead.
	readAccessibleWishlists: agentOperation({
		scope: AGENT_SCOPE.read,
		targets: namesNoWishlist,
		projectOutput: (output, grant) =>
			projectAgentAccessibleWishlists(output, grant.wishlistIds),
	}),
	// The first read inserts the default categories; `read` permits that idempotent write.
	readGiftCategories: agentOperation({
		scope: AGENT_SCOPE.read,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: (output) => output.map(projectCategory),
	}),
	readGiftCategorySettingsRows: agentOperation({
		scope: AGENT_SCOPE.read,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: (output) =>
			output.map((settingsRow) => ({
				...projectCategory(settingsRow),
				enabled: settingsRow.enabled,
			})),
	}),
	createGift: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		setsImageReference: setsGiftImage,
		projectOutput: projectGiftChange,
	}),
	updateGift: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byGiftId((input) => input.id),
		setsImageReference: setsGiftImage,
		projectOutput: (output) => ({
			...projectGiftChange(output),
			didCategoryChange: output.didCategoryChange,
		}),
	}),
	appendGiftDescription: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byGiftId((input) => input.giftId),
		projectOutput: projectGiftChange,
	}),
	deleteGift: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byGiftId((input) => input.giftId),
		confirmation: ALWAYS_CONFIRMED,
		projectOutput: projectWishlistShortId,
	}),
	markGiftReceived: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byGiftId((input) => input.giftId),
		projectOutput: projectGiftChange,
	}),
	reorderGifts: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: projectWishlistShortId,
	}),
	// No bulk action deletes gifts or sets an image reference; image actions only restyle.
	bulkUpdateGifts: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: (output) => ({
			updatedIds: output.updatedIds,
			wishlistShortId: output.wishlistShortId,
		}),
	}),
	// Copies duplicate the source gifts' own uploads, which the actor must manage.
	bulkCopyGifts: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: (input) => [
			{ kind: TARGET_KIND.wishlistId, id: input.sourceWishlistId },
			{ kind: TARGET_KIND.wishlistId, id: input.destinationWishlistId },
		],
		projectOutput: (output) => ({
			createdIds: output.createdIds,
			destinationShortId: output.destinationShortId,
		}),
	}),
	undoGiftRevisionBatch: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: (input) => [{ kind: TARGET_KIND.revisionBatchId, id: input.batchId }],
		confirmation: confirmedDependingOnInput((input) => ({
			undoesGiftCreationsOfBatch: input.batchId,
		})),
		projectOutput: projectUndo,
	}),
	undoGiftRevision: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byGiftId((input) => input.giftId),
		confirmation: confirmedDependingOnInput((input) => ({
			undoesGiftCreationOfGift: input.giftId,
		})),
		projectOutput: projectUndo,
	}),
	createWishlist: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: namesNoWishlist,
		projectOutput: projectAgentWishlistRow,
	}),
	updateWishlist: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.id),
		setsImageReference: (input) =>
			input.imageKey !== undefined || input.imageAssignmentToken !== undefined,
		projectOutput: projectWishlistChange,
	}),
	renameRecipient: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.id),
		projectOutput: projectWishlistChange,
	}),
	setWishlistPalette: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: projectWishlistChange,
	}),
	saveWishlistSettings: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		setsImageReference: (input) => input.image !== undefined,
		projectOutput: projectWishlistShortId,
	}),
	saveGiftCategorySettings: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: projectWishlistShortId,
	}),
	savePriorityLevels: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: (output) => ({
			levels: projectPriorityLevels(output.levels),
			wishlistShortId: output.wishlistShortId,
		}),
	}),
	importGifts: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		setsImageReference: setsDraftImage,
		projectOutput: ({ outcome, wishlistShortId }) => ({
			outcome:
				outcome.status === 'created'
					? {
							status: outcome.status,
							gifts: outcome.gifts.map((created) => ({ id: created.id })),
						}
					: { status: outcome.status, duplicateIndexes: outcome.duplicateIndexes },
			wishlistShortId,
		}),
	}),
	createWishlistFromImport: agentOperation({
		scope: AGENT_SCOPE.giftsWrite,
		targets: namesNoWishlist,
		setsImageReference: setsDraftImage,
		projectOutput: projectAgentWishlistRow,
	}),
	shareWishlist: HUMAN_ONLY,
	revertWishlistToDraft: HUMAN_ONLY,
	archiveWishlist: HUMAN_ONLY,
	deleteWishlist: HUMAN_ONLY,
	flipRecipientToFreeText: HUMAN_ONLY,
	reserveGift: agentOperation({
		scope: AGENT_SCOPE.reservationsWrite,
		targets: byGiftId((input) => input.giftId),
		confirmation: ALWAYS_CONFIRMED,
		projectOutput: (output) => ({
			reservationId: output.reservationId,
			wishlistShortId: output.wishlistShortId,
		}),
	}),
	cancelOwnReservation: agentOperation({
		scope: AGENT_SCOPE.reservationsWrite,
		targets: byReservationId((input) => input.reservationId),
		confirmation: ALWAYS_CONFIRMED,
		projectOutput: projectWishlistShortId,
	}),
	unreserveGift: HUMAN_ONLY,
	setReservationPurchased: agentOperation({
		scope: AGENT_SCOPE.reservationsWrite,
		targets: byReservationId((input) => input.reservationId),
		confirmation: ALWAYS_CONFIRMED,
		projectOutput: (output) => ({
			purchased: output.purchased,
			wishlistShortId: output.wishlistShortId,
		}),
	}),
	readReservationLedger: HUMAN_ONLY,
	readMyGiftReservations: agentOperation({
		scope: AGENT_SCOPE.read,
		targets: byGiftId((input) => input.giftId),
		projectOutput: (output) =>
			output.map((ownReservation) => ({
				id: ownReservation.id,
				quantity: ownReservation.quantity,
				createdAt: ownReservation.createdAt,
			})),
	}),
	readWishlistModerators: HUMAN_ONLY,
	// The core never returns the link on a token channel; the invitee receives it by email.
	generateModeratorInviteLink: agentOperation({
		scope: AGENT_SCOPE.managersInvite,
		targets: byWishlistId((input) => input.wishlistId),
		confirmation: ALWAYS_CONFIRMED,
		projectOutput: (output) => ({ unregisteredInvitee: output.unregisteredInvitee }),
	}),
	acceptModeratorInvite: HUMAN_ONLY,
	revokeModeratorInvite: HUMAN_ONLY,
	removeModerator: HUMAN_ONLY,
	selfPromoteToModerator: HUMAN_ONLY,
	readClaimInvites: HUMAN_ONLY,
	generateClaimInviteLink: HUMAN_ONLY,
	acceptClaimInvite: HUMAN_ONLY,
	revokeClaimInvite: HUMAN_ONLY,
	followWishlist: HUMAN_ONLY,
	unfollowWishlist: HUMAN_ONLY,
	refollowWishlist: HUMAN_ONLY,
	recordWishlistVisit: HUMAN_ONLY,
	toggleGiftLike: HUMAN_ONLY,
};

export function isOperationName(name: string): name is OperationName {
	return Object.hasOwn(OPERATION_REGISTRY, name);
}
