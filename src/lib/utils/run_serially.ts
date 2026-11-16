/**
 * Starts `task` only after every earlier task for the same key settles, so requests reach the
 * server in call order. A rejected task does not stop later ones, and the key leaves `queueTails`
 * once its last task settles.
 */
export function runSerially<Key, Result>(
	queueTails: Map<Key, Promise<void>>,
	key: Key,
	task: () => Promise<Result>,
): Promise<Result> {
	const previousTail = queueTails.get(key) ?? Promise.resolve();
	const result = previousTail.then(task);
	const tail = result.then(
		() => {},
		() => {},
	);
	queueTails.set(key, tail);
	void tail.then(() => {
		if (queueTails.get(key) === tail) {
			queueTails.delete(key);
		}
	});
	return result;
}
