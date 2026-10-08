import { test, expect, type Locator, type Page, type Response } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	addGift,
	openDesktopDisplaySubmenu,
	shareWishlist,
	startGiftReorder,
} from './fixtures/wishlist-helpers.js';

const REORDER_HANDLE = 'Přesunout dárek';

function isSuccessfulRemoteMutation(response: Response): boolean {
	return (
		response.request().method() === 'POST' &&
		response.url().includes('/_app/remote/') &&
		response.ok()
	);
}

async function visibleGiftNames(page: Page, expectedCount = 3): Promise<string[]> {
	const items = page.locator('[data-gift-item]:not([data-gift-reorder-overlay])');
	await expect(items).toHaveCount(expectedCount, { timeout: 10_000 });
	return items.getByRole('heading', { level: 3 }).allTextContents();
}

function giftItem(page: Page, name: string) {
	return page.locator('[data-gift-item]:not([data-gift-reorder-overlay])').filter({
		has: page.getByRole('heading', { name, exact: true, level: 3 }),
	});
}

test('an ambiguous reorder failure exits only after authoritative refresh confirms server order', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-ambiguous-failure');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	const context = page.context();
	try {
		await createWishlistAndNavigate(page, 'Gift Reorder Ambiguous Failure');
		const originalOrder = ['Failure Gift A', 'Failure Gift B', 'Failure Gift C'];
		for (const name of originalOrder) {
			await addGift(page, name);
		}
		await startGiftReorder(page);

		let signalForwardedMutationSettled!: () => void;
		const forwardedMutationSettled = new Promise<void>((resolve) => {
			signalForwardedMutationSettled = resolve;
		});
		let releaseLostResponse!: () => void;
		const lostResponseGate = new Promise<void>((resolve) => {
			releaseLostResponse = resolve;
		});
		await page.route('**/_app/remote/**/reorderGifts', async (route) => {
			try {
				const forwardedResponse = await route.fetch();
				expect(forwardedResponse.ok()).toBe(true);
			} catch (error) {
				if (
					!(error instanceof Error) ||
					!/ECONNRESET|socket hang up/i.test(error.message)
				) {
					throw error;
				}
			}
			signalForwardedMutationSettled();
			await lostResponseGate;
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'simulated lost mutation response' }),
			});
		});

		const firstHandle = giftItem(page, originalOrder[0]).getByRole('button', {
			name: REORDER_HANDLE,
			exact: true,
		});
		await firstHandle.focus();
		await firstHandle.press('ArrowDown');
		await forwardedMutationSettled;
		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Ukládání…', exact: true })).toBeDisabled();
		releaseLostResponse();

		const committedOrder = ['Failure Gift B', 'Failure Gift A', 'Failure Gift C'];
		await expect(page.getByText(/Načetli jsme aktuální pořadí ze serveru/)).toBeVisible();
		await expect(page.getByTestId('gift-reorder-temporary-notice')).toHaveCount(0);
		await page.unroute('**/_app/remote/**/reorderGifts');
		await startGiftReorder(page);
		await expect.poll(() => visibleGiftNames(page)).toEqual(committedOrder);
	} finally {
		await context.close();
	}
});

