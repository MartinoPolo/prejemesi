import '../../../../app.css';
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { toast } from 'svelte-sonner';
import DialogTestFixture from './dialog_test_fixture.svelte';
import SheetContentTestHost from '../sheet/SheetContentTestHost.svelte';
import AppToaster from '../toast/AppToaster.svelte';
import ModalPageBlockerTestFixture from '../modal_page_blocker_test_fixture.svelte';

const PAGE_POINT = { x: 2, y: 2 };

function slotAtPagePoint(): string | null | undefined {
	return document.elementFromPoint(PAGE_POINT.x, PAGE_POINT.y)?.getAttribute('data-slot');
}

describe.each([
	{
		name: 'Dialog',
		overlaySlot: 'dialog-overlay',
		open: () => render(DialogTestFixture, { title: 'Blocking' }),
	},
	{
		name: 'Sheet',
		overlaySlot: 'sheet-overlay',
		open: () => render(SheetContentTestHost, { side: 'bottom' }),
	},
])('$name page blocking', ({ overlaySlot, open }) => {
	it('blocks the page and toasts through its overlay until the exit ends, without restyling body', async () => {
		render(AppToaster);
		toast('Saved');
		const toastElement = page.getByText('Saved');
		await expect.element(toastElement).toBeVisible();
		const toastPointerEvents = () => getComputedStyle(toastElement.element()).pointerEvents;
		expect(toastPointerEvents()).toBe('auto');

		open();
		const content = page.getByRole('dialog');
		await expect.element(content).toBeVisible();
		expect(document.body.style.pointerEvents).toBe('');
		expect(slotAtPagePoint()).toBe(overlaySlot);
		expect(toastPointerEvents()).toBe('none');

		// Dispatched in-page: a driver round trip can outlast the whole exit animation.
		document.activeElement?.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
		);
		await expect.element(content).toHaveAttribute('data-state', 'closed');
		expect(slotAtPagePoint()).toBe(overlaySlot);
		const closingContent = content.element();
		while (
			closingContent.isConnected &&
			Number(getComputedStyle(closingContent).opacity) > 0.5
		) {
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		expect(closingContent.isConnected, 'the exit is observed midway').toBe(true);
		expect(slotAtPagePoint()).toBe(overlaySlot);
		expect(document.body.style.pointerEvents).toBe('');

		await expect.element(content).not.toBeInTheDocument();
		await expect.poll(() => document.querySelector(`[data-slot="${overlaySlot}"]`)).toBeNull();
		expect(document.body.style.pointerEvents).toBe('');
		expect(toastPointerEvents()).toBe('auto');
		toast.dismiss();
	});
});

describe.each([
	{ layer: 'menu' as const, role: 'menu' as const },
	{ layer: 'select' as const, role: 'listbox' as const },
])('modal $layer page blocking', ({ layer, role }) => {
	it('blocks the page through a blocker layer until the exit ends, without restyling body', async () => {
		render(ModalPageBlockerTestFixture, { layer });
		const surface = page.getByRole(role);
		await expect.element(surface).toBeVisible();
		expect(document.body.style.pointerEvents).toBe('');
		expect(slotAtPagePoint()).toBe('modal-page-blocker');

		const closingSurface = surface.element();
		closingSurface.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
		);
		while (
			closingSurface.isConnected &&
			Number(getComputedStyle(closingSurface).opacity) > 0.9
		) {
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		expect(closingSurface.isConnected, 'the exit is observed midway').toBe(true);
		expect(slotAtPagePoint()).toBe('modal-page-blocker');
		expect(document.body.style.pointerEvents).toBe('');

		await expect.element(surface).not.toBeInTheDocument();
		expect(document.querySelector('[data-slot="modal-page-blocker"]')).toBeNull();
		expect(document.body.style.pointerEvents).toBe('');
	});

	it('keeps the surrounding dialog interactive, and open when dismissed from outside', async () => {
		render(ModalPageBlockerTestFixture, { layer, insideDialog: true });
		const surface = page.getByRole(role);
		await expect.element(surface).toBeVisible();
		expect(document.body.style.pointerEvents).toBe('');
		const dialogControl = page.getByTestId('dialog-control').element();
		const { left, top, width, height } = dialogControl.getBoundingClientRect();
		expect(document.elementFromPoint(left + width / 2, top + height / 2)).toBe(dialogControl);

		expect(slotAtPagePoint()).toBe('dialog-overlay');
		const overlay = document.querySelector('[data-slot="dialog-overlay"]');
		if (overlay === null) {
			throw new Error('dialog overlay missing');
		}
		await userEvent.click(page.elementLocator(overlay), { position: PAGE_POINT });
		await expect.element(surface).not.toBeInTheDocument();
		await expect.element(page.getByRole('dialog')).toBeVisible();
	});
});
