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

interface TransformAnimationRecorder {
	giftIds: Record<string, true>;
	unidentifiedTarget: boolean;
}

declare global {
	interface Window {
		__motionTransformAnimations: TransformAnimationRecorder;
	}
}

async function installTransformAnimationRecorder(page: Page) {
	await page.evaluate(() => {
		window.__motionTransformAnimations = { giftIds: {}, unidentifiedTarget: false };
		const nativeAnimate = Element.prototype.animate;
		Element.prototype.animate = function (keyframes, options) {
			const hasTransform = Array.isArray(keyframes)
				? keyframes.some((keyframe) => 'transform' in keyframe)
				: keyframes !== null && 'transform' in keyframes;
			if (hasTransform) {
				const giftId =
					this.closest<HTMLElement>('[data-gift-item][data-gift-id]')?.dataset.giftId ??
					(this instanceof HTMLElement ? this.dataset.giftReceivedAction : undefined) ??
					this.querySelector<HTMLElement>('[data-gift-received-action]')?.dataset
						.giftReceivedAction;
				if (giftId === undefined || giftId === '') {
					window.__motionTransformAnimations.unidentifiedTarget = true;
				} else {
					window.__motionTransformAnimations.giftIds[giftId] = true;
				}
			}
			return nativeAnimate.call(this, keyframes, options);
		};
	});
}

async function clearTransformAnimationRecords(page: Page) {
	await page.evaluate(() => {
		window.__motionTransformAnimations = { giftIds: {}, unidentifiedTarget: false };
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
		await filteredOut.getByRole('button', { name: 'Označit jako přijatý' }).click();
		await expectGiftTransformAnimation(page, filteredOutId);
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
		expect(errors).toEqual([]);
		await page.context().close();
	});

	test('reorder mode keeps stable toolbar regions and control behavior', async ({
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
		await createWishlistAndNavigate(page, 'Motion strategy reorder');
		await addGift(page, 'Motion Reorder A');
		await addGift(page, 'Motion Reorder B');

		const desktopGeometry = () =>
			page.evaluate(() => {
				const toolbar = document.querySelector<HTMLElement>(
					'[data-testid="wishlist-toolbar"]',
				);
				if (!toolbar) {
					throw new Error('Missing wishlist toolbar');
				}
				const toolbarRectangle = toolbar.getBoundingClientRect();
				const relativeRectangle = (selector: string) => {
					const element = toolbar.querySelector<HTMLElement>(selector);
					if (!element) {
						throw new Error(`Missing stable toolbar region: ${selector}`);
					}
					const rectangle = element.getBoundingClientRect();
					return {
						x: rectangle.x - toolbarRectangle.x,
						y: rectangle.y - toolbarRectangle.y,
						width: rectangle.width,
						height: rectangle.height,
					};
				};
				const actions = relativeRectangle('[data-testid="wishlist-toolbar-actions"]');
				return {
					toolbar: { width: toolbarRectangle.width, height: toolbarRectangle.height },
					controls: relativeRectangle('[data-testid="wishlist-toolbar-controls"]'),
					view: relativeRectangle('[data-testid="gift-view-switcher"]'),
					display: relativeRectangle('[data-testid="desktop-display-trigger"]'),
					actionsEdge: {
						right: toolbarRectangle.width - actions.x - actions.width,
						y: actions.y,
						height: actions.height,
					},
				};
			});

		const desktopBefore = await desktopGeometry();
		await startGiftReorder(page);
		const desktopDone = page.getByRole('button', { name: 'Hotovo', exact: true });
		await expect(desktopDone).toBeFocused();
		await expect(
			page.locator('[role="status"]').filter({ hasText: 'Režim změny pořadí zapnut.' }),
		).toHaveCount(1);
		expect(await desktopGeometry()).toEqual(desktopBefore);
		for (const control of [
			page.getByTestId('gift-view-card'),
			page.getByTestId('gift-view-list'),
		]) {
			await expect(control).toBeVisible();
			await expect(control).toBeEnabled();
		}
		await expect(page.getByTestId('desktop-display-trigger')).toBeDisabled();
		await expect(
			page.getByRole('button', { name: 'Přidat dárek', exact: true }),
		).toBeDisabled();
		await desktopDone.click();

		await page.setViewportSize({ width: 390, height: 844 });
		const mobileGeometry = () =>
			page.evaluate(() => {
				const toolbar = document.querySelector<HTMLElement>(
					'[data-testid="wishlist-toolbar"]',
				);
				const mobile = document.querySelector<HTMLElement>(
					'[data-testid="wishlist-toolbar-mobile"]',
				);
				const row = document.querySelector<HTMLElement>('[data-mobile-toolbar-row]');
				const view = row?.querySelector<HTMLElement>('[data-testid="gift-view-switcher"]');
				if (!toolbar || !mobile || !row || !view) {
					throw new Error('Missing mobile toolbar region');
				}
				const origin = toolbar.getBoundingClientRect();
				return [toolbar, mobile, row, view].map((element) => {
					const rectangle = element.getBoundingClientRect();
					return {
						x: rectangle.x - origin.x,
						y: rectangle.y - origin.y,
						width: rectangle.width,
						height: rectangle.height,
					};
				});
			});
		await expect(page.locator('[data-mobile-toolbar-row]:visible')).toHaveCount(1);
		const browseGeometry = await mobileGeometry();
		const mobileMore = page.getByTestId('mobile-more-trigger');
		await mobileMore.click();
		await page
			.getByRole('dialog', { name: 'Další možnosti' })
			.getByRole('button', { name: 'Změnit pořadí', exact: true })
			.click();
		const mobileDone = page.getByRole('button', { name: 'Hotovo', exact: true });
		await expect(page.getByText('Změna pořadí', { exact: true })).toBeVisible();
		await expect(mobileDone).toBeFocused();
		await expect(
			page.locator('[role="status"]').filter({ hasText: 'Režim změny pořadí zapnut.' }),
		).toHaveCount(1);
		expect(await mobileGeometry()).toEqual(browseGeometry);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
			),
		).toBe(true);
		await mobileDone.click();
		await expect(mobileMore).toBeFocused();
		await expect(
			page.locator('[role="status"]').filter({ hasText: 'Režim změny pořadí ukončen.' }),
		).toHaveCount(1);
		expect(await mobileGeometry()).toEqual(browseGeometry);
		expect(errors).toEqual([]);
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
			unidentifiedTarget: false,
		});
		expect(errors).toEqual([]);
		await page.context().close();
	});
});