test('failed recovery stays unresolved and blocks reorder commits until explicit retry succeeds', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-refresh-failure');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	const context = page.context();
	try {
		await createWishlistAndNavigate(page, 'Gift Reorder Refresh Failure');
		const originalOrder = ['Refresh Gift A', 'Refresh Gift B', 'Refresh Gift C'];
		for (const name of originalOrder) {
			await addGift(page, name);
		}
		await startGiftReorder(page);

		let reorderRequests = 0;
		await page.route('**/_app/remote/**/reorderGifts', async (route) => {
			reorderRequests += 1;
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'simulated reorder failure' }),
			});
		});
		let allowAuthoritativeRefresh = false;
		await page.route('**/_app/remote/**/getGiftsByWishlistShortId*', async (route) => {
			if (allowAuthoritativeRefresh) {
				await route.continue();
				return;
			}
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'simulated refresh failure' }),
			});
		});

		const firstHandle = giftItem(page, originalOrder[0]).getByRole('button', {
			name: REORDER_HANDLE,
			exact: true,
		});
		await firstHandle.focus();
		await firstHandle.press('ArrowDown');

		const recoveryNotice = page.getByTestId('gift-reorder-recovery-notice');
		await expect(recoveryNotice).toContainText('Nemůžeme ověřit, zda se pořadí uložilo');
		await expect(page.getByRole('button', { name: REORDER_HANDLE, exact: true })).toHaveCount(
			0,
		);
		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await expect(recoveryNotice).toBeVisible();
		expect(reorderRequests).toBe(1);

		allowAuthoritativeRefresh = true;
		await recoveryNotice.getByRole('button', { name: 'Načíst pořadí znovu' }).click();
		await expect(recoveryNotice).toHaveCount(0);
		await expect(page.getByRole('button', { name: REORDER_HANDLE, exact: true })).toHaveCount(
			3,
		);
		await expect.poll(() => visibleGiftNames(page)).toEqual(originalOrder);
		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await expect(page.getByTestId('gift-reorder-temporary-notice')).toHaveCount(0);

		await page.unroute('**/_app/remote/**/reorderGifts');
		await page.unroute('**/_app/remote/**/getGiftsByWishlistShortId*');
		await startGiftReorder(page);
		await expect.poll(() => visibleGiftNames(page)).toEqual(originalOrder);
	} finally {
		await context.close();
	}
});

test('card drag preview stays stable while the pointer rests on a gift boundary', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-boundary');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	const context = page.context();
	try {
		await createWishlistAndNavigate(page, 'Gift Reorder Boundary Stability');
		const names = [
			'Reorder Boundary Gift A',
			'Reorder Boundary Gift B',
			'Reorder Boundary Gift C',
			'Reorder Boundary Gift D',
			'Reorder Boundary Gift E',
		];
		for (const name of names) {
			await addGift(page, name);
		}

		await expect(page.locator('[data-gift-item]')).toHaveCount(names.length, {
			timeout: 10_000,
		});
		await startGiftReorder(page);

		const aHandle = giftItem(page, names[0]!).getByRole('button', {
			name: REORDER_HANDLE,
			exact: true,
		});
		const bBox = await giftItem(page, names[1]!).boundingBox();
		const cBox = await giftItem(page, names[2]!).boundingBox();
		const handleBox = await aHandle.boundingBox();
		const initialOrder = await visibleGiftNames(page, names.length);
		expect(bBox, 'B card has a bounding box').not.toBeNull();
		expect(cBox, 'C card has a bounding box').not.toBeNull();
		expect(handleBox, 'A reorder handle has a bounding box').not.toBeNull();
		const boundaryX = (bBox!.x + bBox!.width + cBox!.x) / 2;
		const boundaryY = bBox!.y + bBox!.height / 2;

		await page.mouse.move(
			handleBox!.x + handleBox!.width / 2,
			handleBox!.y + handleBox!.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(boundaryX, boundaryY, { steps: 12 });

		const sampledOrders: string[] = [];
		for (let sample = 0; sample < 8; sample += 1) {
			await page.mouse.move(boundaryX, boundaryY);
			await page.evaluate(
				() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
			);
			sampledOrders.push((await visibleGiftNames(page, names.length)).join('|'));
		}

		expect(sampledOrders[0]).not.toBe(initialOrder.join('|'));
		expect(new Set(sampledOrders).size).toBe(1);
		await page.keyboard.press('Escape');
		await page.mouse.up();
		await expect
			.poll(() => visibleGiftNames(page, names.length), { timeout: 10_000 })
			.toEqual(initialOrder);
	} finally {
		await context.close();
	}
});

