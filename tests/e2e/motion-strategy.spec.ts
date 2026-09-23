import { expect, test, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	openDesktopDisplaySubmenu,
	startGiftReorder,
} from './fixtures/wishlist-helpers.js';

const giftItems = (page: Page) =>
	page.locator('[data-gift-item][data-gift-id]:not([data-gift-reorder-overlay])');

function giftItem(page: Page, name: string) {
	return giftItems(page).filter({
		has: page.getByRole('heading', { name, exact: true, level: 3 }),
	});
}

async function chooseDesktopDisplayOption(page: Page, section: RegExp, option: RegExp) {
	const submenu = await openDesktopDisplaySubmenu(page, section);
	const item = submenu.getByRole('menuitemradio', { name: option });
	await item.focus();
	await item.press('Enter');
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
}

async function enableDesktopWithLinkFilter(page: Page) {
	const submenu = await openDesktopDisplaySubmenu(page, /^Filtrovat/);
	const item = submenu.getByRole('menuitemcheckbox', { name: 'S odkazem', exact: true });
	await item.focus();
	await item.press('Enter');
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
}

interface TransformAnimationRecorder {
	giftIds: Record<string, true>;
	travelStarts: Record<string, string[]>;
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
			renderedTravel: {},
			cancelledTravel: 0,
			extendTravel: false,
			unidentifiedTarget: false,
		};
		const nativeAnimate = Element.prototype.animate;
		Element.prototype.animate = function (keyframes, options) {
			const hasTransform = Array.isArray(keyframes)
				? keyframes.some((keyframe) => 'transform' in keyframe)
				: keyframes !== null && 'transform' in keyframes;
			let giftId: string | undefined;
			if (hasTransform) {
				giftId =
					this.closest<HTMLElement>('[data-gift-item][data-gift-id]')?.dataset.giftId ??
					(this instanceof HTMLElement ? this.dataset.giftReceivedAction : undefined) ??
					this.querySelector<HTMLElement>('[data-gift-received-action]')?.dataset
						.giftReceivedAction;
				if (giftId === undefined || giftId === '') {
					window.__motionTransformAnimations.unidentifiedTarget = true;
				} else {
					window.__motionTransformAnimations.giftIds[giftId] = true;
					if (
						Array.isArray(keyframes) &&
						typeof keyframes[0]?.transform === 'string' &&
						keyframes[0].transform.startsWith('translate(')
					) {
						(window.__motionTransformAnimations.travelStarts[giftId] ??= []).push(
							keyframes[0].transform,
						);
					}
				}
			}
			const travel =
				giftId !== undefined &&
				Array.isArray(keyframes) &&
				typeof keyframes[0]?.transform === 'string' &&
				keyframes[0].transform.startsWith('translate(');
			const timing =
				travel &&
				window.__motionTransformAnimations.extendTravel &&
				typeof options === 'object' &&
				options !== null
					? { ...options, duration: 3000 }
					: options;
			const animation = nativeAnimate.call(this, keyframes, timing);
			if (travel) {
				animation.addEventListener(
					'cancel',
					() => {
						window.__motionTransformAnimations.cancelledTravel += 1;
					},
					{ once: true },
				);
			}
			if (
				hasTransform &&
				giftId !== undefined &&
				giftId !== '' &&
				this instanceof HTMLElement
			) {
				requestAnimationFrame(() => {
					const computed = getComputedStyle(this).transform;
					const matrix = new DOMMatrixReadOnly(computed);
					if (
						animation.playState === 'running' &&
						(Math.abs(matrix.m41) > 0.1 || Math.abs(matrix.m42) > 0.1)
					) {
						window.__motionTransformAnimations.renderedTravel[giftId] = true;
					}
				});
			}
			return animation;
		};
	});
}

async function clearTransformAnimationRecords(page: Page) {
	await page.evaluate(() => {
		window.__motionTransformAnimations = {
			giftIds: {},
			travelStarts: {},
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

async function expectGiftInViewport(page: Page, name: string) {
	const eligible = await giftItem(page, name).evaluate((element) => {
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
	expect(eligible, `${name} must have a visible endpoint inside the viewport`).toBe(true);
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

		await page.keyboard.press('Escape');
		await expect(withLinkFilter).not.toBeVisible();
		await activeFilters
			.getByRole('button', { name: 'Odebrat filtr S odkazem', exact: true })
			.click();
		await expect(filteredOut).toBeVisible();
		await expect(activeFilters).toHaveCount(0);
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
			renderedTravel: {},
			cancelledTravel: 0,
			extendTravel: false,
			unidentifiedTarget: false,
		});
		expect(errors).toEqual([]);
		await page.context().close();
	});
});
