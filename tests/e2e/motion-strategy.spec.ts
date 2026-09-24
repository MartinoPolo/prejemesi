import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	openDesktopDisplaySubmenu,
	shareWishlist,
	startGiftReorder,
} from './fixtures/wishlist-helpers.js';

const giftItems = (page: Page) =>
	page.locator('[data-gift-item][data-gift-id]:not([data-gift-reorder-overlay])');

function giftItem(page: Page, name: string) {
	return giftItems(page).filter({
		has: page.getByRole('heading', { name, exact: true, level: 3 }),
	});
}

async function selectGiftView(page: Page, mode: 'card' | 'list' | 'compact') {
	if (mode === 'compact') {
		// Compact is a persisted fallback, not an option in the current two-button switcher.
		await page.evaluate(() =>
			localStorage.setItem('prejemesi-gift-view-mode', JSON.stringify('compact')),
		);
		await page.reload();
	} else {
		await page.getByTestId(`gift-view-${mode}`).click();
	}
	await expect(
		page.locator(`[data-wishlist-gift-collection][data-view-mode=${mode}]`),
	).toBeVisible();
	await expectCleanSettlement(page);
}

async function closeDesktopDisplaySubmenu(page: Page, submenu: Locator, section: RegExp) {
	const root = page.locator('[data-slot="dropdown-menu-content"][data-state="open"]');
	const subTrigger = root.getByRole('menuitem', { name: section });
	await page.keyboard.press('Escape');
	await expect(submenu).not.toBeVisible();
	await expect(subTrigger).toBeFocused();
	await page.keyboard.press('Escape');
	const displayTrigger = page.getByTestId('desktop-display-trigger');
	await expect(displayTrigger).toHaveAttribute('aria-expanded', 'false');
	await expect(displayTrigger).toBeFocused();
}

async function chooseDesktopDisplayOption(page: Page, section: RegExp, option: RegExp) {
	const submenu = await openDesktopDisplaySubmenu(page, section);
	const item = submenu.getByRole('menuitemradio', { name: option });
	await item.focus();
	await item.press('Enter');
	await expect(item).toHaveAttribute('aria-checked', 'true');
	await closeDesktopDisplaySubmenu(page, submenu, section);
}

async function enableDesktopWithLinkFilter(page: Page) {
	const submenu = await openDesktopDisplaySubmenu(page, /^Filtrovat/);
	const item = submenu.getByRole('menuitemcheckbox', { name: 'S odkazem', exact: true });
	await item.focus();
	await item.press('Enter');
	await expect(item).toHaveAttribute('aria-checked', 'true');
	await closeDesktopDisplaySubmenu(page, submenu, /^Filtrovat/);
}

interface TransformAnimationRecorder {
	giftIds: Record<string, true>;
	travelStarts: Record<string, string[]>;
	travelTimings: Record<string, { distance: number; duration: number }[]>;
	renderedTravel: Record<string, true>;
	cancelledTravel: number;
	extendTravel: boolean;
	unidentifiedTarget: boolean;
}

declare global {
	interface Window {
		__motionTransformAnimations: TransformAnimationRecorder;
	}
}

