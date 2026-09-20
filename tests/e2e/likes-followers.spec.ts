import { test, expect, type Page } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';

async function createSharedWishlistAndNavigate(page: Page, title: string): Promise<string> {
	await createWishlistAndNavigate(page, title);
	await addGift(page, TEST_GIFT.name);
	await shareWishlist(page);
	return new URL(page.url()).pathname;
}

test.describe('Like system', () => {
	test('visitor like persists with its count and can be removed', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('like-owner');
		const visitor = createTestUser('like-visitor');

		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		const wishlistPath = await createSharedWishlistAndNavigate(ownerPage, 'Test Like Wishlist');
		await ownerPage.context().close();

		const visitorCookies = await registerViaApi(request, baseURL!, visitor);
		const visitorContext = await createAuthenticatedContext(browser, visitorCookies, baseURL!);
		const visitorPage = await visitorContext.newPage();

		await visitorPage.goto(wishlistPath);
		await expect(visitorPage.getByText(TEST_GIFT.name)).toBeVisible();

		const likeButton = visitorPage.getByRole('button', {
			name: new RegExp(`P.idat do obl.ben.ch: ${TEST_GIFT.name}`, 'i'),
		});
		await expect(likeButton).toHaveAttribute('aria-pressed', 'false');
		await likeButton.click();

		let unlikeButton = visitorPage.getByRole('button', {
			name: new RegExp(`Odebrat z obl.ben.ch: ${TEST_GIFT.name}`, 'i'),
		});
		await expect(unlikeButton).toBeVisible({ timeout: 5_000 });
		await expect(unlikeButton.getByText('1', { exact: true })).toBeVisible();

		await visitorPage.reload();
		unlikeButton = visitorPage.getByRole('button', {
			name: new RegExp(`Odebrat z obl.ben.ch: ${TEST_GIFT.name}`, 'i'),
		});
		await expect(unlikeButton).toBeVisible({ timeout: 5_000 });
		await expect(unlikeButton.getByText('1', { exact: true })).toBeVisible();

		await unlikeButton.click();
		await expect(
			visitorPage.getByRole('button', {
				name: new RegExp(`P.idat do obl.ben.ch: ${TEST_GIFT.name}`, 'i'),
			}),
		).toHaveAttribute('aria-pressed', 'false');

		await visitorContext.close();
	});

	test('owner does not see like buttons on their own wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('likeowner-owner');

		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createSharedWishlistAndNavigate(ownerPage, 'Test Owner No Likes Wishlist');

		const likeButtons = ownerPage.getByRole('button', {
			name: new RegExp(`(P.idat|Odebrat) (do|z) obl.ben.ch`, 'i'),
		});
		await expect(likeButtons).toHaveCount(0);

		await ownerPage.context().close();
	});
});

test.describe('Follower management', () => {
	test('visit, unfollow, abandoned discovery, and refollow persist as one journey', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('follow-owner');
		const follower = createTestUser('follow-visitor');
		const wishlistTitle = 'Test Follow Lifecycle Wishlist';

		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		const wishlistPath = await createSharedWishlistAndNavigate(ownerPage, wishlistTitle);
		await ownerPage.context().close();

		const followerCookies = await registerViaApi(request, baseURL!, follower);
		const followerContext = await createAuthenticatedContext(
			browser,
			followerCookies,
			baseURL!,
		);
		const followerPage = await followerContext.newPage();

		await followerPage.goto(wishlistPath);
		await expect(followerPage.getByText(TEST_GIFT.name)).toBeVisible();

		await followerPage.goto('/followed');
		await expect(followerPage.getByRole('heading', { name: 'Sledované' })).toBeVisible({
			timeout: 5_000,
		});
		let wishlistCard = followerPage
			.getByTestId('wishlist-card')
			.filter({ hasText: wishlistTitle });
		await expect(wishlistCard).toBeVisible({ timeout: 5_000 });

		await wishlistCard.getByRole('button', { name: 'Přestat sledovat' }).click();
		await expect(wishlistCard).not.toBeVisible({ timeout: 5_000 });

		await followerPage.getByRole('button', { name: 'Filtrovat' }).click();
		const abandonedToggle = followerPage.getByRole('menuitemcheckbox', { name: 'Opuštěné' });
		await expect(abandonedToggle).toHaveAttribute('aria-checked', 'false');
		await abandonedToggle.click();
		await expect(abandonedToggle).toHaveAttribute('aria-checked', 'true');
		await followerPage.keyboard.press('Escape');

		wishlistCard = followerPage.getByTestId('wishlist-card').filter({ hasText: wishlistTitle });
		await expect(wishlistCard).toBeVisible({ timeout: 5_000 });
		await wishlistCard.getByRole('button', { name: 'Znovu sledovat' }).click();
		await expect(wishlistCard.getByRole('button', { name: 'Přestat sledovat' })).toBeVisible();

		await followerPage.reload();
		wishlistCard = followerPage.getByTestId('wishlist-card').filter({ hasText: wishlistTitle });
		await expect(wishlistCard).toBeVisible({ timeout: 5_000 });
		await expect(wishlistCard.getByRole('button', { name: 'Přestat sledovat' })).toBeVisible();

		await followerContext.close();
	});
});
