import type { Action } from 'svelte/action';

/**
 * Calls back on any wheel gesture over the node and swallows the scroll.
 * Used by the image editors' plain (Fill / Whole picture) previews: a zoom
 * attempt is a manual-crop intent, so it promotes the editor to Manual mode
 * (#116 follow-up). A Svelte action because inline `onwheel` handlers are
 * passive and could not `preventDefault()` the page scroll.
 */
export const promoteOnWheel: Action<HTMLElement, () => void> = (node, onPromote) => {
	let promote = onPromote;
	const handleWheel = (event: WheelEvent) => {
		event.preventDefault();
		promote();
	};
	node.addEventListener('wheel', handleWheel, { passive: false });
	return {
		update(next: () => void) {
			promote = next;
		},
		destroy() {
			node.removeEventListener('wheel', handleWheel);
		},
	};
};
