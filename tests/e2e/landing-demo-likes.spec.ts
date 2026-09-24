import { test, expect, type Locator, type Page } from '@playwright/test';
import { waitForAppHydration } from './fixtures/auth-helpers.js';
import { createPixelAssertions } from '../helpers/pixel-assertions.mjs';

const { expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;
const MOBILE_VIEWPORT = { width: 375, height: 812 } as const;
function gifterPane(page: Page): Locator {
	return page.getByTestId('landing-demo-pane-gifter');
}
function demoGift(pane: Locator): Locator {
	return pane.getByTestId('landing-demo-gift-teapot');
}
async function gotoDemo(page: Page) {
	const loaded = page.waitForResponse((response) =>
		new URL(response.url()).pathname.endsWith('/getLandingDemoLikes'),
	);
	await page.goto('/');
	await loaded;
	await waitForAppHydration(page);
	await expect(page.getByTestId('landing-demo')).toBeVisible();
}
function pairLikeButton(page: Page): Locator {
	return page.getByTestId('landing-demo-pair-gifter').locator('button[aria-pressed]');
}
async function toggleLike(
	button: Locator,
	expectedPressed: boolean,
	onMutationCommitted: () => void,
) {
	// Pressed state is optimistic; wait for this mutation before reloading or toggling again.
	const committed = button
		.page()
		.waitForResponse(
			(response) =>
				response.request().method() === 'POST' &&
				new URL(response.url()).pathname.endsWith('/toggleLandingDemoLike'),
		);
	await button.click();
	expect((await committed).ok()).toBe(true);
	onMutationCommitted();
	await expect(button).toHaveAttribute('aria-pressed', String(expectedPressed));
}

async function likeCount(button: Locator): Promise<number> {
	const text = await button.locator('[data-like-count]').innerText();
	const count = Number.parseInt(text, 10);
	expect(Number.isFinite(count)).toBe(true);
	return count;
}

test.describe('Landing demo likes', () => {
	test.describe.configure({ mode: 'default' });
	test('own-browser persistence is independent from the shared count seen anonymously', async ({
		browser,
		page,
		baseURL,
	}) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		const anonymousContext = await browser.newContext({
			baseURL: baseURL!,
			viewport: MOBILE_VIEWPORT,
		});
		const anonymousPage = await anonymousContext.newPage();
		let primaryLiked = false;
		try {
			await gotoDemo(page);
			await gotoDemo(anonymousPage);
			const primaryButton = pairLikeButton(page);
			const anonymousButton = pairLikeButton(anonymousPage);
			await expect(primaryButton).toHaveAttribute('aria-pressed', 'false');
			await expect(anonymousButton).toHaveAttribute('aria-pressed', 'false');
			const baselineCount = await likeCount(primaryButton);
			expect(await likeCount(anonymousButton)).toBe(baselineCount);

			await toggleLike(primaryButton, true, () => {
				primaryLiked = true;
			});
			await gotoDemo(page);
			await expect(primaryButton).toHaveAttribute('aria-pressed', 'true');
			const sharedLikedCount = await likeCount(primaryButton);
			expect(sharedLikedCount).toBe(baselineCount + 1);

			await gotoDemo(anonymousPage);
			await expect(anonymousButton).toHaveAttribute('aria-pressed', 'false');
			expect(await likeCount(anonymousButton)).toBe(sharedLikedCount);

			await toggleLike(primaryButton, false, () => {
				primaryLiked = false;
			});
			await gotoDemo(page);
			await expect(primaryButton).toHaveAttribute('aria-pressed', 'false');
			expect(await likeCount(primaryButton)).toBe(baselineCount);
			await gotoDemo(anonymousPage);
			await expect(anonymousButton).toHaveAttribute('aria-pressed', 'false');
			expect(await likeCount(anonymousButton)).toBe(baselineCount);
		} finally {
			try {
				if (primaryLiked) {
					await toggleLike(pairLikeButton(page), false, () => {
						primaryLiked = false;
					});
				}
			} finally {
				await anonymousContext.close();
			}
		}
	});

	test('a like explains the counter once per session', async ({ page }) => {
		await page.setViewportSize(DESKTOP_VIEWPORT);
		await gotoDemo(page);

		const heart = demoGift(gifterPane(page)).locator('button[aria-pressed]');
		const popup = page.getByTestId('landing-demo-like-popup');
		let liked = false;
		try {
			// Nothing explains anything until the visitor actually likes something.
			await expect(popup).toHaveCount(0);

			await toggleLike(heart, true, () => {
				liked = true;
			});
			await expect(popup).toBeVisible();

			const giftCard = demoGift(gifterPane(page)).getByTestId('gift-list-item');
			const giftContent = giftCard.getByTestId('gift-list-content');
			const [popupBox, heartBox, giftCardBox, contentBox] = await Promise.all([
				popup.boundingBox(),
				heart.boundingBox(),
				giftCard.boundingBox(),
				giftContent.boundingBox(),
			]);
			expect(popupBox).not.toBeNull();
			expect(heartBox).not.toBeNull();
			expect(giftCardBox).not.toBeNull();
			expect(contentBox).not.toBeNull();
			expectPixelsAtLeast(popupBox!.x, contentBox!.x);
			expectPixelsAtMost(popupBox!.x + popupBox!.width, giftCardBox!.x + giftCardBox!.width);
			expectPixelsAtLeast(popupBox!.y, heartBox!.y + heartBox!.height);
			expectPixelsAtMost(
				popupBox!.y + popupBox!.height,
				giftCardBox!.y + giftCardBox!.height,
			);

			// Restore the shared counter; unliking must never trigger the explainer.
			await toggleLike(heart, false, () => {
				liked = false;
			});
			await expect(popup).toHaveCount(0, { timeout: 15_000 });

			await toggleLike(heart, true, () => {
				liked = true;
			});
			await expect(popup).toHaveCount(0);

			await toggleLike(heart, false, () => {
				liked = false;
			});
		} finally {
			if (liked) {
				await toggleLike(heart, false, () => {
					liked = false;
				});
			}
		}
	});
});
