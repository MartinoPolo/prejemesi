import '../../app.css';
import { afterEach, describe, expect, it } from 'vitest';
import { createPixelAssertions } from '../../../tests/helpers/pixel-assertions.mjs';
import { restingShadowNesting } from './resting_shadow_nesting.js';

const { expectPixelsAtLeast, expectPixelsNear } = createPixelAssertions(expect);
const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

it('derives a concentric contour above the floor from the rendered border plus the depth clearance on shadowed edges', () => {
	const panel = document.createElement('div');
	panel.className = 'resting-shadow-nesting';
	panel.style.cssText =
		'border: 2.5px solid; width: 300px; --radius-panel: 24px; --radius-btn: 7px; --elevation-ordinary-offset: 4px';
	const control = document.createElement('div');
	control.style.cssText =
		'margin-left: var(--gift-content-inset-end); margin-top: var(--gift-content-inset-bottom)';
	panel.append(control);
	document.body.append(panel);
	const geometry = restingShadowNesting(panel);
	cleanups.push(() => {
		geometry.destroy();
		panel.remove();
	});
	const border = parseFloat(getComputedStyle(panel).borderRightWidth);
	for (const [depth, depthClearance] of [
		['soft', 0],
		['ink', 4],
		['black', 4],
	] as const) {
		panel.dataset.depth = depth;
		const endInset = parseFloat(getComputedStyle(control).marginLeft);
		expectPixelsNear(border + endInset - depthClearance + 7, 24);
		expectPixelsNear(parseFloat(getComputedStyle(control).marginTop), endInset);
	}
});

const MINIMUM_CONTROL_GAP = 9;

function renderNestedPanel(corners: string, border: string) {
	const scope = document.createElement('div');
	scope.dataset.corners = corners;
	scope.dataset.border = border;
	const panel = document.createElement('div');
	panel.className = 'resting-shadow-nesting';
	panel.style.cssText =
		'border: var(--border-w) solid; width: 300px; --elevation-ordinary-offset: 4px';
	const control = document.createElement('div');
	control.style.cssText =
		'margin: var(--gift-content-inset) var(--gift-content-inset-end) var(--gift-content-inset-bottom) var(--gift-content-inset)';
	panel.append(control);
	scope.append(panel);
	document.body.append(scope);
	const geometry = restingShadowNesting(panel);
	cleanups.push(() => {
		geometry.destroy();
		scope.remove();
	});
	return { scope, panel, control };
}

describe.each(['round', 'soft', 'sharp'])('%s corners', (corners) => {
	it.each(['bold', 'fine'])(
		'keeps nested controls at least the floor from a %s inner border, plus clearance on shadowed edges',
		(border) => {
			const { panel, control } = renderNestedPanel(corners, border);
			for (const [depth, depthClearance] of [
				['soft', 0],
				['ink', 4],
				['black', 4],
			] as const) {
				panel.dataset.depth = depth;
				const margins = getComputedStyle(control);
				const startGap = parseFloat(margins.marginLeft);
				const topGap = parseFloat(margins.marginTop);
				const endGap = parseFloat(margins.marginRight);
				const bottomGap = parseFloat(margins.marginBottom);
				expectPixelsAtLeast(
					startGap,
					MINIMUM_CONTROL_GAP,
					`${depth} start gap ${startGap}px`,
				);
				expectPixelsAtLeast(topGap, MINIMUM_CONTROL_GAP, `${depth} top gap ${topGap}px`);
				expectPixelsNear(endGap, startGap + depthClearance);
				expectPixelsAtLeast(
					bottomGap - depthClearance,
					MINIMUM_CONTROL_GAP,
					`${depth} bottom gap ${bottomGap}px`,
				);
			}
		},
	);
});

it('pairs Soft corners as a 12 px panel around 4 px controls', () => {
	const { scope } = renderNestedPanel('soft', 'bold');
	const tokens = getComputedStyle(scope);
	expect(tokens.getPropertyValue('--radius-panel').trim()).toBe('12px');
	expect(tokens.getPropertyValue('--radius-btn').trim()).toBe('4px');
});

it('measures an explicit painted border and restores owner styles on teardown', () => {
	const owner = document.createElement('div');
	const paint = document.createElement('div');
	paint.style.border = '3px solid';
	owner.append(paint);
	owner.style.setProperty('--nested-border-inline', '1px');
	document.body.append(owner);
	cleanups.push(() => owner.remove());
	const geometry = restingShadowNesting(owner, paint);
	expect(owner.style.getPropertyValue('--nested-border-inline')).toBe('3px');
	geometry.destroy();
	expect(owner.style.getPropertyValue('--nested-border-inline')).toBe('1px');
	expect(owner.style.getPropertyValue('--nested-border-block')).toBe('');
});
