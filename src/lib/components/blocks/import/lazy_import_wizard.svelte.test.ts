import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { WIZARD_MODE } from './import_wizard_types.js';
import ImportWizardFixture from './LazyImportWizardFixture.svelte';

const { default: LazyImportWizard } = await import('./LazyImportWizard.svelte');

describe('LazyImportWizard', () => {
	it('does not request the wizard while closed and exposes loading status after opening', async () => {
		let finishLoading!: (module: { default: typeof ImportWizardFixture }) => void;
		const loadWizard = vi.fn(
			() =>
				new Promise<{ default: typeof ImportWizardFixture }>((resolve) => {
					finishLoading = resolve;
				}),
		);
		const screen = await render(LazyImportWizard, {
			open: false,
			mode: WIZARD_MODE.newList,
			loadWizard,
		});

		expect(loadWizard).not.toHaveBeenCalled();
		await screen.rerender({ open: true, mode: WIZARD_MODE.newList, loadWizard });
		await expect
			.element(screen.getByRole('status'))
			.toHaveAccessibleName(m.import_wizard_loading());
		expect(loadWizard).toHaveBeenCalledOnce();

		finishLoading({ default: ImportWizardFixture });
		await expect.element(screen.getByTestId('loaded-import-wizard')).toBeVisible();
	});

	it('offers a retry when the wizard chunk fails to load', async () => {
		const loadWizard = vi
			.fn()
			.mockRejectedValueOnce(new Error('chunk unavailable'))
			.mockResolvedValue({ default: ImportWizardFixture });
		const screen = await render(LazyImportWizard, {
			open: true,
			mode: WIZARD_MODE.newList,
			loadWizard,
		});

		await expect.element(screen.getByRole('alert')).toBeVisible();
		await screen.getByRole('button', { name: m.import_wizard_retry() }).click();
		await expect.element(screen.getByTestId('loaded-import-wizard')).toBeVisible();
		expect(loadWizard).toHaveBeenCalledTimes(2);
	});

	it('offers a page reload fallback and logs the original chunk error', async () => {
		const failure = new Error('stale ESM chunk');
		const reloadPage = vi.fn();
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const screen = await render(LazyImportWizard, {
			open: true,
			mode: WIZARD_MODE.newList,
			loadWizard: vi.fn().mockRejectedValue(failure),
			reloadPage,
		});

		await screen.getByRole('button', { name: m.import_wizard_reload() }).click();
		expect(reloadPage).toHaveBeenCalledOnce();
		expect(consoleError).toHaveBeenCalledWith(
			'[ImportWizard] lazy chunk failed to load',
			failure,
		);
		consoleError.mockRestore();
	});

	it('forwards wizard props and callbacks while preserving the open binding', async () => {
		const onsuccess = vi.fn();
		const loadWizard = vi.fn().mockResolvedValue({ default: ImportWizardFixture });
		const screen = await render(LazyImportWizard, {
			open: true,
			mode: WIZARD_MODE.append,
			wishlistId: 'wishlist-1',
			wishlistTitle: 'Rodina',
			existingGifts: [{ name: 'Kolo', links: [] }],
			onsuccess,
			loadWizard,
		});

		await expect.element(screen.getByText('append|wishlist-1|Rodina|Kolo')).toBeVisible();
		await screen.getByRole('button', { name: 'succeed' }).click();
		expect(onsuccess).toHaveBeenCalledOnce();
		await screen.getByRole('button', { name: 'close' }).click();
		await expect.element(screen.getByTestId('loaded-import-wizard')).not.toBeInTheDocument();
	});
});
