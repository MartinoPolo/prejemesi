import { navigating, page } from '$app/state';
import type { NavigationTarget, NavigationType, Snapshot } from '@sveltejs/kit';
import { untrack } from 'svelte';
import { deLocalizeUrl } from '$lib/paraglide/runtime.js';
import { GIFT_COLLECTION_MOUNTING_ATTRIBUTE } from '$lib/components/blocks/wishlist/gift_card_collection_layout.js';

/** Content still loading may change height above the restored offset, so the restore waits. */
const LOADING_CONTENT_SELECTOR = '[aria-busy="true"]:not(button)';
/** Content still mounting appends below what is shown, so a reachable offset is already final. */
const GROWING_CONTENT_SELECTOR = `[${GIFT_COLLECTION_MOUNTING_ATTRIBUTE}]`;
const RESTORE_TIMEOUT_MS = 5_000;
const USER_SCROLL_INTENT_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/** An in-progress navigation, with null fields when none is running. */
interface ContentNavigation {
	type: NavigationType | null;
	from: NavigationTarget | null;
	to: NavigationTarget | null;
}

interface ContentScrollState {
	targetTop: number;
	maximumTop: number;
	contentLoading: boolean;
	contentGrowing: boolean;
	timedOut: boolean;
}

/** The offset to restore now, or null while the content may still reach the saved one. */
export function contentScrollRestoreTop(state: ContentScrollState): number | null {
	if (state.timedOut) {
		return Math.min(state.targetTop, state.maximumTop);
	}
	if (state.contentLoading) {
		return null;
	}
	if (state.maximumTop >= state.targetTop) {
		return state.targetTop;
	}
	return state.contentGrowing ? null : state.maximumTop;
}

function samePage(from: URL, to: URL): boolean {
	const fromPage = deLocalizeUrl(from);
	const toPage = deLocalizeUrl(to);
	return fromPage.pathname === toPage.pathname && fromPage.search === toPage.search;
}

/**
 * Whether a navigation starts the content at the top, as SvelteKit does for the window: new
 * pages do, while the first load, a locale switch on the same page and a link SvelteKit already
 * scrolled to its fragment target keep their position. Back and forward start at the top too,
 * and the history entry's snapshot then restores its saved offset. `navigating` does not expose
 * `goto`'s `noScroll`, so a no-scroll navigation to another page still starts at the top.
 */
export function navigationStartsContentAtTop(
	navigation: ContentNavigation,
	hasFragmentTarget: (url: URL) => boolean,
): boolean {
	const { type, from, to } = navigation;
	if (type === null || type === 'enter' || from === null || to === null) {
		return false;
	}
	if (type === 'popstate') {
		return true;
	}
	return !samePage(from.url, to.url) && !hasFragmentTarget(to.url);
}

function hasFragmentTarget(url: URL): boolean {
	if (url.hash.length <= 1) {
		return false;
	}
	try {
		return document.getElementById(decodeURIComponent(url.hash.slice(1))) !== null;
	} catch {
		return false;
	}
}

/**
 * Scrolls `scroller` to `targetTop` once its content can reach that offset, and returns a
 * function that cancels the pending restore. Any scroll intent from the user cancels it too.
 */
export function startContentScrollRestore(scroller: HTMLElement, targetTop: number): () => void {
	const startedAt = performance.now();
	const userIntent = new AbortController();
	let frame = 0;
	const stop = () => {
		cancelAnimationFrame(frame);
		userIntent.abort();
	};
	const attempt = (afterFrame: boolean) => {
		const top = contentScrollRestoreTop({
			targetTop,
			maximumTop: scroller.scrollHeight - scroller.clientHeight,
			contentLoading: scroller.querySelector(LOADING_CONTENT_SELECTOR) !== null,
			contentGrowing: scroller.querySelector(GROWING_CONTENT_SELECTOR) !== null,
			timedOut: performance.now() - startedAt > RESTORE_TIMEOUT_MS,
		});
		// Content rendered after the commit may not have marked itself loading yet, so a
		// clamped offset is accepted only once a frame has passed.
		if (top === null || (top < targetTop && !afterFrame)) {
			frame = requestAnimationFrame(() => attempt(true));
			return;
		}
		stop();
		scroller.scrollTo({ top, behavior: 'instant' });
	};
	for (const type of USER_SCROLL_INTENT_EVENTS) {
		scroller.addEventListener(type, stop, { passive: true, signal: userIntent.signal });
	}
	attempt(false);
	return stop;
}

/**
 * Scroll restoration for the app's content scroller, which SvelteKit's window-only restoration
 * misses. The offset rides on the history entry as a layout snapshot. The reset to the top runs
 * as the new page commits, not in `afterNavigate`, which waits for async work to settle and so
 * would let the new page paint at the previous page's offset. Gifts render on the client after
 * the page and mount in batches on narrow screens, so a restore waits until the content can
 * reach the saved offset instead of settling at a clamped one. Call during component
 * initialisation.
 */
export function createContentScrollRestoration(
	getScroller: () => HTMLElement | null,
): Snapshot<number> {
	let cancelPendingRestore = () => {};

	// Separate from the reset effect, which also reruns on shallow URL replacements that must not
	// cancel a pending restore.
	$effect(() => () => cancelPendingRestore());

	$effect(() => {
		// The committed URL is the only tracked dependency; everything else is read untracked.
		void page.url;
		const scroller = untrack(getScroller);
		if (scroller === null || untrack(() => navigating.type) === null) {
			return;
		}
		cancelPendingRestore();
		if (untrack(() => navigationStartsContentAtTop(navigating, hasFragmentTarget))) {
			scroller.scrollTo({ top: 0, behavior: 'instant' });
		}
	});

	function restore(targetTop: number) {
		cancelPendingRestore();
		const scroller = getScroller();
		// Another layout chain's snapshot value may land here, and a zero offset is already in place.
		if (scroller === null || !Number.isFinite(targetTop) || targetTop <= 0) {
			return;
		}
		cancelPendingRestore = startContentScrollRestore(scroller, targetTop);
	}

	return {
		capture: () => getScroller()?.scrollTop ?? 0,
		restore,
	};
}
