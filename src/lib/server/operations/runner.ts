import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
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

export interface OperationBatchStep {
	operation: AnyMutationOperation;
	input: unknown;
}

export interface OperationOptions {
	/** Runs the same code, rolls the transaction back and reports the revisions it would write. */
	dryRun?: boolean;
}

export interface OperationBatchResult {
	batchId: string;
	results: unknown[];
	revisions: GiftRevisionRecord[];
}

export interface OperationDryRunResult<TOutput> {
	result: TOutput;
	revisions: GiftRevisionRecord[];
}

interface PreparedStep {
	operationName: string;
	run(context: MutationOperationContext): Promise<unknown>;
	onCommitted(): Promise<void>;
	onAbandoned(): Promise<void>;
}

interface BoundStep {
	prepare(actor: OperationActor, dryRun: boolean): Promise<PreparedStep>;
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

function parseOperationInput<TSchema extends OperationInputSchema>(
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
	const toPreparedStep = (
		execute: (context: MutationOperationContext) => Promise<TOutput>,
		cleanup: Pick<PreparedStep, 'onCommitted' | 'onAbandoned'>,
	): PreparedStep => ({
		operationName: operation.name,
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

async function settleBestEffort(label: string, work: () => Promise<void>): Promise<void> {
	try {
		await work();
	} catch (thrown) {
		console.error(`[Operations] ${label} failed`, thrown);
	}
}

async function runBoundSteps(
	actor: OperationActor,
	steps: readonly BoundStep[],
	dryRun: boolean,
): Promise<OperationBatchResult> {
	if (steps.length === 0 || steps.length > MAX_OPERATION_BATCH_STEPS) {
		error(400, SERVER_ERROR.INVALID_OPERATION_INPUT);
	}
	const batchId = generateId();
	const now = new Date();
	const preparedSteps: PreparedStep[] = [];
	const deferredEffects: Array<() => Promise<void>> = [];
	let outcome: TransactionOutcome;
	let committed = false;
	try {
		for (const step of steps) {
			preparedSteps.push(await step.prepare(actor, dryRun));
		}
		try {
			outcome = await getDb().transaction(async (transaction) => {
				const revisionCollector = new GiftRevisionCollector({
					batchId,
					actorUserId: actor.userId,
					channel: actor.channel,
				});
				const reservedGiftEdits: ReservedGiftEdit[] = [];
				const results: unknown[] = [];
				for (const preparedStep of preparedSteps) {
					results.push(
						await preparedStep.run({
							actor,
							transaction,
							now,
							batchId,
							dryRun,
							recordGiftRevisions: (changes) =>
								revisionCollector.record(preparedStep.operationName, changes),
							noteReservedGiftEdits: (edits) => reservedGiftEdits.push(...edits),
							deferEffect: (effect) => deferredEffects.push(effect),
						}),
					);
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
	for (const effect of deferredEffects) {
		await settleBestEffort('deferred effect', effect);
	}
	await dispatchReservedGiftEditNotifications(outcome.notifications);
	scheduleGiftRevisionPurge();
	return { batchId, results: outcome.results, revisions: outcome.revisions };
}

/** Runs several mutations atomically under one batch id and one transaction. */
export async function executeOperationBatch(
	actor: OperationActor,
	steps: readonly OperationBatchStep[],
	options: OperationOptions = {},
): Promise<OperationBatchResult> {
	return runBoundSteps(
		actor,
		steps.map((step) => bindMutationStep(step.operation, step.input)),
		options.dryRun === true,
	);
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
	const batch = await runBoundSteps(mutationActor, [step], options.dryRun === true);
	if (output === undefined) {
		throw new Error(`Operation ${operation.name} produced no result`);
	}
	return options.dryRun === true
		? { result: output.value, revisions: batch.revisions }
		: output.value;
}
