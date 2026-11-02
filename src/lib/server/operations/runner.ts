import * as v from 'valibot';
import { error, isHttpError } from '@sveltejs/kit';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { generateId } from '$lib/server/db/id.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { DispatchNotificationInput } from '$lib/modules/notifications/types.js';
import { requireOperationActor, type OperationActor } from './actor.js';
import { MAX_OPERATION_BATCH_STEPS } from './constants.js';
import {
	GiftRevisionCollector,
	scheduleGiftRevisionPurge,
	type GiftRevisionRecord,
} from './gift_revisions.js';
import {
	OPERATION_KIND,
	type AnyMutationOperation,
	type MutationOperation,
	type MutationOperationContext,
	type OperationInputSchema,
	type PreparedMutationOperation,
	type ReadOperation,
} from './operation.js';
import {
	dispatchReservedGiftEditNotifications,
	planReservedGiftEditNotifications,
	type ReservedGiftEdit,
} from './reserved_gift_edit_notifications.js';
import { lockWishlistsInIdOrder } from './wishlist_management.js';

export interface OperationBatchStep {
	operation: AnyMutationOperation;
	input: unknown;
}

export interface OperationOptions {
	/** Runs the same code, rolls the transaction back and reports the revisions it would write. */
	dryRun?: boolean;
}

export interface OperationBatchOptions extends OperationOptions {
	/**
	 * Every wishlist the batch touches, locked FOR UPDATE in id order before the first step. A step
	 * taking a weaker wishlist lock (a reservation's share lock, a gift edit's key share lock) would
	 * otherwise deadlock against a concurrent batch once a later step needs the row exclusively.
	 */
	exclusiveWishlistIds?: readonly string[];
	/**
	 * Runs inside the transaction once the exclusive wishlists are locked and before the first
	 * step; throwing rejects the batch. Lets a caller re-check under the lock what it decided
	 * before the transaction opened.
	 */
	verifyLocked?: (transaction: DatabaseTransaction) => Promise<void>;
	/**
	 * Runs inside the transaction after the last step, with every step's output, before it
	 * commits; throwing rejects the batch. Never runs on a dry run.
	 */
	beforeCommit?: (
		transaction: DatabaseTransaction,
		batch: OperationBatchOutputs,
	) => Promise<void>;
	/** Learns which step threw before the error rejects the whole batch. */
	onStepFailed?: (stepIndex: number, thrown: unknown) => void;
}

type BatchRunOptions = Required<Pick<OperationBatchOptions, 'dryRun' | 'exclusiveWishlistIds'>> &
	Pick<OperationBatchOptions, 'verifyLocked' | 'beforeCommit' | 'onStepFailed'>;

export interface OperationBatchOutputs {
	batchId: string;
	/** Each step's unprojected output, in step order. */
	results: unknown[];
}

export interface OperationBatchResult extends OperationBatchOutputs {
	revisions: GiftRevisionRecord[];
}

/** Why the core rejected one step: the HTTP status and the error message (a code, possibly encoded). */
export interface OperationStepRejection {
	status: number;
	message: string;
}

/** One step of a batch preview: what it would return and write, or why the core rejected it. */
export type OperationStepPreview =
	| { accepted: true; result: unknown; revisions: GiftRevisionRecord[] }
	| { accepted: false; rejection: OperationStepRejection };

export type OperationPreviewOptions = Pick<
	OperationBatchOptions,
	'exclusiveWishlistIds' | 'verifyLocked'
>;

export interface OperationDryRunResult<TOutput> {
	result: TOutput;
	revisions: GiftRevisionRecord[];
}

interface PreparedStep {
	operationName: string;
	/** See {@link MutationOperation.isolatedGiftId}; null for a step that runs on its own. */
	isolatedGiftId: string | null;
	run(context: MutationOperationContext): Promise<unknown>;
	onCommitted(): Promise<void>;
	onAbandoned(): Promise<void>;
}

interface BoundStep {
	prepare(actor: OperationActor, dryRun: boolean): Promise<PreparedStep>;
}

interface DeferredEffect {
	operationName: string;
	effect: () => Promise<void>;
}