test('gift order persists after card drag and rapid list keyboard moves', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	const context = page.context();
	try {
		await createWishlistAndNavigate(page, 'Gift Reorder Persistence');
		const names = {
			A: 'Reorder Gift A',
			B: 'Reorder Gift B',
			C: 'Reorder Gift C',
		};
		await addGift(page, names.A);
		await addGift(page, names.B);
		await addGift(page, names.C);

		await expect(page.locator('[data-gift-item]')).toHaveCount(3, { timeout: 10_000 });
		await startGiftReorder(page);
		await expect
			.poll(() =>
				page
					.locator('body')
					.evaluate(
						(body) =>
							body
								.getAnimations({ subtree: true })
								.filter((animation) => animation.playState === 'running').length,
					),
			)
			.toBe(0);
		const aHandle = giftItem(page, names.A).getByRole('button', {
			name: REORDER_HANDLE,
			exact: true,
		});
		const handleBox = await aHandle.boundingBox();
		const targetBox = await giftItem(page, names.C).boundingBox();
		expect(handleBox, 'A reorder handle has a bounding box').not.toBeNull();
		expect(targetBox, 'C card has a bounding box').not.toBeNull();

		const cardMutation = page.waitForResponse(isSuccessfulRemoteMutation, { timeout: 15_000 });
		await page.mouse.move(
			handleBox!.x + handleBox!.width / 2,
			handleBox!.y + handleBox!.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(
			targetBox!.x + targetBox!.width / 2,
			targetBox!.y + targetBox!.height / 2,
			{ steps: 10 },
		);
		await page.mouse.up();
		await cardMutation;
		await expect
			.poll(() => visibleGiftNames(page), { timeout: 10_000 })
			.not.toEqual([names.A, names.B, names.C]);
		const cardOrder = await visibleGiftNames(page);

		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await page.reload({ waitUntil: 'load' });
		await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(cardOrder);

		await startGiftReorder(page);
		await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(cardOrder);
		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(cardOrder);

		await page.getByRole('radio', { name: 'Seznam', exact: true }).click();
		await expect(page.getByRole('radio', { name: 'Seznam', exact: true })).toBeChecked();
		await expect(page.locator('[data-wishlist-gift-collection]')).toHaveAttribute(
			'data-view-mode',
			'list',
		);
		await startGiftReorder(page);

		const bHandle = giftItem(page, names.B).getByRole('button', {
			name: REORDER_HANDLE,
			exact: true,
		});
		await bHandle.focus();
		for (let move = 0; move < 2; move += 1) {
			const keyboardMutation = page.waitForResponse(isSuccessfulRemoteMutation, {
				timeout: 15_000,
			});
			await bHandle.press('ArrowDown');
			await keyboardMutation;
		}
		await expect
			.poll(async () => (await visibleGiftNames(page)).at(-1), { timeout: 10_000 })
			.toBe(names.B);
		const listOrder = await visibleGiftNames(page);

		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await page.reload({ waitUntil: 'load' });
		const listRadio = page.getByRole('radio', { name: 'Seznam', exact: true });
		if (!(await listRadio.isChecked())) {
			await listRadio.click();
		}
		await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual(listOrder);
	} finally {
		await context.close();
	}
});

