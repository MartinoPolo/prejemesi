import { expect } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';

const { expectPixelsNear } = createPixelAssertions(expect);

export const RECEIVED_ACTION_SELECTOR = '[data-testid="gift-received-toggle"]';
export const RESERVE_ACTION_SELECTOR = '[data-testid="reserve-button"]';
export const MORE_ACTION_SELECTOR = '[data-testid="gift-more-actions"]';

/** Waits for the action row's ResizeObserver measurement and the placement it derives. */
export async function settleActionPlacement(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

/** Resolves a CSS length, including custom properties, in the cascade of `context`. */
export function resolvedCssLength(context: HTMLElement, cssLength: string): number {
	const probe = document.createElement('div');
	probe.style.position = 'absolute';
	probe.style.width = cssLength;
	context.appendChild(probe);
	const length = probe.getBoundingClientRect().width;
	probe.remove();
	return length;
}

/** Rendered, non-overflowed action controls of a gift action row, in row order. */
export function visibleActions(row: HTMLElement): HTMLElement[] {
	return Array.from(row.querySelectorAll<HTMLElement>('button')).filter(
		(action) =>
			action.closest('[aria-hidden="true"]') === null && action.getClientRects().length > 0,
	);
}

/** The visible action control in `row` matching `selector`; fails the test when none is visible. */
export function visibleAction(row: HTMLElement, selector: string): HTMLElement {
	const action = visibleActions(row).find((element) => element.matches(selector));
	expect(action, `Expected a visible ${selector}`).toBeDefined();
	return action!;
}

/** Asserts one equal-height line of actions separated by `--nested-control-gap`, ending at `rightEdge`. */
export function expectRightAlignedAdjacentActions(
	row: HTMLElement,
	actions: HTMLElement[],
	rightEdge: number,
): void {
	expect(actions.length).toBeGreaterThan(0);
	const actionGap = resolvedCssLength(row, 'var(--nested-control-gap)');
	const actionRects = actions.map((action) => action.getBoundingClientRect());

	for (const [index, actionRect] of actionRects.entries()) {
		expectPixelsNear(actionRect.top, actionRects[0]!.top);
		expectPixelsNear(actionRect.height, actionRects[0]!.height);
		if (index > 0) {
			expectPixelsNear(actionRect.left - actionRects[index - 1]!.right, actionGap);
		}
	}
	expectPixelsNear(actionRects.at(-1)!.right, rightEdge);
}
