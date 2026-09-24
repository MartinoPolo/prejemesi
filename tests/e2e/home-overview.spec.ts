import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
	loginViaApi,
	createAuthenticatedContext,
	registerAndGetPage,
} from './fixtures/auth-helpers';
import { createTestUser } from './fixtures/test-data';
import { createPixelAssertions } from '../helpers/pixel-assertions.mjs';

const { expectPixelsNear } = createPixelAssertions(expect);

/**
 * Přehled overview at /home (issue #225).
 *
 * Personas come from the seed (`pnpm db:seed`, shared password below): Martin owns lists,
 * moderates for-someone lists and follows others, so his overview exercises all four rows.
 * Fresh users are registered per test for the empty-state and visit-tracking flows.
 */

const SEED_PASSWORD = 'password123';
const MARTIN = { email: 'martin@test.cz', password: SEED_PASSWORD };

async function signInAs(
	browser: Browser,
	request: APIRequestContext,
	baseURL: string,
	user: { email: string; password: string },
): Promise<Page> {
	const cookies = await loginViaApi(request, baseURL, user);
	const context = await createAuthenticatedContext(browser, cookies, baseURL);
	return context.newPage();
}

/** The shelf (carousel row) whose heading matches `title`. */
function shelf(page: Page, title: string) {
	return page
		.getByTestId('home-shelf')
		.filter({ has: page.getByRole('heading', { name: title, level: 2 }) });
}

