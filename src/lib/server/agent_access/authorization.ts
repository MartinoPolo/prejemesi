import { error } from '@sveltejs/kit';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { SERVER_ERROR, encodeServerError } from '$lib/modules/errors/server_error_codes.js';
import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	type AnyMutationOperation,
	type AnyOperation,
	type AnyReadOperation,
} from '$lib/server/operations/operation.js';
import {
	executeOperation,
	executeOperationBatch,
	parseOperationInput,
	previewOperationBatch,
	type OperationBatchOptions,
	type OperationStepRejection,
} from '$lib/server/operations/runner.js';
import type { GiftRevisionRecord } from '$lib/server/operations/gift_revisions.js';
import { hasAgentScope, tokenActor, type AgentAccessGrant } from './agent_grant.js';
import {
	AGENT_OPERATION_POLICIES,
	isOperationName,
	type AgentOperationPolicy,
} from './operation_policies.js';
import {
	resolveConfirmations,
	resolveTargetWishlistIds,
	type ConfirmationRule,
	type LookupDatabase,
	type TargetReference,
} from './policy_lookups.js';
import { AGENT_BATCH_MAX_ITEMS } from './limits.js';

export interface AgentOperationRequest {
	operationName: string;
	input: unknown;
}

/** An operation the token may call with this input, ready for the runner. */
export interface AuthorizedAgentOperation {
	operation: AnyOperation;
	/** The caller's input as received; the runner validates it again when it runs. */
	input: unknown;
	/** Locked first when the call runs in a batch; re-checked under that lock. */
	targetWishlistIds: readonly string[];
	/** Fast-forward never applies such a call without the user's explicit selection. */
	requiresConfirmation: boolean;
	/** The references and rule the target wishlists and confirmation were resolved from. */
	lookup: { targets: readonly TargetReference[]; confirmation: ConfirmationRule };
	projectOutput(output: unknown): unknown;
}

interface CheckedAgentRequest {
	operation: AnyOperation;
	policy: AgentOperationPolicy<unknown, unknown>;
	rawInput: unknown;
}

/** Lookups return one value per step, in step order. */
function stepValue<TValue>(values: readonly TValue[], index: number): TValue {
	const value = values[index];
	if (value === undefined) {
		throw new Error(`Missing value for step ${index}`);
	}
	return value;
}

function isWithinWishlistRestriction(
	grant: Pick<AgentAccessGrant, 'wishlistIds'>,
	step: { operation: AnyOperation; targets: readonly TargetReference[] },
	targetWishlistIds: readonly string[],
): boolean {
	const allowedWishlistIds = grant.wishlistIds;
	if (allowedWishlistIds === null) {
		return true;
	}
	if (step.targets.length === 0) {
		// A read naming no wishlist filters its output by the restriction; a restricted token
		// cannot create wishlists, which would be outside its restriction.
		return step.operation.kind === OPERATION_KIND.read;
	}
	return (
		targetWishlistIds.length > 0 &&
		targetWishlistIds.every((wishlistId) => allowedWishlistIds.includes(wishlistId))
	);
}

/** 404 for unknown and human-only operations alike; 403 without the policy's scope. */
function checkOperationAndScope(
	grant: AgentAccessGrant,
	request: AgentOperationRequest,
): CheckedAgentRequest {
	const { operationName } = request;
	if (!isOperationName(operationName)) {
		error(404, SERVER_ERROR.AGENT_OPERATION_NOT_FOUND);
	}
	const operation: AnyOperation = OPERATION_REGISTRY[operationName];
	const policy: AgentOperationPolicy<unknown, unknown> | null =
		AGENT_OPERATION_POLICIES[operationName];
	if (policy === null || operation.exposure !== OPERATION_EXPOSURE.agent) {
		error(404, SERVER_ERROR.AGENT_OPERATION_NOT_FOUND);
	}
	if (!hasAgentScope(grant, policy.scope)) {
		error(403, SERVER_ERROR.AGENT_SCOPE_MISSING);
	}
	return { operation, policy, rawInput: request.input };
}

/**
 * Checks a token's calls before they reach the operation core: only agent-exposed operations,
 * only within the token's scopes and wishlist restriction, and without image references. Every
 * call's operation and scope are checked before any input is validated, and every input before
 * any wishlist is looked up. A restricted token gets 403 for a target that does not exist too,
 * so it cannot probe which ids exist outside its wishlists. The core still checks the user's
 * current role on every call, so a token never exceeds its user's rights.
 */
