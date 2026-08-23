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
});
