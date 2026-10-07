import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import {
	isFacePaintHidden,
	isIndicatorOnFace,
	isSlideRunning,
	nextFrames,
	recordSlides,
	resolveCssValue,
	selectionIndicatorOf,
} from '../../../../../tests/helpers/selection-slide-assertions.mjs';
import TabsTestFixture from './tabs_test_fixture.svelte';

describe('Tabs keyboard navigation', () => {
	it('puts only the active tab in the sequential focus order', async () => {
		const screen = render(TabsTestFixture);
		const tabs = screen.getByRole('tab').all();

		await expect.element(tabs[0]).toHaveAttribute('tabindex', '0');
		for (const tab of tabs.slice(1)) {
			await expect.element(tab).toHaveAttribute('tabindex', '-1');
		}
	});

	it('ArrowRight focuses and activates the next enabled tab', async () => {
		const screen = render(TabsTestFixture, { disabledSecond: true });
		const first = screen.getByRole('tab', { name: 'First' });
		const third = screen.getByRole('tab', { name: 'Third' });

		await first.click();
		await userEvent.keyboard('{ArrowRight}');

		await expect.element(third).toHaveFocus();
		await expect.element(third).toHaveAttribute('aria-selected', 'true');
	});

	it('ArrowLeft wraps from the first enabled tab to the last', async () => {
		const screen = render(TabsTestFixture);
		const first = screen.getByRole('tab', { name: 'First' });
		const fourth = screen.getByRole('tab', { name: 'Fourth' });

		await first.click();
		await userEvent.keyboard('{ArrowLeft}');

		await expect.element(fourth).toHaveFocus();
		await expect.element(fourth).toHaveAttribute('aria-selected', 'true');
	});

	it('ArrowDown focuses and activates the next enabled tab in vertical orientation', async () => {
		const screen = render(TabsTestFixture, { orientation: 'vertical', disabledSecond: true });
		const first = screen.getByRole('tab', { name: 'First' });
		const third = screen.getByRole('tab', { name: 'Third' });

		await first.click();
		await userEvent.keyboard('{ArrowDown}');

		await expect.element(third).toHaveFocus();
		await expect.element(third).toHaveAttribute('aria-selected', 'true');
	});

	it('Home and End activate the first and last enabled tabs', async () => {
		const screen = render(TabsTestFixture, { disabledSecond: true });
		const first = screen.getByRole('tab', { name: 'First' });
		const third = screen.getByRole('tab', { name: 'Third' });
		const fourth = screen.getByRole('tab', { name: 'Fourth' });

		await third.click();
		await userEvent.keyboard('{End}');
		await expect.element(fourth).toHaveFocus();
		await expect.element(fourth).toHaveAttribute('aria-selected', 'true');

		await userEvent.keyboard('{Home}');
		await expect.element(first).toHaveFocus();
		await expect.element(first).toHaveAttribute('aria-selected', 'true');
	});
});

describe('Tabs selected face slide', () => {
	async function renderTabs() {
		const screen = render(TabsTestFixture);
		const tablist = screen.getByRole('tablist').element() as HTMLElement;
		const tabs = screen
			.getByRole('tab')
			.all()
			.map((tab) => tab.element() as HTMLElement);
		await nextFrames();
		return { screen, tablist, tabs };
	}

	it('places the shipped active tab face on the active tab without animating', async () => {
		const { tablist, tabs } = await renderTabs();
		const context = tablist.parentElement!;
		const indicatorStyle = getComputedStyle(selectionIndicatorOf(tablist));

		expect(isIndicatorOnFace(tablist, tabs[0])).toBe(true);
		expect(isSlideRunning(selectionIndicatorOf(tablist))).toBe(false);
		expect(indicatorStyle.backgroundColor).toBe(
			resolveCssValue(context, 'background-color', 'var(--card)'),
		);
		expect(indicatorStyle.borderTopWidth).toBe('2px');
		expect(indicatorStyle.borderTopStyle).toBe('solid');
		expect(indicatorStyle.borderTopColor).toBe(resolveCssValue(context, 'color', 'var(--ink)'));
		// Tailwind shadow utilities prepend transparent ring layers before the sticker shadow.
		expect(
			indicatorStyle.boxShadow.endsWith(
				resolveCssValue(context, 'box-shadow', 'var(--shadow-sticker-sm)'),
			),
		).toBe(true);
		expect(indicatorStyle.borderTopLeftRadius).toBe(
			resolveCssValue(context, 'border-top-left-radius', 'var(--radius-btn)'),
		);
		expect(isFacePaintHidden(tabs[0])).toBe(true);
	});

	it('slides the selected face to a clicked tab', async () => {
		const { screen, tablist, tabs } = await renderTabs();
		const slides = recordSlides(selectionIndicatorOf(tablist));

		await screen.getByRole('tab', { name: 'Second' }).click();

		await expect.poll(() => isIndicatorOnFace(tablist, tabs[1])).toBe(true);
		expect(slides.hasSlid()).toBe(true);
		expect(isFacePaintHidden(tabs[1])).toBe(true);
		slides.stop();
	});

	it('slides the selected face with arrow-key activation', async () => {
		const { tablist, tabs } = await renderTabs();
		const slides = recordSlides(selectionIndicatorOf(tablist));

		tabs[0].focus();
		await userEvent.keyboard('{ArrowLeft}');

		await expect.element(tabs[3]).toHaveAttribute('aria-selected', 'true');
		await expect.poll(() => isIndicatorOnFace(tablist, tabs[3])).toBe(true);
		expect(slides.hasSlid()).toBe(true);
		slides.stop();
	});

	// Vitest browser mode cannot hold a real pointer press, so `:active` press styling is not reachable.
	it('keeps tabs and the selected face static on hover', async () => {
		const { tablist, tabs } = await renderTabs();
		const indicator = selectionIndicatorOf(tablist);
		const restingFaceShadow = getComputedStyle(indicator).boxShadow;
		const restingActiveTabShadow = getComputedStyle(tabs[0]).boxShadow;

		for (const tab of [tabs[0], tabs[1]]) {
			await userEvent.hover(tab);
			const style = getComputedStyle(tab);
			expect(style.translate).toBe('none');
			expect(style.scale).toBe('none');
			expect(style.transform).toBe('none');
			expect(getComputedStyle(indicator).boxShadow).toBe(restingFaceShadow);
			expect(getComputedStyle(tabs[0]).boxShadow).toBe(restingActiveTabShadow);
		}
	});

	it('keeps the selected face on its tab while the tab track scrolls', async () => {
		const { tablist, tabs } = await renderTabs();
		expect(tablist.scrollWidth).toBeGreaterThan(tablist.clientWidth);

		tablist.scrollLeft = tablist.scrollWidth;
		await nextFrames();

		expect(isIndicatorOnFace(tablist, tabs[0])).toBe(true);
	});
});
