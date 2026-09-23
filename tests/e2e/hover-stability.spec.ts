import { expect, test } from '@playwright/test';
import { loginViaApi } from './fixtures/auth-helpers.js';
import {
	BROWSER_ZOOMS,
	bottomToTopSweep,
	expectSafeClick,
	expectStableLift,
	launchZoomableContext,
	setRealBrowserZoom,
	stationaryLowerEdge,
} from './hover-stability.helpers.js';

const REPRESENTATIVE_DEPTH = 'soft';

test.describe('Issue #346 stable hover hit regions', () => {
	test.describe.configure({ mode: 'default', timeout: 180_000 });

	test('visitor detail sticker, link row, and circular close retain hit targets at 1/soft', async ({
		baseURL,
	}) => {
		const context = await launchZoomableContext([], baseURL!);
		const page = context.pages()[0] ?? (await context.newPage());
		try {
			await setRealBrowserZoom(page, baseURL!, 1, null);
			await page.locator('html').evaluate((html, depth) => {
				html.dataset.depth = depth;
			}, REPRESENTATIVE_DEPTH);
			const heading = page.locator('[data-gift-item]').first().getByRole('heading');
			await expect(heading).toBeVisible();
			const giftName = await heading.innerText();
			await page.getByText(giftName, { exact: true }).first().click();
			const dialog = page.getByRole('dialog');
			await expect(dialog).toBeVisible();

			const like = dialog.getByRole('button', {
				name: /(?:Přidat do|Odebrat z) oblíbených:/,
			});
			await expect(like).toBeVisible();
			await expect(like).toHaveClass(/elevation-owner-like/);
			expectStableLift(await stationaryLowerEdge(page, like, 'Sticker Like'), 1.08);
			expect(
				(await bottomToTopSweep(page, like, 'Sticker Like')).interveningUnhovered,
			).toEqual([]);
			await expectSafeClick(page, like);

			const link = dialog.locator('a.elevation-owner-raised[target="_blank"]').first();
			await expect(link).toBeVisible();
			await expect(link).toHaveAttribute('href', /^https?:\/\//);
			expect(
				(await bottomToTopSweep(page, link, 'Gift link row')).interveningUnhovered,
			).toEqual([]);
			await expectSafeClick(page, link);

			const close = dialog.getByRole('button', { name: 'Zavřít', exact: true });
			await expect(close).toBeVisible();
			expect(
				(await bottomToTopSweep(page, close, 'Circular close')).interveningUnhovered,
			).toEqual([]);
			await expectSafeClick(page, close);
			await expect(dialog).toBeVisible();
		} finally {
			await context.close();
		}
	});

	test('bottom-to-top traversal keeps one hover interval for Display at every real zoom', async ({
		request,
		baseURL,
	}) => {
		const cookies = await loginViaApi(request, baseURL!, {
			email: 'martin@test.cz',
			password: ['password', '123'].join(''),
		});
		const context = await launchZoomableContext(cookies, baseURL!);
		const page = context.pages()[0] ?? (await context.newPage());
		try {
			let baseline: { dpr: number; innerWidth: number } | null = null;
			for (const zoom of BROWSER_ZOOMS) {
				const zoomMetrics = await setRealBrowserZoom(page, baseURL!, zoom, baseline);
				baseline ??= zoomMetrics;
				await page.evaluate(() => window.scrollTo(0, 0));
				await page.locator('html').evaluate((html, depth) => {
					html.dataset.depth = depth;
				}, REPRESENTATIVE_DEPTH);
				const display = page
					.getByTestId('desktop-display-trigger')
					.filter({ visible: true });
				await expect(display).toBeVisible();
				const traversal = await bottomToTopSweep(page, display, 'Display');
				expect(
					traversal.interveningUnhovered,
					`Display has an unhovered band at zoom ${zoom}`,
				).toEqual([]);
			}
		} finally {
			await context.close();
		}
	});
});