export async function authorizeAgentOperations(
	grant: AgentAccessGrant,
	requests: readonly AgentOperationRequest[],
): Promise<AuthorizedAgentOperation[]> {
	if (requests.length === 0) {
		error(400, SERVER_ERROR.INVALID_OPERATION_INPUT);
	}
	if (requests.length > AGENT_BATCH_MAX_ITEMS) {
		error(
			400,
			encodeServerError(SERVER_ERROR.AGENT_BATCH_TOO_LARGE, {
				maxItems: AGENT_BATCH_MAX_ITEMS,
			}),
		);
	}
	const checkedRequests = requests.map((request) => checkOperationAndScope(grant, request));
	const lookups = checkedRequests.map(({ operation, policy, rawInput }) => {
		const input = parseOperationInput(operation.input, rawInput);
		if (policy.setsImageReference(input)) {
			error(400, SERVER_ERROR.AGENT_IMAGE_INPUT_UNSUPPORTED);
		}
		return { targets: policy.targets(input), confirmation: policy.confirmation(input) };
	});
	const database = getDb();
	const targetWishlistIds = await resolveTargetWishlistIds(
		database,
		lookups.map((lookup) => lookup.targets),
	);
	const withinRestriction = checkedRequests.every(({ operation }, index) =>
		isWithinWishlistRestriction(
			grant,
			{ operation, targets: stepValue(lookups, index).targets },
			stepValue(targetWishlistIds, index),
		),
	);
	if (!withinRestriction) {
		error(403, SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED);
	}
	const confirmations = await resolveConfirmations(
		database,
		lookups.map((lookup) => lookup.confirmation),
	);
	return checkedRequests.map(({ operation, policy, rawInput }, index) => ({
		operation,
		input: rawInput,
		targetWishlistIds: stepValue(targetWishlistIds, index),
		requiresConfirmation: stepValue(confirmations, index),
		lookup: stepValue(lookups, index),
		projectOutput: (output) => policy.projectOutput(output, grant),
	}));
}

export async function authorizeAgentOperation(
	grant: AgentAccessGrant,
	operationName: string,
	input: unknown,
): Promise<AuthorizedAgentOperation> {
	const [authorized] = await authorizeAgentOperations(grant, [{ operationName, input }]);
	if (authorized === undefined) {
		throw new Error(`Authorizing ${operationName} returned no operation`);
	}
	return authorized;
}

function sameWishlistIds(first: readonly string[], second: readonly string[]): boolean {
	const firstIds = new Set(first);
	const secondIds = new Set(second);
	return firstIds.size === secondIds.size && [...firstIds].every((id) => secondIds.has(id));
}

/**
 * 409 when a step's target wishlists or confirmation requirement differ from what was
 * authorized: between authorization and the lock a gift's undo history or a reference may have
 * changed, and the restriction check and confirmation decision covered the earlier state. The
 * first outdated step is reported to `onStepFailed` like a step that threw.
 */
async function verifyAuthorizationUnchanged(
	database: LookupDatabase,
	authorizedOperations: readonly AuthorizedAgentOperation[],
	onStepFailed: OperationBatchOptions['onStepFailed'],
): Promise<void> {
	const lockedTargets = await resolveTargetWishlistIds(
		database,
		authorizedOperations.map((authorized) => authorized.lookup.targets),
	);
	const lockedConfirmations = await resolveConfirmations(
		database,
		authorizedOperations.map((authorized) => authorized.lookup.confirmation),
	);
	const outdatedIndex = authorizedOperations.findIndex(
		(authorized, index) =>
			!sameWishlistIds(authorized.targetWishlistIds, stepValue(lockedTargets, index)) ||
			authorized.requiresConfirmation !== stepValue(lockedConfirmations, index),
	);
	if (outdatedIndex === -1) {
		return;
	}
	try {
		error(409, SERVER_ERROR.AGENT_AUTHORIZATION_OUTDATED);
	} catch (outdated) {
		onStepFailed?.(outdatedIndex, outdated);
		throw outdated;
	}
}

function isMutation(
	authorized: AuthorizedAgentOperation,
): authorized is AuthorizedAgentOperation & { operation: AnyMutationOperation } {
	return authorized.operation.kind === OPERATION_KIND.mutation;
}

export interface AgentBatchResult {
	batchId: string;
	/** Each step's projected output, in step order. */
	results: unknown[];
	/** Each step's unprojected output, in step order. */
	rawResults: unknown[];
}

