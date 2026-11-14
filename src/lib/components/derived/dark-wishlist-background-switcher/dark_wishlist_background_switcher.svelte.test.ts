import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../app.css';
import * as m from '$lib/paraglide/messages.js';
import {
	DARK_WISHLIST_BACKGROUNDS,
	type DarkWishlistBackground,
} from '$lib/theme/dark_wishlist_background.js';

const { persistDarkWishlistBackgroundMock, setModeMock } = vi.hoisted(() => ({
	persistDarkWishlistBackgroundMock: vi.fn(),
	setModeMock: vi.fn(),
}));
vi.mock('$lib/modules/settings/settings.remote.js', () => ({
	setUserDarkWishlistBackground: persistDarkWishlistBackgroundMock,
	setUserDepthStyle: vi.fn(),
	setUserPalette: vi.fn(),
	updatePreferredLocale: vi.fn(),
}));
vi.mock('mode-watcher', () => ({
	userPrefersMode: { current: 'light' as const },
	setMode: setModeMock,
}));

const { default: DarkWishlistBackgroundSwitcher } =
	await import('./DarkWishlistBackgroundSwitcher.svelte');
const { default: SettingsAppearanceSection } =
	await import('$lib/components/blocks/settings/SettingsAppearanceSection.svelte');

const backgroundLabels: Record<DarkWishlistBackground, string> = {
	wishlist: m.dark_wishlist_background_wishlist(),
	app: m.dark_wishlist_background_app(),
	tint: m.dark_wishlist_background_tint(),
};