test.describe('Home overview (issue #225)', () => {
	test('root opens the complete multi-role overview and a category links to its full page', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);

		await page.goto('/');
		await expect(page).toHaveURL(/\/home\/?$/);
		await expect(page.getByRole('heading', { name: 'Přehled', level: 1 })).toBeVisible({
			timeout: 10_000,
		});

		for (const title of ['Nedávné', 'Sledované', 'Spravované', 'Moje seznamy']) {
			await expect(shelf(page, title), `the „${title}" row should be present`).toHaveCount(1);
		}

		await shelf(page, 'Sledované').getByTestId('shelf-view-all-link').click();
		await expect(page).toHaveURL(/\/followed\/?$/);

		await page.context().close();
	});

	test('a new user with no lists sees the onboarding hero instead of rows', async ({
		browser,
		request,
		baseURL,
	}) => {
		const newcomer = createTestUser('home-empty');
		const page = await registerAndGetPage(browser, request, baseURL!, newcomer);

		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Vytvořte první seznam' })).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByTestId('home-shelf')).toHaveCount(0);

		await page.context().close();
	});

	test('Next moves a visible wishlist card and enables Previous', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);
		await page.setViewportSize({ width: 390, height: 844 });

		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Přehled', level: 1 })).toBeVisible({
			timeout: 10_000,
		});

		const overflowingRow = page
			.getByTestId('home-shelf')
			.filter({ has: page.getByRole('button', { name: 'Další' }) })
			.first();
		await expect(overflowingRow).toHaveCount(1);

		const viewport = overflowingRow.locator("[data-slot='carousel-content']");
		const visibleCard = overflowingRow.locator('[data-testid="wishlist-card"]:visible').first();
		await expect(visibleCard).toBeVisible();
		const cardName = await visibleCard.getAttribute('aria-label');
		expect(cardName).toBeTruthy();
		const namedCard = overflowingRow
			.getByTestId('wishlist-card')
			.and(page.getByLabel(cardName!, { exact: true }));
		const viewportBox = await viewport.boundingBox();
		const cardBox = await namedCard.boundingBox();
		expect(viewportBox).not.toBeNull();
		expect(cardBox).not.toBeNull();
		expect(cardBox!.x + cardBox!.width).toBeGreaterThan(viewportBox!.x);
		expect(cardBox!.x).toBeLessThan(viewportBox!.x + viewportBox!.width);
		const initialOffset = cardBox!.x - viewportBox!.x;

		await overflowingRow.getByRole('button', { name: 'Další' }).click();

		await expect
			.poll(async () => {
				const currentCardBox = await namedCard.boundingBox();
				const currentViewportBox = await viewport.boundingBox();
				return currentCardBox!.x - currentViewportBox!.x;
			})
			.toBeLessThan(initialOffset);
		await expect(overflowingRow.getByRole('button', { name: 'Předchozí' })).toBeEnabled();

		await page.context().close();
	});

	test('wishlist surface keeps its content, shadow clearance and lower-edge navigation in a carousel', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/home');
		const viewport = shelf(page, 'Nedávné').locator('[data-slot="carousel-content"]');
		const card = viewport.getByTestId('wishlist-card').first();
		const surface = card.locator(':scope > [data-slot="elevation-surface"]');
		const title = surface.locator('div.font-heading');
		await expect(card).toBeVisible();
		await expect
			.poll(() =>
				card.evaluate(
					(element) =>
						element
							.getAnimations()
							.filter((animation) => animation.playState === 'running').length,
				),
			)
			.toBe(0);
		await page.mouse.move(1, 1);
		const ownerBefore = await card.boundingBox();
		const surfaceBefore = await surface.boundingBox();
		const titleBefore = await title.boundingBox();
		expect(ownerBefore).not.toBeNull();
		expect(surfaceBefore).not.toBeNull();
		expect(titleBefore).not.toBeNull();

		await title.hover();
		await expect
			.poll(() => surface.evaluate((element) => getComputedStyle(element).translate))
			.toBe('0px -2px');
		await expect
			.poll(() =>
				surface.evaluate(
					(element) =>
						element
							.getAnimations()
							.filter((animation) => animation.playState === 'running').length,
				),
			)
			.toBe(0);
		const ownerAfter = await card.boundingBox();
		const surfaceAfter = await surface.boundingBox();
		const titleAfter = await title.boundingBox();
		const viewportBounds = await viewport.boundingBox();
		expectPixelsNear(ownerAfter!.y, ownerBefore!.y);
		expectPixelsNear(surfaceAfter!.y - surfaceBefore!.y, -2);
		expectPixelsNear(titleAfter!.y - titleBefore!.y, surfaceAfter!.y - surfaceBefore!.y);
		const shadowOffset = await card.evaluate((element) =>
			Number.parseFloat(
				getComputedStyle(element).getPropertyValue('--elevation-ordinary-offset'),
			),
		);
		expect(surfaceAfter!.y).toBeGreaterThanOrEqual(viewportBounds!.y);
		expect(surfaceAfter!.y + surfaceAfter!.height + shadowOffset).toBeLessThanOrEqual(
			viewportBounds!.y + viewportBounds!.height,
		);
		const lowerEdge = {
			x: ownerAfter!.x + ownerAfter!.width / 2,
			y: ownerAfter!.y + ownerAfter!.height + shadowOffset - 0.25,
		};
		await page.mouse.move(lowerEdge.x, lowerEdge.y);
		await expect
			.poll(() =>
				card.evaluate((element, point) => {
					const hit = document.elementFromPoint(point.x, point.y);
					return hit === element || (hit !== null && element.contains(hit));
				}, lowerEdge),
			)
			.toBe(true);
		const href = await card.getAttribute('href');
		await page.mouse.click(lowerEdge.x, lowerEdge.y);
		await expect(page).toHaveURL(
			new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`),
		);
		await page.context().close();
	});

	test('opening a wishlist records a visit that surfaces in Nedávné', async ({
		browser,
		request,
		baseURL,
	}) => {
		const gifter = createTestUser('home-visit');
		const page = await registerAndGetPage(browser, request, baseURL!, gifter);

		// The visit is fire-and-forget in the page's onMount, so wait for its remote response
		// before navigating on, otherwise the /home SSR query can race ahead of the write.
		const visitRecorded = page.waitForResponse(
			(response) => response.url().includes('recordWishlistVisit') && response.ok(),
			{ timeout: 15_000 },
		);
		await page.goto('/w/xmas2026');
		await expect(page.getByRole('heading', { name: 'Vánoce 2026' }).first()).toBeVisible({
			timeout: 10_000,
		});
		await visitRecorded;

		await page.goto('/home');
		const recent = shelf(page, 'Nedávné');
		await expect(recent).toHaveCount(1);
		await expect(recent.getByText('Vánoce 2026').first()).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});
