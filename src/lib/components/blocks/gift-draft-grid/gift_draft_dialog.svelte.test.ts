import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftDraftDialog } = await import('./GiftDraftDialog.svelte');

describe('GiftDraftDialog server duplicate acknowledgement', () => {
	it('keeps the batch dialog open with a visible retry acknowledgement warning', async () => {
		const screen = await render(GiftDraftDialog, {
			open: true,
			wishlistTitle: 'Rodina',
			serverDuplicateCount: 1,
			onsubmit: vi.fn(),
			onresetduplicatewarning: vi.fn(),
		});

		await expect.element(screen.getByRole('dialog')).toBeVisible();
		await expect
			.element(screen.getByText(m.batch_add_server_duplicates({ count: 1 })))
			.toBeVisible();
	});

	it('cancels an active row insertion when the batch dialog closes', async () => {
		const insertion = {
			cancel: vi.fn(),
			finished: new Promise<void>(() => {}),
			addEventListener: vi.fn(),
		} as unknown as Animation;
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockImplementation((_keyframes, options) =>
				(options as KeyframeAnimationOptions).duration === 520
					? insertion
					: ({
							cancel: vi.fn(),
							finished: Promise.resolve(),
							addEventListener: vi.fn(),
						} as unknown as Animation),
			);
		const screen = await render(GiftDraftDialog, {
			open: true,
			onsubmit: vi.fn(),
		});

		await screen.getByRole('button', { name: m.draft_grid_add_row() }).click();
		await vi.waitFor(() => expect(animate).toHaveBeenCalled());
		await screen.getByRole('button', { name: m.draft_grid_dialog_cancel() }).click();

		await vi.waitFor(() => expect(insertion.cancel).toHaveBeenCalledOnce());
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		animate.mockRestore();
	});
});
