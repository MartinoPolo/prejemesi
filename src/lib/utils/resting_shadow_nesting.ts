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
		for (const [property, value] of Object.entries(values)) {
			if (node.style.getPropertyValue(property) !== value) {
				node.style.setProperty(property, value);
			}
		}
	}

	const observer = new ResizeObserver(measureBorder);
	observer.observe(observedSurface);
	window.addEventListener('resize', measureBorder);
	measureBorder();

	return {
		update(nextSurface: HTMLElement = node) {
			observer.unobserve(observedSurface);
			observedSurface = nextSurface;
			observer.observe(observedSurface);
			measureBorder();
		},
		destroy() {
			observer.disconnect();
			window.removeEventListener('resize', measureBorder);
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
