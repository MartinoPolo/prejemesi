import '../../../app.css';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../tests/helpers/pixel-assertions.mjs';
import FloatingDepthClearanceTestFixture from './floating_depth_clearance_test_fixture.svelte';

const { expectPixelsNear } = createPixelAssertions(expect);
const CONTEXT_MENU_POINTER = { x: 120, y: 150 };

afterEach(() => {
	delete document.documentElement.dataset.depth;
});

async function settledContent(): Promise<HTMLElement> {
	const content = page.getByTestId('floating-content');
	await expect.element(content).toBeVisible();
	const element = content.element() as HTMLElement;
	await Promise.all(
		element
			.getAnimations({ subtree: true })
			.filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
			.map((animation) => animation.finished),
	);
	return element;
}

function openContextMenuAtPointer(): void {
	page.getByTestId('floating-trigger')
		.element()
		.dispatchEvent(
			new MouseEvent('contextmenu', {
				bubbles: true,
				cancelable: true,
				button: 2,
				clientX: CONTEXT_MENU_POINTER.x,
				clientY: CONTEXT_MENU_POINTER.y,
			}),
		);
}

function pixels(element: HTMLElement, property: string): number {
	return Number.parseFloat(getComputedStyle(element).getPropertyValue(property));
}

describe('floating layer depth clearance (issue #442)', () => {
	it.each([
		{ kind: 'select', sideOffset: 4 },
		{ kind: 'popover', sideOffset: 6 },
	] as const)(
		'opens the $kind at its standard offset plus the Black shadow clearance',
		async ({ kind, sideOffset }) => {
			await page.viewport(800, 700);
			document.documentElement.dataset.depth = 'black';
			await render(FloatingDepthClearanceTestFixture, { kind });
			const content = await settledContent();
			const trigger = page.getByTestId('floating-trigger').element() as HTMLElement;
			const shadowOffset = pixels(trigger, '--elevation-ordinary-offset');

			expect(shadowOffset).toBeGreaterThan(0);
			expect(content.dataset.side).toBe('bottom');
			expectPixelsNear(
				content.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom,
				sideOffset + shadowOffset,
			);
		},
	);

	it('opens a popover with an unshadowed trigger at its standard offset at Black depth', async () => {
		await page.viewport(800, 700);
		document.documentElement.dataset.depth = 'black';
		await render(FloatingDepthClearanceTestFixture, {
			kind: 'popover',
			shadowedTrigger: false,
		});
		const content = await settledContent();
		const trigger = page.getByTestId('floating-trigger').element() as HTMLElement;

		expect(content.dataset.side).toBe('bottom');
		expectPixelsNear(
			content.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom,
			6,
		);
	});

	it('opens the context menu at its standard offset plus the Black shadow clearance', async () => {
		await page.viewport(800, 700);
		document.documentElement.dataset.depth = 'black';
		await render(FloatingDepthClearanceTestFixture, { kind: 'context-menu' });
		openContextMenuAtPointer();
		const content = await settledContent();
		const shadowOffset = pixels(content, '--elevation-ordinary-offset');

		expect(shadowOffset).toBeGreaterThan(0);
		expect(content.dataset.side).toBe('right');
		expectPixelsNear(
			content.getBoundingClientRect().left - CONTEXT_MENU_POINTER.x,
			4 + shadowOffset,
		);
	});

	it.each(['select', 'context-menu'] as const)(
		'caps the %s on both axes to the available space minus the clearance',
		async (kind) => {
			await page.viewport(800, 700);
			document.documentElement.dataset.depth = 'black';
			await render(FloatingDepthClearanceTestFixture, { kind });
			if (kind === 'context-menu') {
				openContextMenuAtPointer();
			}
			const content = await settledContent();
			const clearance = pixels(content, '--depth-clearance');
			const style = getComputedStyle(content);

			expect(clearance).toBeGreaterThan(0);
			expectPixelsNear(
				Number.parseFloat(style.maxHeight),
				pixels(content, '--bits-floating-available-height') - clearance,
			);
			expectPixelsNear(
				Number.parseFloat(style.maxWidth),
				pixels(content, '--bits-floating-available-width') - clearance,
			);
		},
	);
});
