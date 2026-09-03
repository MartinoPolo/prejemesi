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

	it('renders one inset warm boundary without a selected shadow covering its sibling', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftViewSwitcher, {
			value: GIFT_VIEW_MODES.card,
			onchange,
			contained: true,
		});
		const group = screen.getByTestId('gift-view-switcher').element() as HTMLElement;
		const card = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.card}`);
		const list = screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`);
		const groupStyle = getComputedStyle(group);
		const cardElement = card.element() as HTMLElement;
		const listElement = list.element() as HTMLElement;

		expect(groupStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
		expect(parseFloat(groupStyle.borderWidth)).toBeGreaterThanOrEqual(2);
		expect(parseFloat(groupStyle.borderRadius)).toBeLessThanOrEqual(8);
		expect(groupStyle.boxShadow).not.toBe('none');
		expect(parseFloat(groupStyle.paddingLeft)).toBeGreaterThan(0);
		expect(groupStyle.paddingLeft).toBe(groupStyle.paddingRight);
		expect(groupStyle.paddingTop).toBe(groupStyle.paddingBottom);
		expect(getComputedStyle(cardElement).boxShadow).toBe(
			getComputedStyle(listElement).boxShadow,
		);
		expect(cardElement.getBoundingClientRect().width).toBeGreaterThanOrEqual(40);
		expect(cardElement.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
		expect(listElement.getBoundingClientRect().width).toBeGreaterThanOrEqual(40);
		expect(listElement.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
		expect(cardElement.querySelector('svg')!.getBoundingClientRect().y).toBeCloseTo(
			listElement.querySelector('svg')!.getBoundingClientRect().y,
			1,
		);
		await expect.element(card).toHaveAttribute('aria-checked', 'true');
		await expect.element(list).toHaveAttribute('aria-checked', 'false');
		await expect.element(card).toHaveAccessibleName('Karta');
		await expect.element(list).toHaveAccessibleName('Seznam');
		cardElement.focus();
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
