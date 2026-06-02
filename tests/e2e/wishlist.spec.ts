import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

async function createWishlistAndNavigate(page: Page, title: string) {
	await page.goto('/my-lists');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
	await page.getByRole('button', { name: /Vytvo.it seznam|Vytvorit seznam/ }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('textbox', { name: /N.zev|Nazev/i }).fill(title);
	await dialog.getByRole('button', { name: /Vytvo.it|Vytvorit/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
		timeout: 10_000,
	});
	await page.waitForLoadState('networkidle');
}

test.describe('Wishlist page', () => {
	test('shows draft banner for unshared wishlist', async ({ browser, request, baseURL }) => {
		const user = createTestUser('wl-draft');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Draft');
		await expect(page.getByText(/Tento seznam (je.t.|jeste) nebyl sd.len/i)).toBeVisible();
		await expect(page.getByRole('main').getByText('Koncept')).toBeVisible();

		await page.context().close();
	});

	test('view switcher toggles between card/list/compact', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-views');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Views');
		const cardBtn = page.getByRole('button', { name: 'Karta' });
		const listBtn = page.getByRole('button', { name: 'Seznam', exact: true });
		const compactBtn = page.getByRole('button', { name: 'Kompakt' });

		await expect(cardBtn).toHaveAttribute('aria-pressed', 'true');

		await listBtn.click();
		await expect(listBtn).toHaveAttribute('aria-pressed', 'true');

		await compactBtn.click();
		await expect(compactBtn).toHaveAttribute('aria-pressed', 'true');

		await page.context().close();
	});

	test('share wizard completes three steps', async ({ browser, request, baseURL }) => {
		const user = createTestUser('wl-share');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Share');

		await page
			.getByRole('button', {
				name: /P.idat p..n.|Pridat prani|P.idat d.rek|Pridat darek/,
			})
			.first()
			.click();
		let dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 10_000 });
		await dialog.getByRole('textbox', { name: /N.zev|Nazev/i }).fill('Share Test Gift');
		await dialog.getByRole('button', { name: /P.idat d.rek|Pridat darek/ }).click();
		await expect(page.getByText('Share Test Gift')).toBeVisible({ timeout: 5_000 });

		await page
			.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ })
			.first()
			.click();
		dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		await dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }).click();

		await expect(dialog.getByText(/Seznam byl sd.len!/i)).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('button', { name: 'Hotovo' }).click();

		await expect(page.getByRole('main').getByText(/Sd.leno|Sdileno/)).toBeVisible({
			timeout: 5_000,
		});

		await page.context().close();
	});
});
