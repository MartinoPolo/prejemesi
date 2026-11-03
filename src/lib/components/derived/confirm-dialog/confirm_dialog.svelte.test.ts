import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog.svelte';

function deferred() {
	let reject!: (reason: unknown) => void;
	const promise = new Promise<void>((_resolve, rejectPromise) => (reject = rejectPromise));
	return { promise, reject };
}

describe('ConfirmDialog', () => {
	it('keeps focus inside the dialog while the confirm runs and stays open when it rejects', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const confirmation = deferred();
		const screen = await render(ConfirmDialog, {
			open: true,
			title: 'Delete list',
			description: 'The list will be gone.',
			confirmLabel: 'Delete',
			confirmIntent: 'primary-destructive',
			onconfirm: () => confirmation.promise,
		});
		const confirmButton = screen.getByRole('button', { name: 'Delete' });
		const dialog = screen.getByRole('dialog');

		await confirmButton.click();
		await expect.element(confirmButton).toBeDisabled();
		expect(dialog.element().contains(document.activeElement)).toBe(true);

		confirmation.reject(new Error('server down'));
		await expect.element(confirmButton).toBeEnabled();
		await expect.element(dialog).toBeVisible();
		expect(dialog.element().contains(document.activeElement)).toBe(true);
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});
});
