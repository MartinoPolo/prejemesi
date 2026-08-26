import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
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