test('reorder retains order and keyboard controls while switching Grid and List', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-layout-switch');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	const context = page.context();
	try {
		await createWishlistAndNavigate(page, 'Gift Reorder Layout Switching');
		const names = ['Layout Switch Gift A', 'Layout Switch Gift B', 'Layout Switch Gift C'];
		for (const name of names) {
			await addGift(page, name);
		}

		await startGiftReorder(page);
		const listMode = page.getByRole('radio', { name: 'Seznam', exact: true });
		const gridMode = page.getByRole('radio', { name: 'Karta', exact: true });
		const giftCollection = page.locator('[data-wishlist-gift-collection]');
		await expect(listMode).toBeEnabled();
		await expect(gridMode).toBeEnabled();

		const aHandle = giftItem(page, names[0]!).getByRole('button', {
			name: REORDER_HANDLE,
			exact: true,
		});
		const cBox = await giftItem(page, names[2]!).boundingBox();
		const handleBox = await aHandle.boundingBox();
		expect(cBox).not.toBeNull();
		expect(handleBox).not.toBeNull();
		const dragMutation = page.waitForResponse(isSuccessfulRemoteMutation, { timeout: 15_000 });
		await page.mouse.move(
			handleBox!.x + handleBox!.width / 2,
			handleBox!.y + handleBox!.height / 2,
		);
		await page.mouse.down();
		await page.mouse.move(cBox!.x + cBox!.width / 2, cBox!.y + cBox!.height / 2, {
			steps: 10,
		});
		await page.mouse.up();
		await dragMutation;
		const draggedOrder = await visibleGiftNames(page);
		expect(draggedOrder).not.toEqual(names);

		await listMode.click();
		await expect(listMode).toBeChecked();
		await expect(giftCollection).toHaveAttribute('data-view-mode', 'list');
		await expect.poll(() => visibleGiftNames(page)).toEqual(draggedOrder);
		await gridMode.click();
		await expect(gridMode).toBeChecked();
		await expect(giftCollection).toHaveAttribute('data-view-mode', 'card');
		await expect.poll(() => visibleGiftNames(page)).toEqual(draggedOrder);

		await listMode.click();
		await expect(giftCollection).toHaveAttribute('data-view-mode', 'list');
		const listHandle = giftItem(page, draggedOrder[0]!).getByRole('button', {
			name: REORDER_HANDLE,
			exact: true,
		});
		const listKeyboardMutation = page.waitForResponse(isSuccessfulRemoteMutation, {
			timeout: 15_000,
		});
		await listHandle.focus();
		await listHandle.press('ArrowDown');
		await listKeyboardMutation;
		const listKeyboardOrder = [draggedOrder[1]!, draggedOrder[0]!, draggedOrder[2]!];
		await expect.poll(() => visibleGiftNames(page)).toEqual(listKeyboardOrder);

		await gridMode.click();
		await expect(giftCollection).toHaveAttribute('data-view-mode', 'card');
		await expect.poll(() => visibleGiftNames(page)).toEqual(listKeyboardOrder);
		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
	} finally {
		await context.close();
	}
});

const DROP_ZONE_TEST_ID = 'gift-reorder-drop-zone';
// Pointer drags do not auto-scroll, so keep the dragged gift and every group on screen.
const GROUPED_REORDER_VIEWPORT = { width: 1280, height: 1800 };

async function chooseGrouping(
	page: Page,
	option: 'Bez seskupení' | 'Podle priority' | 'Podle kategorie',
) {
	const submenu = await openDesktopDisplaySubmenu(page, /^Seskupení/);
	const item = submenu.getByRole('menuitemradio', { name: option, exact: true });
	await item.focus();
	await item.press('Enter');
	await expect(item).toHaveAttribute('aria-checked', 'true');
	await page.keyboard.press('Escape');
	await expect(submenu).not.toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('desktop-display-trigger')).toHaveAttribute(
		'aria-expanded',
		'false',
	);
}

/** Gift names per visible group heading, in document order. */
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
		return groups;
	});
}

async function waitForSettledAnimations(page: Page) {
	await expect
		.poll(() =>
			page
				.locator('body')
				.evaluate(
					(body) =>
						body
							.getAnimations({ subtree: true })
							.filter((animation) => animation.playState === 'running').length,
				),
		)
		.toBe(0);
}

type DropPoint = 'after' | 'center';

/** Drag a gift by its reorder handle to a point on the target (`after` = trailing half). */
async function dragGiftTo(page: Page, giftName: string, target: Locator, point: DropPoint) {
	const mutation = page.waitForResponse(isSuccessfulRemoteMutation, { timeout: 15_000 });
	await dragGiftWithPointer(page, giftName, target, point);
	await mutation;
}