interface TransactionOutcome {
	results: unknown[];
	revisions: GiftRevisionRecord[];
	notifications: DispatchNotificationInput[];
}

class DryRunRollback extends Error {
	constructor(readonly outcome: TransactionOutcome) {
		super('Operation dry run rollback');
	}
}

/** 400 with the shared invalid-input code when the input does not match the operation's schema. */
export function parseOperationInput<TSchema extends OperationInputSchema>(
	schema: TSchema,
	rawInput: unknown,
): v.InferOutput<TSchema> {
	const parsed = v.safeParse(schema, rawInput);
	if (!parsed.success) {
		error(400, SERVER_ERROR.INVALID_OPERATION_INPUT);
	}
	return parsed.output;
}

const doNothing = async (): Promise<void> => {};

function bindMutationStep<TName extends string, TSchema extends OperationInputSchema, TOutput>(
	operation:
		| MutationOperation<TName, TSchema, TOutput>
		| PreparedMutationOperation<TName, TSchema, TOutput, unknown>,
	rawInput: unknown,
	onOutput: (output: TOutput) => void = () => {},
): BoundStep {
	const input = parseOperationInput(operation.input, rawInput);
	const isolatedGiftId = operation.isolatedGiftId?.(input) ?? null;
	const toPreparedStep = (
		execute: (context: MutationOperationContext) => Promise<TOutput>,
		cleanup: Pick<PreparedStep, 'onCommitted' | 'onAbandoned'>,
	): PreparedStep => ({
		operationName: operation.name,
		isolatedGiftId,
		run: async (context) => {
			const output = await execute(context);
			onOutput(output);
			return output;
		},
		...cleanup,
	});
	return {
		async prepare(actor, dryRun) {
			if (operation.prepare === undefined) {
				return toPreparedStep((context) => operation.run(context, input), {
					onCommitted: doNothing,
					onAbandoned: doNothing,
				});
			}
			const resources = await operation.prepare(actor, input, { dryRun });
			return toPreparedStep((context) => operation.run(context, input, resources.value), {
				onCommitted: () => resources.onCommitted(),
				onAbandoned: () => resources.onAbandoned(),
			});
		},
	};
}

/** Runs bookkeeping whose failure must not fail the request: it is logged and swallowed. */
export async function settleBestEffort(label: string, work: () => Promise<void>): Promise<void> {
	try {
		await work();
	} catch (thrown) {
		console.error(`[Operations] ${label} failed`, thrown);
	}
}

/** After commit, each effect is best effort: a failure is logged and never skips the others. */
async function settleDeferredEffects(
	deferredEffects: readonly DeferredEffect[],
	origin: string,
): Promise<void> {
	for (const { operationName, effect } of deferredEffects) {
		await settleBestEffort(`deferred effect ${operationName} ${origin}`, effect);
	}
}

/** What every step of one batch transaction shares; each step gets its own context from it. */
interface BatchStepScope {
	actor: OperationActor;
	transaction: DatabaseTransaction;
	now: Date;
	batchId: string;
	dryRun: boolean;
	revisionCollector: GiftRevisionCollector;
	noteReservedGiftEdits: (edits: readonly ReservedGiftEdit[]) => void;
	deferEffect: (deferredEffect: DeferredEffect) => void;
}

/**
 * A step's context, holding back what it reports until `reportToScope`, so steps run together
 * still report in step order.
 */
function stepContext(
	step: PreparedStep,
	scope: BatchStepScope,
): { context: MutationOperationContext; reportToScope: () => void } {
	const reports: (() => void)[] = [];
	return {
		context: {
			actor: scope.actor,
			transaction: scope.transaction,
			now: scope.now,
			batchId: scope.batchId,
			dryRun: scope.dryRun,
			recordGiftRevisions: (changes) =>
				reports.push(() => scope.revisionCollector.record(step.operationName, changes)),
			noteReservedGiftEdits: (edits) =>
				reports.push(() => scope.noteReservedGiftEdits(edits)),
			deferEffect: (effect) =>
				reports.push(() =>
					scope.deferEffect({ operationName: step.operationName, effect }),
				),
		},
		reportToScope: () => reports.forEach((report) => report()),
	};
}

