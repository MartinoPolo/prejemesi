import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import ImportConfirmStep from './ImportConfirmStep.svelte';
import { COMMIT_STATUS, WIZARD_MODE } from './import_wizard_types.js';
import type { ValidatedGiftDraft } from '$lib/modules/gifts/gift_draft.js';
import * as m from '$lib/paraglide/messages.js';

const draft = {
	name: 'Camera',
	description: null,
	links: [],
	price: null,
	priceMax: null,
	currency: 'CZK',
	imageUrl: null,
	quantity: 1,
	priority: 'medium',
} as ValidatedGiftDraft;

describe('ImportConfirmStep server duplicate acknowledgement', () => {
	it('shows the server warning and leaves an explicit commit button available', async () => {
		const oncommit = vi.fn(async () => ({ shortId: '' }));
		const screen = await render(ImportConfirmStep, {
			mode: WIZARD_MODE.append,
			selectedDrafts: [draft],
			wishlistTitle: 'Rodina',
			duplicateCount: 0,
			serverDuplicateCount: 2,
			oncommit,
			commitStatus: COMMIT_STATUS.idle,
		});

		await expect
			.element(screen.getByText(m.import_wizard_server_duplicates({ count: 2 })))
			.toBeVisible();
		await screen.getByRole('button', { name: m.import_wizard_commit_append() }).click();
		expect(oncommit).toHaveBeenCalledOnce();
	});
});
