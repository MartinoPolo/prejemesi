import { observeResize } from './shared_resize_observer.js';

export function restingShadowNesting(node: HTMLElement, borderSurface: HTMLElement = node) {
	let observedSurface = borderSurface;
	const previousInline = node.style.getPropertyValue('--nested-border-inline');
	const previousBlock = node.style.getPropertyValue('--nested-border-block');

	function measureBorder() {
		const style = getComputedStyle(observedSurface);
		const values = {
			'--nested-border-inline': style.borderRightWidth,
			'--nested-border-block': style.borderBottomWidth,
		};
		return () => {
			for (const [property, value] of Object.entries(values)) {
				if (node.style.getPropertyValue(property) !== value) {
					node.style.setProperty(property, value);
				}
			}
		};
	}

	// Under border-box sizing a border change resizes the content box, so the resize observer also
	// catches breakpoint border changes without a window resize listener per surface. Its initial
	// delivery measures after layout and before paint; reading the computed style while a list is
	// still being inserted would force a style recalculation per surface.
	let unobserve = observeResize(observedSurface, measureBorder);

	return {
		update(nextSurface: HTMLElement = node) {
			unobserve();
			observedSurface = nextSurface;
			unobserve = observeResize(observedSurface, measureBorder);
		},
		destroy() {
			unobserve();
			for (const [property, value] of [
				['--nested-border-inline', previousInline],
				['--nested-border-block', previousBlock],
			]) {
				if (value !== '') {
					node.style.setProperty(property, value);
				} else {
					node.style.removeProperty(property);
				}
			}
		},
	};
}
