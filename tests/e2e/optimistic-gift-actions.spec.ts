import { test, expect, type Locator, type Page } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	openDesktopDisplaySubmenu,
	shareWishlist,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';
import { addQuantityGift } from './mobile-wishlist.helpers.js';
import { dismissToasts, gift, waitForToast } from './wishlist-gift-actions.helpers.js';

/**
 * Optimistic gift actions: a cancelled reservation and a priority or category change from the
 * More menu show their new state while the request is still in flight, roll back to the exact
 * prior state with an error toast when the server fails, never flash the old state, apply rapid
 * changes in click order and keep the confirmed state after a reload.
 */

const REQUEST_TIMEOUT_MS = 15_000;

async function withinTimeout<Value>(promise: Promise<Value>, message: string): Promise<Value> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), REQUEST_TIMEOUT_MS);
	});
	try {
		return await Promise.race([promise, timeout]);
	} finally {
		clearTimeout(timer);
	}
}

type HeldOutcome = 'succeed' | 'fail';

/**
 * Holds the first call of the named remote command until the test settles it; later calls pass
 * straight through. `forwardedPayloads` lists request bodies in the order they reached the server.
 */
async function holdFirstRemoteCommand(page: Page, exportName: string) {
	const routePattern = `**/_app/remote/**/${exportName}`;
	const forwardedPayloads: string[] = [];
	let settleFirst!: (outcome: HeldOutcome) => void;
	const firstOutcome = new Promise<HeldOutcome>((resolve) => (settleFirst = resolve));
	let markFirstRequested!: (payload: string) => void;
	const firstRequested = new Promise<string>((resolve) => (markFirstRequested = resolve));
	let callCount = 0;
	await page.route(routePattern, async (route) => {
		const payload = route.request().postData() ?? '';
		callCount += 1;
		if (callCount === 1) {
			markFirstRequested(payload);
			if ((await firstOutcome) === 'fail') {
				await route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({ message: 'simulated server failure' }),
				});
				return;
			}
		}
		forwardedPayloads.push(payload);
		await route.continue();
	});
	return {
		forwardedPayloads,
		requested: () =>
			withinTimeout(
				firstRequested,
				`The ${exportName} request never reached the browser route`,
			),
		succeed: () => settleFirst('succeed'),
		fail: () => settleFirst('fail'),
		/** Lets a still-held request fail and removes the route; safe after the request settled. */
		release: async () => {
			settleFirst('fail');
			await page.unrouteAll({ behavior: 'ignoreErrors' });
		},
	};
}

async function chooseGrouping(page: Page, grouping: 'Podle priority' | 'Podle kategorie') {
	const submenu = await openDesktopDisplaySubmenu(page, /^Seskupení/);
	const item = submenu.getByRole('menuitemradio', { name: grouping, exact: true });
	await item.focus();
	await item.press('Enter');
	await expect(submenu).not.toBeVisible();
}

/** Gift names per visible group heading, sorted by name. */
async function groupedGiftNames(page: Page): Promise<Record<string, string[]>> {
	return page.locator('[data-wishlist-gift-collection]').evaluate((collection) => {
		const groups: Record<string, string[]> = {};
		let currentGroup = '';
		for (const element of collection.querySelectorAll(
			'h2, [data-gift-item]:not([data-gift-reorder-overlay]) h3',
		)) {
			const text = element.textContent?.trim() ?? '';
			if (element.tagName === 'H2') {
				currentGroup = text;
				groups[currentGroup] = [];
			} else {
				groups[currentGroup]?.push(text);
			}
		}
		for (const names of Object.values(groups)) {
			names.sort();
		}
		return groups;
	});
}

async function openGiftMoreSubmenu(page: Page, giftName: string, submenuName: RegExp) {
	await gift(page, giftName).getByTestId('gift-more-actions').filter({ visible: true }).click();
	await page.getByRole('menuitem', { name: submenuName }).hover();
}

async function choosePriorityFromMoreMenu(page: Page, giftName: string, priority: string) {
	await openGiftMoreSubmenu(page, giftName, /Priorita/);
	await page.getByRole('menuitemradio', { name: priority, exact: true }).click();
}

