import { flushSync } from 'svelte';

export type GalleryStep = -1 | 1;

interface GalleryArrows {
	previous: HTMLElement | null;
	next: HTMLElement | null;
}

/**
 * Browses one image by an arrow button or arrow key. Arrows render only where they lead somewhere,
 * so when the focused arrow pointing the browsing way disappears at the first or last image,
 * keyboard focus moves to the opposite arrow instead of falling back to the page.
 */
export function browseKeepingArrowFocus(
	step: GalleryStep,
	arrows: () => GalleryArrows,
	browse: () => void,
): void {
	const leadingArrow = step === 1 ? arrows().next : arrows().previous;
	const arrowWasFocused = leadingArrow !== null && leadingArrow === document.activeElement;
	browse();
	if (!arrowWasFocused) {
		return;
	}
	flushSync();
	if (!leadingArrow.isConnected) {
		const { previous, next } = arrows();
		(step === 1 ? previous : next)?.focus();
	}
}
