export function createLatestAsyncQueue<T>(
	worker: (value: T) => Promise<void>,
	onError: (error: unknown) => Promise<void>,
) {
	let pending: T | null = null;
	let running = false;

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
					await onError(error);
					return;
				}
			}
		} finally {
			running = false;
			if (pending !== null) {
				void drain();
			}
		}
	}

	return {
		enqueue(value: T) {
			pending = value;
			if (!running) {
				void drain();
			}
		},
	};
}
