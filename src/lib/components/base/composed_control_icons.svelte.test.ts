import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ComposedControlIconsTestFixture from './composed_control_icons_test_fixture.svelte';

const expectedIconSizes = { sm: 14, md: 16, lg: 16, xl: 20 } as const;

function iconIn(selector: string): SVGElement {
	const icon = document.querySelector<SVGElement>(`${selector} svg`);
	if (icon == null) {
		throw new Error(`Missing icon in ${selector}`);
	}
	return icon;
}

function iconDimensions(icon: SVGElement): readonly [number, number] {
	const bounds = icon.getBoundingClientRect();
	return [bounds.width, bounds.height];
}

function labeledIcon(label: string): SVGElement {
	return iconIn(`[aria-label="${label}"]`);
}

function searchFieldIcon(label: string): SVGElement {
	const input = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
	const icon = input?.closest('[data-slot="search-field"]')?.querySelector<SVGElement>('svg');
	if (icon == null) {
		throw new Error(`Missing icon for ${label}`);
	}
	return icon;
}

afterEach(async () => page.viewport(1280, 720));

describe('composed field icon sizing', () => {
	it('matches explicit SearchField and InputGroup icon sizes to same-size buttons', () => {
		render(ComposedControlIconsTestFixture);

		for (const [size, expectedIconSize] of Object.entries(expectedIconSizes)) {
			const expectedDimensions = [expectedIconSize, expectedIconSize];
			expect(iconDimensions(labeledIcon(`Button peer ${size}`))).toEqual(expectedDimensions);
			expect(iconDimensions(searchFieldIcon(`Search field ${size}`))).toEqual(
				expectedDimensions,
			);
			expect(iconDimensions(iconIn(`[data-testid="Input group addon ${size}"]`))).toEqual(
				expectedDimensions,
			);
		}

		const extraLargeInput = document.querySelector<HTMLInputElement>(
			'[aria-label="Search field xl"]',
		)!;
		const iconRightEdge = searchFieldIcon('Search field xl').getBoundingClientRect().right;
		const textStartEdge =
			extraLargeInput.getBoundingClientRect().left +
			Number.parseFloat(getComputedStyle(extraLargeInput).paddingLeft);
		expect(iconRightEdge).toBeLessThan(textStartEdge);
	});

	it('matches omitted SearchField and InputGroup icon sizing at mobile and desktop widths', async () => {
		render(ComposedControlIconsTestFixture);

		for (const viewportWidth of [390, 1280]) {
			await page.viewport(viewportWidth, 720);
			const expectedDimensions = [16, 16] as const;
			expect(iconDimensions(labeledIcon('Responsive button peer'))).toEqual(
				expectedDimensions,
			);
			expect(iconDimensions(searchFieldIcon('Responsive search field'))).toEqual(
				expectedDimensions,
			);
			expect(iconDimensions(iconIn('[data-testid="Responsive input group addon"]'))).toEqual(
				expectedDimensions,
			);
		}
	});

	it('keeps a nested small button icon independent from an extra-large input group', () => {
		render(ComposedControlIconsTestFixture);
		expect(iconDimensions(labeledIcon('Nested button xl'))).toEqual([14, 14]);
	});

	it('preserves composed input labels and values', () => {
		render(ComposedControlIconsTestFixture);
		const searchInput = page
			.getByRole('searchbox', { name: 'Responsive search field' })
			.element() as HTMLInputElement;
		const groupedInput = page
			.getByRole('textbox', { name: 'Responsive input group' })
			.element() as HTMLInputElement;
		expect(searchInput.value).toBe('Needle');
		expect(groupedInput.value).toBe('Haystack');
	});

	it('keeps addon clicks focused on the grouped input', async () => {
		render(ComposedControlIconsTestFixture);
		await userEvent.click(page.getByTestId('Responsive input group addon'));
		expect(
			page.getByRole('textbox', { name: 'Responsive input group' }).element(),
		).toHaveFocus();
	});
});