async function dragGiftWithPointer(
	page: Page,
	giftName: string,
	target: Locator,
	point: DropPoint,
) {
	await waitForSettledAnimations(page);
	const handleBox = await giftItem(page, giftName)
		.getByRole('button', { name: REORDER_HANDLE, exact: true })
		.boundingBox();
	const targetBox = await target.boundingBox();
	expect(handleBox, `${giftName} reorder handle has a bounding box`).not.toBeNull();
	expect(targetBox, 'drop target has a bounding box').not.toBeNull();
	const listView =
		(await page.locator('[data-wishlist-gift-collection]').getAttribute('data-view-mode')) ===
		'list';
	const dropX =
		point === 'after' && !listView
			? targetBox!.x + targetBox!.width * 0.8
			: targetBox!.x + targetBox!.width / 2;
	const dropY =
		point === 'after' && listView
			? targetBox!.y + targetBox!.height * 0.8
			: targetBox!.y + targetBox!.height / 2;

	await page.mouse.move(
		handleBox!.x + handleBox!.width / 2,
		handleBox!.y + handleBox!.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(dropX, dropY, { steps: 12 });
	await page.mouse.up();
}

/** The drop zone an empty group shows while reordering, found through its section heading. */
async function emptyGroupDropZone(page: Page, groupName: string): Promise<Locator> {
	const groupKey = await page
		.locator('[data-gift-reorder-group]')
		.filter({ has: page.getByRole('heading', { level: 2, name: groupName, exact: true }) })
		.getAttribute('data-gift-reorder-group');
	expect(groupKey, `${groupName} section is a reorder group`).not.toBeNull();
	return page.locator(
		`[data-testid="${DROP_ZONE_TEST_ID}"][data-gift-reorder-group="${groupKey}"]`,
	);
}

test('grouped priority reorder moves gifts within and across levels and persists', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-grouped-priority');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await page.setViewportSize(GROUPED_REORDER_VIEWPORT);
	const context = page.context();
	try {
		await createWishlistAndNavigate(page, 'Grouped Priority Reorder');
		const names = {
			A: 'Grouped Gift A',
			B: 'Grouped Gift B',
			C: 'Grouped Gift C',
			D: 'Grouped Gift D',
		};
		await addGift(page, names.A, { priority: 'Vysoká' });
		await addGift(page, names.B, { priority: 'Vysoká' });
		await addGift(page, names.C, { priority: 'Střední' });
		await addGift(page, names.D);
		await chooseGrouping(page, 'Podle priority');

		await expect
			.poll(() => groupedGiftNames(page))
			.toEqual({
				Vysoká: [names.A, names.B],
				Střední: [names.C],
				'Bez priority': [names.D],
			});
		await expect(page.getByTestId(DROP_ZONE_TEST_ID)).toHaveCount(0);

		await startGiftReorder(page);
		await expect(page.getByTestId('gift-reorder-temporary-notice')).toContainText(
			'Přetažením dárku do jiné skupiny změníte jeho prioritu nebo kategorii',
		);
		await expect
			.poll(() => groupedGiftNames(page))
			.toEqual({
				Vysoká: [names.A, names.B],
				Střední: [names.C],
				Nízká: [],
				'Bez priority': [names.D],
			});
		const emptyLowZone = page.getByTestId(DROP_ZONE_TEST_ID);
		await expect(emptyLowZone).toHaveCount(1);
		await expect(emptyLowZone).toHaveText('Přetáhněte sem dárek');

		await dragGiftTo(page, names.A, giftItem(page, names.B), 'after');
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Vysoká: [names.B, names.A], Střední: [names.C] });

		const aHandle = giftItem(page, names.A).getByRole('button', {
			name: REORDER_HANDLE,
			exact: true,
		});
		const keyboardMutation = page.waitForResponse(isSuccessfulRemoteMutation, {
			timeout: 15_000,
		});
		await aHandle.focus();
		await aHandle.press('ArrowDown');
		await keyboardMutation;
		await expect(
			page
				.locator('[role="status"]')
				.filter({ hasText: `${names.A} přesunut do skupiny Střední, pozice 1 z 2.` }),
		).toHaveCount(1);
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Vysoká: [names.B], Střední: [names.A, names.C] });
		await expect(aHandle).toBeFocused();

		// Focus stays on the moved gift's handle, so further presses keep moving it.
		for (const [key, mediumGroup] of [
			['ArrowDown', [names.C, names.A]],
			['ArrowUp', [names.A, names.C]],
		] as const) {
			const mutation = page.waitForResponse(isSuccessfulRemoteMutation, {
				timeout: 15_000,
			});
			await page.keyboard.press(key);
			await mutation;
			await expect
				.poll(() => groupedGiftNames(page))
				.toMatchObject({ Vysoká: [names.B], Střední: mediumGroup });
			await expect(aHandle).toBeFocused();
		}

		await dragGiftTo(page, names.C, emptyLowZone, 'center');
		await expect
			.poll(() => groupedGiftNames(page))
			.toEqual({
				Vysoká: [names.B],
				Střední: [names.A],
				Nízká: [names.C],
				'Bez priority': [names.D],
			});
		await expect(page.getByTestId(DROP_ZONE_TEST_ID)).toHaveCount(0);
		await expect(page.getByText(`${names.C} přesunut do skupiny Nízká.`)).toBeVisible();

		const undoMutation = page.waitForResponse(isSuccessfulRemoteMutation, { timeout: 15_000 });
		await page.getByRole('button', { name: 'Vrátit', exact: true }).click();
		await undoMutation;
		await expect
			.poll(() => groupedGiftNames(page))
			.toEqual({
				Vysoká: [names.B],
				Střední: [names.A, names.C],
				Nízká: [],
				'Bez priority': [names.D],
			});
		await expect(page.getByTestId(DROP_ZONE_TEST_ID)).toHaveCount(1);

		await dragGiftTo(page, names.D, giftItem(page, names.B), 'after');
		const committedGroups = {
			Vysoká: [names.B, names.D],
			Střední: [names.A, names.C],
		};
		await expect
			.poll(() => groupedGiftNames(page))
			.toEqual({ ...committedGroups, Nízká: [], 'Bez priority': [] });

		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await expect.poll(() => groupedGiftNames(page)).toEqual(committedGroups);
		await expect(page.getByTestId(DROP_ZONE_TEST_ID)).toHaveCount(0);

		await page.reload({ waitUntil: 'load' });
		await expect.poll(() => groupedGiftNames(page)).toEqual(committedGroups);
		await expect(page.getByTestId(DROP_ZONE_TEST_ID)).toHaveCount(0);

		// One global manual order: B<->A permuted Vysoká's slots, A entered Střední right before
		// C, C's undone trip to the empty Nízká kept its slot, and D landed right after B.
		await chooseGrouping(page, 'Bez seskupení');
		await expect
			.poll(() => visibleGiftNames(page, 4))
			.toEqual([names.B, names.D, names.A, names.C]);
	} finally {
		await context.close();
	}
});

