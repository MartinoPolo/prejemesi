import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { getLocale, setLocale, type Locale } from '$lib/paraglide/runtime.js';
import UnsavedChangesDialog from './UnsavedChangesDialog.svelte';

const noop = () => {};

describe('UnsavedChangesDialog actions', () => {
	it.each(['cs', 'en'] satisfies Locale[])(
		'keeps all three %s actions on one row from the smallest desktop width',
		async (locale) => {
			const originalLocale = getLocale();
			await page.viewport(640, 800);
			await setLocale(locale, { reload: false });
			try {
				const screen = await render(UnsavedChangesDialog, {
					open: true,
					onsave: noop,
					ondiscard: noop,
					oncontinue: noop,
				});
				const actionRects = [
					m.unsaved_changes_continue_editing(),
					m.unsaved_changes_discard(),
					m.unsaved_changes_save_continue(),
				].map((name) =>
					screen
						.getByRole('button', { name, exact: true })
						.element()
						.getBoundingClientRect(),
				);
				const footerRect = document
					.querySelector('[data-slot="dialog-footer"]')!
					.getBoundingClientRect();
				for (const [index, rect] of actionRects.entries()) {
					expect(rect.top).toBe(actionRects[0]!.top);
					expect(rect.right).toBeLessThanOrEqual(footerRect.right);
					if (index > 0) {
						expect(actionRects[index - 1]!.right).toBeLessThanOrEqual(rect.left);
					}
				}
				expect(actionRects[0]!.left).toBeGreaterThanOrEqual(footerRect.left);
			} finally {
				await setLocale(originalLocale, { reload: false });
			}
		},
	);
});

describe('UnsavedChangesDialog save', () => {
	it('keeps focus inside the dialog while saving and stays open when the save rejects', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		let rejectSave!: (reason: unknown) => void;
		const oncontinue = vi.fn();
		const screen = await render(UnsavedChangesDialog, {
			open: true,
			onsave: () => new Promise<void>((_resolve, reject) => (rejectSave = reject)),
			ondiscard: noop,
			oncontinue,
		});
		const saveButton = screen.getByRole('button', {
			name: m.unsaved_changes_save_continue(),
			exact: true,
		});
		const dialog = screen.getByTestId('unsaved-changes-dialog');

		await saveButton.click();
		await expect.element(saveButton).toBeDisabled();
		expect(dialog.element().contains(document.activeElement)).toBe(true);

		rejectSave(new Error('server down'));
		await expect.element(saveButton).toBeEnabled();
		await expect.element(dialog).toBeVisible();
		expect(dialog.element().contains(document.activeElement)).toBe(true);
		expect(oncontinue).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});
});
