import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
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

	it('is one warm contained keyboard-operable switcher with named disabled targets', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange,
			contained: true,
		});
		const group = screen.getByTestId('gift-view-switcher').element() as HTMLElement;
		const card = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const list = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);

		expect(getComputedStyle(group).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
		expect(parseFloat(getComputedStyle(group).outlineWidth)).toBeGreaterThan(0);
		expect(getComputedStyle(group).boxShadow).not.toBe('none');
		await expect.element(card).toHaveAccessibleName('Karta');
		await expect.element(list).toHaveAccessibleName('Seznam');
		(card.element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(onchange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		await screen.rerender({
			value: GIFT_VIEW_MODES.card,
			onchange,
			disabled: true,
			contained: true,
		});
		await expect.element(card).toBeDisabled();
		await expect.element(list).toBeDisabled();
		await screen.unmount();
	});
});