test('a failed grouped save returns the moved gift to its original priority', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-grouped-failure');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await page.setViewportSize(GROUPED_REORDER_VIEWPORT);
	const context = page.context();
	try {
		await createWishlistAndNavigate(page, 'Grouped Reorder Failure');
		const highGift = 'Failing High Gift';
		const mediumGift = 'Failing Medium Gift';
		await addGift(page, highGift, { priority: 'Vysoká' });
		await addGift(page, mediumGift, { priority: 'Střední' });
		await chooseGrouping(page, 'Podle priority');
		await startGiftReorder(page);
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Vysoká: [highGift], Střední: [mediumGift] });

		await page.route('**/_app/remote/**/reorderGifts', async (route) => {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'simulated grouped reorder failure' }),
			});
		});
		await dragGiftWithPointer(page, highGift, giftItem(page, mediumGift), 'after');

		await expect(page.getByText(/Načetli jsme aktuální pořadí ze serveru/)).toBeVisible();
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Vysoká: [highGift], Střední: [mediumGift] });
		await page.unroute('**/_app/remote/**/reorderGifts');

		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await expect(page.getByTestId('gift-reorder-temporary-notice')).toHaveCount(0);
		await page.reload({ waitUntil: 'load' });
		await expect
			.poll(() => groupedGiftNames(page))
			.toEqual({ Vysoká: [highGift], Střední: [mediumGift] });
	} finally {
		await context.close();
	}
});

