import { on } from 'svelte/events';

/**
 * Refreshes when the user comes back to the page: its tab shows again or its window regains
 * focus. Both usually fire together, so one refresh at a time runs. Returns the cleanup, for an
 * effect to return.
 */
export function refreshOnPageReturn(refresh: () => Promise<unknown>): () => void {
	let refreshing: Promise<unknown> | null = null;
	const onreturn = () => {
		// The refreshed query keeps its own error state, which the surface already shows.
		refreshing ??= refresh()
			.catch(() => undefined)
			.finally(() => {
				refreshing = null;
			});
	};
	const stopVisibility = on(document, 'visibilitychange', () => {
		if (document.visibilityState === 'visible') {
			onreturn();
		}
	});
	const stopFocus = on(window, 'focus', onreturn);
	return () => {
		stopVisibility();
		stopFocus();
	};
}
