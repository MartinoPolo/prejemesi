import type * as v from 'valibot';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import type { OperationActor } from './actor.js';
import type { GiftRevisionChange } from './gift_revisions.js';
import type { ReservedGiftEdit } from './reserved_gift_edit_notifications.js';

export const OPERATION_KIND = {
	read: 'read',
	mutation: 'mutation',
} as const;

export type OperationInputSchema = v.GenericSchema;

export interface ReadOperationContext {
	/** Null for an anonymous visitor reading a shared wishlist. */
	readonly actor: OperationActor | null;
}

export interface MutationOperationContext {
	readonly actor: OperationActor;
	readonly transaction: DatabaseTransaction;
	/** One timestamp for the whole batch. */
	readonly now: Date;
	readonly batchId: string;
	readonly dryRun: boolean;
	recordGiftRevisions(changes: readonly GiftRevisionChange[]): void;
	/** Coalesced into at most one notification per reserver after the batch commits. */
	noteReservedGiftEdits(edits: readonly ReservedGiftEdit[]): void;
	/** Runs only after the batch commits; never on dry run or failure. */
	deferEffect(effect: () => Promise<void>): void;
}

/** Work done before the batch transaction (e.g. object staging), with handlers for both outcomes. */
export interface PreparedOperationResources<TPrepared> {
	readonly value: TPrepared;
	onCommitted(): Promise<void>;
	/** Runs when the batch fails or is a dry run. */
	onAbandoned(): Promise<void>;
}

export interface ReadOperation<
	TName extends string,
	TSchema extends OperationInputSchema,
	TOutput,
> {
	readonly name: TName;
	readonly kind: typeof OPERATION_KIND.read;
	readonly input: TSchema;
	run(context: ReadOperationContext, input: v.InferOutput<TSchema>): Promise<TOutput>;
}

export interface MutationOperation<
	TName extends string,
	TSchema extends OperationInputSchema,
	TOutput,
> {
	readonly name: TName;
	readonly kind: typeof OPERATION_KIND.mutation;
	readonly input: TSchema;
	readonly prepare?: undefined;
	run(context: MutationOperationContext, input: v.InferOutput<TSchema>): Promise<TOutput>;
}

/** A mutation that must do non-transactional work before its transaction opens. */
export interface PreparedMutationOperation<
	TName extends string,
	TSchema extends OperationInputSchema,
	TOutput,
	TPrepared,
> {
	readonly name: TName;
	readonly kind: typeof OPERATION_KIND.mutation;
	readonly input: TSchema;
	prepare(
		actor: OperationActor,
		input: v.InferOutput<TSchema>,
		options: { dryRun: boolean },
	): Promise<PreparedOperationResources<TPrepared>>;
	run(
		context: MutationOperationContext,
		input: v.InferOutput<TSchema>,
		prepared: TPrepared,
	): Promise<TOutput>;
}

export type AnyReadOperation = ReadOperation<string, OperationInputSchema, unknown>;
export type AnyMutationOperation =
	| MutationOperation<string, OperationInputSchema, unknown>
	| PreparedMutationOperation<string, OperationInputSchema, unknown, unknown>;
export type AnyOperation = AnyReadOperation | AnyMutationOperation;

export function defineOperation<
	TName extends string,
	TSchema extends OperationInputSchema,
	TOutput,
>(definition: ReadOperation<TName, TSchema, TOutput>): ReadOperation<TName, TSchema, TOutput>;
export function defineOperation<
	TName extends string,
	TSchema extends OperationInputSchema,
	TOutput,
>(
	definition: MutationOperation<TName, TSchema, TOutput>,
): MutationOperation<TName, TSchema, TOutput>;
export function defineOperation<
	TName extends string,
	TSchema extends OperationInputSchema,
	TOutput,
	TPrepared,
>(
	definition: PreparedMutationOperation<TName, TSchema, TOutput, TPrepared>,
): PreparedMutationOperation<TName, TSchema, TOutput, TPrepared>;
export function defineOperation(definition: AnyOperation): AnyOperation {
	return definition;
}
