import type { getDb } from '$lib/server/db/index.js';

type GiftDbTransaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
type AfterRowsLockedHook = (tx: GiftDbTransaction) => Promise<void>;

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
	tx: GiftDbTransaction,
): Promise<void> {
	if (import.meta.env.MODE === 'test') {
		await afterRowsLockedHook?.(tx);
	}
}
