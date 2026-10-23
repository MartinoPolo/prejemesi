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
	/** One sentence on what the operation does, for the generated API docs and MCP tools. */
	readonly summary: string;
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
	 * Agents never set an image URL or storage key: the core trusts a given upload key, so a token
	 * could point a gift at another user's upload and later trigger its deletion, and an external
	 * URL would be kept as a reference. Such input is rejected.
	 */
	setsImageReference(input: TInput): boolean;
	/**
	 * Whether the input may name an image from `POST /api/v1/images` in `imageReference`, which
	 * authorization checks for ownership and replaces with the stored image's key.
	 */
	readonly acceptsImageReference: boolean;
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
	summary: string;
	scope: AgentScope;
	targets: (input: TInput) => TargetReference[];
	confirmation?: ConfirmationDeclaration<NoInfer<TInput>>;
	setsImageReference?: (input: NoInfer<TInput>) => boolean;
	acceptsImageReference?: boolean;
	projectOutput: (output: TOutput, grant: AgentAccessGrant) => unknown;
}): AgentOperationPolicy<TInput, TOutput> {
	return {
		summary: policy.summary,
		scope: policy.scope,
		confirmationMode: policy.confirmation?.mode ?? CONFIRMATION_MODE.never,
		targets: policy.targets,
		confirmation: policy.confirmation?.rule ?? (() => false),
		setsImageReference: policy.setsImageReference ?? (() => false),
		acceptsImageReference: policy.acceptsImageReference ?? false,
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
		summary: 'Lists the gifts of a wishlist as the user may see them.',
		scope: AGENT_SCOPE.read,
		targets: byWishlistShortId((input) => input.wishlistShortId),
		projectOutput: (output, grant) =>
			projectAgentWishlistGifts(output, {
				includeReserverNames: hasAgentScope(grant, AGENT_SCOPE.reservationsIdentities),
			}),
	}),
	readBulkCopyDestinations: agentOperation({
		summary: 'Lists the wishlists the gifts of this wishlist can be copied to.',
		scope: AGENT_SCOPE.read,
		targets: byWishlistId((input) => input.sourceWishlistId),
		projectOutput: (output, grant) =>
			projectAgentBulkCopyDestinations(output, grant.wishlistIds),
	}),
	readPriorityLevels: agentOperation({
		summary: 'Lists the priority levels of a wishlist.',
		scope: AGENT_SCOPE.read,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: projectPriorityLevels,
	}),
	readWishlist: agentOperation({
		summary: 'Reads the details of one wishlist.',
		scope: AGENT_SCOPE.read,
		targets: byWishlistShortId((input) => input.wishlistShortId),
		projectOutput: projectAgentWishlist,
	}),
	// Names no wishlist: the projection applies the token's wishlist restriction instead.
	readAccessibleWishlists: agentOperation({
		summary: 'Lists the wishlists the token reaches, with the user’s role on each.',
		scope: AGENT_SCOPE.read,
		targets: namesNoWishlist,
		projectOutput: (output, grant) =>
			projectAgentAccessibleWishlists(output, grant.wishlistIds),
	}),
	// The first read inserts the default categories; `read` permits that idempotent write.
	readGiftCategories: agentOperation({
		summary: 'Lists the gift categories a wishlist uses.',
		scope: AGENT_SCOPE.read,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: (output) => output.map(projectCategory),
	}),
	readGiftCategorySettingsRows: agentOperation({
		summary: 'Lists every gift category of a wishlist and whether it is enabled.',
		scope: AGENT_SCOPE.read,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: (output) =>
			output.map((settingsRow) => ({
				...projectCategory(settingsRow),
				enabled: settingsRow.enabled,
			})),
	}),
	createGift: agentOperation({
		summary: 'Adds a gift to a wishlist the user manages.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		setsImageReference: setsGiftImage,
		acceptsImageReference: true,
		projectOutput: projectGiftChange,
	}),
	updateGift: agentOperation({
		summary:
			'Edits a gift; after sharing, the post-share rules decide which fields may change.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byGiftId((input) => input.id),
		setsImageReference: setsGiftImage,
		acceptsImageReference: true,
		projectOutput: (output) => ({
			...projectGiftChange(output),
			didCategoryChange: output.didCategoryChange,
		}),
	}),
	appendGiftDescription: agentOperation({
		summary: 'Adds a dated addition to the description of a shared gift.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byGiftId((input) => input.giftId),
		projectOutput: projectGiftChange,
	}),
	deleteGift: agentOperation({
		summary: 'Deletes a gift; always needs the user’s confirmation.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byGiftId((input) => input.giftId),
		confirmation: ALWAYS_CONFIRMED,
		projectOutput: projectWishlistShortId,
	}),
	markGiftReceived: agentOperation({
		summary: 'Marks a gift received or not received.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byGiftId((input) => input.giftId),
		projectOutput: projectGiftChange,
	}),
	reorderGifts: agentOperation({
		summary: 'Sets the manual order of the gifts of a wishlist.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: projectWishlistShortId,
	}),
	// No bulk action deletes gifts or sets an image reference; image actions only restyle.
	bulkUpdateGifts: agentOperation({
		summary: 'Sets one field, such as priority or category, on several gifts at once.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: (output) => ({
			updatedIds: output.updatedIds,
			wishlistShortId: output.wishlistShortId,
		}),
	}),
	// Copies duplicate the source gifts' own uploads, which the actor must manage. Removing the
	// copied sources deletes gifts, which needs the user's confirmation like `deleteGift`.
	bulkCopyGifts: agentOperation({
		summary:
			'Copies gifts to another wishlist, optionally removing the unreserved sources, which needs confirmation.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: (input) => [
			{ kind: TARGET_KIND.wishlistId, id: input.sourceWishlistId },
			{ kind: TARGET_KIND.wishlistId, id: input.destinationWishlistId },
		],
		confirmation: confirmedDependingOnInput((input) => input.removeUnreservedSources === true),
		projectOutput: (output) => ({
			createdIds: output.createdIds,
			destinationShortId: output.destinationShortId,
		}),
	}),
	undoGiftRevisionBatch: agentOperation({
		summary: 'Undoes a batch of gift changes unless a gift changed since.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: (input) => [{ kind: TARGET_KIND.revisionBatchId, id: input.batchId }],
		confirmation: confirmedDependingOnInput((input) => ({
			undoesGiftCreationsOfBatch: input.batchId,
		})),
		projectOutput: projectUndo,
	}),
	undoGiftRevision: agentOperation({
		summary: 'Undoes the latest change of a gift unless it changed since.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byGiftId((input) => input.giftId),
		confirmation: confirmedDependingOnInput((input) => ({
			undoesGiftCreationOfGift: input.giftId,
		})),
		projectOutput: projectUndo,
	}),
	restoreGiftOrder: HUMAN_ONLY,
	createWishlist: agentOperation({
		summary: 'Creates a draft wishlist; only with an unrestricted fast-forward token.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: namesNoWishlist,
		projectOutput: projectAgentWishlistRow,
	}),
	updateWishlist: agentOperation({
		summary: 'Edits the title, description, event date or kind of a wishlist.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.id),
		setsImageReference: (input) =>
			input.imageKey !== undefined || input.imageAssignmentToken !== undefined,
		projectOutput: projectWishlistChange,
	}),
	renameRecipient: agentOperation({
		summary: 'Renames the free-text recipient of a wishlist.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.id),
		projectOutput: projectWishlistChange,
	}),
	setWishlistPalette: agentOperation({
		summary: 'Sets the color palette of a wishlist.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: projectWishlistChange,
	}),
	saveWishlistSettings: agentOperation({
		summary: 'Saves the details, categories and palette of a wishlist together.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		setsImageReference: (input) => input.image !== undefined,
		projectOutput: projectWishlistShortId,
	}),
	saveGiftCategorySettings: agentOperation({
		summary:
			'Saves the ordered gift categories of a wishlist: renames, recolors, reorders, removes or creates them.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: projectWishlistShortId,
	}),
	createGiftCategory: HUMAN_ONLY,
	savePriorityLevels: agentOperation({
		summary: 'Renames, adds, removes or reorders the priority levels of a wishlist.',
		scope: AGENT_SCOPE.giftsWrite,
		targets: byWishlistId((input) => input.wishlistId),
		projectOutput: (output) => ({
			levels: projectPriorityLevels(output.levels),
			wishlistShortId: output.wishlistShortId,
		}),
	}),
	importGifts: agentOperation({
		summary: 'Adds several gifts at once, reporting likely duplicates unless acknowledged.',
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
		summary:
			'Creates a draft wishlist with gifts; only with an unrestricted fast-forward token.',
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
		summary: 'Reserves a gift for the user; always needs the user’s confirmation.',
		scope: AGENT_SCOPE.reservationsWrite,
		targets: byGiftId((input) => input.giftId),
		confirmation: ALWAYS_CONFIRMED,
		projectOutput: (output) => ({
			reservationId: output.reservationId,
			wishlistShortId: output.wishlistShortId,
		}),
	}),
	cancelOwnReservation: agentOperation({
		summary: 'Cancels one of the user’s reservations; always needs the user’s confirmation.',
		scope: AGENT_SCOPE.reservationsWrite,
		targets: byReservationId((input) => input.reservationId),
		confirmation: ALWAYS_CONFIRMED,
		projectOutput: projectWishlistShortId,
	}),
	unreserveGift: HUMAN_ONLY,
	setReservationPurchased: agentOperation({
		summary:
			'Marks one of the user’s reservations bought or not; always needs the user’s confirmation.',
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
		summary: 'Lists the user’s own reservations of a gift.',
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
		summary: 'Invites a manager by email; always needs the user’s confirmation.',
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