async function toggleCategoryFromMoreMenu(page: Page, giftName: string, category: string) {
	await openGiftMoreSubmenu(page, giftName, /Kategorie/);
	await page.getByRole('menuitemcheckbox', { name: category, exact: true }).click();
}

function priorityBadge(page: Page, giftName: string) {
	return gift(page, giftName).getByTestId('gift-priority-badge');
}

function categoryBadges(page: Page, giftName: string) {
	return gift(page, giftName).getByTestId('gift-category-badge').filter({ visible: true });
}

/**
 * Records every distinct set of priority badge texts the gift shows, sampled on each DOM mutation
 * and animation frame so a momentary flash of an earlier value is caught. Returns a stop function
 * that resolves to the samples, each joined with `|`.
 */
async function recordPriorityBadgeTexts(page: Page, giftName: string) {
	await page.evaluate((name) => {
		const samples: string[] = [];
		const sample = () => {
			const texts = [
				...document.querySelectorAll(
					'[data-wishlist-gift-collection] [data-gift-item]:not([data-gift-reorder-overlay]) h3',
				),
			]
				.filter((heading) => heading.textContent?.trim() === name)
				.map(
					(heading) =>
						heading
							.closest('[data-gift-item]')
							?.querySelector('[data-testid="gift-priority-badge"]')
							?.textContent?.trim() ?? '',
				);
			const text = [...new Set(texts)].sort().join('|');
			if (samples.at(-1) !== text) {
				samples.push(text);
			}
		};
		const observer = new MutationObserver(sample);
		observer.observe(document.body, {
			subtree: true,
			childList: true,
			characterData: true,
			attributes: true,
		});
		let frame = 0;
		const sampleEveryFrame = () => {
			sample();
			frame = requestAnimationFrame(sampleEveryFrame);
		};
		sampleEveryFrame();
		Object.assign(window, {
			stopPriorityBadgeRecording: () => {
				observer.disconnect();
				cancelAnimationFrame(frame);
				return samples;
			},
		});
	}, giftName);
	return () =>
		page.evaluate(() =>
			(
				window as unknown as { stopPriorityBadgeRecording: () => string[] }
			).stopPriorityBadgeRecording(),
		);
}

test('a priority change regroups the gift at once, rolls back on failure and persists without a flash', async ({
	browser,
	request,
	baseURL,
}) => {
	// Fresh accounts, a wishlist and several held round trips exceed the default budget on a busy dev server.
	test.slow();
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('optimistic-priority'),
	);
	try {
		const highGift = 'Optimistický drak';
		const mediumGift = 'Optimistický míč';
		await createWishlistAndNavigate(page, 'Optimistické priority');
		await addGift(page, highGift, { priority: 'Vysoká' });
		await addGift(page, mediumGift, { priority: 'Střední' });
		await chooseGrouping(page, 'Podle priority');
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Vysoká: [highGift], Střední: [mediumGift] });

		const failingUpdate = await holdFirstRemoteCommand(page, 'updateGift');
		try {
			await choosePriorityFromMoreMenu(page, mediumGift, 'Vysoká');
			await failingUpdate.requested();
			await expect(priorityBadge(page, mediumGift)).toHaveText('Vysoká');
			await expect
				.poll(() => groupedGiftNames(page))
				.toMatchObject({ Vysoká: [highGift, mediumGift].sort() });

			failingUpdate.fail();
			await waitForToast(page, m.error_generic());
			await expect(priorityBadge(page, mediumGift)).toHaveText('Střední');
			await expect
				.poll(() => groupedGiftNames(page))
				.toMatchObject({ Vysoká: [highGift], Střední: [mediumGift] });
		} finally {
			await failingUpdate.release();
		}
		await dismissToasts(page);

		const stopRecording = await recordPriorityBadgeTexts(page, mediumGift);
		const succeedingUpdate = await holdFirstRemoteCommand(page, 'updateGift');
		try {
			await choosePriorityFromMoreMenu(page, mediumGift, 'Vysoká');
			await succeedingUpdate.requested();
			await expect(priorityBadge(page, mediumGift)).toHaveText('Vysoká');
			succeedingUpdate.succeed();
			await waitForToast(page, m.toast_gift_updated());
		} finally {
			await succeedingUpdate.release();
		}
		await page.evaluate(
			() =>
				new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				),
		);
		const badgeTexts = await stopRecording();
		const timeline = `priority badge over time: ${badgeTexts.join(' → ')}`;
		expect(badgeTexts[0], timeline).toBe('Střední');
		expect(
			badgeTexts.slice(1).filter((texts) => texts.split('|').includes('Střední')),
			timeline,
		).toEqual([]);
		expect(badgeTexts.at(-1), timeline).toBe('Vysoká');

		await page.reload({ waitUntil: 'load' });
		await expect(priorityBadge(page, mediumGift)).toHaveText('Vysoká');
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Vysoká: [highGift, mediumGift].sort() });
	} finally {
		await page.context().close();
	}
});

