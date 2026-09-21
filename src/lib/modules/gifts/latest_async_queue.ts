export function createLatestAsyncQueue<T>(
	worker: (value: T) => Promise<void>,
	onError: (error: unknown) => Promise<void>,
) {
	let pending: T | null = null;
	let running = false;
	let activeDrainSucceeded = true;
	let idleWaiters: Array<(succeeded: boolean) => void> = [];

	function settleIdleWaiters() {
		const waiters = idleWaiters;
		idleWaiters = [];
		const succeeded = activeDrainSucceeded;
		for (const resolve of waiters) {
			resolve(succeeded);
		}
	}

	async function drain() {
		running = true;
		try {
			while (pending !== null) {
				const value = pending;
				pending = null;
				try {
					await worker(value);
				} catch (error) {
					// Discard work queued before this failure. Values enqueued during recovery
					// remain pending and start only after recovery has settled.
					pending = null;
					activeDrainSucceeded = false;
					await onError(error);
					return;
				}
			}
		} finally {
			running = false;
			if (pending !== null) {
				void drain();
			} else {
				settleIdleWaiters();
			}
		}
	}

	return {
		enqueue(value: T) {
			pending = value;
			if (!running) {
				activeDrainSucceeded = true;
				void drain();
			}
		},
		whenIdle(): Promise<boolean> {
			if (!running && pending === null) {
				return Promise.resolve(activeDrainSucceeded);
			}
			return new Promise((resolve) => idleWaiters.push(resolve));
		},
	};
}
