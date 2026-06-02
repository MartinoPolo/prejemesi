import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

// ── Shared helpers ────────────────────────────────────────────────────────────

async function createWishlistAndNavigate(page: Page, title: string) {
	await page.goto('/my-lists');
	await page.waitForLoadState('networkidle');
	await page
		.getByRole('button', { name: /Vytvořit/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('textbox', { name: 'Nazev' }).fill(title);
	await dialog.getByRole('button', { name: 'Vytvorit' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	await page.waitForLoadState('networkidle');
}

async function openAddGiftDialog(page: Page): Promise<ReturnType<Page['getByRole']>> {
	await page
		.getByRole('button', { name: /Pridat/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	return dialog;
}

// ── Gift creation ─────────────────────────────────────────────────────────────

test.describe('Gift creation', () => {
	test('creates gift with name only (minimal fields)', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-minimal');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Minimal Gift Test');
		const dialog = await openAddGiftDialog(page);

		await dialog.getByRole('textbox', { name: /Nazev/i }).fill('Minimální dárek');
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();

		await expect(page.getByText('Minimální dárek')).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});

	test('creates gift with all fields', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-full');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Full Gift Test');
		const dialog = await openAddGiftDialog(page);

		await dialog.getByRole('textbox', { name: /Nazev/i }).fill('Plný dárek');
		await dialog.getByRole('textbox', { name: /Popis/i }).fill('Testovací popis');
		await dialog.getByLabel(/Cena/).fill('1500');
		await dialog.locator('#gift-url').fill('https://example.com/gift');
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();

		await expect(page.getByText('Plný dárek')).toBeVisible({ timeout: 10_000 });
		// Price formatted via Intl.NumberFormat — "1 500 Kč" or similar depending on locale
		await expect(page.getByText(/1\s?500/)).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});

	test('normalizes partial URL (no protocol)', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-url-partial');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Partial URL Test');
		const dialog = await openAddGiftDialog(page);

		await dialog.getByRole('textbox', { name: /Nazev/i }).fill('Odkaz bez protokolu');
		await dialog.locator('#gift-url').fill('seznam.cz/produkt');
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();

		// Should not fail — gift must appear in the list
		await expect(page.getByText('Odkaz bez protokolu')).toBeVisible({ timeout: 10_000 });

		// Open the gift detail to verify the URL was saved and normalized
		await page.getByText('Odkaz bez protokolu').click();
		const detailDialog = page.getByRole('dialog');
		await expect(detailDialog).toBeVisible({ timeout: 5_000 });
		// The URL field should contain the normalized https:// value
		const urlInput = detailDialog.locator('#gift-url');
		await expect(urlInput).toHaveValue('https://seznam.cz/produkt');

		await page.context().close();
	});

	test('preserves http:// prefix without double-prepending', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gc-url-http');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'HTTP URL Test');
		const dialog = await openAddGiftDialog(page);

		await dialog.getByRole('textbox', { name: /Nazev/i }).fill('HTTP odkaz');
		await dialog.locator('#gift-url').fill('http://example.com');
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();

		await expect(page.getByText('HTTP odkaz')).toBeVisible({ timeout: 10_000 });

		// Open the gift detail to verify the URL was not double-prefixed
		await page.getByText('HTTP odkaz').click();
		const detailDialog = page.getByRole('dialog');
		await expect(detailDialog).toBeVisible({ timeout: 5_000 });
		const urlInput = detailDialog.locator('#gift-url');
		await expect(urlInput).toHaveValue('http://example.com');

		await page.context().close();
	});
});

// ── Gift image upload ─────────────────────────────────────────────────────────

test.describe('Gift image upload', () => {
	test('uploads image successfully', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-img-upload');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Image Upload Test');
		const dialog = await openAddGiftDialog(page);

		// Switch to Upload tab
		await dialog.getByRole('button', { name: /Nahrát/i }).click();

		// Wait for the file input to be present in the dialog
		const fileInput = dialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();

		// Monitor the upload request and set the file
		const uploadResponsePromise = page.waitForResponse(
			(response) =>
				response.request().method() === 'PUT' &&
				response.url().includes('/api/upload/') &&
				response.status() === 201,
			{ timeout: 15_000 },
		);

		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);

		// Wait for upload to complete (PUT 201 response)
		await uploadResponsePromise;

		// Preview image should appear (upload complete, progress bar gone)
		await expect(dialog.locator('img[alt="Upload preview"]')).toBeVisible({ timeout: 10_000 });

		// No error message should be shown
		await expect(dialog.locator('.text-destructive')).not.toBeVisible();

		// Fill in the gift name and submit
		await dialog.getByRole('textbox', { name: /Nazev/i }).fill('Dárek s obrázkem');
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();

		await expect(page.getByText('Dárek s obrázkem')).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});

	test('upload does not block form if skipped', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-img-skip');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Skip Upload Test');
		const dialog = await openAddGiftDialog(page);

		// Switch to Upload tab but do NOT upload anything
		await dialog.getByRole('button', { name: /Nahrát/i }).click();

		// Fill name and submit immediately without uploading
		await dialog.getByRole('textbox', { name: /Nazev/i }).fill('Dárek bez obrázku');
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();

		// Creation should succeed
		await expect(page.getByText('Dárek bez obrázku')).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});

// ── Gift list refresh after creation ─────────────────────────────────────────

test.describe('Gift list refresh after creation', () => {
	test('new gift appears without page reload', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-refresh');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Refresh Test');

		// Add first gift
		let dialog = await openAddGiftDialog(page);
		await dialog.getByRole('textbox', { name: /Nazev/i }).fill('První dárek');
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();
		await expect(page.getByText('První dárek')).toBeVisible({ timeout: 10_000 });

		// Add second gift — no reload between
		dialog = await openAddGiftDialog(page);
		await dialog.getByRole('textbox', { name: /Nazev/i }).fill('Druhý dárek');
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();
		await expect(page.getByText('Druhý dárek')).toBeVisible({ timeout: 10_000 });

		// Both gifts must be visible simultaneously without a reload
		await expect(page.getByText('První dárek')).toBeVisible();
		await expect(page.getByText('Druhý dárek')).toBeVisible();

		await page.context().close();
	});

	test('multiple rapid creations all appear', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-rapid');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Rapid Creation Test');

		const giftNames = ['Dárek A', 'Dárek B', 'Dárek C'];

		for (const giftName of giftNames) {
			const dialog = await openAddGiftDialog(page);
			await dialog.getByRole('textbox', { name: /Nazev/i }).fill(giftName);
			await dialog.getByRole('button', { name: 'Pridat darek' }).click();
			await expect(page.getByText(giftName)).toBeVisible({ timeout: 10_000 });
		}

		// All three must be visible at the same time
		for (const giftName of giftNames) {
			await expect(page.getByText(giftName)).toBeVisible();
		}

		await page.context().close();
	});
});
