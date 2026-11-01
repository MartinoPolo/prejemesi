import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from '../e2e/fixtures/auth-helpers.js';
import { SEED_PASSWORD } from '../../src/lib/server/db/seed_credentials.js';

// Read-only browsing of seeded gifts: the eight-image PS5, the three-image jacket and a
// single-image book. Display preferences live in localStorage, so seeded data stays untouched.
const SEED_WISHLIST_ID = 'seed-wl-xmas26';
const EIGHT_IMAGE_GIFT_ID = 'seed-g-ps5';
const THREE_IMAGE_GIFT_ID = 'seed-g-bunda';
const SINGLE_IMAGE_GIFT_ID = 'seed-g-sapiens';
const EIGHT_IMAGE_GIFT_NAME = 'PlayStation 5';
/** Longer than any viewer takes to open after a press, so a wrongly opened viewer is caught. */
const NO_VIEWER_WINDOW_MS = 600;
const MAX_TAB_PRESSES = 80;
/** Far more frames than the slide transition takes, so a slide that never settles still ends. */
const MAX_SLIDE_FRAMES = 240;

test.use({ viewport: { width: 1280, height: 900 } });

async function openSeedWishlistAsVisitor(page: Page, viewMode: 'card' | 'list'): Promise<void> {
	const baseURL = test.info().project.use.baseURL!;
	const cookies = await loginViaApi(page.request, baseURL, {
		email: 'petr@test.cz',
		password: SEED_PASSWORD,
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.addInitScript(
		({ wishlistId, mode }) => {
			localStorage.setItem('prejemesi-gift-view-mode', JSON.stringify(mode));
			localStorage.setItem(
				`prejemesi-wishlist:${wishlistId}:gift-grouping`,
				JSON.stringify('none'),
			);
		},
		{ wishlistId: SEED_WISHLIST_ID, mode: viewMode },
	);
	await page.goto('/w/xmas2026', { waitUntil: 'domcontentloaded' });
	await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();
	await waitForAppHydration(page);
	await expect(giftItem(page, EIGHT_IMAGE_GIFT_ID)).toBeVisible();
}

function giftItem(page: Page, giftId: string): Locator {
	return page.locator(`[data-gift-item][data-gift-id="${giftId}"]`);
}

function currentSlide(card: Locator): Promise<string | null> {
	return card.locator('[data-gallery-slide][data-current]').getAttribute('data-gallery-slide');
}

/** The hover-revealed wrapper that carries the arrow's opacity. */
function arrowReveal(arrow: Locator): Locator {
	return arrow.locator('xpath=..');
}

/** Opacity as painted: the product of the element's and every ancestor's opacity. */
function paintedOpacity(locator: Locator): Promise<number> {
	return locator.evaluate((element) => {
		let opacity = 1;
		for (let node: Element | null = element; node !== null; node = node.parentElement) {
			opacity *= Number(getComputedStyle(node).opacity);
		}
		return opacity;
	});
}

/** Watches a short window after an interaction, so a viewer that opens late still fails. */
async function expectNoDialogOpensWithin(page: Page, windowMs: number): Promise<void> {
	const opened = await page.evaluate(
		(watchMs) =>
			new Promise<boolean>((resolve) => {
				const isOpen = () => document.querySelector('[role="dialog"]') !== null;
				if (isOpen()) {
					resolve(true);
					return;
				}
				const observer = new MutationObserver(() => {
					if (isOpen()) {
						observer.disconnect();
						resolve(true);
					}
				});
				observer.observe(document.body, { childList: true, subtree: true });
				setTimeout(() => {
					observer.disconnect();
					resolve(false);
				}, watchMs);
			}),
		windowMs,
	);
	expect(opened, 'browsing the card opens no viewer').toBe(false);
}

/** Tabs from the top of the page until the target has keyboard focus. */
async function tabTo(page: Page, target: Locator): Promise<void> {
	await page.evaluate(() => {
		(document.activeElement as HTMLElement | null)?.blur();
	});
	for (let press = 0; press < MAX_TAB_PRESSES; press += 1) {
		await page.keyboard.press('Tab');
		if (await target.evaluate((element) => element === document.activeElement)) {
			return;
		}
	}
	throw new Error(`The target was not reached within ${String(MAX_TAB_PRESSES)} Tab presses`);
}

test.describe('Gift image gallery (issue #591)', () => {
	test('card arrows browse in place and the viewer opens on the browsed image', async ({
		page,
	}) => {
		await openSeedWishlistAsVisitor(page, 'card');
		const card = giftItem(page, EIGHT_IMAGE_GIFT_ID);
		const indicator = card.getByTestId('gift-gallery-indicator');
		await expect(indicator).toHaveAttribute('data-kind', 'counter');
		await expect(indicator).toContainText('1/8');
		await expect(
			giftItem(page, THREE_IMAGE_GIFT_ID).getByTestId('gift-gallery-indicator'),
		).toHaveAttribute('data-kind', 'dots');

		const next = card.getByTestId('gift-card-gallery-next');
		const previous = card.getByTestId('gift-card-gallery-previous');
		await page.mouse.move(0, 0);
		await expect(arrowReveal(next)).toHaveCSS('opacity', '0');
		await card.hover();
		await expect(arrowReveal(next)).toHaveCSS('opacity', '1');
		// The cover has nothing before it, so its previous arrow is absent rather than wrapping.
		await expect(previous).toHaveCount(0);
		await next.click();
		await next.click();
		await expect.poll(() => currentSlide(card)).toBe('2');
		await expect(indicator).toContainText('3/8');
		await expect(arrowReveal(previous)).toHaveCSS('opacity', '1');
		await previous.click();
		await previous.click();
		await expect.poll(() => currentSlide(card)).toBe('0');
		await expect(previous).toHaveCount(0);
		for (let step = 0; step < 7; step += 1) {
			await next.click();
		}
		await expect.poll(() => currentSlide(card)).toBe('7');
		await expect(indicator).toContainText('8/8');
		await expect(next).toHaveCount(0);
		await expectNoDialogOpensWithin(page, NO_VIEWER_WINDOW_MS);

		await card.getByRole('heading', { name: EIGHT_IMAGE_GIFT_NAME }).click();
		const viewer = page.getByRole('dialog');
		await expect(viewer).toBeVisible();
		const photo = viewer.getByTestId('gift-viewer-photo');
		await expect(photo).toHaveAttribute('data-gallery-index', '7');
		await expect(viewer.getByTestId('gift-viewer-thumbnail').nth(7)).toHaveAttribute(
			'aria-current',
			'true',
		);
		await expect(viewer.getByTestId('gift-viewer-gallery-next')).toHaveCount(0);
		await page.keyboard.press('ArrowRight');
		await expect(photo).toHaveAttribute('data-gallery-index', '7');
		await page.keyboard.press('ArrowLeft');
		await expect(photo).toHaveAttribute('data-gallery-index', '6');

		const singleImageCard = giftItem(page, SINGLE_IMAGE_GIFT_ID);
		await expect(singleImageCard.getByTestId('gift-gallery-indicator')).toHaveCount(0);
		await expect(singleImageCard.getByTestId('gift-card-gallery-next')).toHaveCount(0);
	});

	test('keyboard focus reveals the arrows, which browse without opening the viewer', async ({
		page,
	}) => {
		await openSeedWishlistAsVisitor(page, 'card');
		const card = giftItem(page, EIGHT_IMAGE_GIFT_ID);
		const next = card.getByTestId('gift-card-gallery-next');
		await page.mouse.move(0, 0);
		await expect(arrowReveal(next)).toHaveCSS('opacity', '0');

		await tabTo(page, next);

		await expect(arrowReveal(next)).toHaveCSS('opacity', '1');
		await page.keyboard.press('Enter');
		await expect.poll(() => currentSlide(card)).toBe('1');
		await expectNoDialogOpensWithin(page, NO_VIEWER_WINDOW_MS);
		await expect(next).toBeFocused();
		await expect(arrowReveal(card.getByTestId('gift-card-gallery-previous'))).toHaveCSS(
			'opacity',
			'1',
		);
	});

	test('the next image starts sliding in from the side on the frame after the click', async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await openSeedWishlistAsVisitor(page, 'card');
		const card = giftItem(page, EIGHT_IMAGE_GIFT_ID);
		const next = card.getByTestId('gift-card-gallery-next');
		await card.hover();
		await expect(card.locator('[data-gallery-slide="1"]')).toHaveCount(1);

		// Clicks and samples in one page task, so every frame from the click on is observed and a
		// slide that first pops in at rest fails.
		const samples = await next.evaluate(
			(arrowElement, maxFrames) =>
				new Promise<{ slide: string | undefined; offsetX: number }[]>((resolve) => {
					const cardElement = arrowElement.closest('[data-gift-item]')!;
					const samples: { slide: string | undefined; offsetX: number }[] = [];
					const sample = () => {
						const current = cardElement.querySelector<HTMLElement>(
							'[data-gallery-slide][data-current]',
						);
						const frame = {
							slide: current?.dataset.gallerySlide,
							offsetX:
								current === null
									? Number.NaN
									: new DOMMatrixReadOnly(getComputedStyle(current).transform)
											.m41,
						};
						samples.push(frame);
						const atRest = frame.slide === '1' && frame.offsetX === 0;
						if (atRest || samples.length >= maxFrames) {
							resolve(samples);
						} else {
							requestAnimationFrame(sample);
						}
					};
					(arrowElement as HTMLElement).click();
					requestAnimationFrame(sample);
				}),
			MAX_SLIDE_FRAMES,
		);

		expect(samples[0], 'the next image is current on the first frame').toMatchObject({
			slide: '1',
		});
		expect(samples[0]!.offsetX, 'the next image is still sliding in').toBeGreaterThan(0);
		expect(samples.at(-1), 'the next image comes to rest').toEqual({ slide: '1', offsetX: 0 });
	});

	test('a reserved gallery gift stays browsable with crisp arrows and indicator', async ({
		page,
	}) => {
		await openSeedWishlistAsVisitor(page, 'card');
		// Petr reserved the only PlayStation, so the card shows it as unavailable.
		const card = giftItem(page, EIGHT_IMAGE_GIFT_ID);
		await expect(card.getByTestId('gift-card-crop-composition')).toHaveCSS('opacity', '0.5');

		await card.hover();
		const next = card.getByTestId('gift-card-gallery-next');
		await expect(arrowReveal(next)).toHaveCSS('opacity', '1');
		await expect.poll(() => paintedOpacity(next)).toBe(1);
		await expect.poll(() => paintedOpacity(card.getByTestId('gift-gallery-indicator'))).toBe(1);

		await next.click();
		await expect.poll(() => currentSlide(card)).toBe('1');
		await expect(card.getByTestId('gift-gallery-indicator')).toContainText('2/8');
		await expect
			.poll(() => paintedOpacity(card.getByTestId('gift-card-gallery-previous')))
			.toBe(1);
		await expectNoDialogOpensWithin(page, NO_VIEWER_WINDOW_MS);
	});

	test('list rows count the images after the cover', async ({ page }) => {
		await openSeedWishlistAsVisitor(page, 'list');

		await expect(
			giftItem(page, EIGHT_IMAGE_GIFT_ID).getByTestId('gift-gallery-count-chip'),
		).toContainText('+7');
		await expect(
			giftItem(page, THREE_IMAGE_GIFT_ID).getByTestId('gift-gallery-count-chip'),
		).toContainText('+2');
		await expect(
			giftItem(page, SINGLE_IMAGE_GIFT_ID).getByTestId('gift-gallery-count-chip'),
		).toHaveCount(0);
		await expect(
			giftItem(page, EIGHT_IMAGE_GIFT_ID).getByTestId('gift-card-gallery-next'),
		).toHaveCount(0);
	});
});
