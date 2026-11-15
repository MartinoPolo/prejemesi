import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import LazyDialogFixture from './LazyDialogFixture.svelte';
import LoadedDialogFixture from './LoadedDialogFixture.svelte';
import { lazyComponent } from './lazy_component.svelte.js';
import * as m from '$lib/paraglide/messages.js';

describe('LazyDialog', () => {
	it('mounts a dialog preloaded on intent while it is still closed', async () => {
		const importDialog = vi.fn().mockResolvedValue({ default: LoadedDialogFixture });
		const loader = lazyComponent(importDialog);
		const screen = await render(LazyDialogFixture, { open: false, loader });

		expect(importDialog).not.toHaveBeenCalled();
		loader.preload();
		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'false');

		await screen.rerender({ open: true, loader });
		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'true');
		expect(screen.getByRole('status').query()).toBeNull();
		expect(importDialog).toHaveBeenCalledOnce();
	});

	it('keeps the opened dialog mounted after it closes through its own binding', async () => {
		const loader = lazyComponent(vi.fn().mockResolvedValue({ default: LoadedDialogFixture }));
		const screen = await render(LazyDialogFixture, { open: true, loader });

		await expect.element(screen.getByText('Nastavení')).toBeVisible();
		await screen.getByRole('button', { name: 'close' }).click();

		await expect.element(screen.getByTestId('host-open')).toHaveTextContent('false');
		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'false');
	});

	it('surfaces an intent preload failure only after opening, then retries', async () => {
		const importDialog = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockRejectedValueOnce(new Error('still offline'))
			.mockResolvedValue({ default: LoadedDialogFixture });
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const loader = lazyComponent(importDialog);
		const screen = await render(LazyDialogFixture, { open: false, loader });

		loader.preload();
		await vi.waitFor(() => expect(importDialog).toHaveBeenCalledOnce());
		expect(screen.getByRole('alert').query()).toBeNull();

		await screen.rerender({ open: true, loader });
		await expect.element(screen.getByRole('alert')).toBeVisible();
		await screen.getByRole('button', { name: m.import_wizard_retry() }).click();
		await expect.element(screen.getByTestId('loaded-dialog')).toBeVisible();
		expect(importDialog).toHaveBeenCalledTimes(3);
		consoleError.mockRestore();
	});
});
