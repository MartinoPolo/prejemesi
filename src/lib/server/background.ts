import { getRequestEvent } from '$app/server';

/**
 * Schedules non-critical work (email delivery, external cleanup) to run after
 * the response has been sent, keeping it off the user's response path
 * (issue #108, REQ-6).
 *
 * On Cloudflare Workers the task is handed to `ctx.waitUntil`, which keeps the
 * isolate (and its request-scoped I/O objects, e.g. the Hyperdrive socket)
 * alive until the promise settles. Outside Workers (dev, tests) the promise is
 * simply detached.
 *
 * Failures are logged and swallowed: background work must never roll back or
 * fail the already-committed mutation that scheduled it.
 */
export function runAfterResponse(task: () => Promise<void>): void {
	let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
	try {
		const { platform } = getRequestEvent();
		waitUntil = platform?.ctx?.waitUntil.bind(platform.ctx);
	} catch {
		// Outside a request context (scripts, tests) – fall through to detached mode.
	}

	const promise = task().catch((error) => {
		console.error('[background] deferred task failed', error);
	});

	waitUntil?.(promise);
}
