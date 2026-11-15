import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LazyDialogFixture from './LazyDialogFixture.svelte';
import LoadedDialogFixture from './LoadedDialogFixture.svelte';
import { lazyComponent } from './lazy_component.svelte.js';
import * as m from '$lib/paraglide/messages.js';

interface LoadedModule {
	default: typeof LoadedDialogFixture;
}

function fixtureLoader(importDialog: () => Promise<LoadedModule>) {
	return lazyComponent(importDialog);
}

function deferredImport() {
	let resolveImport!: () => void;
	let rejectImport!: (error: Error) => void;
	const importDialog = vi.fn(
		() =>
			new Promise<LoadedModule>((resolve, reject) => {
				resolveImport = () => resolve({ default: LoadedDialogFixture });
				rejectImport = reject;
			}),
	);
	return {
		importDialog,
		resolveImport: () => resolveImport(),
		rejectImport: (error: Error) => rejectImport(error),
	};
}

function nextFrames(count = 2): Promise<void> {
	return new Promise((resolve) => {
		const step = (remaining: number) => {
			if (remaining === 0) {
				resolve();
				return;
			}
			requestAnimationFrame(() => step(remaining - 1));
		};
		step(count);
	});
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('LazyDialog', () => {
	it('mounts a dialog preloaded on intent while it is still closed', async () => {
		const importDialog = vi.fn().mockResolvedValue({ default: LoadedDialogFixture });
		const loader = fixtureLoader(importDialog);
		const screen = await render(LazyDialogFixture, { open: false, loader });

		expect(importDialog).not.toHaveBeenCalled();
		loader.preload();
		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'false');

		await screen.getByRole('button', { name: 'trigger' }).click();
		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'true');
		expect(importDialog).toHaveBeenCalledOnce();
	});

	it('mounts the first opened dialog closed, then opens it on the next frame', async () => {
		const { importDialog, resolveImport } = deferredImport();
		const screen = await render(LazyDialogFixture, {
			open: true,
			loader: fixtureLoader(importDialog),
		});

		resolveImport();
		const loadedDialog = screen.getByTestId('loaded-dialog');
		await expect.element(loadedDialog).toHaveAttribute('data-open', 'true');
		await expect.element(loadedDialog).toHaveAttribute('data-mounted-open', 'false');
	});

	it('keeps the opened dialog mounted after it closes through its own binding', async () => {
		const loader = fixtureLoader(vi.fn().mockResolvedValue({ default: LoadedDialogFixture }));
		const screen = await render(LazyDialogFixture, { open: true, loader });

		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'true');
		await screen.getByRole('button', { name: 'close' }).click();

		await expect.element(screen.getByTestId('host-open')).toHaveTextContent('false');
		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'false');
	});

	it('keeps one persistent status region and announces loading in it', async () => {
		const { importDialog, resolveImport } = deferredImport();
		const screen = await render(LazyDialogFixture, {
			open: false,
			loader: fixtureLoader(importDialog),
		});

		const status = screen.getByRole('status');
		await expect.element(status).toBeInTheDocument();
		await expect.element(status).toHaveTextContent('');
		const statusElement = status.element();

		await screen.getByRole('button', { name: 'trigger' }).click();
		await expect.element(status).toHaveTextContent(m.dialog_loading());
		expect(status.element()).toBe(statusElement);

		resolveImport();
		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'true');
		await expect.element(status).toHaveTextContent('');
		expect(status.element()).toBe(statusElement);
	});

	it('loads once when it is opened again while still loading', async () => {
		const { importDialog, resolveImport } = deferredImport();
		const loader = fixtureLoader(importDialog);
		const screen = await render(LazyDialogFixture, { open: true, loader });

		await expect.element(screen.getByRole('status')).toHaveTextContent(m.dialog_loading());
		await screen.rerender({ open: false, loader });
		await screen.rerender({ open: true, loader });
		resolveImport();

		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'true');
		expect(importDialog).toHaveBeenCalledOnce();
	});

	it('mounts the dialog closed when it is closed before the chunk arrives', async () => {
		const { importDialog, resolveImport } = deferredImport();
		const loader = fixtureLoader(importDialog);
		const screen = await render(LazyDialogFixture, { open: true, loader });

		await expect.element(screen.getByRole('status')).toHaveTextContent(m.dialog_loading());
		await screen.rerender({ open: false, loader });
		resolveImport();

		const loadedDialog = screen.getByTestId('loaded-dialog');
		await expect.element(loadedDialog).toHaveAttribute('data-open', 'false');
		await nextFrames();
		await expect.element(loadedDialog).toHaveAttribute('data-open', 'false');
		await expect.element(screen.getByTestId('host-open')).toHaveTextContent('false');
	});

	it('moves focus to Retry on a load failure and closes on Escape', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const failure = new Error('offline');
		const screen = await render(LazyDialogFixture, {
			open: false,
			loader: fixtureLoader(vi.fn().mockRejectedValue(failure)),
		});

		await screen.getByRole('button', { name: 'trigger' }).click();
		const errorDialog = screen.getByRole('dialog', { name: m.dialog_load_error_title() });
		await expect.element(errorDialog).toBeVisible();
		await expect.element(screen.getByRole('button', { name: m.dialog_retry() })).toHaveFocus();
		expect(consoleError).toHaveBeenCalledWith(
			'[LazyDialog] lazy chunk failed to load',
			failure,
		);

		await userEvent.keyboard('{Escape}');
		await expect.element(screen.getByTestId('host-open')).toHaveTextContent('false');
		await expect.element(errorDialog).not.toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: 'trigger' })).toHaveFocus();
	});

	it('retries from the error dialog and loads the dialog', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const importDialog = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue({ default: LoadedDialogFixture });
		const screen = await render(LazyDialogFixture, {
			open: true,
			loader: fixtureLoader(importDialog),
		});

		await screen.getByRole('button', { name: m.dialog_retry() }).click();
		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'true');
		expect(importDialog).toHaveBeenCalledTimes(2);
	});

	it('offers a page reload from the error dialog', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const reloadPage = vi.fn();
		const screen = await render(LazyDialogFixture, {
			open: true,
			loader: fixtureLoader(vi.fn().mockRejectedValue(new Error('stale chunk'))),
			reloadPage,
		});

		await screen.getByRole('button', { name: m.dialog_reload() }).click();
		expect(reloadPage).toHaveBeenCalledOnce();
	});

	it('retries the import when it is reopened after a failure', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const importDialog = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue({ default: LoadedDialogFixture });
		const loader = fixtureLoader(importDialog);
		const screen = await render(LazyDialogFixture, { open: true, loader });

		await expect
			.element(screen.getByRole('dialog', { name: m.dialog_load_error_title() }))
			.toBeVisible();
		await screen.rerender({ open: false, loader });
		await screen.rerender({ open: true, loader });

		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'true');
		expect(importDialog).toHaveBeenCalledTimes(2);
	});

	it('surfaces an intent preload failure only after opening', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const importDialog = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue({ default: LoadedDialogFixture });
		const loader = fixtureLoader(importDialog);
		const screen = await render(LazyDialogFixture, { open: false, loader });

		loader.preload();
		await vi.waitFor(() => expect(importDialog).toHaveBeenCalledOnce());
		expect(screen.getByRole('dialog').query()).toBeNull();

		await screen.getByRole('button', { name: 'trigger' }).click();
		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'true');
		expect(importDialog).toHaveBeenCalledTimes(2);
	});

	it('preloads in an idle period, not on mount', async () => {
		const idleCallbacks: Array<() => void> = [];
		vi.spyOn(window, 'requestIdleCallback').mockImplementation((callback) => {
			idleCallbacks.push(() => callback({ didTimeout: false, timeRemaining: () => 50 }));
			return idleCallbacks.length;
		});
		const importDialog = vi.fn().mockResolvedValue({ default: LoadedDialogFixture });
		const screen = await render(LazyDialogFixture, {
			open: false,
			loader: fixtureLoader(importDialog),
			preloadWhenIdle: true,
		});

		expect(importDialog).not.toHaveBeenCalled();
		expect(idleCallbacks).toHaveLength(1);
		idleCallbacks[0]();
		await expect
			.element(screen.getByTestId('loaded-dialog'))
			.toHaveAttribute('data-open', 'false');
		expect(importDialog).toHaveBeenCalledOnce();
	});
});