test('rapid priority changes on one gift reach the server in click order and keep the last choice', async ({
	browser,
	request,
	baseURL,
}) => {
	test.slow();
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('optimistic-priority-rapid'),
	);
	try {
		const giftName = 'Optimistický vlak';
		await createWishlistAndNavigate(page, 'Rychlé změny priority');
		await addGift(page, giftName, { priority: 'Střední' });
		await chooseGrouping(page, 'Podle priority');
		await expect.poll(() => groupedGiftNames(page)).toMatchObject({ Střední: [giftName] });

		const heldUpdate = await holdFirstRemoteCommand(page, 'updateGift');
		try {
			await choosePriorityFromMoreMenu(page, giftName, 'Vysoká');
			const firstPayload = await heldUpdate.requested();
			await expect(priorityBadge(page, giftName)).toHaveText('Vysoká');

			await choosePriorityFromMoreMenu(page, giftName, 'Nízká');
			await expect(priorityBadge(page, giftName)).toHaveText('Nízká');
			await expect.poll(() => groupedGiftNames(page)).toMatchObject({ Nízká: [giftName] });

			heldUpdate.succeed();
			await expect.poll(() => heldUpdate.forwardedPayloads.length).toBe(2);
			const [firstForwarded, secondForwarded] = heldUpdate.forwardedPayloads;
			expect(firstForwarded, 'the first click must reach the server first').toBe(
				firstPayload,
			);
			expect(secondForwarded).not.toBe(firstPayload);
			await expect(
				page
					.locator('[data-sonner-toast]')
					.filter({ hasText: m.toast_gift_updated() })
					.first(),
			).toBeVisible();
			await expect(priorityBadge(page, giftName)).toHaveText('Nízká');
			await expect.poll(() => groupedGiftNames(page)).toMatchObject({ Nízká: [giftName] });
		} finally {
			await heldUpdate.release();
		}

		await page.reload({ waitUntil: 'load' });
		await expect(priorityBadge(page, giftName)).toHaveText('Nízká');
		await expect.poll(() => groupedGiftNames(page)).toMatchObject({ Nízká: [giftName] });
	} finally {
		await page.context().close();
	}
});

test('a category change regroups the gift at once, rolls back on failure and persists on success', async ({
	browser,
	request,
	baseURL,
}) => {
	test.slow();
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('optimistic-category'),
	);
	try {
		const bookGift = 'Optimistická kniha';
		const looseGift = 'Optimistický sešit';
		await createWishlistAndNavigate(page, 'Optimistické kategorie');
		await addGift(page, bookGift, { category: 'Knihy' });
		await addGift(page, looseGift);
		await chooseGrouping(page, 'Podle kategorie');
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Knihy: [bookGift], 'Bez kategorie': [looseGift] });
		await expect(categoryBadges(page, looseGift)).toHaveCount(0);

		const heldUpdate = await holdFirstRemoteCommand(page, 'updateGift');
		try {
			await toggleCategoryFromMoreMenu(page, looseGift, 'Knihy');
			await heldUpdate.requested();
			await expect(categoryBadges(page, looseGift)).toHaveText(['Knihy']);
			await expect
				.poll(() => groupedGiftNames(page))
				.toMatchObject({ Knihy: [bookGift, looseGift].sort() });

			heldUpdate.fail();
			await waitForToast(page, m.error_generic());
			await expect(categoryBadges(page, looseGift)).toHaveCount(0);
			await expect
				.poll(() => groupedGiftNames(page))
				.toMatchObject({ Knihy: [bookGift], 'Bez kategorie': [looseGift] });
		} finally {
			await heldUpdate.release();
		}
		await dismissToasts(page);

		await toggleCategoryFromMoreMenu(page, looseGift, 'Knihy');
		await waitForToast(page, m.toast_gift_updated());
		await page.reload({ waitUntil: 'load' });
		await expect(categoryBadges(page, looseGift)).toHaveText(['Knihy']);
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Knihy: [bookGift, looseGift].sort() });
	} finally {
		await page.context().close();
	}
});