async function installTransformAnimationRecorder(page: Page) {
	await page.evaluate(() => {
		window.__motionTransformAnimations = {
			giftIds: {},
			travelStarts: {},
			travelTimings: {},
			renderedTravel: {},
			cancelledTravel: 0,
			extendTravel: false,
			unidentifiedTarget: false,
		};
		function recordTransformTarget(element: Element, travelStart: string | undefined) {
			const giftId =
				element.closest<HTMLElement>('[data-gift-item][data-gift-id]')?.dataset.giftId ??
				(element instanceof HTMLElement ? element.dataset.giftReceivedAction : undefined) ??
				element.querySelector<HTMLElement>('[data-gift-received-action]')?.dataset
					.giftReceivedAction;
			if (giftId === undefined || giftId === '') {
				window.__motionTransformAnimations.unidentifiedTarget = true;
			} else {
				window.__motionTransformAnimations.giftIds[giftId] = true;
				if (travelStart !== undefined) {
					(window.__motionTransformAnimations.travelStarts[giftId] ??= []).push(
						travelStart,
					);
				}
			}
			return giftId;
		}

		function recordRenderedTravel(element: Element, animation: Animation, giftId?: string) {
			if (giftId === undefined || giftId === '' || !(element instanceof HTMLElement)) {
				return;
			}
			requestAnimationFrame(() => {
				const computed = getComputedStyle(element).transform;
				const matrix = new DOMMatrixReadOnly(computed);
				if (
					animation.playState === 'running' &&
					(Math.abs(matrix.m41) > 0.1 || Math.abs(matrix.m42) > 0.1)
				) {
					window.__motionTransformAnimations.renderedTravel[giftId] = true;
				}
			});
		}

		function firstTravelTranslation(keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
			const transform = Array.isArray(keyframes) ? keyframes[0]?.transform : undefined;
			return typeof transform === 'string' && transform.startsWith('translate(')
				? transform
				: undefined;
		}

		function animationTiming(
			options: number | KeyframeAnimationOptions | undefined,
			travel: boolean,
		) {
			return travel &&
				window.__motionTransformAnimations.extendTravel &&
				typeof options === 'object' &&
				options !== null
				? { ...options, duration: 3000 }
				: options;
		}

		const nativeAnimate = Element.prototype.animate;
		Element.prototype.animate = function (keyframes, options) {
			const hasTransform = Array.isArray(keyframes)
				? keyframes.some((keyframe) => 'transform' in keyframe)
				: keyframes !== null && 'transform' in keyframes;
			const firstTranslate = firstTravelTranslation(keyframes);
			const giftId = hasTransform ? recordTransformTarget(this, firstTranslate) : undefined;
			const travel = giftId !== undefined && firstTranslate !== undefined;
			if (travel && giftId !== undefined && firstTranslate !== undefined) {
				const matrix = new DOMMatrixReadOnly(firstTranslate);
				const duration = typeof options === 'number' ? options : options?.duration;
				if (typeof duration === 'number') {
					(window.__motionTransformAnimations.travelTimings[giftId] ??= []).push({
						distance: Math.hypot(matrix.m41, matrix.m42),
						duration,
					});
				}
			}
			const animation = nativeAnimate.call(this, keyframes, animationTiming(options, travel));
			if (travel) {
				animation.addEventListener(
					'cancel',
					() => {
						window.__motionTransformAnimations.cancelledTravel += 1;
					},
					{ once: true },
				);
			}
			recordRenderedTravel(this, animation, giftId);
			return animation;
		};
	});
}

async function clearTransformAnimationRecords(page: Page) {
	await page.evaluate(() => {
		window.__motionTransformAnimations = {
			giftIds: {},
			travelStarts: {},
			travelTimings: {},
			renderedTravel: {},
			cancelledTravel: 0,
			extendTravel: false,
			unidentifiedTarget: false,
		};
	});
}

async function expectGiftTransformAnimation(page: Page, giftId: string) {
	await expect
		.poll(() =>
			page.evaluate(
				(targetGiftId) => window.__motionTransformAnimations.giftIds[targetGiftId] === true,
				giftId,
			),
		)
		.toBe(true);
}

async function expectGiftTravel(page: Page, giftId: string) {
	await expect
		.poll(() =>
			page.evaluate(
				(id) => window.__motionTransformAnimations.renderedTravel[id] === true,
				giftId,
			),
		)
		.toBe(true);
}

async function expectVisibleEndpoint(item: Locator) {
	const eligible = await item.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return (
			element.isConnected &&
			rect.width > 0 &&
			rect.height > 0 &&
			rect.right > 0 &&
			rect.bottom > 0 &&
			rect.left < innerWidth &&
			rect.top < innerHeight
		);
	});
	expect(eligible, 'Gift must have a visible endpoint inside the viewport').toBe(true);
}

async function expectGiftInViewport(page: Page, name: string) {
	await expectVisibleEndpoint(giftItem(page, name));
}

async function expectProportionalTravel(page: Page, giftId: string) {
	const timings = await page.evaluate(
		(id) => window.__motionTransformAnimations.travelTimings[id] ?? [],
		giftId,
	);
	expect(timings.length, 'Travel must have a measured duration').toBeGreaterThan(0);
	for (const { distance, duration } of timings) {
		expect(distance).toBeGreaterThan(0);
		expect(Math.abs(duration - Math.max(325, (distance / 1500) * 1000))).toBeLessThan(2);
	}
}

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') {
			errors.push(`console: ${message.text()}`);
		}
	});
	return errors;
}

