import { DEFAULT_PIXEL_TOLERANCE } from './pixel-assertions.mjs';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** @param {Element} group */
export function selectionIndicatorOf(group) {
	const indicator = group.querySelector(':scope > [data-slot="selection-indicator"]');
	if (!(indicator instanceof HTMLElement)) {
		throw new TypeError('Expected the group to render a selection indicator');
	}
	return indicator;
}

/** @param {Element} indicator */
export function isSlideRunning(indicator) {
	return indicator.getAnimations().some((animation) => animation.playState === 'running');
}

/**
 * Records indicator transitions from now on, so a test proves a slide ran rather than sampling it
 * after the fact. Register before triggering the selection change.
 * @param {Element} indicator
 */
export function recordSlides(indicator) {
	/** @type {Set<string>} */
	const transitionedProperties = new Set();
	/** @param {Event} event */
	const recordTransition = (event) => {
		if (event instanceof TransitionEvent && event.target === indicator) {
			transitionedProperties.add(event.propertyName);
		}
	};
	indicator.addEventListener('transitionrun', recordTransition);
	return {
		hasSlid: () => transitionedProperties.has('translate'),
		stop: () => indicator.removeEventListener('transitionrun', recordTransition),
	};
}

/**
 * Whether the group's placed, visible indicator covers `element`.
 * @param {Element} group
 * @param {Element} element
 */
export function isIndicatorOver(group, element) {
	const indicator = selectionIndicatorOf(group);
	const indicatorBounds = indicator.getBoundingClientRect();
	const elementBounds = element.getBoundingClientRect();
	const near = (/** @type {number} */ actual, /** @type {number} */ expected) =>
		Math.abs(actual - expected) <= DEFAULT_PIXEL_TOLERANCE;
	return (
		group.hasAttribute('data-selection-placed') &&
		getComputedStyle(indicator).visibility === 'visible' &&
		near(indicatorBounds.x, elementBounds.x) &&
		near(indicatorBounds.y, elementBounds.y) &&
		near(indicatorBounds.width, elementBounds.width) &&
		near(indicatorBounds.height, elementBounds.height)
	);
}

/**
 * Whether the visible selected face is drawn by the group's indicator exactly over `face`.
 * @param {Element} group
 * @param {Element} face
 */
export function isIndicatorOnFace(group, face) {
	return face.hasAttribute('data-selection-face') && isIndicatorOver(group, face);
}

/**
 * Resolves a CSS value, such as a design token reference, to its computed form in `context`.
 * @param {Element} context
 * @param {string} property
 * @param {string} value
 */
export function resolveCssValue(context, property, value) {
	const probe = document.createElement('span');
	probe.style.setProperty('position', 'absolute');
	probe.style.setProperty(property, value);
	context.append(probe);
	try {
		return getComputedStyle(probe).getPropertyValue(property);
	} finally {
		probe.remove();
	}
}

/**
 * Whether the face paints none of its own selected decoration, leaving it to the indicator.
 * @param {Element} face
 */
export function isFacePaintHidden(face) {
	const style = getComputedStyle(face);
	const outlineHidden =
		style.outlineStyle === 'none' ||
		parseFloat(style.outlineWidth) === 0 ||
		style.outlineColor === TRANSPARENT;
	return (
		style.backgroundColor === TRANSPARENT &&
		style.borderTopColor === TRANSPARENT &&
		style.boxShadow === 'none' &&
		outlineHidden
	);
}

/** Resolves after the browser has rendered `count` frames. */
export async function nextFrames(count = 2) {
	for (let frame = 0; frame < count; frame += 1) {
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}
}
