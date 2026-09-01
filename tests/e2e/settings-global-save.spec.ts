import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

async function openSettings(page: Awaited<ReturnType<typeof registerAndGetPage>>) {
	await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
	const dialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe('wishlist settings global save', () => {
	test('tablet layout keeps horizontal tabs, fixed scrolling content, and Save on every tab', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('settings-global-layout'),
		);
		await createWishlistAndNavigate(page, 'Globální nastavení');
		await page.setViewportSize({ width: 760, height: 420 });
		const dialog = await openSettings(page);
		const tabs = dialog.getByRole('tablist');
		expect(await tabs.getAttribute('aria-orientation')).toBe('horizontal');
		expect(await tabs.evaluate((node) => getComputedStyle(node).flexWrap)).toBe('nowrap');
		expect(await tabs.evaluate((node) => getComputedStyle(node).overflowX)).toBe('auto');
		const tabBoxes = await tabs
			.getByRole('tab')
			.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
		expect(new Set(tabBoxes.map((box) => Math.round(box.y))).size).toBe(1);
		expect(Math.max(...tabBoxes.map((box) => box.height))).toBeLessThan(60);

		const content = dialog.getByTestId('wishlist-settings-scroll-region');
		const footer = dialog.getByTestId('wishlist-settings-footer');
		expect(await content.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto');
		const footerY = (await footer.boundingBox())!.y;
		for (const tabName of ['Import a export', 'Nebezpečná zóna']) {
			await dialog.getByRole('tab', { name: tabName }).click();
			await expect(footer.getByRole('button', { name: 'Uložit' })).toBeVisible();
			expect((await footer.boundingBox())!.y).toBeCloseTo(footerY, 0);
		}
		await page.context().close();
	});

	test('drafts survive tabs, palette discards locally, and successful global Save closes', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('settings-global-draft'),
		);
		await createWishlistAndNavigate(page, 'Původní název');
		let dialog = await openSettings(page);
		await dialog.getByLabel('Název seznamu').fill('Sdílený koncept');
		await dialog.getByRole('tab', { name: 'Vzhled' }).click();
		await dialog.getByRole('button', { name: 'Oceán' }).click();
		await dialog.getByRole('tab', { name: 'Podrobnosti' }).click();
		await expect(dialog.getByLabel('Název seznamu')).toHaveValue('Sdílený koncept');

		await dialog.getByRole('button', { name: 'Zavřít' }).click();
		await page.getByRole('button', { name: 'Pokračovat v úpravách' }).click();
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Zavřít' }).click();
		await page.getByRole('button', { name: 'Zahodit změny' }).click();
		await expect(dialog).not.toBeVisible();

		dialog = await openSettings(page);
		await expect(dialog.getByLabel('Název seznamu')).toHaveValue('Původní název');
		await dialog.getByRole('tab', { name: 'Vzhled' }).click();
		await expect(dialog.getByRole('button', { name: 'Obloha' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await dialog.getByRole('button', { name: 'Oceán' }).click();
		await dialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(dialog).not.toBeVisible();
		dialog = await openSettings(page);
		await dialog.getByRole('tab', { name: 'Vzhled' }).click();
		await expect(dialog.getByRole('button', { name: 'Oceán' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await page.context().close();
	});
});
