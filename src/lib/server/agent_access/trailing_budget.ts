import { sql } from 'drizzle-orm';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import type { ServerErrorCode } from '$lib/modules/errors/server_error_codes.js';
import { AgentApiFailure } from './api.js';
import type { LookupDatabase } from './policy_lookups.js';

/** One past spend of a budget inside its window. */
export interface BudgetSpend {
	createdAt: Date;
	amount: number;
}

/** A per-user allowance over a trailing window, counted across all of the user's tokens. */
export interface TrailingBudget {
	/** Names the advisory lock serializing one user's spending of this budget. */
	lockName: string;
	limit: number;
	windowMs: number;
	exceededCode: ServerErrorCode;
	/** The 429 detail field reporting `limit`. */
	limitDetail: string;
	/** The user's spends created after `windowStart`, oldest first. */
	recentSpends: (
		database: LookupDatabase,
		userId: string,
		windowStart: Date,
	) => Promise<readonly BudgetSpend[]>;
}

/** Seconds until enough spends leave the window for `requested` more, or null while they fit. */
async function secondsUntilBudgetFits(
	database: LookupDatabase,
	budget: TrailingBudget,
	userId: string,
	requested: number,
	now: Date,
): Promise<number | null> {
	const spends = await budget.recentSpends(
		database,
		userId,
		new Date(now.getTime() - budget.windowMs),
	);
	let spent = spends.reduce((sum, spend) => sum + spend.amount, 0);
	if (spent + requested <= budget.limit) {
		return null;
	}
	for (const spend of spends) {
		spent -= spend.amount;
		if (spent + requested <= budget.limit) {
			const leavesWindowAt = spend.createdAt.getTime() + budget.windowMs;
			return Math.max(1, Math.ceil((leavesWindowAt - now.getTime()) / 1000));
		}
	}
	return Math.ceil(budget.windowMs / 1000);
}

/** Throws 429 with `Retry-After` unless `requested` more fit the user's budget. */
export async function assertWithinTrailingBudget(
	database: LookupDatabase,
	budget: TrailingBudget,
	userId: string,
	requested: number,
	now: Date,
): Promise<void> {
	const retryAfterSeconds = await secondsUntilBudgetFits(
		database,
		budget,
		userId,
		requested,
		now,
	);
	if (retryAfterSeconds !== null) {
		throw new AgentApiFailure(
			429,
			budget.exceededCode,
			{
				retryAfterSeconds,
				[budget.limitDetail]: budget.limit,
				windowSeconds: budget.windowMs / 1000,
			},
			{ 'retry-after': String(retryAfterSeconds) },
		);
	}
}

/** Serializes one user's spending so concurrent requests cannot both pass the budget check. */
export async function lockTrailingBudget(
	transaction: DatabaseTransaction,
	budget: TrailingBudget,
	userId: string,
): Promise<void> {
	await transaction.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`${budget.lockName}:${userId}`}, 0))`,
	);
}
