import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import ViewToggle from './ViewToggle.svelte';
import ViewToggleTestHarness from './ViewToggleTestHarness.svelte';

describe('ViewToggle toggle selection (fixes: re-click deselects both items)', () => {
	it('renders the same warm segmented tray treatment as the wishlist switcher', async () => {
		const rootStyle = document.documentElement.style;
		const properties = ['--secondary', '--card', '--ink'] as const;
		const previousProperties = properties.map((property) => ({
			property,
			value: rootStyle.getPropertyValue(property),
			priority: rootStyle.getPropertyPriority(property),
		}));
		rootStyle.setProperty('--secondary', 'rgb(12, 23, 34)');
		rootStyle.setProperty('--card', 'rgb(45, 56, 67)');
		rootStyle.setProperty('--ink', 'rgb(78, 89, 100)');

		const screen = await render(ViewToggle, { value: 'grid' });

		try {
			const group = screen
				.getByRole('group', { name: m.dashboard_view_label() })
				.element() as HTMLElement;
			const grid = screen
				.getByRole('radio', { name: m.dashboard_view_grid() })
				.element() as HTMLElement;
			const list = screen
				.getByRole('radio', { name: m.dashboard_view_list() })
				.element() as HTMLElement;

			expect(getComputedStyle(group).backgroundColor).toBe('rgb(12, 23, 34)');
			expect(getComputedStyle(grid).backgroundColor).toBe('rgb(45, 56, 67)');
			expect(getComputedStyle(list).backgroundColor).toBe('rgba(0, 0, 0, 0)');
			expect(getComputedStyle(group).borderColor).toBe('rgb(78, 89, 100)');
			expect(parseFloat(getComputedStyle(group).borderWidth)).toBeGreaterThan(0);
			expect(getComputedStyle(group).boxShadow).not.toBe('none');
			expect(getComputedStyle(grid).boxShadow).toBe(getComputedStyle(list).boxShadow);
		} finally {
			await screen.unmount();
			for (const { property, value, priority } of previousProperties) {
				rootStyle.setProperty(property, value, priority);
			}
		}
	});

	it('updates the parent-owned bound mode', async () => {
		const screen = await render(ViewToggleTestHarness);

		await screen.getByRole('radio', { name: m.dashboard_view_list() }).click();

		await expect.element(screen.getByTestId('parent-view-mode')).toHaveTextContent('list');
		await screen.unmount();
	});

	it('switches mode when clicking the inactive item', async () => {
		const screen = await render(ViewToggle, { value: 'grid' });

		await screen.getByRole('radio', { name: m.dashboard_view_list() }).click();

		await expect
			.element(screen.getByRole('radio', { name: m.dashboard_view_list() }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(screen.getByRole('radio', { name: m.dashboard_view_grid() }))
			.toHaveAttribute('aria-checked', 'false');
		await screen.unmount();
	});

	it('keeps the active item checked when re-clicking it', async () => {
		const screen = await render(ViewToggle, { value: 'grid' });

		const activeItem = screen.getByRole('radio', { name: m.dashboard_view_grid() });
		await activeItem.click();

		await expect.element(activeItem).toHaveAttribute('data-state', 'on');
		await expect.element(activeItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('always has exactly one checked item after re-clicking the active item', async () => {
		const screen = await render(ViewToggle, { value: 'list' });

		await screen.getByRole('radio', { name: m.dashboard_view_list() }).click();

		const gridItem = screen.getByRole('radio', { name: m.dashboard_view_grid() });
		const listItem = screen.getByRole('radio', { name: m.dashboard_view_list() });
		await expect.element(gridItem).toHaveAttribute('aria-checked', 'false');
		await expect.element(listItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});
});
