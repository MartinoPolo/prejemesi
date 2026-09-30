import { test, expect, type Page } from '@playwright/test';
import { createPixelAssertions } from '../helpers/pixel-assertions.mjs';
import {
	createAuthenticatedContext,
	loginViaApi,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';
import { openDesktopDisplaySubmenu } from './fixtures/wishlist-helpers.js';

const { expectPixelsAtMost, expectPixelsNear } = createPixelAssertions(expect);

async function sampleListGeometry(page: Page) {
	return page.evaluate(async () => {
		await document.fonts.ready;
		const samples: {
			id: string;
			width: number;
			height: number;
			rowHeight: number;
			leftInset: number;
			topInset: number;
			bottomInset: number;
		}[][] = [];
		for (let frame = 0; frame < 75; frame += 1) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			samples.push(
				Array.from(
					document.querySelectorAll<HTMLElement>(
						'[data-wishlist-gift-collection][data-view-mode="list"]:not([inert]) [data-gift-item][data-gift-id]',
					),
				).map((gift) => {
					const row = gift.querySelector<HTMLElement>('[data-testid="gift-list-item"]')!;
					const image = row.querySelector<HTMLElement>(
						'[data-testid="gift-list-image"]',
					)!;
					const rowRect = row.getBoundingClientRect();
					const imageRect = image.getBoundingClientRect();
					const rowStyle = getComputedStyle(row);
					return {
						id: gift.dataset.giftId!,
						width: imageRect.width,
						height: imageRect.height,
						rowHeight: rowRect.height,
						leftInset:
							imageRect.left - rowRect.left - parseFloat(rowStyle.borderLeftWidth),
						topInset: imageRect.top - rowRect.top - parseFloat(rowStyle.borderTopWidth),
						bottomInset:
							rowRect.bottom -
							imageRect.bottom -
							parseFloat(rowStyle.borderBottomWidth),
					};
				}),
			);
		}
		return samples;
	});
}

test('grouped desktop List images retain stable full-height sizing through viewport changes', async ({
	browser,
	request,
	baseURL,
}) => {
	const cookies = await loginViaApi(request, baseURL!, {
		email: 'martin@test.cz',
		password: 'password123',
	});
	const context = await createAuthenticatedContext(browser, cookies, baseURL!);
	try {
		const page = await context.newPage();
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/w/knihy026', { waitUntil: 'domcontentloaded' });
		await waitForAppHydration(page);
		await page.getByTestId('gift-view-list').click();
		const submenu = await openDesktopDisplaySubmenu(page, /^Seskupení/);
		await submenu.getByRole('menuitemradio', { name: /^Podle kategorie$/ }).click();
		await page.keyboard.press('Escape');
		await expect(
			page.getByTestId('wishlist-gift-list').getByRole('heading', {
				name: 'Výpravné ilustrované edice a kompletní sběratelské kolekce',
			}),
		).toBeVisible();
		const crowdedGift = page.locator('[data-gift-id="seed-g-kn-crowded-long-title"]');
		await expect(crowdedGift.getByTestId('gift-category-badge')).toBeVisible();
		await expect(crowdedGift.getByTestId('gift-priority-badge')).toBeVisible();
		await expect(crowdedGift.getByTestId('gift-state-overlay')).toBeVisible();
		await expect(crowdedGift.getByTestId('gift-state-overlay')).toContainText(
			'Rezervováno více lidmi',
		);
		await expect(crowdedGift.getByTestId('gift-list-actions')).toBeVisible();

		let wideWidth = 0;
		for (const viewportWidth of [1280, 1600, 672, 390]) {
			await page.setViewportSize({ width: viewportWidth, height: 900 });
			const samples = await sampleListGeometry(page);
			const settled = samples.at(-1)!;
			expect(settled.length).toBeGreaterThan(2);
			for (const gift of settled) {
				for (const sample of samples.slice(-30)) {
					const sameGift = sample.find((item) => item.id === gift.id)!;
					expectPixelsNear(sameGift.width, gift.width);
					expectPixelsNear(sameGift.height, gift.height);
					expectPixelsNear(sameGift.rowHeight, gift.rowHeight);
					expectPixelsNear(sameGift.leftInset, 0);
					expectPixelsNear(sameGift.topInset, 0);
					expectPixelsNear(sameGift.bottomInset, 0);
				}
				if (viewportWidth >= 640) {
					expectPixelsAtMost(gift.width, gift.height);
					expectPixelsNear(gift.width, settled[0]!.width);
				}
			}
			const crowded = settled.find((gift) => gift.id === 'seed-g-kn-crowded-long-title')!;
			const ordinary = settled.find((gift) => gift.id === 'seed-g-kn-atlas')!;
			if (viewportWidth === 1280) {
				wideWidth = ordinary.width;
				expectPixelsNear(ordinary.width, ordinary.height);
			}
			if (viewportWidth === 1600) {
				expectPixelsNear(ordinary.width, wideWidth);
			}
			if (viewportWidth >= 640) {
				expect(crowded.rowHeight).toBeGreaterThan(ordinary.rowHeight);
			}
		}
	} finally {
		await context.close();
	}
});