async function expectCleanSettlement(page: Page) {
	await expect
		.poll(
			() =>
				page
					.locator('body')
					.evaluate(
						(body) =>
							body
								.getAnimations({ subtree: true })
								.filter((animation) => animation.playState === 'running').length,
					),
			{ timeout: 5_000 },
		)
		.toBe(0);
	const integrity = await page.locator('body').evaluate(() => {
		const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((node) => node.id);
		const gifts = [...document.querySelectorAll<HTMLElement>('[data-gift-item][data-gift-id]')];
		return {
			duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
			duplicateGiftIds: gifts
				.map((gift) => gift.dataset.giftId)
				.filter((id, index, all) => all.indexOf(id) !== index),
			staleTransforms: gifts.filter((gift) => gift.style.transform !== '').length,
			staleClones: document.querySelectorAll('[aria-hidden="true"][data-gift-item]').length,
			horizontalOverflow:
				document.documentElement.scrollWidth > document.documentElement.clientWidth,
		};
	});
	expect(integrity).toEqual({
		duplicateIds: [],
		duplicateGiftIds: [],
		staleTransforms: 0,
		staleClones: 0,
		horizontalOverflow: false,
	});
}

test.describe('issue #269 integrated motion strategy', () => {
	test.describe.configure({ mode: 'serial' });
	test.use({ viewport: { width: 1280, height: 900 } });

	test('filter insertion and received placement preserve identity and settle cleanly', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('motion-strategy-filter-received'),
		);
		const errors = collectBrowserErrors(page);
		const names = ['Motion Gift A', 'Motion Gift B', 'Motion Gift C'];
		await createWishlistAndNavigate(page, 'Motion strategy filter and receive');
		await addGift(page, names[0]!);
		await addGift(page, names[1]!, { primaryLink: 'https://example.com/motion-b' });
		await addGift(page, names[2]!, { primaryLink: 'https://example.com/motion-c' });

		const filteredOut = giftItem(page, names[0]!);
		const displaced = giftItem(page, names[1]!);
		const filteredOutId = await filteredOut.getAttribute('data-gift-id');
		const displacedId = await displaced.getAttribute('data-gift-id');
		expect(filteredOutId).not.toBeNull();
		expect(displacedId).not.toBeNull();
		if (filteredOutId === null || displacedId === null) {
			throw new Error('Gift motion targets must expose stable gift IDs');
		}

		await installTransformAnimationRecorder(page);
		const filterMenu = await openDesktopDisplaySubmenu(page, /^Filtrovat/);
		const withLinkFilter = filterMenu.getByRole('menuitemcheckbox', {
			name: 'S odkazem',
			exact: true,
		});
		await expect(withLinkFilter).toHaveAttribute('aria-checked', 'false');
		await clearTransformAnimationRecords(page);
		await withLinkFilter.click();
		await expectGiftTransformAnimation(page, displacedId);
		await expect(page.getByTestId('desktop-display-trigger')).toHaveAccessibleName(
			'Možnosti zobrazení: Aktivní filtry: 1',
		);
		await expect(page.locator('[data-filter-count]')).toHaveText('1');
		await expect(withLinkFilter).toHaveAttribute('aria-checked', 'true');
		const activeFilters = page.getByTestId('wishlist-toolbar-active-filters');
		await expect(activeFilters.locator('[data-active-filter-pill]')).toHaveText('S odkazem');
		await expect(filteredOut).toHaveCount(0);
		await expect(displaced).toBeVisible();
		expect(await displaced.getAttribute('data-gift-id')).toBe(displacedId);
		expect(
			await page.evaluate(
				(id) => window.__motionTransformAnimations.travelStarts[id],
				filteredOutId,
			),
		).toBeUndefined();

		await page.keyboard.press('Escape');
		await clearTransformAnimationRecords(page);
		await expect(withLinkFilter).not.toBeVisible();
		await activeFilters
			.getByRole('button', { name: 'Odebrat filtr S odkazem', exact: true })
			.click();
		await expect(filteredOut).toBeVisible();
		await expect(activeFilters).toHaveCount(0);
		expect(
			await page.evaluate(
				(id) => window.__motionTransformAnimations.travelStarts[id],
				filteredOutId,
			),
		).toBeUndefined();
		await expect(page.getByTestId('desktop-display-trigger')).toBeFocused();
		expect(await filteredOut.getAttribute('data-gift-id')).toBe(filteredOutId);
		expect(await displaced.getAttribute('data-gift-id')).toBe(displacedId);
		await expectCleanSettlement(page);

		await clearTransformAnimationRecords(page);
		let releaseReceivedRequest: () => void = () => {};
		let signalReceivedRequest: () => void = () => {};
		const receivedRequestHeld = new Promise<void>((resolve) => {
			signalReceivedRequest = resolve;
		});
		const receivedRequestReleased = new Promise<void>((resolve) => {
			releaseReceivedRequest = resolve;
		});
		await page.route('**/_app/remote/*/markGiftReceived', async (route) => {
			signalReceivedRequest();
			await receivedRequestReleased;
			await route.continue();
		});
		try {
			await filteredOut.getByRole('button', { name: 'Označit jako přijatý' }).click();
			await receivedRequestHeld;
			await chooseDesktopDisplayOption(page, /^Řadit podle/, /^Název$/);
		} finally {
			releaseReceivedRequest();
		}
		await expect(
			page.locator('[data-testid="wishlist-page-shell"] p[aria-live="polite"]'),
		).toContainText('Dárek „Motion Gift A“ byl označen jako přijatý.');
		await page.unroute('**/_app/remote/*/markGiftReceived');
		await expect(page.getByTestId('desktop-display-trigger')).toBeFocused();
		await expect(
			filteredOut.locator('[data-state-primary][data-state-kind="received"]'),
		).toHaveText('Přijato', { timeout: 10_000 });
		await expect(page.getByRole('heading', { name: 'Obdržené', exact: true })).toBeVisible();
		expect(await filteredOut.getAttribute('data-gift-id')).toBe(filteredOutId);
		await expect(
			giftItems(page).filter({
				has: page.locator('[data-state-primary][data-state-kind="received"]'),
			}),
		).toHaveCount(1);
		await expectCleanSettlement(page);

		const reverse = filteredOut.getByRole('button', { name: 'Označit jako nepřijatý' });
		const scrollBefore = await page.evaluate(() => scrollY);
		await reverse.click();
		await expect(filteredOut.getByRole('button', { name: 'Označit jako přijatý' })).toBeFocused(
			{
				timeout: 10_000,
			},
		);
		expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
		await expect(page.getByRole('heading', { name: 'Obdržené', exact: true })).toHaveCount(0);
		await expectCleanSettlement(page);
		expect(await filteredOut.getAttribute('data-gift-id')).toBe(filteredOutId);
		await clearTransformAnimationRecords(page);
		await filteredOut.getByRole('button', { name: 'Označit jako přijatý' }).click();
		await expectGiftTransformAnimation(page, filteredOutId);
		await expectCleanSettlement(page);
		expect(errors).toEqual([]);
		await page.context().close();
	});

	test('reorder mode temporarily bypasses and restores browse choices', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('motion-strategy-reorder'),
		);
		const errors = collectBrowserErrors(page);
		const manualOrder = ['Zeta Gift', 'Alpha Gift', 'Mu Gift'];
		await createWishlistAndNavigate(page, 'Motion strategy reorder');
		await addGift(page, manualOrder[0]!, {
			primaryLink: 'https://example.com/zeta',
			priority: 'Vysoká',
			category: 'Knihy',
		});
		await addGift(page, manualOrder[1]!, { priority: 'Nízká' });
		await addGift(page, manualOrder[2]!, {
			primaryLink: 'https://example.com/mu',
			priority: 'Vysoká',
			category: 'Knihy',
		});

		await chooseDesktopDisplayOption(page, /^Seskupení/, /^Podle kategorie$/);
		await chooseDesktopDisplayOption(page, /^Řadit podle/, /^Název$/);
		await enableDesktopWithLinkFilter(page);

		const browseOrder = ['Mu Gift', 'Zeta Gift'];
		await expect
			.poll(() => giftItems(page).getByRole('heading', { level: 3 }).allTextContents())
			.toEqual(browseOrder);
		await expect(page.getByRole('heading', { level: 2, name: 'Knihy' })).toBeVisible();

		const desktopMore = page.getByTestId('desktop-more-trigger');
		await startGiftReorder(page);
		const desktopDone = page.getByRole('button', { name: 'Hotovo', exact: true });
		await expect(desktopDone).toBeFocused();
		await expect(
			page.locator('[role="status"]').filter({ hasText: 'Režim změny pořadí zapnut.' }),
		).toHaveCount(1);
		await expect(page.getByTestId('gift-reorder-temporary-notice')).toContainText(
			'dočasně zobrazujeme všechny aktivní dárky bez seskupení, řazení a filtrů',
		);
		await expect
			.poll(() => giftItems(page).getByRole('heading', { level: 3 }).allTextContents())
			.toEqual(manualOrder);
		await expect(page.getByRole('heading', { level: 2, name: 'Knihy' })).toHaveCount(0);
		await expect(page.getByTestId('desktop-display-trigger')).toBeDisabled();

		await desktopDone.click();
		await expect(desktopMore).toBeFocused();
		await expect(
			page.locator('[role="status"]').filter({ hasText: 'Režim změny pořadí ukončen.' }),
		).toHaveCount(1);
		await expect
			.poll(() => giftItems(page).getByRole('heading', { level: 3 }).allTextContents())
			.toEqual(browseOrder);
		await expect(page.getByRole('heading', { level: 2, name: 'Knihy' })).toBeVisible();
		await expect(page.getByTestId('desktop-display-trigger')).toHaveAccessibleName(
			'Možnosti zobrazení: Aktivní filtry: 1',
		);

		const groupingMenu = await openDesktopDisplaySubmenu(page, /^Seskupení/);
		await expect(
			groupingMenu.getByRole('menuitemradio', { name: 'Podle kategorie', exact: true }),
		).toHaveAttribute('aria-checked', 'true');
		await page.keyboard.press('Escape');
		await page.keyboard.press('Escape');
		const sortingMenu = await openDesktopDisplaySubmenu(page, /^Řadit podle/);
		await expect(
			sortingMenu.getByRole('menuitemradio', { name: 'Název', exact: true }),
		).toHaveAttribute('aria-checked', 'true');
		await page.keyboard.press('Escape');
		await page.keyboard.press('Escape');
		const filterMenu = await openDesktopDisplaySubmenu(page, /^Filtrovat/);
		await expect(
			filterMenu.getByRole('menuitemcheckbox', { name: 'S odkazem', exact: true }),
		).toHaveAttribute('aria-checked', 'true');

		expect(errors).toEqual([]);
		await page.context().close();
	});

	for (const viewMode of ['list', 'card'] as const) {
		test(`desktop ${viewMode} sort and cross-section grouping move visible identities`, async ({
			browser,
			request,
			baseURL,
		}) => {
			const page = await registerAndGetPage(
				browser,
				request,
				baseURL!,
				createTestUser('motion-display-desktop'),
			);
			const errors = collectBrowserErrors(page);
			await createWishlistAndNavigate(page, 'Display motion desktop');
			await addGift(page, 'Zeta Motion', {
				priority: 'Vysoká',
				category: 'Knihy',
				primaryLink: 'https://example.com/zeta-motion',
			});
			await addGift(page, 'Alpha Motion', { priority: 'Nízká' });
			await addGift(page, 'Mu Motion', { priority: 'Nízká' });
			await page.getByTestId(`gift-view-${viewMode}`).click();
			await chooseDesktopDisplayOption(page, /^Seskupení/, /^Bez seskupení$/);
			await expectCleanSettlement(page);
			const zetaId = await giftItem(page, 'Zeta Motion').getAttribute('data-gift-id');
			expect(zetaId).toBeTruthy();
			if (zetaId === null) {
				throw new Error('Missing stable gift identity');
			}
			await installTransformAnimationRecorder(page);
			await chooseDesktopDisplayOption(page, /^Řadit podle/, /^Název$/);
			await expectGiftTravel(page, zetaId);
			await expect
				.poll(() => giftItems(page).getByRole('heading', { level: 3 }).allTextContents())
				.toEqual(['Alpha Motion', 'Mu Motion', 'Zeta Motion']);
			await expectCleanSettlement(page);

			await clearTransformAnimationRecords(page);
			await chooseDesktopDisplayOption(page, /^Seskupení/, /^Podle kategorie$/);
			await expectGiftTravel(page, zetaId);
			await expect(page.getByRole('heading', { level: 2, name: 'Knihy' })).toBeVisible();
			await expect
				.poll(() => giftItems(page).getByRole('heading', { level: 3 }).allTextContents())
				.toEqual(['Zeta Motion', 'Alpha Motion', 'Mu Motion']);
			await expectCleanSettlement(page);

			await clearTransformAnimationRecords(page);
			await chooseDesktopDisplayOption(page, /^Seskupení/, /^Podle kategorie$/);
			await page.evaluate(
				() =>
					new Promise<void>((resolve) =>
						requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
					),
			);
			expect(
				await page.evaluate(() => window.__motionTransformAnimations.travelStarts),
			).toEqual({});
			if (viewMode === 'list') {
				await page.evaluate(() => {
					window.__motionTransformAnimations.extendTravel = true;
				});
				await chooseDesktopDisplayOption(page, /^Seskupení/, /^Bez seskupení$/);
				await expectGiftTravel(page, zetaId);
				await chooseDesktopDisplayOption(page, /^Řadit podle/, /^Výchozí pořadí$/);
				await enableDesktopWithLinkFilter(page);
				await expect
					.poll(() =>
						page.evaluate(() => window.__motionTransformAnimations.cancelledTravel),
					)
					.toBeGreaterThan(0);
				await expect(giftItems(page).getByRole('heading', { level: 3 })).toHaveText([
					'Zeta Motion',
				]);
				await expectCleanSettlement(page);
				await page.evaluate(() => {
					window.__motionTransformAnimations.extendTravel = false;
				});
			} else {
				await enableDesktopWithLinkFilter(page);
			}
			await expect(giftItems(page)).toHaveCount(1);
			await page.getByTestId('desktop-more-trigger').click();
			await page.getByRole('menuitem', { name: 'Obnovit výchozí zobrazení' }).click();
			await expect
				.poll(() => giftItems(page).getByRole('heading', { level: 3 }).allTextContents())
				.toEqual(['Zeta Motion', 'Alpha Motion', 'Mu Motion']);
			await expect(giftItems(page)).toHaveCount(3);
			await expect(page.locator('[data-filter-count]')).toHaveCount(0);
			await expectCleanSettlement(page);
			expect(await giftItem(page, 'Zeta Motion').getAttribute('data-gift-id')).toBe(zetaId);
			if (viewMode === 'list') {
				const receivedToggle = giftItem(page, 'Zeta Motion').getByRole('button', {
					name: 'Označit jako přijatý',
				});
				await receivedToggle.click();
				await expect(
					giftItem(page, 'Zeta Motion').locator('[data-state-kind="received"]'),
				).toBeVisible();
				await expectCleanSettlement(page);
			}
			expect(errors).toEqual([]);
			await page.context().close();
		});
	}

	for (const viewMode of ['card', 'list'] as const) {
		test(`mobile ${viewMode} sort and grouping move identities, reduced motion skips travel`, async ({
			browser,
			request,
			baseURL,
		}) => {
			const page = await registerAndGetPage(
				browser,
				request,
				baseURL!,
				createTestUser('motion-display-mobile'),
			);
			const errors = collectBrowserErrors(page);
			await createWishlistAndNavigate(page, 'Display motion mobile');
			await addGift(page, 'Zeta Mobile', { priority: 'Vysoká', category: 'Knihy' });
			await addGift(page, 'Alpha Mobile', { priority: 'Nízká' });
			await addGift(page, 'Mu Mobile', { priority: 'Nízká' });
			await chooseDesktopDisplayOption(page, /^Seskupení/, /^Bez seskupení$/);
			await page.setViewportSize({ width: 390, height: 850 });
			await page.getByTestId(`gift-view-${viewMode}`).click();
			await expect(page.getByTestId('mobile-display-trigger')).toBeVisible();
			const movingName = 'Alpha Mobile';
			const zetaId = await giftItem(page, movingName).getAttribute('data-gift-id');
			expect(zetaId).toBeTruthy();
			if (zetaId === null) {
				throw new Error('Missing stable gift identity');
			}
			await installTransformAnimationRecorder(page);
			const chooseMobile = async (section: 'sort' | 'grouping', option: string) => {
				await page.getByTestId('mobile-display-trigger').click();
				await page.getByTestId(`mobile-sheet-${section}-switch`).click();
				await page
					.getByRole('radiogroup', {
						name: section === 'sort' ? 'Řadit podle' : 'Seskupení',
					})
					.getByText(option, { exact: true })
					.click();
				await expect(page.getByTestId('mobile-sheet-switcher')).toHaveCount(0);
			};
			await expectGiftInViewport(page, movingName);
			await chooseMobile('sort', 'Název');
			await expectGiftTravel(page, zetaId);
			await expectCleanSettlement(page);
			await expectGiftInViewport(page, movingName);
			await clearTransformAnimationRecords(page);
			await chooseMobile('grouping', 'Podle kategorie');
			await expectGiftTravel(page, zetaId);
			await expectCleanSettlement(page);
			await expectGiftInViewport(page, movingName);

			await chooseMobile('grouping', 'Bez seskupení');
			await chooseMobile('sort', 'Výchozí pořadí');
			await expect
				.poll(() => giftItems(page).getByRole('heading', { level: 3 }).allTextContents())
				.toEqual(['Zeta Mobile', 'Alpha Mobile', 'Mu Mobile']);

			await expectCleanSettlement(page);
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await clearTransformAnimationRecords(page);
			await chooseMobile('sort', 'Název');
			await expect
				.poll(() => giftItems(page).getByRole('heading', { level: 3 }).allTextContents())
				.toEqual(['Alpha Mobile', 'Mu Mobile', 'Zeta Mobile']);
			expect(
				await page.evaluate(() => window.__motionTransformAnimations.travelStarts),
			).toEqual({});
			await expectCleanSettlement(page);
			expect(errors).toEqual([]);
			await page.context().close();
		});
	}

	for (const viewMode of ['card', 'list', 'compact'] as const) {
		for (const viewport of [
			{ width: 1280, height: 1100 },
			{ width: 390, height: 1800 },
		]) {
			test(`${viewMode} reservation pin and unpin travel on ${viewport.width}px viewport`, async ({
				browser,
				request,
				baseURL,
			}) => {
				const ownerPage = await registerAndGetPage(
					browser,
					request,
					baseURL!,
					createTestUser('motion-reservation-owner'),
				);
				await createWishlistAndNavigate(ownerPage, 'Reservation motion');
				await addGift(ownerPage, 'Unreserved First');
				await addGift(ownerPage, 'Pinned Second');
				await shareWishlist(ownerPage);
				const wishlistPath = new URL(ownerPage.url()).pathname;
				await ownerPage.context().close();

				const page = await registerAndGetPage(
					browser,
					request,
					baseURL!,
					createTestUser('motion-reservation-gifter'),
				);
				await page.setViewportSize(viewport);
				await page.goto(wishlistPath);
				await expect(page.getByText(/Unreserved First/).first()).toBeVisible();
				await selectGiftView(page, viewMode);
				const movingGift = giftItems(page).filter({
					has: page.getByText('Pinned Second', { exact: true }),
				});
				const giftId = await movingGift.getAttribute('data-gift-id');
				expect(giftId).toBeTruthy();
				if (giftId === null) {
					throw new Error('Missing stable gift identity');
				}
				await expectVisibleEndpoint(movingGift);
				await installTransformAnimationRecorder(page);
				await movingGift.getByTestId('reserve-button').click();
				const dialog = page.getByRole('dialog');
				await expect(dialog).toBeVisible();
				await dialog.getByRole('button', { name: 'Rezervovat', exact: true }).click();
				await expectGiftTravel(page, giftId);
				await expectProportionalTravel(page, giftId);
				await expect(movingGift.getByTestId('reserve-button')).toHaveText(
					/Zrušit rezervaci/,
				);
				await expect(page.getByText('Vaše rezervace', { exact: true })).toBeVisible();
				await page.screenshot({ path: test.info().outputPath('reservation-motion.png') });
				await expectCleanSettlement(page);
				await expectVisibleEndpoint(movingGift);
				expect(await movingGift.getAttribute('data-gift-id')).toBe(giftId);

				await clearTransformAnimationRecords(page);
				await movingGift.getByTestId('reserve-button').click();
				await expectGiftTravel(page, giftId);
				await expectProportionalTravel(page, giftId);
				await expect(movingGift.getByTestId('reserve-button')).toHaveText(/Rezervovat/);
				await expect(page.getByText('Vaše rezervace', { exact: true })).toHaveCount(0);
				await expectCleanSettlement(page);
				await page.screenshot({ path: test.info().outputPath('unreserved-settled.png') });
				await expectVisibleEndpoint(movingGift);
				expect(await movingGift.getAttribute('data-gift-id')).toBe(giftId);
				if (viewMode === 'card' && viewport.width < 640) {
					await page.emulateMedia({ reducedMotion: 'reduce' });
					await clearTransformAnimationRecords(page);
					await movingGift.getByTestId('reserve-button').click();
					await page
						.getByRole('dialog')
						.getByRole('button', { name: 'Rezervovat', exact: true })
						.click();
					await expect(movingGift.getByTestId('reserve-button')).toHaveText(
						/Zrušit rezervaci/,
					);
					expect(
						await page.evaluate(() => window.__motionTransformAnimations.travelStarts),
					).toEqual({});
					await expectCleanSettlement(page);
				}
				await page.context().close();
			});
		}
	}

	test('compact sort animates visible gift identity without switching views', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('motion-compact-sort'),
		);
		await createWishlistAndNavigate(page, 'Compact sort motion');
		await addGift(page, 'Zeta Compact');
		await addGift(page, 'Alpha Compact');
		await selectGiftView(page, 'compact');
		const movingGift = giftItems(page).filter({
			has: page.getByText('Zeta Compact', { exact: true }),
		});
		const giftId = await movingGift.getAttribute('data-gift-id');
		expect(giftId).toBeTruthy();
		if (giftId === null) {
			throw new Error('Missing stable gift identity');
		}
		await expectVisibleEndpoint(movingGift);
		await installTransformAnimationRecorder(page);
		await chooseDesktopDisplayOption(page, /^Řadit podle/, /^Název$/);
		await expectGiftTravel(page, giftId);
		await expectProportionalTravel(page, giftId);
		await expect(giftItems(page).locator('td:first-child')).toHaveText([
			'Alpha Compact',
			'Zeta Compact',
		]);
		await expectCleanSettlement(page);
		await expectVisibleEndpoint(movingGift);
		await page.context().close();
	});

	test('responsive card reflow travels only when the gift remains visible', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('motion-responsive-reflow'),
		);
		await createWishlistAndNavigate(page, 'Responsive reflow motion');
		await addGift(page, 'First Responsive');
		await addGift(page, 'Second Responsive');
		await page.getByTestId('gift-view-card').click();
		await expectCleanSettlement(page);
		const movingGift = giftItem(page, 'Second Responsive');
		const giftId = await movingGift.getAttribute('data-gift-id');
		expect(giftId).toBeTruthy();
		if (giftId === null) {
			throw new Error('Missing stable gift identity');
		}
		await expectVisibleEndpoint(movingGift);
		await installTransformAnimationRecorder(page);
		await page.setViewportSize({ width: 320, height: 1800 });
		await expectGiftTravel(page, giftId);
		await expectProportionalTravel(page, giftId);
		await expectCleanSettlement(page);
		await expectVisibleEndpoint(movingGift);
		await expect(page.getByTestId('gift-view-card')).toHaveAttribute('aria-checked', 'true');
		await page.context().close();
	});

	test('rapid card/list switching commits the latest mode and reduced motion skips transforms', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('motion-strategy-view-switch'),
		);
		const errors = collectBrowserErrors(page);
		await createWishlistAndNavigate(page, 'Motion strategy view switching');
		await addGift(page, 'Motion View Gift');
		const list = page.getByTestId('gift-view-list');
		const card = page.getByTestId('gift-view-card');
		await list.click();
		await card.click();
		await list.click();
		await expect(list).toHaveAttribute('aria-checked', 'true');
		await expectCleanSettlement(page);

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await installTransformAnimationRecorder(page);
		await card.click();
		await expect(card).toHaveAttribute('aria-checked', 'true');
		expect(await page.evaluate(() => window.__motionTransformAnimations)).toEqual({
			giftIds: {},
			travelStarts: {},
			travelTimings: {},
			renderedTravel: {},
			cancelledTravel: 0,
			extendTravel: false,
			unidentifiedTarget: false,
		});
		expect(errors).toEqual([]);
		await page.context().close();
	});
});
