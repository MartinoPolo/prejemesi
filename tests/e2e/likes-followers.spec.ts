import { test, expect, type Page } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';

async function createSharedWishlistAndNavigate(page: Page, title: string): Promise<string> {
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

	// Add a gift
	await page
		.getByRole('button', { name: /Pridat/ })
		.first()
		.click();
	const giftDialog = page.getByRole('dialog');
	await expect(giftDialog).toBeVisible({ timeout: 5_000 });
	await giftDialog.getByRole('textbox', { name: /Nazev/i }).fill(TEST_GIFT.name);
	await giftDialog.getByRole('button', { name: 'Pridat darek' }).click();
	await expect(page.getByText(TEST_GIFT.name)).toBeVisible({ timeout: 10_000 });

	// Share the wishlist
	await page
		.getByRole('button', { name: /Sdilet seznam/ })
		.first()
		.click();
	const shareDialog = page.getByRole('dialog');
	await expect(shareDialog).toBeVisible({ timeout: 5_000 });
	await shareDialog.getByRole('button', { name: 'Sdilet seznam' }).click();
	await expect(shareDialog.getByText('Seznam byl sdilen!')).toBeVisible({ timeout: 5_000 });
	await shareDialog.getByRole('button', { name: 'Hotovo' }).click();

	return new URL(page.url()).pathname;
}

test.describe('Like system', () => {
	test('visitor can like and unlike a gift on a shared wishlist', async ({
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
		await visitorPage.waitForLoadState('networkidle');
		await expect(visitorPage.getByText(TEST_GIFT.name)).toBeVisible();

		const likeButton = visitorPage.getByRole('button', {
			name: new RegExp(`Pridat do oblibenych: ${TEST_GIFT.name}`, 'i'),
		});
		await expect(likeButton).toBeVisible();
		await expect(likeButton).toHaveAttribute('aria-pressed', 'false');

		// Like the gift
		await likeButton.click();
		await expect(
			visitorPage.getByRole('button', {
				name: new RegExp(`Odebrat z oblibenych: ${TEST_GIFT.name}`, 'i'),
			}),
		).toBeVisible({ timeout: 5_000 });

		// Unlike the gift
		const unlikeButton = visitorPage.getByRole('button', {
			name: new RegExp(`Odebrat z oblibenych: ${TEST_GIFT.name}`, 'i'),
		});
		await unlikeButton.click();
		await expect(
			visitorPage.getByRole('button', {
				name: new RegExp(`Pridat do oblibenych: ${TEST_GIFT.name}`, 'i'),
			}),
		).toBeVisible({ timeout: 5_000 });

		await visitorContext.close();
	});

	test('like count is visible to non-owners after liking', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('likecount-owner');
		const visitor = createTestUser('likecount-visitor');

		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		const wishlistPath = await createSharedWishlistAndNavigate(
			ownerPage,
			'Test Like Count Wishlist',
		);
		await ownerPage.context().close();

		const visitorCookies = await registerViaApi(request, baseURL!, visitor);
		const visitorContext = await createAuthenticatedContext(browser, visitorCookies, baseURL!);
		const visitorPage = await visitorContext.newPage();

		await visitorPage.goto(wishlistPath);
		await visitorPage.waitForLoadState('networkidle');

		// Like the gift — count should appear (1)
		const likeButton = visitorPage.getByRole('button', {
			name: new RegExp(`Pridat do oblibenych: ${TEST_GIFT.name}`, 'i'),
		});
		await likeButton.click();
		await expect(
			visitorPage.getByRole('button', {
				name: new RegExp(`Odebrat z oblibenych: ${TEST_GIFT.name}`, 'i'),
			}),
		).toBeVisible({ timeout: 5_000 });

		// The like button should now show the count "1"
		const likedButton = visitorPage.getByRole('button', {
			name: new RegExp(`Odebrat z oblibenych: ${TEST_GIFT.name}`, 'i'),
		});
		await expect(likedButton.getByText('1')).toBeVisible();

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

		// Owner should not see any like buttons
		const likeButtons = ownerPage.getByRole('button', {
			name: new RegExp(`(Pridat|Odebrat) (do|z) oblibenych`, 'i'),
		});
		await expect(likeButtons).toHaveCount(0);

		await ownerPage.context().close();
	});
});

