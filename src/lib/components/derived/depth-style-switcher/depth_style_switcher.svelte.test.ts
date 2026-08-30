import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { DepthStyle } from '$lib/theme/depth_styles.js';

const { persistDepthMock, persistPaletteMock, updatePreferredLocaleMock, setModeMock } = vi.hoisted(
	() => ({
		persistDepthMock: vi.fn(),
		persistPaletteMock: vi.fn(),
		updatePreferredLocaleMock: vi.fn(),
		setModeMock: vi.fn(),
	}),
);
vi.mock('$lib/modules/settings/settings.remote.js', () => ({
	setUserDepthStyle: persistDepthMock,
	setUserPalette: persistPaletteMock,
	updatePreferredLocale: updatePreferredLocaleMock,
}));
vi.mock('mode-watcher', () => ({
	userPrefersMode: { current: 'light' as const },
	setMode: setModeMock,
}));

const { default: DepthStyleSwitcher } = await import('./DepthStyleSwitcher.svelte');
const { default: SettingsAppearanceSection } =
	await import('$lib/components/blocks/settings/SettingsAppearanceSection.svelte');
const { default: AppearanceMenu } =
	await import('$lib/components/derived/appearance-menu/AppearanceMenu.svelte');
const { default: MobileNav } = await import('$lib/components/blocks/navbar/MobileNav.svelte');

function deferredPromise() {
	let resolve!: () => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<void>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

const previewRecipes: Record<DepthStyle, { label: string; style: string }> = {
	soft: {
		label: m.depth_style_soft(),
		style: '--hard-shadow: var(--soft-shadow); --hard-shadow-strong: var(--soft-shadow-strong);',
	},
	ink: {
		label: m.depth_style_ink(),
		style: '--hard-shadow: var(--ink-shadow); --hard-shadow-strong: var(--ink-shadow-strong);',
	},
	black: {
		label: m.depth_style_black(),
		style: '--hard-shadow: var(--black-shadow); --hard-shadow-strong: var(--black-shadow-strong);',
	},
};

describe('DepthStyleSwitcher', () => {
	beforeEach(() => {
		persistDepthMock.mockReset();
		persistDepthMock.mockResolvedValue(undefined);
		persistPaletteMock.mockReset();
		persistPaletteMock.mockResolvedValue(undefined);
		updatePreferredLocaleMock.mockReset();
		updatePreferredLocaleMock.mockResolvedValue(undefined);
		setModeMock.mockReset();
		document.documentElement.dataset.depth = 'soft';
		document.documentElement.dataset.palette = 'grape';
	});

	it('renders exactly three name-only minimum-48px controlled choices with exact independent previews', async () => {
		const screen = await render(DepthStyleSwitcher, {});
		const choices = screen.getByRole('radio').all();
		expect(choices).toHaveLength(3);

		for (const { label, style } of Object.values(previewRecipes)) {
			const choice = screen.getByRole('radio', { name: label });
			await expect.element(choice).toHaveClass(/min-h-12/);
			await expect.element(choice).toHaveAttribute('style', style);
		}
		await screen.unmount();
	});

	it('shows the document depth selection after mounting without exposing the SSR default', async () => {
		document.documentElement.dataset.depth = 'black';

		const screen = await render(DepthStyleSwitcher, {});
		await expect
			.element(screen.getByRole('group', { name: m.depth_style_label() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('radio', { name: m.depth_style_black() }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(screen.getByRole('radio', { name: m.depth_style_soft() }))
			.toHaveAttribute('aria-checked', 'false');
		await screen.unmount();
	});

	it('optimistically persists selection and synchronizes mounted instances without changing palette', async () => {
		const first = await render(DepthStyleSwitcher, {});
		const second = await render(DepthStyleSwitcher, {});

		const inkChoices = first.getByRole('radio', { name: m.depth_style_ink() }).all();
		await inkChoices[0]!.click();

		expect(document.documentElement.dataset.depth).toBe('ink');
		expect(document.documentElement.dataset.palette).toBe('grape');
		expect(persistDepthMock).toHaveBeenCalledWith('ink');
		await expect.element(inkChoices[1]!).toHaveAttribute('aria-checked', 'true');
		await first.unmount();
		await second.unmount();
	});

	it('serializes persistence in click order while selection remains optimistic', async () => {
		const inkPersistence = deferredPromise();
		const blackPersistence = deferredPromise();
		persistDepthMock
			.mockImplementationOnce(() => inkPersistence.promise)
			.mockImplementationOnce(() => blackPersistence.promise);
		const screen = await render(DepthStyleSwitcher, {});

		await screen.getByRole('radio', { name: m.depth_style_ink() }).click();
		await screen.getByRole('radio', { name: m.depth_style_black() }).click();

		expect(document.documentElement.dataset.depth).toBe('black');
		await expect
			.element(screen.getByRole('radio', { name: m.depth_style_black() }))
			.toHaveAttribute('aria-checked', 'true');
		expect(persistDepthMock).toHaveBeenCalledTimes(1);
		expect(persistDepthMock).toHaveBeenNthCalledWith(1, 'ink');

		inkPersistence.resolve();
		await vi.waitFor(() => {
			expect(persistDepthMock).toHaveBeenCalledTimes(2);
		});
		expect(persistDepthMock).toHaveBeenNthCalledWith(2, 'black');
		blackPersistence.resolve();
		await screen.unmount();
	});

	it('cannot deselect the active choice', async () => {
		const screen = await render(DepthStyleSwitcher, {});
		const soft = screen.getByRole('radio', { name: m.depth_style_soft() });

		await soft.click();

		await expect.element(soft).toHaveAttribute('aria-checked', 'true');
		expect(persistDepthMock).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('exposes the named depth group in settings and palette changes preserve depth', async () => {
		const screen = await render(SettingsAppearanceSection, {});

		await expect.element(screen.getByRole('group', { name: 'Hloubka a stíny' })).toBeVisible();
		await screen.getByRole('button', { name: 'Máta' }).click();

		expect(document.documentElement.dataset.depth).toBe('soft');
		expect(persistPaletteMock).toHaveBeenCalledWith('mint');
		await screen.unmount();
	});

	it('shows the named depth group in the real appearance menu', async () => {
		const screen = await render(AppearanceMenu, {});

		await screen.getByRole('button', { name: m.settings_appearance_title() }).click();

		await expect.element(screen.getByRole('group', { name: 'Hloubka a stíny' })).toBeVisible();
		await screen.unmount();
	});

	it('shows the named depth group in the real mobile navigation drawer', async () => {
		await page.viewport(375, 667);
		const screen = await render(MobileNav, { navLinks: [] });

		await screen.getByRole('button', { name: m.nav_open_menu() }).click();

		await expect.element(screen.getByRole('group', { name: 'Hloubka a stíny' })).toBeVisible();
		await screen.unmount();
		await page.viewport(1280, 720);
	});
});
