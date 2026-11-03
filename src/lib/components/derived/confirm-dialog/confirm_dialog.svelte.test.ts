import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { getLocale, setLocale, type Locale } from '$lib/paraglide/runtime.js';
import ConfirmDialog, { CONFIRM_INTENTS, type ConfirmIntent } from './ConfirmDialog.svelte';

/** Every cancel and confirm label pair the app passes to ConfirmDialog. */
const APP_LABEL_PAIRS: ReadonlyArray<readonly [cancel: () => string, confirm: () => string]> = [
	[m.cancel, m.gift_hidden_selection_continue],
	[m.cancel, m.gift_recipient_change_warning_continue],
	[m.cancel, m.wishlist_archive_confirm_action],
	[m.cancel, m.wishlist_delete_confirm_action],
	[m.cancel, m.wishlist_revert_confirm_action],
	[m.cancel, m.settings_delete_confirm_button],
	[m.demo_cancel, m.demo_reset_confirm],
	[m.demo_cancel, m.demo_continue],
	[m.access_tokens_back, m.access_tokens_app_revoke_confirm],
	[m.access_tokens_back, m.access_tokens_revoke_confirm],
	[m.access_tokens_back, m.access_tokens_close_guard_confirm],
	[m.change_review_back_to_review, m.change_review_discard],
	[m.change_review_back_short, m.change_review_undo],
	[m.change_review_back_short, m.chat_undo],
];

/** The face paint each confirm intent must show, as resolved colour tokens. */
const INTENT_FACES: Record<ConfirmIntent, { background: string; border: string }> = {
	primary: { background: '--primary', border: '--ink' },
	danger: { background: '--card', border: '--status-danger' },
	'primary-destructive': { background: '--status-danger-fill', border: '--ink' },
};

function resolvedColor(scope: Element, token: string): string {
	const probe = document.createElement('span');
	probe.style.color = `var(${token})`;
	scope.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	return color;
}

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

describe('ConfirmDialog actions', () => {
	it.each(['cs', 'en'] satisfies Locale[])(
		'keeps every app %s cancel and confirm pair on one row from the smallest desktop width',
		async (locale) => {
			const originalLocale = getLocale();
			await page.viewport(640, 800);
			await setLocale(locale, { reload: false });
			try {
				for (const [cancelMessage, confirmMessage] of APP_LABEL_PAIRS) {
					const cancelLabel = cancelMessage();
					const confirmLabel = confirmMessage();
					const screen = await render(ConfirmDialog, {
						open: true,
						title: 'Confirm',
						description: 'Description',
						cancelLabel,
						confirmLabel,
						confirmIntent: 'primary-destructive',
						onconfirm: () => {},
					});
					const cancelRect = screen
						.getByRole('button', { name: cancelLabel, exact: true })
						.element()
						.getBoundingClientRect();
					const confirmRect = screen
						.getByRole('button', { name: confirmLabel, exact: true })
						.element()
						.getBoundingClientRect();
					const footerRect = document
						.querySelector('[data-slot="dialog-footer"]')!
						.getBoundingClientRect();
					const pair = `${cancelLabel} | ${confirmLabel}`;
					expect(confirmRect.top, pair).toBe(cancelRect.top);
					expect(cancelRect.right, pair).toBeLessThanOrEqual(confirmRect.left);
					expect(cancelRect.left, pair).toBeGreaterThanOrEqual(footerRect.left);
					expect(confirmRect.right, pair).toBeLessThanOrEqual(footerRect.right);
					await screen.unmount();
				}
			} finally {
				await setLocale(originalLocale, { reload: false });
			}
		},
	);

	it.each(CONFIRM_INTENTS)(
		'paints the %s confirm intent on the confirm button',
		async (intent) => {
			const screen = await render(ConfirmDialog, {
				open: true,
				title: 'Confirm',
				description: 'Description',
				confirmLabel: 'Go',
				confirmIntent: intent,
				onconfirm: () => {},
			});
			const dialog = screen.getByRole('dialog').element();
			const face = screen
				.getByRole('button', { name: 'Go', exact: true })
				.element()
				.querySelector('[data-slot="elevation-surface"]')!;
			const faceStyle = getComputedStyle(face);
			expect(faceStyle.backgroundColor).toBe(
				resolvedColor(dialog, INTENT_FACES[intent].background),
			);
			expect(faceStyle.borderTopColor).toBe(
				resolvedColor(dialog, INTENT_FACES[intent].border),
			);
		},
	);
});
