export const SENTRY_IDLE_TIMEOUT_MILLISECONDS = 2_000;

interface IdleWindow {
	document: { readyState: string };
	addEventListener(type: 'load', listener: () => void, options?: { once: boolean }): void;
	requestAnimationFrame?: (callback: () => void) => number;
	requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
	setTimeout?: (callback: () => void, delay: number) => number;
}

export function createSingletonSafeLoader<T>(
	load: () => Promise<T>,
	onFailure: (error: unknown) => void = () => {},
): () => Promise<T | undefined> {
	let loading: Promise<T | undefined> | undefined;
	return () =>
		(loading ??= load().catch((error: unknown) => {
			onFailure(error);
			return undefined;
		}));
}

interface ErrorEventTarget {
	addEventListener(type: string, listener: (event: unknown) => void): void;
	removeEventListener(type: string, listener: (event: unknown) => void): void;
}

export function installEarlyErrorBuffer(target: ErrorEventTarget, limit = 20) {
	const errors: unknown[] = [];
	const remember = (error: unknown) => {
		if (errors.length < limit) {
			errors.push(error);
		}
	};
	const onError = (event: unknown) => {
		remember((event as { error?: unknown }).error ?? event);
	};
	const onUnhandledRejection = (event: unknown) => {
		remember((event as { reason?: unknown }).reason ?? event);
	};

	target.addEventListener('error', onError);
	target.addEventListener('unhandledrejection', onUnhandledRejection);

	const detach = () => {
		target.removeEventListener('error', onError);
		target.removeEventListener('unhandledrejection', onUnhandledRejection);
	};
	return {
		flush(capture: (error: unknown) => void): void {
			detach();
			for (const error of errors.splice(0)) {
				capture(error);
			}
		},
		discard(): void {
			detach();
			errors.length = 0;
		},
	};
}

export function scheduleAfterLoadAndIdle(
	target: IdleWindow,
	run: () => void,
	delayMilliseconds = 3_000,
	idleTimeoutMilliseconds = SENTRY_IDLE_TIMEOUT_MILLISECONDS,
): void {
	const scheduleIdle = () => {
		if (target.requestIdleCallback !== undefined) {
			target.requestIdleCallback(run, { timeout: idleTimeoutMilliseconds });
		} else {
			run();
		}
	};
	const scheduleDelay = () => {
		(target.setTimeout ?? globalThis.setTimeout)(scheduleIdle, delayMilliseconds);
	};
	const scheduleAfterRenderedFrame = () => {
		if (target.requestAnimationFrame === undefined) {
			scheduleDelay();
			return;
		}
		target.requestAnimationFrame(() => {
			target.requestAnimationFrame?.(scheduleDelay);
		});
	};

	if (target.document.readyState === 'complete') {
		scheduleAfterRenderedFrame();
	} else {
		target.addEventListener('load', scheduleAfterRenderedFrame, { once: true });
	}
}
