import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import BackgroundThemeChooser from './BackgroundThemeChooser.svelte';

const ROOT = document.documentElement;

// Locators target ARIA roles + the locale-independent `data-value` attribute,
// so the suite does not depend on the active UI language.

beforeEach(() => {
	ROOT.removeAttribute('data-bg-theme');
});

afterEach(() => {
	cleanup();
});

describe('BackgroundThemeChooser', () => {
	it('exposes all three background themes as a single-select radio group (REQ-1)', async () => {
		const screen = render(BackgroundThemeChooser, {
			value: 'default',
			onSave: vi.fn().mockResolvedValue(undefined),
		});

		await expect.element(screen.getByRole('radiogroup')).toBeInTheDocument();

		const radios = screen.getByRole('radio');
		expect(await radios.all()).toHaveLength(3);
		await expect.element(radios.nth(0)).toHaveAttribute('data-value', 'default');
		await expect.element(radios.nth(1)).toHaveAttribute('data-value', 'golden-hour');
		await expect.element(radios.nth(2)).toHaveAttribute('data-value', 'twilight');
	});

	it('applies the initial preference to data-bg-theme on the app root (REQ-3)', async () => {
		const screen = render(BackgroundThemeChooser, {
			value: 'twilight',
			onSave: vi.fn().mockResolvedValue(undefined),
		});

		await expect.poll(() => ROOT.getAttribute('data-bg-theme')).toBe('twilight');
		await expect
			.element(screen.getByRole('radio').nth(2))
			.toHaveAttribute('aria-checked', 'true');
	});

	it('selecting a theme applies it live and persists it (REQ-2, REQ-3)', async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const screen = render(BackgroundThemeChooser, { value: 'default', onSave });

		const classBefore = ROOT.className;
		await screen.getByRole('radio').nth(1).click();

		await expect.poll(() => ROOT.getAttribute('data-bg-theme')).toBe('golden-hour');
		expect(onSave).toHaveBeenCalledWith('golden-hour');
		// REQ-5: background theme drives only data-bg-theme, never the color-mode class.
		expect(ROOT.className).toBe(classBefore);
	});

	it('reverts the applied theme when persistence fails', async () => {
		const onSave = vi.fn().mockRejectedValue(new Error('network'));
		const screen = render(BackgroundThemeChooser, { value: 'default', onSave });

		await screen.getByRole('radio').nth(1).click();

		// Optimistically applied, then rolled back to the previous selection.
		await expect.poll(() => ROOT.getAttribute('data-bg-theme')).toBe('default');
		await expect
			.element(screen.getByRole('radio').nth(0))
			.toHaveAttribute('aria-checked', 'true');
	});
});
