/** Runs `callback` when the browser is idle, at the latest after `timeoutMilliseconds`; returns a canceller. */
export function scheduleIdle(callback: () => void, timeoutMilliseconds: number): () => void {
	if (typeof window.requestIdleCallback === 'function') {
		const idleHandle = window.requestIdleCallback(callback, { timeout: timeoutMilliseconds });
		return () => window.cancelIdleCallback(idleHandle);
	}
	// Safari has no requestIdleCallback — fall back to a bounded timer.
	const timeoutHandle = setTimeout(callback, timeoutMilliseconds);
	return () => clearTimeout(timeoutHandle);
}
