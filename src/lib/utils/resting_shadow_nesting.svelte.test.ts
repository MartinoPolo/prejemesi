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

// The border is measured with the first rendering update after the surface is observed.
async function expectBorderMeasured(owner: HTMLElement) {
	await expect.poll(() => owner.style.getPropertyValue('--nested-border-inline')).not.toBe('');
}

it('derives a concentric contour above the floor from the rendered border plus the depth clearance on shadowed edges', async () => {
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
	await expectBorderMeasured(panel);
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

async function renderNestedPanel(corners: string, border: string) {
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
	await expectBorderMeasured(panel);
	return { scope, panel, control };
}

describe.each(['round', 'soft', 'sharp'])('%s corners', (corners) => {
	it.each(['bold', 'fine'])(
		'keeps nested controls at least the floor from a %s inner border, plus clearance on shadowed edges',
		async (border) => {
			const { panel, control } = await renderNestedPanel(corners, border);
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

it('pairs Soft corners as a 12 px panel around 4 px controls', async () => {
	const { scope } = await renderNestedPanel('soft', 'bold');
	const tokens = getComputedStyle(scope);
	expect(tokens.getPropertyValue('--radius-panel').trim()).toBe('12px');
	expect(tokens.getPropertyValue('--radius-btn').trim()).toBe('4px');
});

it('follows a border width change of every observed surface', async () => {
	const panels = [document.createElement('div'), document.createElement('div')];
	const geometries = panels.map((panel) => {
		panel.style.cssText = 'box-sizing: border-box; border: 2px solid; width: 300px';
		document.body.append(panel);
		return restingShadowNesting(panel);
	});
	cleanups.push(() => {
		for (const geometry of geometries) {
			geometry.destroy();
		}
		for (const panel of panels) {
			panel.remove();
		}
	});
	// Lets the observer deliver its initial notification, so only the border change can update.
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	for (const panel of panels) {
		panel.style.borderWidth = '4px';
	}
	for (const panel of panels) {
		await expect.poll(() => panel.style.getPropertyValue('--nested-border-inline')).toBe('4px');
		expect(panel.style.getPropertyValue('--nested-border-block')).toBe('4px');
	}
});

it('keeps tracking a shared surface after another owner of it is destroyed', async () => {
	const surface = document.createElement('div');
	surface.style.cssText = 'box-sizing: border-box; border: 2px solid; width: 300px';
	const owners = [document.createElement('div'), document.createElement('div')];
	surface.append(...owners);
	document.body.append(surface);
	const [firstGeometry, secondGeometry] = owners.map((owner) =>
		restingShadowNesting(owner, surface),
	);
	cleanups.push(() => {
		secondGeometry.destroy();
		surface.remove();
	});
	firstGeometry.destroy();
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	surface.style.borderWidth = '5px';
	await expect.poll(() => owners[1].style.getPropertyValue('--nested-border-inline')).toBe('5px');
	expect(owners[0].style.getPropertyValue('--nested-border-inline')).toBe('');
});

it('measures an explicit painted border and restores owner styles on teardown', async () => {
	const owner = document.createElement('div');
	const paint = document.createElement('div');
	paint.style.border = '3px solid';
	owner.append(paint);
	owner.style.setProperty('--nested-border-inline', '1px');
	document.body.append(owner);
	cleanups.push(() => owner.remove());
	const geometry = restingShadowNesting(owner, paint);
	await expect.poll(() => owner.style.getPropertyValue('--nested-border-inline')).toBe('3px');
	geometry.destroy();
	expect(owner.style.getPropertyValue('--nested-border-inline')).toBe('1px');
	expect(owner.style.getPropertyValue('--nested-border-block')).toBe('');
});
