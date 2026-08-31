import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import WishlistSelectionToolbar from './WishlistSelectionToolbar.svelte';
import * as m from '$lib/paraglide/messages.js';

function createProps() {
	return {
		selectedCount: 2,
		hiddenCount: 1,
		visibleState: 'some' as const,
		priorityReady: true,
		categoryReady: true,
		priorityLevels: [{ id: 'high', label: 'Vysoká' }],
		categories: [{ id: 'sport', label: 'Sport' }],
		commonPriorityId: undefined,
		commonCategoryId: undefined,
		commonImageFit: undefined,
		commonImageBackground: undefined,
		commonReceived: undefined,
		onselectvisible: vi.fn(),
		onpriority: vi.fn(),
		oncategory: vi.fn(),
		onaction: vi.fn(),
		ondone: vi.fn(),
	};
}

describe('WishlistSelectionToolbar', () => {
	it('reports mixed summaries, hidden selection, and dispatches visible-select plus done callbacks', async () => {
		const props = createProps();
		const screen = await render(WishlistSelectionToolbar, props);
		const region = screen.getByRole('region', { name: m.gift_selection_toolbar() });
		await expect.element(region).toHaveTextContent(m.gift_selection_count({ count: 2 }));
		await expect.element(region).toHaveTextContent(m.gift_selection_hidden_count({ count: 1 }));
		await expect.element(region).toHaveTextContent(m.gift_priority_label());
		await expect.element(region).toHaveTextContent(m.gift_context_category());
		await expect.element(region).toHaveTextContent(m.gift_selection_mixed());
		await screen.getByRole('checkbox', { name: m.gift_selection_visible_all() }).click();
		expect(props.onselectvisible).toHaveBeenCalled();
		await screen.getByRole('button', { name: m.done() }).click();
		expect(props.ondone).toHaveBeenCalledOnce();
		await screen.unmount();
	});

	it('represents mixed bulk values without checking a concrete choice', async () => {
		const screen = await render(WishlistSelectionToolbar, createProps());

		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		for (const name of [
			`${m.gift_priority_label()}: ${m.gift_selection_mixed()}`,
			`${m.gift_context_category()}: ${m.gift_selection_mixed()}`,
			`${m.image_fit_label()}: ${m.gift_selection_mixed()}`,
			`${m.image_background_label()}: ${m.gift_selection_mixed()}`,
			`${m.gift_selection_received_state()}: ${m.gift_selection_mixed()}`,
		]) {
			await expect.element(screen.getByRole('menuitem', { name })).toBeVisible();
		}

		await screen
			.getByRole('menuitem', {
				name: `${m.gift_priority_label()}: ${m.gift_selection_mixed()}`,
			})
			.click();
		await expect.element(screen.getByText(m.gift_selection_mixed()).last()).toBeVisible();
		expect(
			Array.from(document.querySelectorAll('[role="menuitemradio"]')).some(
				(item) => item.getAttribute('aria-checked') === 'true',
			),
		).toBe(false);
		await screen.unmount();
	});

	it('checks common values for every bulk field', async () => {
		const screen = await render(WishlistSelectionToolbar, {
			...createProps(),
			commonPriorityId: 'high',
			commonCategoryId: 'sport',
			commonImageFit: 'fit' as const,
			commonImageBackground: '#000000',
			commonReceived: true,
		});

		(screen.getByTestId('selection-wide-controls').element() as HTMLElement).style.display =
			'flex';
		for (const [triggerName, choiceName] of [
			[`${m.gift_priority_label()}: Vysoká`, 'Vysoká'],
			[`${m.gift_context_category()}: Sport`, 'Sport'],
			[`${m.image_fit_label()}: ${m.image_fit_fit()}`, m.image_fit_fit()],
			[
				`${m.image_background_label()}: ${m.image_background_black()}`,
				m.image_background_black(),
			],
			[
				`${m.gift_selection_received_state()}: ${m.gift_mark_received()}`,
				m.gift_mark_received(),
			],
		] as const) {
			await screen.getByRole('button', { name: triggerName }).click();
			await expect
				.element(screen.getByRole('menuitemradio', { name: choiceName }))
				.toHaveAttribute('aria-checked', 'true');
			await userEvent.keyboard('{Escape}');
		}
		await screen.unmount();
	});

	it('uses complementary selection tokens on nested blue wishlist surfaces', () => {
		const neutral = document.createElement('div');
		const blueWishlist = document.createElement('div');
		const selectedGift = document.createElement('div');
		blueWishlist.dataset.palette = 'sky';
		selectedGift.dataset.giftItem = '';
		selectedGift.setAttribute('aria-selected', 'true');
		blueWishlist.appendChild(selectedGift);
		document.body.append(neutral, blueWishlist);

		const neutralStyle = getComputedStyle(neutral);
		const blueStyle = getComputedStyle(blueWishlist);
		expect(neutralStyle.getPropertyValue('--selection-ring').trim()).toBe(
			neutralStyle.getPropertyValue('--primary').trim(),
		);
		expect(blueStyle.getPropertyValue('--selection-ring').trim()).toBe(
			blueStyle.getPropertyValue('--accent-loud').trim(),
		);
		expect(blueStyle.getPropertyValue('--selection-ring').trim()).not.toBe(
			blueStyle.getPropertyValue('--primary').trim(),
		);
		expect(getComputedStyle(selectedGift).outlineStyle).toBe('solid');
		neutral.remove();
		blueWishlist.remove();
	});

	it('disables bulk actions when nothing is selected', async () => {
		const screen = await render(WishlistSelectionToolbar, {
			...createProps(),
			selectedCount: 0,
			hiddenCount: 0,
			visibleState: 'none',
		});
		await expect
			.element(screen.getByRole('button', { name: m.gift_selection_actions() }))
			.toBeDisabled();
		await expect.element(screen.getByRole('button', { name: m.done() })).toBeEnabled();
		await screen.unmount();
	});

	it('shows pending count on the active trigger and disables bulk controls', async () => {
		const screen = await render(WishlistSelectionToolbar, {
			...createProps(),
			pending: { action: 'received' as const, count: 2 },
		});
		await expect
			.element(screen.getByRole('button', { name: m.gift_bulk_pending({ count: 2 }) }))
			.toBeDisabled();
		await expect.element(screen.getByRole('button', { name: m.done() })).toBeEnabled();
		await screen.unmount();
	});

	it('keeps narrow actions in parity and dispatches structured callbacks', async () => {
		const props = createProps();
		const screen = await render(WishlistSelectionToolbar, props);

		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		for (const name of [
			`${m.gift_priority_label()}: ${m.gift_selection_mixed()}`,
			`${m.gift_context_category()}: ${m.gift_selection_mixed()}`,
			`${m.image_fit_label()}: ${m.gift_selection_mixed()}`,
			`${m.image_background_label()}: ${m.gift_selection_mixed()}`,
			`${m.gift_selection_received_state()}: ${m.gift_selection_mixed()}`,
		]) {
			await expect.element(screen.getByRole('menuitem', { name })).toBeVisible();
		}

		await screen
			.getByRole('menuitem', {
				name: `${m.image_fit_label()}: ${m.gift_selection_mixed()}`,
			})
			.click();
		(screen.getByTestId('selection-image-fit-fill').element() as HTMLElement).click();
		expect(props.onaction).toHaveBeenCalledWith({ action: 'imageFit', fit: 'fill' });

		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		await screen
			.getByRole('menuitem', {
				name: `${m.image_background_label()}: ${m.gift_selection_mixed()}`,
			})
			.click();
		(screen.getByTestId('selection-image-background-black').element() as HTMLElement).click();
		expect(props.onaction).toHaveBeenCalledWith({
			action: 'imageBackground',
			background: '#000000',
		});

		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		await screen
			.getByRole('menuitem', {
				name: `${m.gift_selection_received_state()}: ${m.gift_selection_mixed()}`,
			})
			.click();
		(screen.getByTestId('selection-received-false').element() as HTMLElement).click();
		expect(props.onaction).toHaveBeenCalledWith({ action: 'received', received: false });
		await screen.unmount();
	});
});