test('reorder falls back to the ungrouped order when priority levels cannot load, then retries', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-levels-failure');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	const context = page.context();
	try {
		await createWishlistAndNavigate(page, 'Grouped Reorder Levels Failure');
		await addGift(page, 'Levels High Gift', { priority: 'Vysoká' });
		await addGift(page, 'Levels Loose Gift');
		await chooseGrouping(page, 'Podle priority');

		await page.route('**/_app/remote/**/getPriorityLevels*', async (route) => {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'simulated priority level failure' }),
			});
		});
		await page.reload({ waitUntil: 'load' });
		await expect(
			page.getByRole('heading', { name: 'Levels High Gift', level: 3 }),
		).toBeVisible();

		const reorderNotice = page.getByTestId('gift-reorder-temporary-notice');
		await startGiftReorder(page);
		await expect(reorderNotice).toContainText('bez seskupení, řazení a filtrů');
		await expect(page.getByTestId(DROP_ZONE_TEST_ID)).toHaveCount(0);
		await expect
			.poll(() => visibleGiftNames(page, 2))
			.toEqual(['Levels High Gift', 'Levels Loose Gift']);
		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await expect(reorderNotice).toHaveCount(0);

		await page.unroute('**/_app/remote/**/getPriorityLevels*');
		await startGiftReorder(page);
		await expect(reorderNotice).toContainText('Přetažením dárku do jiné skupiny');
		await expect(page.getByTestId(DROP_ZONE_TEST_ID)).toHaveCount(2);
	} finally {
		await context.close();
	}
});

test('grouped category reorder on a shared wishlist changes the category with post-share disclosure', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-grouped-category');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await page.setViewportSize(GROUPED_REORDER_VIEWPORT);
	const context = page.context();
	try {
		await createWishlistAndNavigate(page, 'Grouped Category Reorder');
		const bookGift = 'Category Book Gift';
		const looseGift = 'Category Loose Gift';
		await addGift(page, bookGift, { category: 'Knihy' });
		await addGift(page, looseGift);
		await shareWishlist(page);
		await chooseGrouping(page, 'Podle kategorie');

		const listMode = page.getByRole('radio', { name: 'Seznam', exact: true });
		await listMode.click();
		await expect(page.locator('[data-wishlist-gift-collection]')).toHaveAttribute(
			'data-view-mode',
			'list',
		);
		await expect
			.poll(() => groupedGiftNames(page))
			.toEqual({ Knihy: [bookGift], 'Bez kategorie': [looseGift] });

		await startGiftReorder(page);
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Knihy: [bookGift], 'Bez kategorie': [looseGift] });

		await dragGiftTo(page, looseGift, giftItem(page, bookGift), 'after');
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Knihy: [bookGift, looseGift], 'Bez kategorie': [] });
		await expect(page.getByText(`${looseGift} přesunut do skupiny Knihy.`)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Vrátit', exact: true })).toBeVisible();

		await dragGiftTo(page, bookGift, await emptyGroupDropZone(page, 'Hry'), 'center');
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Hry: [bookGift], Knihy: [looseGift], 'Bez kategorie': [] });

		await dragGiftTo(page, bookGift, await emptyGroupDropZone(page, 'Bez kategorie'), 'center');
		await expect
			.poll(() => groupedGiftNames(page))
			.toMatchObject({ Hry: [], Knihy: [looseGift], 'Bez kategorie': [bookGift] });

		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await page.reload({ waitUntil: 'load' });
		await expect
			.poll(() => groupedGiftNames(page))
			.toEqual({ Knihy: [looseGift], 'Bez kategorie': [bookGift] });

		await giftItem(page, looseGift)
			.getByRole('heading', { name: looseGift, exact: true, level: 3 })
			.click();
		const giftDialog = page.getByRole('dialog');
		await expect(giftDialog).toBeVisible({ timeout: 5_000 });
		await expect(giftDialog.getByText(/Upraveno po sdílení/)).toBeVisible({
			timeout: 10_000,
		});
	} finally {
		await context.close();
	}
});
