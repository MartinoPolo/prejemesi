import {
	devices,
	expect,
	test,
	type BrowserContext,
	type CDPSession,
	type Locator,
	type Page,
	type Response,
} from '@playwright/test';
import { createTestUser } from '../e2e/fixtures/test-data.js';
import { parseCookiesForContext, registerViaApi } from '../e2e/fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	startGiftReorder,
} from '../e2e/fixtures/wishlist-helpers.js';
import { resetAllScroll, waitForGiftAnimationsToSettle } from '../e2e/mobile-wishlist.helpers.js';

const REORDER_HANDLE = 'Přesunout dárek';
/** Comfortably past the 300 ms long-press that turns a touch on the card into a drag. */
const LONG_PRESS_HOLD_MS = 450;
const DRAG_STEPS = 16;

interface ScreenPoint {
	x: number;
	y: number;
}

function isSuccessfulRemoteMutation(response: Response): boolean {
	return (
		response.request().method() === 'POST' &&
		response.url().includes('/_app/remote/') &&
		response.ok()
	);
}

function giftItems(page: Page): Locator {
	return page.locator('[data-gift-item]:not([data-gift-reorder-overlay])');
}

function giftItem(page: Page, name: string): Locator {
	return giftItems(page).filter({
		has: page.getByRole('heading', { name, exact: true, level: 3 }),
	});
}

function reorderHandle(page: Page, name: string): Locator {
	return giftItem(page, name).getByRole('button', { name: REORDER_HANDLE, exact: true });
}

function visibleGiftNames(page: Page): Promise<string[]> {
	return giftItems(page).getByRole('heading', { level: 3 }).allTextContents();
}

function contentScrollTop(page: Page): Promise<number> {
	return page.locator('main').evaluate((element) => element.scrollTop);
}

/** Phone cards stack one per row, so a drag between neighbours needs both on screen. */
async function scrollCardToTop(page: Page, name: string) {
	const card = await giftItem(page, name).elementHandle();
	await page.locator('main').evaluate((main, cardElement) => {
		const offset =
			cardElement!.getBoundingClientRect().top - main.getBoundingClientRect().top - 8;
		main.scrollTop += offset;
	}, card);
	await waitForGiftAnimationsToSettle(page);
}

async function centerOf(locator: Locator): Promise<ScreenPoint> {
	await waitForGiftAnimationsToSettle(locator.page());
	const box = await locator.boundingBox();
	expect(box, 'element has a bounding box').not.toBeNull();
	return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/** The card's center lies on its body, clear of the top-left grip and bottom-right controls. */
function cardBody(page: Page, name: string): Promise<ScreenPoint> {
	return centerOf(giftItem(page, name));
}

function pathPoint(from: ScreenPoint, to: ScreenPoint, step: number): ScreenPoint {
	return {
		x: from.x + ((to.x - from.x) * step) / DRAG_STEPS,
		y: from.y + ((to.y - from.y) * step) / DRAG_STEPS,
	};
}

async function signInContext(
	context: BrowserContext,
	cookies: string[],
	baseURL: string,
): Promise<Page> {
	await context.addCookies(parseCookiesForContext(cookies, baseURL));
	return context.newPage();
}

async function createWishlistWithGifts(page: Page, title: string, names: readonly string[]) {
	await createWishlistAndNavigate(page, title);
	for (const name of names) {
		await addGift(page, name);
	}
	await expect(giftItems(page)).toHaveCount(names.length, { timeout: 10_000 });
	return new URL(page.url()).pathname;
}

/** Records the pointer type of every press so the spec proves which input started each drag. */
async function recordPressPointerTypes(page: Page) {
	await page.evaluate(() => {
		const types: string[] = [];
		Object.assign(window, { pressPointerTypes: types });
		window.addEventListener('pointerdown', (event) => types.push(event.pointerType), {
			capture: true,
		});
	});
}

function pressPointerTypes(page: Page): Promise<string[]> {
	return page.evaluate(
		() => (window as unknown as { pressPointerTypes: string[] }).pressPointerTypes,
	);
}

async function dragWithMouse(page: Page, from: ScreenPoint, to: ScreenPoint) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: DRAG_STEPS });
	await page.mouse.up();
}

async function dragWithPen(cdp: CDPSession, from: ScreenPoint, to: ScreenPoint) {
	const pen = { pointerType: 'pen', button: 'left' } as const;
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mousePressed',
		...from,
		...pen,
		buttons: 1,
		clickCount: 1,
	});
	for (let step = 1; step <= DRAG_STEPS; step += 1) {
		await cdp.send('Input.dispatchMouseEvent', {
			type: 'mouseMoved',
			...pathPoint(from, to, step),
			...pen,
			buttons: 1,
		});
	}
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mouseReleased',
		...to,
		...pen,
		buttons: 0,
		clickCount: 1,
	});
}

