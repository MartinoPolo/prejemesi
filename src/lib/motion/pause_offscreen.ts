import type { Attachment } from 'svelte/attachments';

const OFFSCREEN_ATTRIBUTE = 'data-offscreen';

let sharedObserver: IntersectionObserver | undefined;
let observedCount = 0;

function observer(): IntersectionObserver {
	sharedObserver ??= new IntersectionObserver((entries) => {
		for (const entry of entries) {
			entry.target.toggleAttribute(OFFSCREEN_ATTRIBUTE, !entry.isIntersecting);
		}
	});
	return sharedObserver;
}

/**
 * Marks the element `data-offscreen` while it is scrolled out of view or hidden, so its styles
 * can pause looping animations. A running animation keeps the compositor producing frames and
 * is restyled on every main-thread frame even when nobody can see it, for example a lazy image's
 * loading placeholder that waits below the fold until the visitor scrolls to it.
 */
export const pauseWhenOffscreen: Attachment<Element> = (element) => {
	if (typeof IntersectionObserver === 'undefined') {
		return;
	}
	observer().observe(element);
	observedCount += 1;
	return () => {
		element.removeAttribute(OFFSCREEN_ATTRIBUTE);
		sharedObserver?.unobserve(element);
		observedCount -= 1;
		if (observedCount === 0) {
			sharedObserver?.disconnect();
			sharedObserver = undefined;
		}
	};
};
