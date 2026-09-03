import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	expectShareMethodsStep,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';

test.describe('Wishlist page', () => {
	test('shows draft status chip and single share action for unshared wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-draft');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Draft');

		// Anime-sky redesign (#102, REQ-12): the full-width draft lifecycle strip is removed.
		// The unshared state is surfaced by the compact "Koncept" status chip in the header.
		await expect(
			page
				.getByRole('main')
				.locator(
					'[data-testid="wishlist-mobile-hero"]:visible, [data-testid="wishlist-banner"]:visible',
				)
				.getByText('Koncept'),
		).toBeVisible();
		await expect(page.getByText(/Tento seznam (je.t.|jeste) nebyl sd.len/i)).toHaveCount(0);

		// A single „Sdílet" action opens the share wizard (replacing the removed strips).
		await expect(
			page.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }).first(),
		).toBeVisible();

		await page.context().close();
	});

	test('view switcher offers card and list only', async ({ browser, request, baseURL }) => {
		const user = createTestUser('wl-views');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Views');
		// Locale-agnostic: GiftViewSwitcher labels are i18n'd (issue #154), so select via
		// stable data-testids rather than the (locale-dependent) accessible names.
		const cardBtn = page.getByTestId('gift-view-card');
		const listBtn = page.getByTestId('gift-view-list');
		const compactBtn = page.getByTestId('gift-view-compact');

		await expect(cardBtn).toHaveAttribute('aria-checked', 'true');

		await listBtn.click();
		await expect(listBtn).toHaveAttribute('aria-checked', 'true');

		await expect(compactBtn).toHaveCount(0);

		await page.context().close();
	});

	test('stationary pointer below settings does not hover or move toolbar selects', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-toolbar-hover-boundary');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.setViewportSize({ width: 1440, height: 900 });
		await createWishlistAndNavigate(page, 'Toolbar hover boundary');

		const toolbar = page.getByTestId('wishlist-toolbar');
		const settings = page.getByRole('button', { name: 'Nastavení seznamu' });
		const sort = toolbar.getByRole('button', { name: /Řadit podle/ });
		const grouping = toolbar.getByRole('button', { name: /Seskupení/ });
		await expect(settings).toBeVisible();
		await expect(sort).toBeVisible();
		await expect(grouping).toBeVisible();

		const settingsBox = await settings.boundingBox();
		expect(settingsBox).not.toBeNull();
		await page.mouse.move(
			settingsBox!.x + settingsBox!.width / 2,
			settingsBox!.y + settingsBox!.height + 10,
		);

		const groupingElement = await grouping.elementHandle();
		expect(groupingElement).not.toBeNull();
		const samples = await sort.evaluate(async (sortElement, groupingHandle) => {
			const groupingElement = groupingHandle as HTMLElement;
			const frames: Array<{
				sortY: number;
				groupingY: number;
				sortHovered: boolean;
				groupingHovered: boolean;
			}> = [];
			const startedAt = performance.now();

			do {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				frames.push({
					sortY: sortElement.getBoundingClientRect().y,
					groupingY: groupingElement.getBoundingClientRect().y,
					sortHovered: sortElement.matches(':hover'),
					groupingHovered: groupingElement.matches(':hover'),
				});
			} while (performance.now() - startedAt < 350);

			return frames;
		}, groupingElement!);

		const travel = (positions: number[]) => Math.max(...positions) - Math.min(...positions);
		expect(samples.every((sample) => !sample.sortHovered)).toBe(true);
		expect(samples.every((sample) => !sample.groupingHovered)).toBe(true);
		expect(travel(samples.map((sample) => sample.sortY))).toBeLessThanOrEqual(0.1);
		expect(travel(samples.map((sample) => sample.groupingY))).toBeLessThanOrEqual(0.1);

		await page.context().close();
	});

	test('first share visits methods before success and reopen starts at methods', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-share');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Share');
		await addGift(page, 'Share Test Gift');

		await page
			.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ })
			.first()
			.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await expect(
			dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }),
		).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Kopírovat' })).toHaveCount(0);

		await dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }).click();
		await expectShareMethodsStep(page);
		await expect(dialog.getByText(/Seznam byl sd.len!/i)).toHaveCount(0);
		await dialog.getByRole('button', { name: 'Hotovo' }).click();
		await expect(dialog.getByText(/Seznam byl sd.len!/i)).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('button', { name: 'Hotovo' }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });
		await waitForDialogOverlayRemoval(page);

		await expect(
			page
				.getByRole('main')
				.locator(
					'[data-testid="wishlist-mobile-hero"]:visible, [data-testid="wishlist-banner"]:visible',
				)
				.getByText(/Sd.leno|Sdileno/),
		).toBeVisible({ timeout: 5_000 });

		await page
			.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ })
			.first()
			.click();
		await expectShareMethodsStep(page);
		await expect(
			dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }),
		).toHaveCount(0);

		await page.context().close();
	});
});