function deferredPromise() {
	let resolve!: () => void;
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

describe('DarkWishlistBackgroundSwitcher', () => {
	beforeEach(() => {
		persistDarkWishlistBackgroundMock.mockReset();
		persistDarkWishlistBackgroundMock.mockResolvedValue(undefined);
		document.documentElement.dataset.darkWishlistBackground = 'app';
		document.documentElement.dataset.depth = 'soft';
		document.documentElement.dataset.palette = 'grape';
	});

	afterEach(() => {
		delete document.documentElement.dataset.darkWishlistBackground;
		delete document.documentElement.dataset.depth;
		delete document.documentElement.dataset.palette;
	});

	it('renders the labelled group with the three named choices and the dark-mode-only hint', async () => {
		const screen = await render(DarkWishlistBackgroundSwitcher, {});

		const group = screen.getByRole('group', { name: m.dark_wishlist_background_label() });
		await expect.element(group).toBeVisible();
		expect(group.getByRole('radio').all()).toHaveLength(DARK_WISHLIST_BACKGROUNDS.length);
		for (const label of Object.values(backgroundLabels)) {
			await expect.element(screen.getByRole('radio', { name: label })).toBeVisible();
		}
		await expect.element(screen.getByText(m.dark_wishlist_background_help())).toBeVisible();
		await screen.unmount();
	});

	it('shows the document selection after mounting', async () => {
		document.documentElement.dataset.darkWishlistBackground = 'tint';

		const screen = await render(DarkWishlistBackgroundSwitcher, {});

		await expect
			.element(screen.getByRole('radio', { name: backgroundLabels.tint }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(screen.getByRole('radio', { name: backgroundLabels.app }))
			.toHaveAttribute('aria-checked', 'false');
		await screen.unmount();
	});

	it('optimistically applies and persists the selection and synchronizes mounted instances', async () => {
		const first = await render(DarkWishlistBackgroundSwitcher, {});
		const second = await render(DarkWishlistBackgroundSwitcher, {});
		const wishlistChoices = first.getByRole('radio', { name: backgroundLabels.wishlist }).all();

		await wishlistChoices[0]!.click();

		expect(document.documentElement.dataset.darkWishlistBackground).toBe('wishlist');
		expect(document.documentElement.dataset.depth).toBe('soft');
		expect(document.documentElement.dataset.palette).toBe('grape');
		expect(persistDarkWishlistBackgroundMock).toHaveBeenCalledWith('wishlist');
		await expect.element(wishlistChoices[1]!).toHaveAttribute('aria-checked', 'true');
		await first.unmount();
		await second.unmount();
	});

	it('serializes rapid persistence from separate instances in interaction order', async () => {
		const wishlistPersistence = deferredPromise();
		const tintPersistence = deferredPromise();
		persistDarkWishlistBackgroundMock
			.mockImplementationOnce(() => wishlistPersistence.promise)
			.mockImplementationOnce(() => tintPersistence.promise);
		const first = await render(DarkWishlistBackgroundSwitcher, {});
		const second = await render(DarkWishlistBackgroundSwitcher, {});
		const wishlistChoices = first.getByRole('radio', { name: backgroundLabels.wishlist }).all();
		const tintChoices = first.getByRole('radio', { name: backgroundLabels.tint }).all();

		await wishlistChoices[0]!.click();
		await tintChoices[1]!.click();

		expect(document.documentElement.dataset.darkWishlistBackground).toBe('tint');
		await expect.element(tintChoices[0]!).toHaveAttribute('aria-checked', 'true');
		expect(persistDarkWishlistBackgroundMock).toHaveBeenCalledTimes(1);
		expect(persistDarkWishlistBackgroundMock).toHaveBeenNthCalledWith(1, 'wishlist');

		wishlistPersistence.resolve();
		await vi.waitFor(() => {
			expect(persistDarkWishlistBackgroundMock).toHaveBeenCalledTimes(2);
		});
		expect(persistDarkWishlistBackgroundMock).toHaveBeenNthCalledWith(2, 'tint');
		tintPersistence.resolve();
		await first.unmount();
		await second.unmount();
	});

	it('continues queued persistence after an earlier save rejects', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			persistDarkWishlistBackgroundMock
				.mockRejectedValueOnce(new Error('save failed'))
				.mockResolvedValueOnce(undefined);
			const screen = await render(DarkWishlistBackgroundSwitcher, {});

			try {
				await screen.getByRole('radio', { name: backgroundLabels.wishlist }).click();
				await screen.getByRole('radio', { name: backgroundLabels.tint }).click();

				await vi.waitFor(() =>
					expect(persistDarkWishlistBackgroundMock).toHaveBeenCalledTimes(2),
				);
				expect(persistDarkWishlistBackgroundMock).toHaveBeenNthCalledWith(2, 'tint');
			} finally {
				await screen.unmount();
			}
		} finally {
			consoleError.mockRestore();
		}
	});

	it('cannot deselect the active choice', async () => {
		const screen = await render(DarkWishlistBackgroundSwitcher, {});
		const app = screen.getByRole('radio', { name: backgroundLabels.app });

		await app.click();

		await expect.element(app).toHaveAttribute('aria-checked', 'true');
		expect(document.documentElement.dataset.darkWishlistBackground).toBe('app');
		expect(persistDarkWishlistBackgroundMock).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('follows the depth control in the settings appearance section', async () => {
		const screen = await render(SettingsAppearanceSection, {});

		const depthGroup = screen.getByRole('group', { name: 'Hloubka a stíny' }).element();
		const backgroundGroup = screen
			.getByRole('group', { name: 'Pozadí seznamu v tmavém režimu' })
			.element();
		expect(
			depthGroup.compareDocumentPosition(backgroundGroup) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		await expect.element(screen.getByText('Platí jen v tmavém režimu.')).toBeVisible();
		await screen.unmount();
	});

	it('fits every full label inside the settings card content on a 375 px phone', async () => {
		await page.viewport(375, 667);
		// The settings card content at 375 px: viewport minus page gutters, card border and padding.
		const host = document.createElement('div');
		host.style.width = '299px';
		document.body.append(host);
		const screen = await render(DarkWishlistBackgroundSwitcher, {}, { baseElement: host });

		try {
			const hostBounds = host.getBoundingClientRect();
			expect(host.scrollWidth, 'switcher horizontal overflow').toBeLessThanOrEqual(
				host.clientWidth,
			);
			for (const label of Object.values(backgroundLabels)) {
				const choiceElement = screen.getByRole('radio', { name: label }).element();
				const choiceBounds = choiceElement.getBoundingClientRect();
				expect(choiceBounds.left, `${label} left edge`).toBeGreaterThanOrEqual(
					hostBounds.left - 1,
				);
				expect(choiceBounds.right, `${label} right edge`).toBeLessThanOrEqual(
					hostBounds.right + 1,
				);

				const labelText = document.createRange();
				labelText.selectNodeContents(choiceElement);
				const textBounds = labelText.getBoundingClientRect();
				expect(textBounds.left, `${label} text left edge`).toBeGreaterThanOrEqual(
					choiceBounds.left,
				);
				expect(textBounds.right, `${label} text right edge`).toBeLessThanOrEqual(
					choiceBounds.right,
				);
			}
		} finally {
			await screen.unmount();
			host.remove();
			await page.viewport(1280, 720);
		}
	});
});