/** Extra checks a caller runs under the batch's locks, after the authorization re-check. */
export type AgentBatchOptions = Pick<
	OperationBatchOptions,
	'dryRun' | 'verifyLocked' | 'beforeCommit' | 'onStepFailed'
>;

function requireMutations(
	authorizedOperations: readonly AuthorizedAgentOperation[],
): (AuthorizedAgentOperation & { operation: AnyMutationOperation })[] {
	const mutations = authorizedOperations.filter(isMutation);
	if (mutations.length !== authorizedOperations.length) {
		error(400, SERVER_ERROR.INVALID_OPERATION_INPUT);
	}
	return mutations;
}

/** Every target wishlist locked first, then the authorization and the caller's checks re-run. */
function lockedBatchOptions(
	mutations: readonly AuthorizedAgentOperation[],
	options: Pick<OperationBatchOptions, 'verifyLocked' | 'onStepFailed'>,
): Required<Pick<OperationBatchOptions, 'exclusiveWishlistIds' | 'verifyLocked'>> {
	const { verifyLocked, onStepFailed } = options;
	return {
		exclusiveWishlistIds: [
			...new Set(mutations.flatMap((authorized) => authorized.targetWishlistIds)),
		],
		verifyLocked: async (transaction: DatabaseTransaction) => {
			await verifyAuthorizationUnchanged(transaction, mutations, onStepFailed);
			await verifyLocked?.(transaction);
		},
	};
}

/**
 * Runs authorized mutations atomically as the token actor. Every target wishlist is locked FOR
 * UPDATE in id order first, then the authorization is re-checked under that lock (409
 * `AGENT_AUTHORIZATION_OUTDATED` on any difference). Reads are rejected: they run through
 * {@link executeAgentRead} without a transaction or exclusive locks.
 */
export async function executeAgentOperationBatch(
	grant: AgentAccessGrant,
	authorizedOperations: readonly AuthorizedAgentOperation[],
	options: AgentBatchOptions = {},
): Promise<AgentBatchResult> {
	const mutations = requireMutations(authorizedOperations);
	const batch = await executeOperationBatch(
		tokenActor(grant),
		mutations.map((authorized) => ({
			operation: authorized.operation,
			input: authorized.input,
		})),
		{
			dryRun: options.dryRun,
			beforeCommit: options.beforeCommit,
			onStepFailed: options.onStepFailed,
			...lockedBatchOptions(mutations, options),
		},
	);
	return {
		batchId: batch.batchId,
		results: batch.results.map((output, index) =>
			stepValue(mutations, index).projectOutput(output),
		),
		rawResults: batch.results,
	};
}

/** One previewed step: its projected output and gift revisions, or the core's rejection. */
export type AgentStepPreview =
	| { accepted: true; result: unknown; revisions: GiftRevisionRecord[] }
	| { accepted: false; rejection: OperationStepRejection };

/**
 * Dry-runs authorized mutations step by step as the token actor under the same exclusive locks
 * and authorization re-check as {@link executeAgentOperationBatch}; a rejected step is reported
 * and the following steps still run on the state the accepted ones left. Nothing commits.
 */
export async function previewAgentOperationBatch(
	grant: AgentAccessGrant,
	authorizedOperations: readonly AuthorizedAgentOperation[],
	options: Pick<OperationBatchOptions, 'verifyLocked'> = {},
): Promise<AgentStepPreview[]> {
	const mutations = requireMutations(authorizedOperations);
	const previews = await previewOperationBatch(
		tokenActor(grant),
		mutations.map((authorized) => ({
			operation: authorized.operation,
			input: authorized.input,
		})),
		lockedBatchOptions(mutations, options),
	);
	return previews.map((preview, index) =>
		preview.accepted
			? { ...preview, result: stepValue(mutations, index).projectOutput(preview.result) }
			: preview,
	);
}

function isRead(
	authorized: AuthorizedAgentOperation,
): authorized is AuthorizedAgentOperation & { operation: AnyReadOperation } {
	return authorized.operation.kind === OPERATION_KIND.read;
}

/** Runs an authorized read as the token actor and returns its projected output. */
export async function executeAgentRead(
	grant: AgentAccessGrant,
	authorized: AuthorizedAgentOperation,
): Promise<unknown> {
	if (!isRead(authorized)) {
		error(400, SERVER_ERROR.INVALID_OPERATION_INPUT);
	}
	const output = await executeOperation(
		tokenActor(grant),
		authorized.operation,
		authorized.input,
	);
	return authorized.projectOutput(output);
}
