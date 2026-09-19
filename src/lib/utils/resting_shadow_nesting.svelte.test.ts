import '../../app.css';
import { afterEach, expect, it } from 'vitest';
import { restingShadowNesting } from './resting_shadow_nesting.js';

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

it('derives a concentric resting contour from the rendered border, not its fractional declaration', () => {
	const panel = document.createElement('div');
	panel.className = 'resting-shadow-nesting';
	panel.style.cssText =
		'border: 2.5px solid; width: 300px; --radius-panel: 16px; --radius-btn: 7px; --elevation-ordinary-offset: 4px';
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
	const faceInset = parseFloat(getComputedStyle(control).marginLeft);
	const shadowInset = border + faceInset - 4;
	expect(shadowInset + 7).toBeCloseTo(16, 5);
	expect(parseFloat(getComputedStyle(control).marginTop)).toBe(faceInset);
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
