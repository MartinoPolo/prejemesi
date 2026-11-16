/**
 * Runs `callback` in a task after the next frame is painted, so work that does not change what
 * the frame shows stays out of the task that renders it; returns a canceller.
 */
export function afterNextPaint(callback: () => void): () => void {
	let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
	const frameHandle = requestAnimationFrame(() => {
		timeoutHandle = setTimeout(callback, 0);
	});
	return () => {
		cancelAnimationFrame(frameHandle);
		clearTimeout(timeoutHandle);
	};
}
