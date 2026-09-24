import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { WIZARD_MODE } from './import_wizard_types.js';

const importRemotes = vi.hoisted(() => ({
	fetchGoogleSheetCsv: vi.fn(),
	importGifts: vi.fn(),
	createWishlistFromImport: vi.fn(),
}));

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/import/import.remote.js', () => importRemotes);

const { default: ImportWizard } = await import('./ImportWizard.svelte');

function pasteEvent(text: string): ClipboardEvent {
	const clipboardData = new DataTransfer();
	clipboardData.setData('text/plain', text);
	return new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData });
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('ImportWizard new-list title validation', () => {
	it('blocks blank and whitespace titles before advancing with a valid title', async () => {
		const screen = await render(ImportWizard, {
			open: true,
			mode: WIZARD_MODE.newList,
		});

		await screen.getByRole('radio', { name: m.import_wizard_source_paste() }).click();
		const pasteSurface = screen.getByPlaceholder(m.import_wizard_paste_placeholder());
		pasteSurface.element().dispatchEvent(pasteEvent('Name\tQuantity\nCamera\t1'));

		const titleInput = screen.getByLabelText(m.import_wizard_review_title_label());
		await expect.element(titleInput).toBeVisible();
		const nextButton = screen.getByRole('button', { name: m.import_wizard_next() });
		await vi.waitFor(() => expect(nextButton.element()).not.toBeDisabled());

		await nextButton.click();
		await expect.element(screen.getByText(m.wishlist_name_required())).toBeVisible();
		expect(
			screen.getByRole('button', { name: m.import_wizard_commit_new() }).elements(),
		).toHaveLength(0);

		await titleInput.fill('   ');
		await nextButton.click();
		await expect.element(screen.getByText(m.wishlist_name_required())).toBeVisible();
		expect(
			screen.getByRole('button', { name: m.import_wizard_commit_new() }).elements(),
		).toHaveLength(0);

		await titleInput.fill('Birthday gifts');
		await expect.element(screen.getByText(m.wishlist_name_required())).not.toBeInTheDocument();
		await nextButton.click();
		await expect
			.element(screen.getByRole('button', { name: m.import_wizard_commit_new() }))
			.toBeVisible();
	});
});