interface IndexedStep {
	stepIndex: number;
	step: PreparedStep;
}

/**
 * Splits the steps, in order, into runs that execute together: a step on its own, or consecutive
 * steps that each change only their own distinct gift ({@link MutationOperation.isolatedGiftId}).
 */
function concurrentStepGroups(steps: readonly IndexedStep[]): IndexedStep[][] {
	const groups: IndexedStep[][] = [];
	let groupGiftIds = new Set<string>();
	for (const indexedStep of steps) {
		const giftId = indexedStep.step.isolatedGiftId;
		const group = groups.at(-1);
		if (
			group !== undefined &&
			giftId !== null &&
			groupGiftIds.size > 0 &&
			!groupGiftIds.has(giftId)
		) {
			group.push(indexedStep);
			groupGiftIds.add(giftId);
			continue;
		}
		groups.push([indexedStep]);
		groupGiftIds = new Set(giftId === null ? [] : [giftId]);
	}
	return groups;
}

type StepGroupOutcome = { failed: false; results: unknown[] } | { failed: true; thrown: unknown };

/**
 * Runs a group's steps concurrently on the transaction's one connection, which pipelines their
 * statements, then reports their effects in step order. A failure of a group of several steps may
 * leave the transaction aborted and need not be the first failing step: see
 * {@link runStepGroupInSavepoint}.
 */
async function runStepGroup(
	group: readonly IndexedStep[],
	scope: BatchStepScope,
): Promise<StepGroupOutcome> {
	const runs = group.map(({ step }) => ({ step, ...stepContext(step, scope) }));
	type GroupRun = (typeof runs)[number];
	const settledRuns = new Map<GroupRun, PromiseSettledResult<unknown>>();
	const runTogether = async (selected: readonly GroupRun[]) => {
		const settled = await Promise.allSettled(selected.map((run) => run.step.run(run.context)));
		selected.forEach((run, index) => settledRuns.set(run, settled[index]));
	};
	// postgres.js pipelines only statements it has already prepared on the connection; one it has
	// not described yet makes the statements queued behind it go one round trip each. So the first
	// step of each operation runs ahead and prepares the statements the others repeat.
	const leaders = new Map(runs.map((run) => [run.step.operationName, run] as const).reverse());
	await runTogether([...leaders.values()]);
	if ([...settledRuns.values()].every((settled) => settled.status === 'fulfilled')) {
		await runTogether(runs.filter((run) => !settledRuns.has(run)));
	}
	const results: unknown[] = [];
	for (const run of runs) {
		const settled = settledRuns.get(run);
		if (settled?.status !== 'fulfilled') {
			return { failed: true, thrown: settled?.reason };
		}
		results.push(settled.value);
	}
	runs.forEach((run) => run.reportToScope());
	return { failed: false, results };
}

class StepGroupRollback extends Error {
	constructor() {
		super('Operation step group rollback');
	}
}

/**
 * Runs a group together in a savepoint and finishes it there, or undoes it and returns null when a
 * step fails or `finish` throws `StepGroupRollback`. The caller then runs the steps one by one, so a
 * failure names the step a sequential run would have failed on.
 */
async function runStepGroupInSavepoint<T>(
	group: readonly IndexedStep[],
	scope: BatchStepScope,
	finish: (savepoint: DatabaseTransaction, results: unknown[]) => Promise<T>,
): Promise<T | null> {
	try {
		return await scope.transaction.transaction(async (savepoint) => {
			const outcome = await runStepGroup(group, { ...scope, transaction: savepoint });
			if (outcome.failed) {
				throw new StepGroupRollback();
			}
			return finish(savepoint, outcome.results);
		});
	} catch (thrown) {
		if (thrown instanceof StepGroupRollback) {
			return null;
		}
		throw thrown;
	}
}

