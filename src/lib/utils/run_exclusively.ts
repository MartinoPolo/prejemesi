/**
 * Runs `task` unless one for the same key is still pending, so repeated clicks send one command.
 * The key stays in `pendingKeys` until the task settles; pass a `SvelteSet` to render the pending
 * state.
 */
export async function runExclusively<Key>(
	pendingKeys: Set<Key>,
	key: Key,
	task: () => Promise<unknown>,
): Promise<void> {
	if (pendingKeys.has(key)) {
		return;
	}
	pendingKeys.add(key);
	try {
		await task();
	} finally {
		pendingKeys.delete(key);
	}
}
