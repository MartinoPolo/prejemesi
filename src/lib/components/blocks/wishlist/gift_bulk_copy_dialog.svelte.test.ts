import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { expectContentClearsOverlayClose } from '$lib/components/base/dialog/overlay_close_geometry.test_fixtures.js';
import GiftBulkCopyDialog from './GiftBulkCopyDialog.svelte';
import * as m from '$lib/paraglide/messages.js';

const { expectPixelsNear, expectPixelsAtMost } = createPixelAssertions(expect);

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

afterEach(async () => {
	delete document.documentElement.dataset.depth;
	await page.viewport(1280, 760);
});

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
		const destinationTrigger = dialog.getByLabelText(m.gift_bulk_copy_destination());
		await expect.element(destinationTrigger).toHaveAttribute('id', 'bulk-copy-destination');
		await vi.waitFor(() => {
			expectPixelsNear(destinationTrigger.element().getBoundingClientRect().height, 38);
		});
		const desktopTriggerWidth = destinationTrigger.element().getBoundingClientRect().width;
		const desktopConfirmWidth = dialog
			.getByRole('button', { name: m.gift_bulk_copy_confirm() })
			.element()
			.getBoundingClientRect().width;
		expectPixelsAtMost(desktopConfirmWidth, desktopTriggerWidth);
		await destinationTrigger.click();
		await screen.getByRole('option', { name: 'Narozeniny · Jana' }).click();
		expect(handlers.ondestinationchange).toHaveBeenCalledWith('destination');
		await screen.unmount();
	});

	it('supports keyboard selection and Escape without dismissing the parent dialog', async () => {
		await page.viewport(1280, 760);
		const handlers = props();
		const screen = await render(GiftBulkCopyDialog, handlers);
		const trigger = screen.getByTestId('bulk-copy-destination');
		await trigger.click();
		await userEvent.keyboard('{ArrowDown}{Enter}');
		expect(handlers.ondestinationchange).toHaveBeenCalledWith('destination');

		await trigger.click();
		await userEvent.keyboard('{Escape}');
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_bulk_copy_title() }))
			.toBeVisible();
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
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
		const shell = dialog.element();
		const shellRect = shell.getBoundingClientRect();
		const shellStyle = getComputedStyle(shell);
		expect(shellStyle.bottom).toBe('0px');
		expectPixelsNear(parseFloat(shellStyle.maxHeight), window.innerHeight * 0.8);
		expectPixelsNear(shellRect.left, window.innerWidth - shellRect.right);
		expect(shellRect.left).toBeGreaterThan(0);
		expect(shellStyle.borderLeftWidth).toBe(shellStyle.borderRightWidth);
		expect(shellStyle.borderLeftWidth).toBe(shellStyle.borderTopWidth);
		expect(shellStyle.borderTopLeftRadius).toBe(shellStyle.borderTopRightRadius);
		expect(parseFloat(shellStyle.borderTopLeftRadius)).toBeGreaterThan(0);
		const header = shell.querySelector<HTMLElement>('[data-slot="sheet-header"]')!;
		const headerStyle = getComputedStyle(header);
		expectPixelsNear(
			header.getBoundingClientRect().width,
			shellRect.width -
				parseFloat(shellStyle.borderLeftWidth) -
				parseFloat(shellStyle.borderRightWidth),
		);
		expect(headerStyle.paddingLeft).toBe('16px');
		expectContentClearsOverlayClose(
			header,
			shell.querySelector<HTMLElement>('[data-slot="sheet-close"]')!,
		);
		expect(headerStyle.paddingTop).toBe('12px');
		expect(headerStyle.paddingBottom).toBe('12px');
		expectPixelsNear(parseFloat(headerStyle.borderBottomWidth), 1);
		const body = header.nextElementSibling as HTMLElement;
		const bodyStyle = getComputedStyle(body);
		expect(bodyStyle.paddingLeft).toBe('8px');
		expect(bodyStyle.paddingRight).toBe('8px');
		expect(bodyStyle.paddingTop).toBe('8px');
		expect(bodyStyle.paddingBottom).toBe('8px');
		const triggerRect = dialog
			.getByTestId('bulk-copy-destination')
			.element()
			.getBoundingClientRect();
		const backButton = dialog.getByRole('button', { name: m.gift_context_back() });
		const backRect = backButton.element().getBoundingClientRect();
		const confirmRect = dialog
			.getByRole('button', { name: m.gift_bulk_copy_confirm() })
			.element()
			.getBoundingClientRect();
		expectPixelsNear(backRect.width, triggerRect.width);
		expectPixelsNear(confirmRect.width, triggerRect.width);
		expectPixelsNear(backRect.left, triggerRect.left);
		expectPixelsNear(confirmRect.left, triggerRect.left);
		await backButton.click();
		expect(onback).toHaveBeenCalledOnce();
		await screen.unmount();
	});

	it('offers no source removal for an occasion source wishlist', async () => {
		await page.viewport(1280, 760);
		const screen = await render(GiftBulkCopyDialog, props());
		const dialog = screen.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		await expect.element(dialog).toBeVisible();
		await expect
			.element(dialog.getByRole('checkbox', { name: m.gift_bulk_copy_remove_sources() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('lets a permanent source opt in to removing the copied unreserved gifts', async () => {
		await page.viewport(1280, 760);
		const onremovesourceschange = vi.fn();
		const screen = await render(GiftBulkCopyDialog, {
			...props(),
			selectedDestinationId: 'destination',
			offerSourceRemoval: true,
			onremovesourceschange,
		});
		const dialog = screen.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		const removal = dialog.getByRole('checkbox', { name: m.gift_bulk_copy_remove_sources() });
		await expect.element(removal).toBeVisible();
		await expect.element(removal).not.toBeChecked();
		await expect
			.element(removal)
			.toHaveAccessibleDescription(m.gift_bulk_copy_remove_sources_help());
		await expect.element(dialog.getByText(m.gift_bulk_copy_description())).toBeVisible();

		await removal.click();
		expect(onremovesourceschange).toHaveBeenCalledWith(true);
		await screen.unmount();
	});

	it('copies without requesting source removal while the permanent-source checkbox stays unchecked', async () => {
		await page.viewport(1280, 760);
		const handlers = {
			...props(),
			selectedDestinationId: 'destination',
			offerSourceRemoval: true,
			removeSources: false,
			onremovesourceschange: vi.fn(),
		};
		const screen = await render(GiftBulkCopyDialog, handlers);
		const dialog = screen.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		await expect
			.element(dialog.getByRole('checkbox', { name: m.gift_bulk_copy_remove_sources() }))
			.not.toBeChecked();

		await dialog.getByRole('button', { name: m.gift_bulk_copy_confirm() }).click();

		expect(handlers.onconfirm).toHaveBeenCalledOnce();
		expect(handlers.onremovesourceschange).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it.each([
		['desktop dialog', 1280],
		['mobile sheet', 390],
	])('names the move once source removal is chosen (%s)', async (_surface, viewportWidth) => {
		await page.viewport(viewportWidth, 760);
		const screen = await render(GiftBulkCopyDialog, {
			...props(),
			selectedDestinationId: 'destination',
			offerSourceRemoval: true,
			removeSources: true,
			onremovesourceschange: vi.fn(),
		});
		const dialog = screen.getByRole('dialog', { name: m.gift_bulk_copy_move_title() });
		await expect.element(dialog).toBeVisible();
		await expect
			.element(dialog.getByRole('checkbox', { name: m.gift_bulk_copy_remove_sources() }))
			.toBeChecked();
		await expect.element(dialog.getByText(m.gift_bulk_copy_move_description())).toBeVisible();
		await expect
			.element(dialog.getByText(m.gift_bulk_copy_description()))
			.not.toBeInTheDocument();
		await expect
			.element(dialog.getByRole('button', { name: m.gift_bulk_copy_move_confirm() }))
			.toBeEnabled();
		await expect
			.element(dialog.getByRole('button', { name: m.gift_bulk_copy_confirm() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('keeps the copy wording while source removal is offered but not chosen', async () => {
		await page.viewport(1280, 760);
		const screen = await render(GiftBulkCopyDialog, {
			...props(),
			selectedDestinationId: 'destination',
			offerSourceRemoval: true,
			removeSources: false,
			onremovesourceschange: vi.fn(),
		});
		const dialog = screen.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		await expect.element(dialog).toBeVisible();
		await expect
			.element(dialog.getByRole('button', { name: m.gift_bulk_copy_confirm() }))
			.toBeEnabled();
		await screen.unmount();
	});

	it.each(['soft', 'ink', 'black'] as const)(
		'keeps the narrow sheet header clear of the close button at %s depth',
		async (depth) => {
			document.documentElement.dataset.depth = depth;
			await page.viewport(390, 760);
			const screen = await render(GiftBulkCopyDialog, props());
			const dialog = screen.getByRole('dialog', { name: m.gift_bulk_copy_title() });
			await expect.element(dialog).toBeVisible();
			const shell = dialog.element();

			expectContentClearsOverlayClose(
				shell.querySelector<HTMLElement>('[data-slot="sheet-header"]')!,
				shell.querySelector<HTMLElement>('[data-slot="sheet-close"]')!,
			);
			await screen.unmount();
		},
	);
});