async function dragWithTouch(
	page: Page,
	cdp: CDPSession,
	from: ScreenPoint,
	to: ScreenPoint,
	holdMs: number,
) {
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
	await page.waitForTimeout(holdMs);
	for (let step = 1; step <= DRAG_STEPS; step += 1) {
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [pathPoint(from, to, step)],
		});
		await page.evaluate(
			() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
		);
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('mouse and pen drag a gift from anywhere on its card, keyboard reorder still works (#530)', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-whole-card-pointer');
	const cookies = await registerViaApi(request, baseURL!, user);
	const context = await browser.newContext();
	try {
		const page = await signInContext(context, cookies, baseURL!);
		const [a, b, c] = ['Card Drag Gift A', 'Card Drag Gift B', 'Card Drag Gift C'] as const;
		await createWishlistWithGifts(page, 'Whole Card Drag Pointer', [a, b, c]);
		await startGiftReorder(page);
		await recordPressPointerTypes(page);
		await expect(giftItem(page, a)).toHaveCSS('cursor', 'grab');

		const mouseMutation = page.waitForResponse(isSuccessfulRemoteMutation, {
			timeout: 15_000,
		});
		await dragWithMouse(page, await cardBody(page, a), await cardBody(page, c));
		await mouseMutation;
		await expect.poll(() => visibleGiftNames(page)).toEqual([b, c, a]);

		const cdp = await context.newCDPSession(page);
		const penMutation = page.waitForResponse(isSuccessfulRemoteMutation, { timeout: 15_000 });
		await dragWithPen(cdp, await cardBody(page, a), await cardBody(page, b));
		await penMutation;
		await expect.poll(() => visibleGiftNames(page)).toEqual([a, b, c]);
		expect(await pressPointerTypes(page)).toEqual(['mouse', 'pen']);

		const keyboardMutation = page.waitForResponse(isSuccessfulRemoteMutation, {
			timeout: 15_000,
		});
		await reorderHandle(page, a).focus();
		await reorderHandle(page, a).press('ArrowDown');
		await keyboardMutation;
		await expect.poll(() => visibleGiftNames(page)).toEqual([b, a, c]);

		await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
		await page.reload({ waitUntil: 'load' });
		await expect.poll(() => visibleGiftNames(page), { timeout: 10_000 }).toEqual([b, a, c]);
	} finally {
		await context.close();
	}
});

test('on touch, swiping over cards scrolls while the grip and a long press drag (#530)', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-reorder-whole-card-touch');
	const cookies = await registerViaApi(request, baseURL!, user);
	const setupContext = await browser.newContext();
	const touchContext = await browser.newContext({ ...devices['Pixel 7'] });
	try {
		const names = ['Touch Gift A', 'Touch Gift B', 'Touch Gift C'] as const;
		const [a, b] = names;
		const setupPage = await signInContext(setupContext, cookies, baseURL!);
		const path = await createWishlistWithGifts(setupPage, 'Whole Card Drag Touch', names);

		const page = await signInContext(touchContext, cookies, baseURL!);
		await page.goto(path);
		await expect(giftItems(page)).toHaveCount(names.length, { timeout: 10_000 });
		await startGiftReorder(page);
		await recordPressPointerTypes(page);
		const cdp = await touchContext.newCDPSession(page);
		const reorderRequests: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('reorderGifts')) {
				reorderRequests.push(request.url());
			}
		});

		await resetAllScroll(page);
		const swipeStart = await cardBody(page, a);
		await dragWithTouch(page, cdp, swipeStart, { x: swipeStart.x, y: swipeStart.y - 200 }, 0);
		await expect.poll(() => contentScrollTop(page)).toBeGreaterThan(100);
		await expect(page.locator('[data-gift-reorder-overlay]')).toHaveCount(0);
		await page.waitForTimeout(LONG_PRESS_HOLD_MS);
		expect(await visibleGiftNames(page)).toEqual([...names]);
		expect(reorderRequests).toEqual([]);

		await scrollCardToTop(page, a);
		const longPressMutation = page.waitForResponse(isSuccessfulRemoteMutation, {
			timeout: 15_000,
		});
		const scrollBeforeLongPressDrag = await contentScrollTop(page);
		// Dragging upward would scroll the page down if the touch were still panning it.
		await dragWithTouch(
			page,
			cdp,
			await cardBody(page, b),
			await cardBody(page, a),
			LONG_PRESS_HOLD_MS,
		);
		await longPressMutation;
		await expect.poll(() => visibleGiftNames(page)).toEqual([b, a, ...names.slice(2)]);
		expect(await contentScrollTop(page)).toBeLessThanOrEqual(scrollBeforeLongPressDrag);

		// The lower card's grip, since the sticky toolbar covers the top of the content area.
		await scrollCardToTop(page, b);
		const gripMutation = page.waitForResponse(isSuccessfulRemoteMutation, { timeout: 15_000 });
		const grip = await centerOf(reorderHandle(page, a));
		const aCenter = await cardBody(page, a);
		const bCenter = await cardBody(page, b);
		await dragWithTouch(
			page,
			cdp,
			grip,
			{ x: grip.x + bCenter.x - aCenter.x, y: grip.y + bCenter.y - aCenter.y },
			0,
		);
		await gripMutation;
		await expect.poll(() => visibleGiftNames(page)).toEqual([...names]);
		expect(new Set(await pressPointerTypes(page))).toEqual(new Set(['touch']));
	} finally {
		await touchContext.close();
		await setupContext.close();
	}
});
