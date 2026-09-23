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