test.describe('Follower management', () => {
	test('logged-in user auto-follows a wishlist on first visit and it appears on /followed', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('follow-owner');
		const follower = createTestUser('follow-visitor');

		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		const wishlistPath = await createSharedWishlistAndNavigate(
			ownerPage,
			'Test Auto Follow Wishlist',
		);
		const wishlistTitle = 'Test Auto Follow Wishlist';
		await ownerPage.context().close();

		const followerCookies = await registerViaApi(request, baseURL!, follower);
		const followerContext = await createAuthenticatedContext(
			browser,
			followerCookies,
			baseURL!,
		);
		const followerPage = await followerContext.newPage();

		// Visit the shared wishlist — should auto-follow
		await followerPage.goto(wishlistPath);
		await followerPage.waitForLoadState('networkidle');
		await expect(followerPage.getByText(TEST_GIFT.name)).toBeVisible();

		// Navigate to /followed — wishlist should be listed
		await followerPage.goto('/followed');
		await followerPage.waitForLoadState('networkidle');
		await expect(followerPage.getByRole('heading', { name: 'Sledované' })).toBeVisible({
			timeout: 5_000,
		});
		await expect(followerPage.getByText(wishlistTitle)).toBeVisible({ timeout: 5_000 });

		await followerContext.close();
	});

	test('user can unfollow a wishlist from /followed page', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('unfollow-owner');
		const follower = createTestUser('unfollow-visitor');

		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		const wishlistPath = await createSharedWishlistAndNavigate(
			ownerPage,
			'Test Unfollow Wishlist',
		);
		const wishlistTitle = 'Test Unfollow Wishlist';
		await ownerPage.context().close();

		const followerCookies = await registerViaApi(request, baseURL!, follower);
		const followerContext = await createAuthenticatedContext(
			browser,
			followerCookies,
			baseURL!,
		);
		const followerPage = await followerContext.newPage();

		// Visit to trigger auto-follow
		await followerPage.goto(wishlistPath);
		await followerPage.waitForLoadState('networkidle');

		// Unfollow from /followed page
		await followerPage.goto('/followed');
		await followerPage.waitForLoadState('networkidle');
		await expect(followerPage.getByText(wishlistTitle)).toBeVisible({ timeout: 5_000 });

		const wishlistCard = followerPage
			.getByTestId('wishlist-card')
			.filter({ hasText: wishlistTitle })
			.first();

		// Use the "Prestat sledovat" button inside the card
		await wishlistCard.getByRole('button', { name: 'Prestat sledovat' }).click();

		// Wishlist should no longer be visible (unfollowed items hidden by default)
		await expect(followerPage.getByText(wishlistTitle)).not.toBeVisible({ timeout: 5_000 });

		await followerContext.close();
	});

	test('unfollowed wishlists appear when "Opuštěné" toggle is enabled', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('unfollowed-toggle-owner');
		const follower = createTestUser('unfollowed-toggle-visitor');

		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		const wishlistPath = await createSharedWishlistAndNavigate(
			ownerPage,
			'Test Unfollowed Toggle Wishlist',
		);
		const wishlistTitle = 'Test Unfollowed Toggle Wishlist';
		await ownerPage.context().close();

		const followerCookies = await registerViaApi(request, baseURL!, follower);
		const followerContext = await createAuthenticatedContext(
			browser,
			followerCookies,
			baseURL!,
		);
		const followerPage = await followerContext.newPage();

		// Visit to trigger auto-follow, then unfollow
		await followerPage.goto(wishlistPath);
		await followerPage.waitForLoadState('networkidle');

		await followerPage.goto('/followed');
		await followerPage.waitForLoadState('networkidle');
		await expect(followerPage.getByText(wishlistTitle)).toBeVisible({ timeout: 5_000 });

		await followerPage.getByRole('button', { name: 'Prestat sledovat' }).first().click();
		await expect(followerPage.getByText(wishlistTitle)).not.toBeVisible({ timeout: 5_000 });

		// Enable "Opuštěné" toggle
		const toggle = followerPage.getByRole('switch');
		await toggle.click();

		// Unfollowed wishlist should now be visible again with "Znovu sledovat" button
		await expect(followerPage.getByText(wishlistTitle)).toBeVisible({ timeout: 5_000 });
		await expect(
			followerPage.getByRole('button', { name: 'Znovu sledovat' }).first(),
		).toBeVisible();

		await followerContext.close();
	});
});
