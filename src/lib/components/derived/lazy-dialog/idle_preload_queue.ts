/** Safari has no requestIdleCallback, so it waits a bounded time instead. */
const IDLE_FALLBACK_DELAY_MILLISECONDS = 3_000;

interface IdlePreloadable {
	readonly component: unknown;
	load(): Promise<unknown>;
}

type RequestIdle = (run: () => void) => void;

/**
 * Preloads queued chunks one per idle period, each after the previous one settles, so a page
 * with several likely dialogs never fetches them all at once.
 */
export function createIdlePreloadQueue(requestIdle: RequestIdle) {
	const pendingLoaders: IdlePreloadable[] = [];
	let preloading = false;

	function preloadNextWhenIdle(): void {
		if (preloading || pendingLoaders.length === 0) {
			return;
		}
		preloading = true;
		requestIdle(() => {
			const nextLoader = pendingLoaders.shift();
			const settled = nextLoader === undefined ? Promise.resolve() : nextLoader.load();
			void settled
				.catch(() => undefined)
				.then(() => {
					preloading = false;
					preloadNextWhenIdle();
				});
		});
	}

	return {
		/** Returns a function that drops the loader if its idle period has not come yet. */
		add(loader: IdlePreloadable): () => void {
			if (loader.component === undefined && !pendingLoaders.includes(loader)) {
				pendingLoaders.push(loader);
				preloadNextWhenIdle();
			}
			return () => {
				const index = pendingLoaders.indexOf(loader);
				if (index !== -1) {
					pendingLoaders.splice(index, 1);
				}
			};
		},
	};
}

function requestBrowserIdle(run: () => void): void {
	if (typeof window.requestIdleCallback === 'function') {
		window.requestIdleCallback(run);
		return;
	}
	setTimeout(run, IDLE_FALLBACK_DELAY_MILLISECONDS);
}

export const idlePreloadQueue = createIdlePreloadQueue(requestBrowserIdle);
