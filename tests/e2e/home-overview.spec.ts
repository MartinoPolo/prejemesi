import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
	loginViaApi,
	createAuthenticatedContext,
	registerAndGetPage,
	waitForAppHydration,
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

	test('Shift+wheel and horizontal wheel glide the row proportionally without overshooting its edges (issue #524)', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/home');
		await waitForAppHydration(page);

		const row = page
			.getByTestId('home-shelf')
			.filter({ has: page.getByRole('button', { name: 'Další' }) })
			.first();
		await expect(row).toHaveCount(1);
		const container = row.locator('[data-embla-container]');
		await row.scrollIntoViewIfNeeded();
		const rowBox = await row.locator('[data-slot="carousel-content"]').boundingBox();
		await page.mouse.move(rowBox!.x + rowBox!.width / 2, rowBox!.y + rowBox!.height / 2);

		// Records the track's translateX every frame, so backward jumps and overshoot are observable.
		await container.evaluate((element) => {
			const samples: number[] = [];
			const record = () => {
				samples.push(new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
				requestAnimationFrame(record);
			};
			record();
			Object.assign(window, { trackSamples: samples });
		});
		const takeSamples = () =>
			page.evaluate(() => {
				const samples = (window as unknown as { trackSamples: number[] }).trackSamples;
				return samples.splice(0, samples.length);
			});
		const settledPosition = async () => {
			let previous = Number.NaN;
			await expect
				.poll(async () => {
					const current = await container.evaluate(
						(element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41,
					);
					const settled = current === previous;
					previous = current;
					return settled;
				})
				.toBe(true);
			return previous;
		};
		const wheelNotches = async (count: number, deltaX: number, deltaY: number) => {
			for (let notch = 0; notch < count; notch++) {
				await page.mouse.wheel(deltaX, deltaY);
				await page.waitForTimeout(50);
			}
		};
		/** Every frame moved toward `direction` (−1 = toward the end) and never went past `final`. */
		const expectMonotonicWithoutOvershoot = (
			samples: number[],
			direction: number,
			final: number,
		) => {
			for (let index = 1; index < samples.length; index++) {
				expect((samples[index] - samples[index - 1]) * direction).toBeGreaterThan(-0.5);
			}
			for (const sample of samples) {
				expect((sample - final) * direction).toBeLessThan(0.5);
			}
		};

		expect(await settledPosition()).toBe(0);
		await takeSamples();

		// One Shift+wheel notch moves the row by exactly its delta: a glide, not a fling.
		await page.keyboard.down('Shift');
		await wheelNotches(1, 0, 100);
		const afterNotch = await settledPosition();
		expect(afterNotch).toBeCloseTo(-100, 0);
		expectMonotonicWithoutOvershoot(await takeSamples(), -1, afterNotch);

		// Spinning far past the end stops exactly at the end edge.
		await wheelNotches(30, 0, 100);
		await page.keyboard.up('Shift');
		const end = await settledPosition();
		expectMonotonicWithoutOvershoot(await takeSamples(), -1, end);
		await expect(row.getByRole('button', { name: 'Další' })).toBeDisabled();

		// Horizontal (trackpad) deltas back past the start stop exactly at the start edge.
		await wheelNotches(30, -100, 0);
		expect(await settledPosition()).toBe(0);
		expectMonotonicWithoutOvershoot(await takeSamples(), 1, 0);

		// A plain vertical wheel is left to scroll the page and does not move the row.
		await page.evaluate(() => {
			window.addEventListener(
				'wheel',
				(event) =>
					Object.assign(window, { verticalWheelPrevented: event.defaultPrevented }),
				{ once: true },
			);
		});
		await wheelNotches(1, 0, 100);
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						(window as unknown as { verticalWheelPrevented?: boolean })
							.verticalWheelPrevented,
				),
			)
			.toBe(false);
		expect(await settledPosition()).toBe(0);

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

	test('Nedávné is more prominent than the category rows on desktop (issue #532)', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/home');
		await waitForAppHydration(page);

		const recent = shelf(page, 'Nedávné');
		const followed = shelf(page, 'Sledované');
		await expect(recent.getByTestId('wishlist-card').first()).toBeVisible({ timeout: 10_000 });
		await expect(followed.getByTestId('wishlist-card').first()).toBeVisible();

		const recentCard = await recent.getByTestId('wishlist-card').first().boundingBox();
		const categoryCard = await followed.getByTestId('wishlist-card').first().boundingBox();
		expect(recentCard!.width).toBeGreaterThan(categoryCard!.width);

		const headingFontSize = (row: ReturnType<typeof shelf>) =>
			row
				.getByRole('heading', { level: 2 })
				.evaluate((heading) => Number.parseFloat(getComputedStyle(heading).fontSize));
		expect(await headingFontSize(recent)).toBeGreaterThan(await headingFontSize(followed));

		await page.context().close();
	});
});