async function runBoundSteps(
	actor: OperationActor,
	steps: readonly BoundStep[],
	options: BatchRunOptions,
): Promise<OperationBatchResult> {
	const { dryRun } = options;
	if (steps.length === 0 || steps.length > MAX_OPERATION_BATCH_STEPS) {
		error(400, SERVER_ERROR.INVALID_OPERATION_INPUT);
	}
	const batchId = generateId();
	const now = new Date();
	const preparedSteps: PreparedStep[] = [];
	const deferredEffects: DeferredEffect[] = [];
	let outcome: TransactionOutcome;
	let committed = false;
	try {
		for (const step of steps) {
			preparedSteps.push(await step.prepare(actor, dryRun));
		}
		try {
			outcome = await getDb().transaction(async (transaction) => {
				await lockWishlistsInIdOrder(transaction, options.exclusiveWishlistIds);
				await options.verifyLocked?.(transaction);
				const revisionCollector = new GiftRevisionCollector({
					batchId,
					actorUserId: actor.userId,
					channel: actor.channel,
				});
				const reservedGiftEdits: ReservedGiftEdit[] = [];
				const scope: BatchStepScope = {
					actor,
					transaction,
					now,
					batchId,
					dryRun,
					revisionCollector,
					noteReservedGiftEdits: (edits) => reservedGiftEdits.push(...edits),
					deferEffect: (deferredEffect) => deferredEffects.push(deferredEffect),
				};
				const results: unknown[] = [];
				const indexedSteps = preparedSteps.map((step, stepIndex) => ({ stepIndex, step }));
				for (const group of concurrentStepGroups(indexedSteps)) {
					const groupResults =
						group.length > 1
							? await runStepGroupInSavepoint(group, scope, async (_, ran) => ran)
							: null;
					if (groupResults !== null) {
						results.push(...groupResults);
						continue;
					}
					for (const indexedStep of group) {
						const outcome = await runStepGroup([indexedStep], scope);
						if (outcome.failed) {
							options.onStepFailed?.(indexedStep.stepIndex, outcome.thrown);
							throw outcome.thrown;
						}
						results.push(...outcome.results);
					}
				}
				const notifications = dryRun
					? []
					: await planReservedGiftEditNotifications(
							transaction,
							reservedGiftEdits,
							actor,
						);
				const revisions = await revisionCollector.flush(transaction);
				if (dryRun) {
					throw new DryRunRollback({ results, revisions, notifications });
				}
				await options.beforeCommit?.(transaction, { batchId, results });
				return { results, revisions, notifications };
			});
		} catch (thrown) {
			if (thrown instanceof DryRunRollback) {
				return {
					batchId,
					results: thrown.outcome.results,
					revisions: thrown.outcome.revisions,
				};
			}
			throw thrown;
		}
		committed = true;
	} finally {
		if (!committed) {
			for (const preparedStep of preparedSteps) {
				await settleBestEffort('abandoned preparation cleanup', () =>
					preparedStep.onAbandoned(),
				);
			}
		}
	}

	for (const preparedStep of preparedSteps) {
		await settleBestEffort('committed preparation cleanup', () => preparedStep.onCommitted());
	}
	await settleDeferredEffects(deferredEffects, `batch ${batchId}`);
	await dispatchReservedGiftEditNotifications(outcome.notifications);
	scheduleGiftRevisionPurge();
	return { batchId, results: outcome.results, revisions: outcome.revisions };
}

/** What a mutation without a signed-in actor may use: it writes no gift revisions. */
export type AnonymousVisitorMutationContext = Pick<
	MutationOperationContext,
	'transaction' | 'now' | 'deferEffect'
>;

/**
 * Runs an anonymous visitor's own mutation (UI only: agents always act as a real user) with an
 * operation's input validation, single transaction and after-commit effects.
 */
export async function executeAnonymousVisitorMutation<
	TSchema extends OperationInputSchema,
	TOutput,
