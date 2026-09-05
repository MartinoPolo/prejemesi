import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GiftBulkCopyDialog from './GiftBulkCopyDialog.svelte';
import * as m from '$lib/paraglide/messages.js';

const destinations = [
	{
		id: 'destination',
		title: 'Narozeniny',
		status: 'active' as const,
		recipientDisplayName: 'Jana',
	},
];

function props() {
	return {
		open: true,
		destinations,
		selectedDestinationId: '',
		selectedCount: 2,
		onopenchange: vi.fn(),
		ondestinationchange: vi.fn(),
		onconfirm: vi.fn(),
	};
}

afterEach(async () => page.viewport(1280, 760));

describe('GiftBulkCopyDialog', () => {
	it('uses a desktop confirmation dialog and requires a destination', async () => {
		await page.viewport(1280, 760);
		const handlers = props();
		const screen = await render(GiftBulkCopyDialog, handlers);
		const dialog = screen.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		await expect.element(dialog).toBeVisible();
		await expect
			.element(dialog.getByRole('button', { name: m.gift_bulk_copy_confirm() }))
			.toBeDisabled();
		await dialog.getByLabelText(m.gift_bulk_copy_destination()).selectOptions('destination');
		expect(handlers.ondestinationchange).toHaveBeenCalledWith('destination');
		await screen.unmount();
	});

	it('restores confirm focus when a recoverable submission settles with the dialog open', async () => {
		await page.viewport(1280, 760);
		const handlers = { ...props(), selectedDestinationId: 'destination' };
		const screen = await render(GiftBulkCopyDialog, handlers);
		const confirm = screen
			.getByRole('button', { name: m.gift_bulk_copy_confirm() })
			.element() as HTMLButtonElement;
		confirm.focus();
		await screen.rerender({ ...handlers, submitting: true });
		expect(confirm).toBeDisabled();
		await screen.rerender({ ...handlers, submitting: false, open: true });
		await new Promise(requestAnimationFrame);
		expect(confirm).toHaveFocus();
		await screen.unmount();
	});

	it('reuses the bounded wishlist bottom sheet and exposes nested Back on narrow screens', async () => {
		await page.viewport(390, 760);
		const onback = vi.fn();
		const screen = await render(GiftBulkCopyDialog, {
			...props(),
			selectedDestinationId: 'destination',
			onback,
		});
		const dialog = screen.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		await expect.element(dialog).toBeVisible();
		expect(dialog.element()).toHaveClass('wishlist-bottom-sheet');
		expect(getComputedStyle(dialog.element()).bottom).toBe('0px');
		await dialog.getByRole('button', { name: m.gift_context_back() }).click();
		expect(onback).toHaveBeenCalledOnce();
		await screen.unmount();
	});
});
