import type { Attachment } from 'svelte/attachments';

export const REVEAL_HELD_ATTRIBUTE = 'data-reveal-held';

/**
 * Holds an element's entrance animation (`.reveal`, a pop-in) while it starts below the viewport
 * and restarts it when the element scrolls into view, so visitors see it arrive instead of finding
 * it already settled. Without JavaScript, already in view, or under reduced motion, the CSS plays
 * or skips the entrance on load as before. The held element is transparent but stays laid out and
 * in the accessibility tree.
 */
export const revealOnView: Attachment<Element> = (element) => {
	if (
		typeof IntersectionObserver === 'undefined' ||
		window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
		element.getBoundingClientRect().top < window.innerHeight
	) {
		return;
	}
	element.setAttribute(REVEAL_HELD_ATTRIBUTE, '');
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				observer.disconnect();
				element.removeAttribute(REVEAL_HELD_ATTRIBUTE);
			}
		},
		{ threshold: 0.15 },
	);
	observer.observe(element);
	return () => {
		observer.disconnect();
		element.removeAttribute(REVEAL_HELD_ATTRIBUTE);
	};
};
