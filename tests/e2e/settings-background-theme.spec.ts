import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

/**
 * Smoke coverage for issue #38 — app background theme setting.
 * Locators target the radiogroup by ARIA role and assert on the
 * locale-independent `data-bg-theme` attribute, so the test does not
 * depend on the active UI language.
 */
test.describe('Settings — app background theme', () => {
	test('select, apply, and persist a background theme', async ({ browser, request, baseURL }) => {
		const user = createTestUser('bg-theme');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/settings');
		await page.waitForLoadState('networkidle');

		const html = page.locator('html');
		// Fresh user defaults to the neutral theme (REQ, default selection).
		await expect(html).toHaveAttribute('data-bg-theme', 'default');

		const chooser = page.getByRole('radiogroup');
		await expect(chooser).toBeVisible();
		const options = chooser.getByRole('radio');
		await expect(options).toHaveCount(3);

		// Order matches BACKGROUND_THEMES: default, golden-hour, twilight.
		await options.nth(1).click();

		// Applied live on the app root (REQ-3).
		await expect(html).toHaveAttribute('data-bg-theme', 'golden-hour');

		// The "Saved" indicator only appears after the persist command resolves
		// (DB committed) — waiting for it avoids racing the reload against the write.
		await expect(chooser.locator('xpath=..').getByText(/uloženo|saved/i)).toBeVisible();

		// Persists across a full reload / new SSR render (REQ-2, REQ-3 production flow).
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(html).toHaveAttribute('data-bg-theme', 'golden-hour');

		await page.context().close();
	});
});
