import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { GIFT_VIEW_MODES } from '$lib/modules/gifts/types.js';
import GiftViewSwitcher from './GiftViewSwitcher.svelte';

describe('GiftViewSwitcher toggle selection (fixes: re-click deselects both items)', () => {
	it('switches mode and fires onchange exactly once when clicking the inactive item', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, { value: GIFT_VIEW_MODES.card, onchange });

		await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`).click();

		expect(onchange).toHaveBeenCalledTimes(1);
		expect(onchange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		await screen.unmount();
	});

	it('keeps the active item checked and does not fire onchange when re-clicking it', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, { value: GIFT_VIEW_MODES.card, onchange });

		const activeItem = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		await activeItem.click();

		expect(onchange).not.toHaveBeenCalled();
		await expect.element(activeItem).toHaveAttribute('data-state', 'on');
		await expect.element(activeItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('always has exactly one checked item after re-clicking the active item', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, { value: GIFT_VIEW_MODES.list, onchange });

		await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`).click();

		const cardItem = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const listItem = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);
		await expect.element(cardItem).toHaveAttribute('aria-checked', 'false');
		await expect.element(listItem).toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('projects legacy compact mode to exactly one checked card radio', async () => {
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.compact,
			onchange: vi.fn(),
		});
		const group = screen.getByTestId('gift-view-switcher').element();

		expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
		await expect
			.element(screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`))
			.toHaveAttribute('aria-checked', 'true');
		await screen.unmount();
	});

	it('leaves legacy compact mode when the projected card radio is clicked', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.compact,
			onchange,
		});

		await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`).click();

		expect(onchange).toHaveBeenCalledExactlyOnceWith(GIFT_VIEW_MODES.card);
		await screen.unmount();
	});

	it('moves focus and requests the next selection with arrow navigation', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange,
		});
		const card = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const list = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);

		(card.element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');

		await expect.element(list).toHaveFocus();
		expect(onchange).toHaveBeenCalledOnce();
		expect(onchange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		await screen.unmount();
	});

	it('does not mutate disabled controls and retains their labels and state', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange,
			disabled: true,
		});
		const card = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const list = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);

		await expect.element(card).toHaveAccessibleName('Karta');
		await expect.element(list).toHaveAccessibleName('Seznam');
		await expect.element(card).toBeDisabled();
		await expect.element(list).toBeDisabled();
		await list.click({ force: true });
		expect(onchange).not.toHaveBeenCalled();
		await expect.element(card).toHaveAttribute('aria-checked', 'true');
		await expect.element(list).toHaveAttribute('aria-checked', 'false');
		await screen.unmount();
	});

	it('uses 40px mobile targets and compact 32px desktop targets', async () => {
		await page.viewport(390, 720);
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange: vi.fn(),
		});
		const group = screen.getByTestId('gift-view-switcher').element() as HTMLElement;
		const card = screen
			.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`)
			.element() as HTMLElement;

		expect(group.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
		expect(card.getBoundingClientRect().width).toBeGreaterThanOrEqual(40);
		expect(card.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);

		await page.viewport(800, 720);
		expect(group.getBoundingClientRect().height).toBe(32);
		expect(card.getBoundingClientRect().width).toBe(32);
		expect(card.getBoundingClientRect().height).toBe(32);
		await screen.unmount();
	});

	it('uses one ink boundary and a distinct card surface only for the selected segment', async () => {
		const rootStyle = document.documentElement.style;
		const properties = ['--secondary', '--card', '--ink'] as const;
		const previousProperties = properties.map((property) => ({
			property,
			value: rootStyle.getPropertyValue(property),
			priority: rootStyle.getPropertyPriority(property),
		}));
		rootStyle.setProperty('--secondary', 'rgb(11, 22, 33)');
		rootStyle.setProperty('--card', 'rgb(44, 55, 66)');
		rootStyle.setProperty('--ink', 'rgb(77, 88, 99)');

		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange: vi.fn(),
		});

		try {
			const group = screen.getByTestId('gift-view-switcher').element() as HTMLElement;
			const card = screen
				.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`)
				.element() as HTMLElement;
			const list = screen
				.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`)
				.element() as HTMLElement;

			expect(getComputedStyle(group).backgroundColor).toBe('rgb(11, 22, 33)');
			expect(getComputedStyle(card).backgroundColor).toBe('rgb(44, 55, 66)');
			expect(getComputedStyle(list).backgroundColor).toBe('rgba(0, 0, 0, 0)');
			expect(getComputedStyle(group).outlineColor).toBe('rgb(77, 88, 99)');
			expect(parseFloat(getComputedStyle(group).outlineWidth)).toBeGreaterThan(0);
			expect(parseFloat(getComputedStyle(card).borderWidth)).toBe(0);
			expect(parseFloat(getComputedStyle(list).borderWidth)).toBe(0);

			await list.click();

			expect(getComputedStyle(card).backgroundColor).toBe('rgba(0, 0, 0, 0)');
			expect(getComputedStyle(list).backgroundColor).toBe('rgb(44, 55, 66)');
			expect(getComputedStyle(group).backgroundColor).toBe('rgb(11, 22, 33)');
		} finally {
			await screen.unmount();
			for (const { property, value, priority } of previousProperties) {
				rootStyle.setProperty(property, value, priority);
			}
		}
	});

	it('keeps the visible focus outline outside the shared tray boundary', async () => {
		const rootStyle = document.documentElement.style;
		const previousRing = {
			value: rootStyle.getPropertyValue('--ring'),
			priority: rootStyle.getPropertyPriority('--ring'),
		};
		rootStyle.setProperty('--ring', 'rgb(101, 112, 123)');

		try {
			const screen = await render(GiftViewSwitcher, {
				value: GIFT_VIEW_MODES.card,
				onchange: vi.fn(),
			});

			try {
				const group = screen.getByTestId('gift-view-switcher').element() as HTMLElement;
				const card = screen
					.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`)
					.element() as HTMLElement;

				card.focus();
				expect(getComputedStyle(group).overflow).toBe('visible');
				expect(getComputedStyle(card).outlineColor).toBe('rgb(101, 112, 123)');
				expect(parseFloat(getComputedStyle(card).outlineWidth)).toBeGreaterThan(0);
				expect(parseFloat(getComputedStyle(card).outlineOffset)).toBeGreaterThan(0);
			} finally {
				await screen.unmount();
			}
		} finally {
			rootStyle.setProperty('--ring', previousRing.value, previousRing.priority);
		}
	});

	it('always renders the shared warm segmented tray treatment', async () => {
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange: vi.fn(),
		});
		const group = screen.getByTestId('gift-view-switcher').element() as HTMLElement;

		expect(getComputedStyle(group).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
		expect(parseFloat(getComputedStyle(group).outlineWidth)).toBeGreaterThan(0);
		expect(getComputedStyle(group).boxShadow).not.toBe('none');
		await screen.unmount();
	});
});
