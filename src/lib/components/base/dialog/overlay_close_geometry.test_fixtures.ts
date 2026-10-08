import { expect } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { resolvedCssLength } from '$lib/components/blocks/gift/gift_action_geometry.test_fixtures.js';

const { expectPixelsAtMost } = createPixelAssertions(expect);

/**
 * Asserts that `element` reserves the overlay close button plus the nested control gap at its
 * inline end. This proves the reserved content box, not that its text fits inside it.
 */
export function expectContentClearsOverlayClose(element: HTMLElement, closeButton: HTMLElement) {
	const elementStyle = getComputedStyle(element);
	const contentInlineEnd =
		element.getBoundingClientRect().right -
		Number.parseFloat(elementStyle.paddingRight) -
		Number.parseFloat(elementStyle.borderRightWidth);
	const nestedControlGap = resolvedCssLength(element, 'var(--nested-control-gap)');

	expectPixelsAtMost(
		contentInlineEnd + nestedControlGap,
		closeButton.getBoundingClientRect().left,
	);
}