>(
	mutation: {
		operationName: string;
		input: TSchema;
		run: (
			context: AnonymousVisitorMutationContext,
			input: v.InferOutput<TSchema>,
		) => Promise<TOutput>;
	},
	rawInput: unknown,
): Promise<TOutput> {
	const input = parseOperationInput(mutation.input, rawInput);
	const now = new Date();
	const deferredEffects: DeferredEffect[] = [];
	const output = await getDb().transaction((transaction) =>
		mutation.run(
			{
				transaction,
				now,
				deferEffect: (effect) =>
					deferredEffects.push({ operationName: mutation.operationName, effect }),
			},
			input,
		),
	);
	await settleDeferredEffects(deferredEffects, 'anonymous visitor');
	return output;
}

/** Runs several mutations atomically under one batch id and one transaction. */
export async function executeOperationBatch(
	actor: OperationActor,
	steps: readonly OperationBatchStep[],
	options: OperationBatchOptions = {},
): Promise<OperationBatchResult> {
	return runBoundSteps(
		actor,
		steps.map((step) => bindMutationStep(step.operation, step.input)),
		{
			dryRun: options.dryRun === true,
			exclusiveWishlistIds: options.exclusiveWishlistIds ?? [],
			verifyLocked: options.verifyLocked,
			beforeCommit: options.beforeCommit,
			onStepFailed: options.onStepFailed,
		},
	);
}

/** A client error the core raised on purpose, or null for anything else: a defect, kept thrown. */
export function toOperationStepRejection(thrown: unknown): OperationStepRejection | null {
	return isHttpError(thrown) && thrown.status < 500
		? { status: thrown.status, message: thrown.body.message }
		: null;
}

function requireStepRejection(thrown: unknown): OperationStepRejection {
	const rejection = toOperationStepRejection(thrown);
	if (rejection === null) {
		throw thrown;
	}
	return rejection;
}

type PreviewEntry = { prepared: PreparedStep } | { rejection: OperationStepRejection };

class PreviewRollback extends Error {
	constructor() {
		super('Operation preview rollback');
	}
}

/**
 * Previews a batch step by step in one transaction that always rolls back: each step runs in its
 * own savepoint, so a step the core rejects is reported and undone while the following steps run
 * on the state the earlier accepted ones left. Steps that may run together first try as one group
 * in one savepoint; when any of them is rejected, the group is undone and previewed step by step.
 * Nothing commits and no deferred effect runs.
 */
export async function previewOperationBatch(
	actor: OperationActor,
	steps: readonly OperationBatchStep[],
	options: OperationPreviewOptions = {},
): Promise<OperationStepPreview[]> {
	if (steps.length === 0 || steps.length > MAX_OPERATION_BATCH_STEPS) {
		error(400, SERVER_ERROR.INVALID_OPERATION_INPUT);
	}
	const batchId = generateId();
	const now = new Date();
	const entries: PreviewEntry[] = [];
	const previews: OperationStepPreview[] = [];
	const previewScope = (transaction: DatabaseTransaction): BatchStepScope => ({
		actor,
		transaction,
		now,
		batchId,
		dryRun: true,
		revisionCollector: new GiftRevisionCollector({
			batchId,
			actorUserId: actor.userId,
			channel: actor.channel,
		}),
		noteReservedGiftEdits: () => {},
		deferEffect: () => {},
	});
	/** Each step's preview, or null when a step was rejected and the savepoint rolled back. */
	const previewTogether = (transaction: DatabaseTransaction, group: readonly IndexedStep[]) => {
		const scope = previewScope(transaction);
		return runStepGroupInSavepoint(group, scope, async (savepoint, results) => {
			const revisions = await scope.revisionCollector.flush(savepoint);
			// Each step of a group changes only its own gift, so the gift id assigns its revisions.
			const stepRevisions = group.map(({ step }) =>
				revisions.filter((revision) => revision.giftId === step.isolatedGiftId),
			);
			if (stepRevisions.flat().length !== revisions.length) {
				throw new StepGroupRollback();
			}
			return group.map(
				(_, index): OperationStepPreview => ({
					accepted: true,
					result: results[index],
					revisions: stepRevisions[index],
				}),
			);
		});
	};
	const previewAlone = async (
		transaction: DatabaseTransaction,
		indexedStep: IndexedStep,
	): Promise<OperationStepPreview> => {
		try {
			return await transaction.transaction(async (savepoint) => {
				const scope = previewScope(savepoint);
				const outcome = await runStepGroup([indexedStep], scope);
				if (outcome.failed) {
					throw outcome.thrown;
				}
				const revisions = await scope.revisionCollector.flush(savepoint);
				return { accepted: true, result: outcome.results[0], revisions } as const;
			});
		} catch (thrown) {
			return { accepted: false, rejection: requireStepRejection(thrown) };
		}
	};
	try {
		for (const step of steps) {
			try {
				const boundStep = bindMutationStep(step.operation, step.input);
				entries.push({ prepared: await boundStep.prepare(actor, true) });
			} catch (thrown) {
				entries.push({ rejection: requireStepRejection(thrown) });
			}
		}
		const preparedSteps = entries.flatMap((entry, stepIndex) =>
			'prepared' in entry ? [{ stepIndex, step: entry.prepared }] : [],
		);
		entries.forEach((entry, stepIndex) => {
			if ('rejection' in entry) {
				previews[stepIndex] = { accepted: false, rejection: entry.rejection };
			}
		});
		await getDb().transaction(async (transaction) => {
			await lockWishlistsInIdOrder(transaction, options.exclusiveWishlistIds ?? []);
			await options.verifyLocked?.(transaction);
			for (const group of concurrentStepGroups(preparedSteps)) {
				const together =
					group.length > 1 ? await previewTogether(transaction, group) : null;
				for (const [index, indexedStep] of group.entries()) {
					previews[indexedStep.stepIndex] =
						together?.[index] ?? (await previewAlone(transaction, indexedStep));
				}
			}
			throw new PreviewRollback();
		});
	} catch (thrown) {
		if (!(thrown instanceof PreviewRollback)) {
			throw thrown;
		}
	} finally {
		for (const entry of entries) {
			if ('prepared' in entry) {
				await settleBestEffort('preview preparation cleanup', () =>
					entry.prepared.onAbandoned(),
				);
			}
		}
	}
	return previews;
}

