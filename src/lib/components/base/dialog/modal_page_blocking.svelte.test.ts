import '../../../../app.css';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { toast } from 'svelte-sonner';
import DialogTestFixture from './dialog_test_fixture.svelte';
import SheetContentTestHost from '../sheet/SheetContentTestHost.svelte';
import AppToaster from '../toast/AppToaster.svelte';

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

		await expect.element(content).not.toBeInTheDocument();
		await expect.poll(() => document.querySelector(`[data-slot="${overlaySlot}"]`)).toBeNull();
		expect(document.body.style.pointerEvents).toBe('');
		expect(toastPointerEvents()).toBe('auto');
		toast.dismiss();
	});
});
