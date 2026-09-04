import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
		oncopy: vi.fn(),
		ondone: vi.fn(),
	};
}

function visibleChildren(element: HTMLElement) {
	return Array.from(element.children).filter(
		(child) => getComputedStyle(child).display !== 'none',
	);
}

describe('WishlistSelectionToolbar mobile bulk surface (#340)', () => {
	beforeEach(async () => page.viewport(390, 760));
	afterEach(async () => {
		document.body.style.minHeight = '';
		window.scrollTo(0, 0);
		await page.viewport(1280, 760);
	});

	it('uses one mobile row with an explicit label and right-grouped 40px actions', async () => {
		for (const width of [320, 360, 390]) {
			await page.viewport(width, 760);
			const screen = await render(WishlistSelectionToolbar, createProps());
			const region = screen.getByRole('region', { name: m.gift_selection_toolbar() });
			const element = region.element() as HTMLElement;
			const row = element.querySelector('.mobile-selection-row') as HTMLElement;
			expect(row).toHaveTextContent(
				`${m.gift_selection_mode_label()} · ${m.gift_selection_count({ count: 2 })}`,
			);
			const actions = row.querySelector('.mobile-selection-actions') as HTMLElement;
			await expect
				.element(screen.getByRole('checkbox', { name: m.gift_selection_visible_all() }))
				.toBeVisible();
			await expect
				.element(screen.getByRole('button', { name: m.gift_selection_actions() }))
				.toBeVisible();
			await expect.element(screen.getByRole('button', { name: m.cancel() })).toBeVisible();
			for (const target of actions.querySelectorAll<HTMLElement>(
				'button, [data-slot="checkbox"]',
			)) {
				expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
			}
			expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
			expect(actions.getBoundingClientRect().right).toBeCloseTo(
				row.getBoundingClientRect().right,
				1,
			);
			await screen.unmount();
		}
	});

	it('opens a bounded wishlist bottom sheet with every bulk field and mixed summaries', async () => {
		const screen = await render(WishlistSelectionToolbar, createProps());
		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		const dialog = screen.getByRole('dialog', { name: m.gift_selection_actions() });
		await expect.element(dialog).toBeVisible();
		const style = getComputedStyle(dialog.element());
		expect(style.bottom).toBe('0px');
		expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
		expect(parseFloat(style.borderLeftWidth)).toBeGreaterThan(0);
		expect(parseFloat(style.borderRightWidth)).toBeGreaterThan(0);
		expect(parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
		for (const heading of [
			m.gift_priority_label(),
			m.gift_context_category(),
			m.image_fit_label(),
			m.image_background_label(),
			m.gift_selection_received_state(),
		]) {
			await expect.element(dialog.getByText(new RegExp(heading))).toBeVisible();
		}
		expect(dialog.element()).toHaveTextContent(m.gift_selection_mixed());
		expect(
			Array.from(dialog.element().querySelectorAll('[type="radio"]')).some(
				(radio) => (radio as HTMLInputElement).checked,
			),
		).toBe(false);
		const scroll = screen.getByTestId('selection-bulk-sheet-scroll').element();
		expect(getComputedStyle(scroll).overflowY).toBe('auto');
		await expect
			.element(dialog.getByRole('button', { name: m.gift_bulk_copy() }))
			.toBeVisible();
		await screen.unmount();
	});

	it('checks common values and dispatches structured bulk actions', async () => {
		const props = {
			...createProps(),
			commonPriorityId: 'high',
			commonCategoryId: 'sport',
			commonImageFit: 'fit' as const,
			commonImageBackground: '#000000',
			commonReceived: true,
		};
		const screen = await render(WishlistSelectionToolbar, props);
		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		for (const name of [
			'Vysoká',
			'Sport',
			m.image_fit_fit(),
			m.image_background_black(),
			m.gift_mark_received(),
		]) {
			await expect.element(screen.getByRole('radio', { name })).toBeChecked();
		}
		await screen.getByRole('radio', { name: m.image_fit_fill() }).click();
		expect(props.onaction).toHaveBeenCalledWith({ action: 'imageFit', fit: 'fill' });
		await screen.getByRole('radio', { name: m.image_background_transparent() }).click();
		expect(props.onaction).toHaveBeenCalledWith({
			action: 'imageBackground',
			background: null,
		});
		await screen.getByRole('radio', { name: m.gift_mark_unreceived() }).click();
		expect(props.onaction).toHaveBeenCalledWith({ action: 'received', received: false });
		await screen.getByRole('radio', { name: m.gift_priority_none() }).click();
		expect(props.onpriority).toHaveBeenCalledWith(null);
		await screen.getByRole('radio', { name: m.gift_category_uncategorized() }).click();
		expect(props.oncategory).toHaveBeenCalledWith(null);
		await screen.unmount();
	});

	it('preserves loading, disabled, zero-selection, and pending behavior', async () => {
		const loading = await render(WishlistSelectionToolbar, {
			...createProps(),
			priorityReady: false,
			categoryReady: false,
		});
		await loading.getByRole('button', { name: m.gift_selection_actions() }).click();
		const loadingDialog = loading.getByRole('dialog', { name: m.gift_selection_actions() });
		expect(loadingDialog.element()).toHaveTextContent(m.moderator_loading());
		await expect
			.element(loadingDialog.getByRole('radio', { name: m.gift_priority_none() }))
			.toBeDisabled();
		await expect
			.element(loadingDialog.getByRole('radio', { name: m.gift_category_uncategorized() }))
			.toBeDisabled();
		await userEvent.keyboard('{Escape}');
		await loading.unmount();

		const empty = await render(WishlistSelectionToolbar, {
			...createProps(),
			selectedCount: 0,
			hiddenCount: 0,
			visibleState: 'none' as const,
		});
		await expect
			.element(empty.getByRole('button', { name: m.gift_selection_actions() }))
			.toBeDisabled();
		await expect.element(empty.getByRole('button', { name: m.cancel() })).toBeEnabled();
		await empty.unmount();

		const pending = await render(WishlistSelectionToolbar, {
			...createProps(),
			pending: { action: 'received' as const, count: 2 },
		});
		await expect
			.element(pending.getByRole('button', { name: m.gift_bulk_pending({ count: 2 }) }))
			.toBeDisabled();
		await expect.element(pending.getByRole('button', { name: m.cancel() })).toBeEnabled();
		await pending.unmount();
	});

	it('restores focus and page scroll on Escape and dispatches select-all plus Cancel', async () => {
		const props = createProps();
		const screen = await render(WishlistSelectionToolbar, props);
		const trigger = screen
			.getByRole('button', { name: m.gift_selection_actions() })
			.element() as HTMLButtonElement;
		document.body.style.minHeight = '200vh';
		window.scrollTo(0, 17);
		await new Promise(requestAnimationFrame);
		const scrollBefore = window.scrollY;
		await screen.getByRole('checkbox', { name: m.gift_selection_visible_all() }).click();
		expect(props.onselectvisible).toHaveBeenCalled();
		await trigger.click();
		await userEvent.keyboard('{Escape}');
		await new Promise(requestAnimationFrame);
		await new Promise(requestAnimationFrame);
		expect(document.activeElement).toBe(trigger);
		expect(window.scrollY).toBe(scrollBefore);
		await screen.getByRole('button', { name: m.cancel() }).click();
		expect(props.ondone).toHaveBeenCalledOnce();
		await screen.unmount();
		document.body.style.minHeight = '';
		window.scrollTo(0, 0);
	});
});

describe('WishlistSelectionToolbar desktop preservation (#340)', () => {
	beforeEach(async () => page.viewport(1280, 760));

	it('keeps the existing wide field controls and Done action', async () => {
		const screen = await render(WishlistSelectionToolbar, {
			...createProps(),
			commonPriorityId: 'high',
			commonCategoryId: 'sport',
			commonImageFit: 'fit' as const,
			commonImageBackground: '#000000',
			commonReceived: true,
		});
		const wide = screen.getByTestId('selection-wide-controls').element() as HTMLElement;
		wide.style.display = 'flex';
		expect(visibleChildren(wide)).toHaveLength(6);
		await expect
			.element(screen.getByRole('button', { name: m.gift_bulk_copy() }))
			.toBeVisible();
		await expect.element(screen.getByRole('button', { name: m.done() })).toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: `${m.gift_priority_label()}: Vysoká` }))
			.toBeVisible();
		await screen.unmount();
	});
});