async function reserveOneUnit(page: Page, giftName: string) {
	await gift(page, giftName).getByTestId('reserve-button').filter({ visible: true }).click();
	const reserveDialog = page.getByRole('dialog');
	await reserveDialog.getByRole('button', { name: 'Rezervovat', exact: true }).click();
	await expect(reserveDialog).not.toBeVisible({ timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
}

function visibleStateBadge(giftRow: Locator, kind: 'partial' | 'own-reservation') {
	return giftRow.locator(`[data-state-kind="${kind}"]`).filter({ visible: true });
}

test('cancelling a reservation frees its unit at once, rolls back on failure and persists on success', async ({
	browser,
	request,
	baseURL,
}) => {
	test.slow();
	const giftName = 'Optimistické koloběžky';
	const ownerPage = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('optimistic-unreserve-owner'),
	);
	await createWishlistAndNavigate(ownerPage, 'Optimistické rezervace');
	await addQuantityGift(ownerPage, giftName, 3);
	await shareWishlist(ownerPage);
	const wishlistPath = new URL(ownerPage.url()).pathname;
	await ownerPage.context().close();

	const otherGifterPage = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('optimistic-unreserve-other'),
	);
	await otherGifterPage.goto(wishlistPath);
	await reserveOneUnit(otherGifterPage, giftName);
	await otherGifterPage.context().close();

	const gifterPage = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('optimistic-unreserve-gifter'),
	);
	try {
		await gifterPage.goto(wishlistPath);
		const giftRow = gift(gifterPage, giftName);
		const reserveButton = giftRow.getByTestId('reserve-button').filter({ visible: true });
		await expect(visibleStateBadge(giftRow, 'partial')).toHaveText('Volné 2/3');
		await reserveOneUnit(gifterPage, giftName);
		await expect(reserveButton).toHaveText(new RegExp(m.reserve_button_cancel()));
		await expect(visibleStateBadge(giftRow, 'own-reservation')).toHaveCount(1);
		await expect(visibleStateBadge(giftRow, 'partial')).toHaveText('Volné 1/3');
		await dismissToasts(gifterPage);

		const heldUnreserve = await holdFirstRemoteCommand(gifterPage, 'unreserveGift');
		try {
			await reserveButton.click();
			await heldUnreserve.requested();
			await expect(reserveButton).toHaveText(new RegExp(m.reserve_button_reserve()));
			await expect(visibleStateBadge(giftRow, 'own-reservation')).toHaveCount(0);
			await expect(visibleStateBadge(giftRow, 'partial')).toHaveText('Volné 2/3');

			heldUnreserve.fail();
			await waitForToast(gifterPage, m.error_generic());
			await expect(reserveButton).toHaveText(new RegExp(m.reserve_button_cancel()));
			await expect(visibleStateBadge(giftRow, 'own-reservation')).toHaveCount(1);
			await expect(visibleStateBadge(giftRow, 'partial')).toHaveText('Volné 1/3');
		} finally {
			await heldUnreserve.release();
		}
		await dismissToasts(gifterPage);

		await reserveButton.click();
		await waitForToast(gifterPage, m.toast_gift_unreserved());
		await gifterPage.reload({ waitUntil: 'load' });
		await expect(reserveButton).toHaveText(new RegExp(m.reserve_button_reserve()));
		await expect(visibleStateBadge(giftRow, 'partial')).toHaveText('Volné 2/3');
	} finally {
		await gifterPage.context().close();
	}
});
