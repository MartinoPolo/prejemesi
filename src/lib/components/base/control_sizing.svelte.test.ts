import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../tests/helpers/pixel-assertions.mjs';
import ControlSizingTestFixture from './control-sizing_test_fixture.svelte';
import { Checkbox } from './checkbox/index.js';

const { expectPixelsNear } = createPixelAssertions(expect);
const expectedSizes = { sm: 26, md: 32, lg: 40, xl: 48 } as const;

function height(element: Element): number {
	return element.getBoundingClientRect().height;
}

function width(element: Element): number {
	return element.getBoundingClientRect().width;
}

function namedControl(name: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[aria-label="${name}"]`);
	if (element == null) {
		throw new Error(`Missing ${name}`);
	}
	return element;
}

function iconIn(name: string): SVGElement {
	const icon = namedControl(name).querySelector<SVGElement>('svg');
	if (icon == null) {
		throw new Error(`Missing icon in ${name}`);
	}
	return icon;
}

function expectMatchingInputTypographyAndPadding(actual: Element, expected: Element): void {
	const actualStyle = getComputedStyle(actual);
	const expectedStyle = getComputedStyle(expected);
	expect(actualStyle.fontSize).toBe(expectedStyle.fontSize);
	expect(actualStyle.paddingTop).toBe(expectedStyle.paddingTop);
	expect(actualStyle.paddingBottom).toBe(expectedStyle.paddingBottom);
	expect(actualStyle.paddingLeft).toBe(expectedStyle.paddingLeft);
}

afterEach(async () => page.viewport(1280, 720));

describe('shared rendered control sizing', () => {
	it('renders every explicit size at its fixed shared height', () => {
		render(ControlSizingTestFixture);
		for (const [size, expectedHeight] of Object.entries(expectedSizes)) {
			const controls = [
				namedControl(`Text button ${size}`),
				namedControl(`Button ${size}`),
				namedControl(`Input ${size}`),
				namedControl(`Select ${size}`),
				namedControl(`Checkbox ${size}`),
				document.querySelector<HTMLElement>(`[data-size="${size}"] [data-slot="toggle"]`)!,
				namedControl(`Switcher ${size}`),
			];
			for (const control of controls) {
				expectPixelsNear(
					height(control),
					expectedHeight,
					`${size} ${control.getAttribute('aria-label')}`,
				);
			}
		}
	});

	it('uses 40px below sm and 32px from sm when size is omitted', async () => {
		render(ControlSizingTestFixture);
		const controls = [
			namedControl('Responsive button'),
			namedControl('Responsive input'),
			namedControl('Responsive select'),
			namedControl('Responsive checkbox'),
			document.querySelector<HTMLElement>(
				'[data-testid="responsive-matrix"] [data-slot="toggle"]',
			)!,
			namedControl('Responsive switcher'),
		];
		await page.viewport(390, 720);
		for (const control of controls) {
			expectPixelsNear(height(control), 40, 'mobile responsive control');
		}
		await page.viewport(1280, 720);
		for (const control of controls) {
			expectPixelsNear(height(control), 32, 'desktop responsive control');
		}
	});

	it('applies each root size to the group height and inherited input typography', () => {
		render(ControlSizingTestFixture);
		for (const [size, expectedHeight] of Object.entries(expectedSizes)) {
			expectPixelsNear(height(namedControl(`Input group ${size}`)), expectedHeight);
			const groupedInput = namedControl(`Inherited input group control ${size}`);
			const standaloneInput = namedControl(`Standalone input group peer ${size}`);
			expectMatchingInputTypographyAndPadding(groupedInput, standaloneInput);
			expect(Number.parseFloat(getComputedStyle(groupedInput).paddingRight)).toBeLessThan(
				Number.parseFloat(getComputedStyle(standaloneInput).paddingRight),
			);
		}
	});

	it('applies omitted responsive sizing to an input group at mobile and desktop widths', async () => {
		render(ControlSizingTestFixture);
		for (const [viewportWidth, expectedHeight] of [
			[390, 40],
			[1280, 32],
		] as const) {
			await page.viewport(viewportWidth, 720);
			expectPixelsNear(height(namedControl('Responsive input group')), expectedHeight);
			expectMatchingInputTypographyAndPadding(
				namedControl('Responsive inherited input group control'),
				namedControl('Standalone responsive input group peer'),
			);
		}
	});

	it('gives an explicit child input size precedence over its group size', () => {
		render(ControlSizingTestFixture);
		expectPixelsNear(height(namedControl('Override input group')), expectedSizes.xl);
		expectMatchingInputTypographyAndPadding(
			namedControl('Overridden input group control'),
			namedControl('Standalone overridden input group peer'),
		);
	});

	it('reactively updates inherited input sizing when the root size changes', async () => {
		render(ControlSizingTestFixture);
		const group = namedControl('Dynamic input group');
		const control = namedControl('Dynamic inherited input group control');
		expectPixelsNear(height(group), expectedSizes.sm);
		expectMatchingInputTypographyAndPadding(
			control,
			namedControl('Standalone dynamic input group peer'),
		);

		await userEvent.click(page.getByRole('button', { name: 'Change input group size' }));

		expectPixelsNear(height(group), expectedSizes.xl);
		expectMatchingInputTypographyAndPadding(
			control,
			namedControl('Standalone dynamic input group peer'),
		);
	});

	it('keeps explicit sizes unchanged across breakpoints', async () => {
		render(ControlSizingTestFixture);
		for (const viewportWidth of [390, 1280]) {
			await page.viewport(viewportWidth, 720);
			for (const [size, expectedHeight] of Object.entries(expectedSizes)) {
				expectPixelsNear(height(namedControl(`Button ${size}`)), expectedHeight);
			}
		}
	});

	it('uses the same size-driven icon dimensions across comparable controls', () => {
		render(ControlSizingTestFixture);
		const expectedIcons = { sm: 14, md: 16, lg: 16, xl: 20 } as const;
		for (const [size, expectedIconSize] of Object.entries(expectedIcons)) {
			for (const name of [
				`Text button ${size}`,
				`Button ${size}`,
				`Select ${size}`,
				`Checkbox ${size}`,
				`Switcher item ${size}`,
			]) {
				const icon = iconIn(name);
				expectPixelsNear(height(icon), expectedIconSize, name);
				expectPixelsNear(width(icon), expectedIconSize, name);
			}
		}
	});

	it('allows a text segmented item to grow wider than its height', () => {
		render(ControlSizingTestFixture);
		const item = namedControl('Responsive switcher').querySelector('button')!;
		expect(width(item)).toBeGreaterThan(height(item));
	});

	it('provides reusable nonsemantic checkbox geometry', () => {
		render(ControlSizingTestFixture);
		const owner = document.querySelector<HTMLElement>(
			'[data-testid="nonsemantic-checkbox-owner"]',
		)!;
		const surface = owner.querySelector<HTMLElement>('[data-slot="checkbox-surface"]')!;
		expectPixelsNear(height(owner), 32);
		expectPixelsNear(height(surface), 32);
		expect(surface.getAttribute('role')).toBeNull();
		expect(surface.getAttribute('aria-hidden')).toBe('true');
		expect(getComputedStyle(surface).borderRadius).toBe(getComputedStyle(owner).borderRadius);
	});

	it('visually distinguishes invalid checkboxes without changing geometry', async () => {
		const screen = await render(Checkbox, {
			'aria-label': 'Invalid selection',
			'aria-invalid': true,
		});
		const owner = screen.getByRole('checkbox').element();
		const surface = owner.querySelector('[data-slot="checkbox-surface"]')!;
		const invalidBorder = getComputedStyle(surface).borderColor;
		owner.removeAttribute('aria-invalid');
		expect(invalidBorder).not.toBe(getComputedStyle(surface).borderColor);
		expectPixelsNear(height(owner), 32);
	});

	it('preserves checkbox keyboard, mixed, disabled, and focus states', async () => {
		render(ControlSizingTestFixture);
		const interactive = namedControl('Interactive checkbox');
		interactive.focus();
		await userEvent.keyboard(' ');
		expect(interactive.getAttribute('aria-checked')).toBe('true');
		expect(interactive.matches(':focus-visible')).toBe(true);
		expect(namedControl('Mixed checkbox').getAttribute('aria-checked')).toBe('mixed');
		const disabled = namedControl('Disabled checkbox') as HTMLButtonElement;
		expect(disabled.disabled).toBe(true);
		disabled.click();
		expect(disabled.getAttribute('aria-checked')).toBe('false');
	});
});
