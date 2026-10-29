import type { DatabaseTransaction } from '$lib/server/db/index.js';

type AfterRowsLockedHook = (transaction: DatabaseTransaction) => Promise<void>;

let afterRowsLockedHook: AfterRowsLockedHook | undefined;

export function setBulkUpdateAfterRowsLockedHookForTest(
	hook: AfterRowsLockedHook | undefined,
): void {
	if (import.meta.env.MODE !== 'test') {
		throw new Error('Bulk update test hooks are only available in tests');
	}
	afterRowsLockedHook = hook;
}

export async function runBulkUpdateAfterRowsLockedHookForTest(
	transaction: DatabaseTransaction,
): Promise<void> {
	if (import.meta.env.MODE === 'test') {
		await afterRowsLockedHook?.(transaction);
	}
}
