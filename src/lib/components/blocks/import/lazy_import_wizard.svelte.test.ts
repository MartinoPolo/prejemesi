import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { lazyComponent } from '$lib/components/derived/lazy-dialog/index.js';
import { WIZARD_MODE } from './import_wizard_types.js';
import ImportWizardFixture from './LazyImportWizardFixture.svelte';
import type ImportWizard from './ImportWizard.svelte';

const { default: LazyImportWizard } = await import('./LazyImportWizard.svelte');

interface WizardModule {
	default: typeof ImportWizard;
}

// The fixture stands in for the real wizard; only its props and open binding matter here.
function wizardLoader(loadWizard: () => Promise<{ default: typeof ImportWizardFixture }>) {
	return lazyComponent(loadWizard as unknown as () => Promise<WizardModule>);
}

describe('LazyImportWizard', () => {
	it('does not request the wizard while closed and announces loading after opening', async () => {
		let finishLoading!: (module: { default: typeof ImportWizardFixture }) => void;
		const loadWizard = vi.fn(
			() =>
				new Promise<{ default: typeof ImportWizardFixture }>((resolve) => {
					finishLoading = resolve;
				}),
		);
		const loader = wizardLoader(loadWizard);
		const screen = await render(LazyImportWizard, {
			open: false,
			mode: WIZARD_MODE.newList,
			loader,
		});

		expect(loadWizard).not.toHaveBeenCalled();
		await screen.rerender({ open: true, mode: WIZARD_MODE.newList, loader });
		await expect
			.element(screen.getByRole('status'))
			.toHaveTextContent(m.import_wizard_loading());
		expect(loadWizard).toHaveBeenCalledOnce();

		finishLoading({ default: ImportWizardFixture });
		await expect.element(screen.getByTestId('loaded-import-wizard')).toBeVisible();
	});

	it('offers a retry when the wizard chunk fails to load', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const loadWizard = vi
			.fn()
			.mockRejectedValueOnce(new Error('chunk unavailable'))
			.mockResolvedValue({ default: ImportWizardFixture });
		const screen = await render(LazyImportWizard, {
			open: true,
			mode: WIZARD_MODE.newList,
			loader: wizardLoader(loadWizard),
		});

		await expect
			.element(screen.getByRole('dialog', { name: m.dialog_load_error_title() }))
			.toBeVisible();
		await screen.getByRole('button', { name: m.dialog_retry() }).click();
		await expect.element(screen.getByTestId('loaded-import-wizard')).toBeVisible();
		expect(loadWizard).toHaveBeenCalledTimes(2);
		vi.restoreAllMocks();
	});

	it('offers a page reload fallback and logs the original chunk error', async () => {
		const failure = new Error('stale ESM chunk');
		const reloadPage = vi.fn();
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const screen = await render(LazyImportWizard, {
			open: true,
			mode: WIZARD_MODE.newList,
			loader: wizardLoader(vi.fn().mockRejectedValue(failure)),
			reloadPage,
		});

		await screen.getByRole('button', { name: m.dialog_reload() }).click();
		expect(reloadPage).toHaveBeenCalledOnce();
		expect(consoleError).toHaveBeenCalledWith(
			'[LazyDialog] lazy chunk failed to load',
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
			loader: wizardLoader(loadWizard),
		});

		await expect.element(screen.getByText('append|wishlist-1|Rodina|Kolo')).toBeVisible();
		await screen.getByRole('button', { name: 'succeed' }).click();
		expect(onsuccess).toHaveBeenCalledOnce();
		await screen.getByRole('button', { name: 'close' }).click();
		await expect.element(screen.getByTestId('loaded-import-wizard')).not.toBeInTheDocument();
	});
});
