import { test, expect, type Page, type Response } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	addGift,
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

		let signalMutationCommitted!: () => void;
		const mutationCommitted = new Promise<void>((resolve) => {
			signalMutationCommitted = resolve;
		});
		let releaseLostResponse!: () => void;
		const lostResponseGate = new Promise<void>((resolve) => {
			releaseLostResponse = resolve;
		});
		await page.route('**/_app/remote/**/reorderGifts', async (route) => {
			const committedResponse = await route.fetch();
			expect(committedResponse.ok()).toBe(true);
			signalMutationCommitted();
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
		await mutationCommitted;
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
		const gridHandle = giftItem(page, listKeyboardOrder[0]!).getByRole('button', {
			name: REORDER_HANDLE,
			exact: true,
		});
		const gridKeyboardMutation = page.waitForResponse(isSuccessfulRemoteMutation, {
			timeout: 15_000,
		});
		await gridHandle.focus();
		await gridHandle.press('ArrowDown');
		await gridKeyboardMutation;
		const finalOrder = [listKeyboardOrder[1]!, listKeyboardOrder[0]!, listKeyboardOrder[2]!];
		await expect.poll(() => visibleGiftNames(page)).toEqual(finalOrder);

		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await page.reload({ waitUntil: 'load' });
		await expect.poll(() => visibleGiftNames(page)).toEqual(finalOrder);
	} finally {
		await context.close();
	}
});