export async function executeOperation<TSchema extends OperationInputSchema, TOutput>(
	actor: OperationActor | null,
	operation: ReadOperation<string, TSchema, TOutput>,
	rawInput: unknown,
): Promise<TOutput>;
export async function executeOperation<TSchema extends OperationInputSchema, TOutput>(
	actor: OperationActor,
	operation:
		| MutationOperation<string, TSchema, TOutput>
		| PreparedMutationOperation<string, TSchema, TOutput, unknown>,
	rawInput: unknown,
	options: OperationOptions & { dryRun: true },
): Promise<OperationDryRunResult<TOutput>>;
export async function executeOperation<TSchema extends OperationInputSchema, TOutput>(
	actor: OperationActor,
	operation:
		| MutationOperation<string, TSchema, TOutput>
		| PreparedMutationOperation<string, TSchema, TOutput, unknown>,
	rawInput: unknown,
	options?: OperationOptions & { dryRun?: false },
): Promise<TOutput>;
export async function executeOperation<TSchema extends OperationInputSchema, TOutput>(
	actor: OperationActor | null,
	operation:
		| ReadOperation<string, TSchema, TOutput>
		| MutationOperation<string, TSchema, TOutput>
		| PreparedMutationOperation<string, TSchema, TOutput, unknown>,
	rawInput: unknown,
	options: OperationOptions = {},
): Promise<TOutput | OperationDryRunResult<TOutput>> {
	if (operation.kind === OPERATION_KIND.read) {
		// Reads run outside a transaction to keep their statement budget.
		return operation.run({ actor }, parseOperationInput(operation.input, rawInput));
	}
	const mutationActor = requireOperationActor(actor);
	let output: { value: TOutput } | undefined;
	const step = bindMutationStep(operation, rawInput, (value) => {
		output = { value };
	});
	const batch = await runBoundSteps(mutationActor, [step], {
		dryRun: options.dryRun === true,
		exclusiveWishlistIds: [],
	});
	if (output === undefined) {
		throw new Error(`Operation ${operation.name} produced no result`);
	}
	return options.dryRun === true
		? { result: output.value, revisions: batch.revisions }
		: output.value;
}
