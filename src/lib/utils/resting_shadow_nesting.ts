type MeasureBorder = () => void;

const measurersBySurface = new Map<Element, Set<MeasureBorder>>();
let sharedResizeObserver: ResizeObserver | null = null;

/** One observer serves every surface, so a collection resize is one callback rather than one per card. */
function observeSurface(surface: Element, measureBorder: MeasureBorder) {
	sharedResizeObserver ??= new ResizeObserver((entries) => {
		for (const entry of entries) {
			measurersBySurface.get(entry.target)?.forEach((measure) => measure());
		}
	});
	const measurers = measurersBySurface.get(surface);
	if (measurers === undefined) {
		measurersBySurface.set(surface, new Set([measureBorder]));
		sharedResizeObserver.observe(surface);
	} else {
		measurers.add(measureBorder);
	}
}

function unobserveSurface(surface: Element, measureBorder: MeasureBorder) {
	const measurers = measurersBySurface.get(surface);
	if (measurers === undefined) {
		return;
	}
	measurers.delete(measureBorder);
	if (measurers.size === 0) {
		measurersBySurface.delete(surface);
		sharedResizeObserver?.unobserve(surface);
	}
}

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

	// Under border-box sizing a border change resizes the content box, so the resize observer also
	// catches breakpoint border changes without a window resize listener per surface.
	observeSurface(observedSurface, measureBorder);
	measureBorder();

	return {
		update(nextSurface: HTMLElement = node) {
			unobserveSurface(observedSurface, measureBorder);
			observedSurface = nextSurface;
			observeSurface(observedSurface, measureBorder);
			measureBorder();
		},
		destroy() {
			unobserveSurface(observedSurface, measureBorder);
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
