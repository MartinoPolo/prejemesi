import {
	expect,
	type Browser,
	type Locator,
	type Page,
	type Request,
	type Response,
} from '@playwright/test';
import * as m from '../../../src/lib/paraglide/messages.js';
import { waitForAppHydration } from '../../e2e/fixtures/auth-helpers.js';
import {
	clickWishlistToolbarMoreAction,
	createWishlistAndNavigate,
	openDesktopDisplaySubmenu,
	shareWishlist,
	startGiftReorder,
	waitForDialogOverlayRemoval,
} from '../../e2e/fixtures/wishlist-helpers.js';
import {
	GIFT_CARD_SURFACE,
	type GiftCardOutcome,
	type GiftCardState,
	type SurfaceCase,
} from './inventory.js';
import { describeSurfaceCases, type AssertionGuard } from './support/cases.js';
import { oncePerRun } from './support/run-fixture.js';
import {
	openSession,
	registerUser,
	releaseFocusAndPointer,
	requireTouch,
	testWithWorld,
	withSignedInPage,
	type InteractionSession,
} from './support/session.js';
import {
	expectAnimationsFinished,
	expectPageSettled,
	expectScrollAtRest,
	nextFrames,
} from './support/settled.js';
import {
	mouseDrag,
	pointOf,
	rightClick,
	type NativeContextMenuResult,
	type PressTarget,
} from './support/touch.js';
import { addFixtureGift, type FixtureGift } from './support/wishlist.js';

/*
 * Generated from `GIFT_CARD_SURFACE` in ./inventory.ts: one case per capability and possible state.
 * One run builds three wishlists with the same gifts (see `FixtureList`); each group then reuses
 * one page per viewport and role and resets only the state that differs between cases.
 */

const PRESSED_GIFT = 'Kolo pro výlety';
/** The first two gifts, in creation order, share the highest priority, so they swap in any grouping. */
const REORDER_TARGET = PRESSED_GIFT;
const REORDER_SOURCE = 'Stan pro dva';
const SOURCE_ORIGIN = 'https://example.com';

const FIXTURE_GIFTS: readonly FixtureGift[] = [
	{
		name: PRESSED_GIFT,
		priority: 'Vysoká',
		link: `${SOURCE_ORIGIN}/kolo`,
		categories: ['Elektronika', 'Předplatné', 'Oblečení', 'Domácnost', 'Zážitky'],
	},
	{ name: REORDER_SOURCE, priority: 'Vysoká', link: `${SOURCE_ORIGIN}/stan` },
	{ name: 'Kniha o houbách', priority: 'Vysoká', categories: ['Knihy'] },
	{ name: 'Desková hra', priority: 'Střední', categories: ['Hry'] },
	{ name: 'Hrnek na čaj', priority: 'Střední' },
	{ name: 'Teplé ponožky', priority: 'Nízká', categories: ['Oblečení'] },
	{ name: 'Vonná svíčka' },
	{ name: 'Turistický batoh', priority: 'Nízká' },
];

const ACTIVE_GIFTS =
	'[data-wishlist-gift-collection]:not([inert]) [data-gift-item]:not([data-gift-reorder-overlay])';
const REORDER_OVERLAY = '[data-gift-reorder-overlay]';
const LONG_PRESS_PENDING = '[data-long-press-pending]';
const TRANSIENT_GESTURE_STATE = [LONG_PRESS_PENDING, REORDER_OVERLAY];
const OPEN_LAYERS =
	'[role="dialog"]:visible, [role="alertdialog"]:visible, [role="menu"]:visible, [data-slot="popover-content"]:visible';
/** A negative window longer than any recognizer, so a gesture that should not fire would have. */
const SETTLE_AFTER_GESTURE_MS = 750;
/** Press-phase checks run at a fixed hold time, so they must not wait for a late reaction. */
const PRESS_PHASE_TIMEOUT_MS = 100;
/** Past the 300 ms reorder long press, so the drag has started before the finger moves. */
const REORDER_DRAG_HOLD_MS = 450;
/** The grip drags at once; a short rest only makes the touchstart land before the move. */
const GRIP_DRAG_HOLD_MS = 50;
/** Short of every recognizer, so leaving the card is what ends the press. */
const RELEASE_OUTSIDE_HOLD_MS = 100;
/** Inside the long-press window, so the scroll must cancel the pending long press. */
const HOLD_BEFORE_SCROLL_MS = 200;
const SECOND_FINGER_AFTER_MS = 200;
/** `.mpx/DECISIONS.md` 2026-10-26: a touch long press opens the actions after 500 ms. */
const LONG_PRESS_MS = 500;
/**
 * Timers fire late on a loaded machine; the slack stays short of 100 ms, so a recognizer that
 * waits 100 ms longer still fails.
 */
const LATE_TIMER_SLACK_MS = 90;
/** Past the long press even when it restarts at the second finger. */
const LONG_HOLD_MS = 900;

const FOCUS_RETURNS = 'focus returns to where the layer was opened';
const LONG_PRESS_TIMING = `the actions open ${LONG_PRESS_MS} ms into the press`;
const NO_LONG_PRESS = 'the press ends without opening the actions';
const SELECTION_TOGGLES = 'the press toggles the selection';
const DRAG_ABSORBS_CONTEXT_MENU =
	'the drag absorbs the native contextmenu: no layer opens and the browser menu is suppressed';

type Role = GiftCardState['role'];
type Viewport = GiftCardState['viewport'];
type GiftCardCase = SurfaceCase<typeof GIFT_CARD_SURFACE.dimensions, GiftCardOutcome>;
/**
 * Visitors need a shared wishlist. Managers browse an unshared copy because a shared list's editor
 * shows a two-minute post-share countdown that would shift its layout for part of a run. Reorder
 * cases rearrange their own copy, so browse groups on other workers never see it.
 */
type FixtureList = 'shared' | 'managed' | 'reorder';

interface GiftCardSession extends InteractionSession {
	role: Role;
	mutationRequests: Request[];
	/** Display state this spec last applied; `undefined` until first set. */
	view?: GiftCardState['view'];
	grouping?: GiftCardState['grouping'];
}

interface GiftCardFixture {
	cookiesByRole: Record<Role, string[]>;
	paths: Record<FixtureList, string>;
}

async function createFixtureWishlist(
	browser: Browser,
	baseURL: string,
	cookies: readonly string[],
	title: string,
	{ shared }: { shared: boolean },
) {
	return withSignedInPage(browser, baseURL, cookies, async (page) => {
		const path = await createWishlistAndNavigate(page, title);
		for (const gift of FIXTURE_GIFTS) {
			await addFixtureGift(page, gift);
		}
		if (shared) {
			await shareWishlist(page);
		}
		return path;
	});
}

async function openGiftCardSession(
	browser: Browser,
	baseURL: string,
	fixture: GiftCardFixture,
	viewport: Viewport,
	role: Role,
	list: FixtureList,
): Promise<GiftCardSession> {
	const session = await openSession(browser, baseURL, fixture.cookiesByRole[role], viewport);
	const { context, page } = session;
	await context.route(`${SOURCE_ORIGIN}/**`, (route) =>
		route.fulfill({ contentType: 'text/html', body: '<title>Zdroj</title>' }),
	);
	const mutationRequests: Request[] = [];
	page.on('request', (request) => {
		if (request.method() === 'POST' && request.url().includes('/_app/remote/')) {
			mutationRequests.push(request);
		}
	});
	await page.goto(fixture.paths[list]);
	await waitForAppHydration(page);
	await expect(page.locator(ACTIVE_GIFTS)).toHaveCount(FIXTURE_GIFTS.length);
	return { ...session, role, mutationRequests };
}

const test = testWithWorld(async ({ browser, playwright, workerInfo, baseURL, sessions }) => {
	const fixture = await oncePerRun<GiftCardFixture>(
		workerInfo,
		'gift-card-wishlist',
		async () => {
			const cookiesByRole = {
				manager: await registerUser(playwright, baseURL, 'interaction-manager'),
				visitor: await registerUser(playwright, baseURL, 'interaction-visitor'),
			};
			const [shared, managed, reorder] = await Promise.all([
				createFixtureWishlist(browser, baseURL, cookiesByRole.manager, 'Interakce dárků', {
					shared: true,
				}),
				createFixtureWishlist(browser, baseURL, cookiesByRole.manager, 'Správa dárků', {
					shared: false,
				}),
				createFixtureWishlist(browser, baseURL, cookiesByRole.manager, 'Pořadí dárků', {
					shared: false,
				}),
			]);
			return { cookiesByRole, paths: { shared, managed, reorder } };
		},
	);
	return {
		session(viewport: Viewport, role: Role, list: FixtureList) {
			return sessions.get(`${viewport} ${role} ${list}`, () =>
				openGiftCardSession(browser, baseURL, fixture, viewport, role, list),
			);
		},
	};
});

function giftItem(page: Page, name: string): Locator {
	return page
		.locator(ACTIVE_GIFTS)
		.filter({ has: page.getByRole('heading', { name, exact: true, level: 3 }) });
}

function giftContent(page: Page, name: string): Locator {
	return giftItem(page, name).locator('h3');
}

function giftOrder(page: Page): Promise<string[]> {
	return page.locator(ACTIVE_GIFTS).locator('h3').allTextContents();
}

function selectionStates(page: Page): Promise<(string | null)[]> {
	return page
		.locator(ACTIVE_GIFTS)
		.evaluateAll((items) => items.map((item) => item.getAttribute('aria-selected')));
}

function reorderGrip(page: Page, name: string): Locator {
	return giftItem(page, name).getByRole('button', {
		name: m.gift_reorder_grip_label(),
		exact: true,
	});
}

function moreButton(page: Page): Locator {
	return giftItem(page, PRESSED_GIFT).getByTestId('gift-more-actions').filter({ visible: true });
}

function sourceLink(page: Page): Locator {
	return giftItem(page, PRESSED_GIFT)
		.locator(`a[href^="${SOURCE_ORIGIN}"]`)
		.filter({ visible: true })
		.first();
}

function categoryMoreChip(page: Page): Locator {
	return giftItem(page, PRESSED_GIFT)
		.getByTestId('gift-category-badges')
		.getByText(/^\+\d+$/)
		.filter({ visible: true });
}

function likeButton(page: Page): Locator {
	return giftItem(page, PRESSED_GIFT).getByRole('button', {
		name: new RegExp(
			`^(${m.gift_like_add_aria({ name: PRESSED_GIFT })}|${m.gift_like_remove_aria({ name: PRESSED_GIFT })})$`,
		),
	});
}

function detailDialog(page: Page, role: Role): Locator {
	return page.getByRole('dialog').filter({
		has: page.getByTestId(role === 'manager' ? 'gift-editor-header' : 'gift-viewer'),
	});
}

function actionsSheet(page: Page): Locator {
	return page
		.getByRole('dialog')
		.filter({ hasText: m.gift_context_actions_description() })
		.filter({ has: page.getByRole('heading', { name: PRESSED_GIFT }) });
}

function categoryPopover(page: Page): Locator {
	return page.getByTestId('gift-category-popover').filter({ visible: true });
}

function scrollContainer(page: Page): Locator {
	return page.locator('main');
}

function selectionToolbar(page: Page): Locator {
	return page.getByRole('region', { name: m.gift_selection_toolbar() });
}

function reorderNotice(page: Page): Locator {
	return page.getByTestId('gift-reorder-temporary-notice');
}

async function centerGiftInView(page: Page, name: string) {
	await giftItem(page, name).evaluate((item) => item.scrollIntoView({ block: 'center' }));
	await nextFrames(page);
}

async function closeOpenLayers(page: Page) {
	const discardChanges = page
		.getByRole('dialog', { name: m.wishlist_settings_unsaved_title() })
		.getByRole('button', { name: m.wishlist_settings_discard() });
	await expect(async () => {
		if (await discardChanges.isVisible()) {
			await discardChanges.click();
		} else if ((await page.locator(OPEN_LAYERS).count()) > 0) {
			await page.keyboard.press('Escape');
		}
		await expect(page.locator(OPEN_LAYERS)).toHaveCount(0, { timeout: 1_000 });
	}).toPass({ timeout: 10_000 });
}

async function closeExtraPages(session: GiftCardSession) {
	for (const extraPage of session.context.pages()) {
		if (extraPage !== session.page) {
			await extraPage.close();
		}
	}
}

async function dismissToasts(page: Page) {
	await page
		.locator('[data-sonner-toast] button[aria-label="Dismiss"]')
		.evaluateAll((buttons) => buttons.forEach((button) => (button as HTMLElement).click()));
	await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
}

async function currentMode(page: Page): Promise<GiftCardState['mode']> {
	if (await selectionToolbar(page).isVisible()) {
		return 'selection';
	}
	if (await reorderNotice(page).isVisible()) {
		return 'reorder';
	}
	return 'browse';
}

async function leaveMode(page: Page, mode: GiftCardState['mode']) {
	if (mode === 'selection') {
		await selectionToolbar(page)
			.getByRole('button', { name: new RegExp(`^(${m.done()}|${m.cancel()})$`) })
			.filter({ visible: true })
			.click();
		await expect(selectionToolbar(page)).toBeHidden();
	} else if (mode === 'reorder') {
		await page
			.getByRole('button', { name: m.done(), exact: true })
			.filter({ visible: true })
			.click();
		await expect(reorderNotice(page)).toBeHidden();
	}
}

async function enterMode(page: Page, mode: GiftCardState['mode']) {
	if (mode === 'selection') {
		await clickWishlistToolbarMoreAction(page, new RegExp(`^${m.gift_selection_toolbar()}$`));
		await expect(selectionToolbar(page)).toBeVisible();
	} else if (mode === 'reorder') {
		await startGiftReorder(page);
		await expect(reorderNotice(page)).toBeVisible();
	}
}

async function applyView(session: GiftCardSession, view: GiftCardState['view']) {
	const choice = session.page.getByTestId(`gift-view-${view}`).filter({ visible: true });
	if ((await choice.getAttribute('aria-checked')) !== 'true') {
		await choice.click();
		await expect(choice).toHaveAttribute('aria-checked', 'true');
	}
	await expect(
		session.page.locator(
			`[data-wishlist-gift-collection][data-view-mode="${view}"]:not([inert])`,
		),
	).toHaveCount(1);
	session.view = view;
}

async function applyGrouping(session: GiftCardSession, grouping: GiftCardState['grouping']) {
	const { page } = session;
	const label = grouping === 'none' ? m.gift_grouping_none() : m.gift_grouping_priority();
	if (session.touch === undefined) {
		const submenu = await openDesktopDisplaySubmenu(
			page,
			new RegExp(`^${m.gift_grouping_label()}`),
		);
		await submenu.getByRole('menuitemradio', { name: label }).click();
	} else {
		const sheet = page.getByRole('dialog', { name: m.gift_display_options() });
		await page.getByTestId('mobile-display-trigger').click();
		await expect(sheet).toBeVisible();
		await sheet.getByTestId('mobile-sheet-grouping-switch').click();
		await sheet.locator(`label[for="mobile-gift-grouping-${grouping}"]`).click();
	}
	await closeOpenLayers(page);
	await waitForDialogOverlayRemoval(page);
	session.grouping = grouping;
}

/** Brings the reused page to the case's state without reloading it. */
async function arrange(session: GiftCardSession, state: GiftCardState) {
	const { page } = session;
	await closeExtraPages(session);
	await closeOpenLayers(page);
	await dismissToasts(page);
	await releaseFocusAndPointer(session);
	const mode = await currentMode(page);
	const displayChanges = session.view !== state.view || session.grouping !== state.grouping;
	if (mode !== state.mode || displayChanges) {
		await leaveMode(page, mode);
		if (session.view !== state.view) {
			await applyView(session, state.view);
		}
		if (session.grouping !== state.grouping) {
			await applyGrouping(session, state.grouping);
		}
		await enterMode(page, state.mode);
	}
	await scrollContainer(page).evaluate((main) => (main.scrollTop = 0));
	await centerGiftInView(page, PRESSED_GIFT);
}

interface CaseContext {
	page: Page;
	session: GiftCardSession;
	state: GiftCardState;
	guard: AssertionGuard;
}

interface InteractionResult {
	nativeContextMenu?: NativeContextMenuResult | null;
	/** Where a keyboard user's focus must return once the opened layer closes. */
	focusOrigin?: Locator;
	/** How long after its pointerdown a touch hold opened the actions; unset when they stayed shut. */
	actionsOpenedAfterMs?: number;
}

/** Runs while the finger or button is still down, where the gesture has a press phase. */
type DuringPress = () => Promise<void>;
type Interaction = (context: CaseContext, duringPress: DuringPress) => Promise<InteractionResult>;

async function mouseClick(page: Page, target: PressTarget) {
	const point = await pointOf(target);
	await page.mouse.click(point.x, point.y);
}

async function focusAndPress(target: Locator, key: string): Promise<InteractionResult> {
	await target.focus();
	await expect(target).toBeFocused();
	await target.page().keyboard.press(key);
	return { focusOrigin: target };
}

/** A point just left of the pressed card, outside it. */
async function pointBesideCard(page: Page) {
	const card = await pointOf({ locator: giftItem(page, PRESSED_GIFT), offset: { x: 0, y: 0 } });
	const heading = await pointOf(giftContent(page, PRESSED_GIFT));
	return { x: Math.max(1, card.x - 10), y: heading.y };
}

/** The source and target are neighbours, so centring the target keeps both on screen. */
async function reorderDragPath(page: Page, from: Locator) {
	await centerGiftInView(page, REORDER_TARGET);
	return [from, giftItem(page, REORDER_TARGET)];
}

/** Runs a touch press and times, in the page's own clock, when the actions sheet appears. */
async function timeActionsOpening<Result>(
	page: Page,
	press: () => Promise<Result>,
): Promise<{ result: Result; actionsOpenedAfterMs?: number }> {
	const timing = await page.evaluateHandle((sheetDescription) => {
		const times = { pressedAt: Number.NaN, openedAt: Number.NaN };
		window.addEventListener('pointerdown', (event) => (times.pressedAt = event.timeStamp), {
			capture: true,
			once: true,
		});
		const observer = new MutationObserver(() => {
			const dialogs = [...document.querySelectorAll('[role="dialog"]')];
			if (dialogs.some((dialog) => dialog.textContent?.includes(sheetDescription))) {
				times.openedAt = performance.now();
				observer.disconnect();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		return { times, stop: () => observer.disconnect() };
	}, m.gift_context_actions_description());
	try {
		const result = await press();
		const openedAfterMs = await timing.evaluate(
			({ times }) => times.openedAt - times.pressedAt,
		);
		return {
			result,
			actionsOpenedAfterMs: Number.isNaN(openedAfterMs) ? undefined : openedAfterMs,
		};
	} finally {
		await timing.evaluate(({ stop }) => stop());
		await timing.dispose();
	}
}

function holdContent(durationMs: number): Interaction {
	return async ({ page, session }, duringPress) => {
		const { actionsOpenedAfterMs } = await timeActionsOpening(page, () =>
			requireTouch(session).hold(giftContent(page, PRESSED_GIFT), durationMs, {
				beforeRelease: duringPress,
			}),
		);
		return { actionsOpenedAfterMs };
	};
}

function holdWithDrift(distancePx: number): Interaction {
	return async ({ page, session }, duringPress) => {
		const { actionsOpenedAfterMs } = await timeActionsOpening(page, () =>
			requireTouch(session).holdThenDrift(giftContent(page, PRESSED_GIFT), {
				distancePx,
				durationMs: LONG_HOLD_MS,
				beforeRelease: duringPress,
			}),
		);
		return { actionsOpenedAfterMs };
	};
}

function tap(target: (page: Page) => Locator): Interaction {
	return async ({ page, session }) => {
		await requireTouch(session).tap(target(page));
		return {};
	};
}

function click(target: (page: Page) => Locator): Interaction {
	return async ({ page }) => {
		await mouseClick(page, target(page));
		return {};
	};
}

const pressedContent = (page: Page) => giftContent(page, PRESSED_GIFT);
const pressedCard = (page: Page) => giftItem(page, PRESSED_GIFT);

const INTERACTIONS: Record<string, Interaction> = {
	'tap content': tap(pressedContent),
	'double tap content': async ({ page, session, state }) => {
		await requireTouch(session).doubleTap(pressedContent(page), async () => {
			await expect(detailDialog(page, state.role)).toBeVisible();
			await expectAnimationsFinished(page);
		});
		return {};
	},
	'hold 150 ms': holdContent(150),
	'hold 375 ms': holdContent(375),
	'hold 900 ms': holdContent(900),
	'hold with 4 px drift': holdWithDrift(4),
	'hold with 12 px drift': holdWithDrift(12),
	'hold then scroll': async ({ page, session }) => {
		await requireTouch(session).holdThenScroll(pressedContent(page), {
			holdMs: HOLD_BEFORE_SCROLL_MS,
			distancePx: 250,
		});
		return {};
	},
	'swipe over cards': async ({ page, session }) => {
		const start = await pointOf(pressedContent(page));
		await requireTouch(session).swipe(start, { x: start.x, y: start.y - 250 });
		return {};
	},
	'long press with native contextmenu': async ({ page, session }, duringPress) => {
		const { result: nativeContextMenu, actionsOpenedAfterMs } = await timeActionsOpening(
			page,
			() =>
				requireTouch(session).hold(pressedContent(page), LONG_HOLD_MS, {
					withNativeContextMenu: true,
					beforeRelease: duringPress,
				}),
		);
		return { nativeContextMenu, actionsOpenedAfterMs };
	},
	'release outside': async ({ page, session }, duringPress) => {
		const outside = await pointBesideCard(page);
		if (session.touch === undefined) {
			await mouseDrag(page, [pressedContent(page), outside]);
		} else {
			await session.touch.drag([pressedContent(page), outside], {
				holdMs: RELEASE_OUTSIDE_HOLD_MS,
				beforeRelease: duringPress,
			});
		}
		return {};
	},
	'second finger during hold': async ({ page, session }, duringPress) => {
		await requireTouch(session).twoFingerDuringHold(pressedContent(page), {
			secondFingerAfterMs: SECOND_FINGER_AFTER_MS,
			durationMs: LONG_HOLD_MS,
			beforeRelease: duringPress,
		});
		return {};
	},
	'long press drag to neighbour': async ({ page, session }, duringPress) => {
		const path = await reorderDragPath(page, giftItem(page, REORDER_SOURCE));
		await requireTouch(session).drag(path, {
			holdMs: REORDER_DRAG_HOLD_MS,
			beforeRelease: duringPress,
		});
		return {};
	},
	'grip drag to neighbour': async ({ page, session }, duringPress) => {
		const path = await reorderDragPath(page, reorderGrip(page, REORDER_SOURCE));
		await requireTouch(session).drag(path, {
			holdMs: GRIP_DRAG_HOLD_MS,
			beforeRelease: duringPress,
		});
		return {};
	},
	'tap More': tap(moreButton),
	'tap source link': tap(sourceLink),
	'tap category "+X"': tap(categoryMoreChip),
	'tap Like': tap(likeButton),

	'click content': click(pressedContent),
	'right-click content': async ({ page }) => {
		await rightClick(page, pressedContent(page));
		return {};
	},
	'right-click source link': async ({ page }) => {
		await rightClick(page, sourceLink(page));
		return {};
	},
	'mouse drag to neighbour': async ({ page }) => {
		await mouseDrag(page, await reorderDragPath(page, giftItem(page, REORDER_SOURCE)));
		return {};
	},
	'click More': click(moreButton),
	'click source link': click(sourceLink),
	'click category "+X"': click(categoryMoreChip),
	'click Like': click(likeButton),

	'Enter on card': ({ page }) => focusAndPress(pressedCard(page), 'Enter'),
	'Space on card': ({ page }) => focusAndPress(pressedCard(page), 'Space'),
	'Shift+F10 on card': ({ page }) => focusAndPress(pressedCard(page), 'Shift+F10'),
	'Enter on More': ({ page }) => focusAndPress(moreButton(page), 'Enter'),
	'Enter on category "+X"': ({ page }) => focusAndPress(categoryMoreChip(page), 'Enter'),
	'Enter on Like': ({ page }) => focusAndPress(likeButton(page), 'Enter'),
	'arrow keys on grip': ({ page }) => focusAndPress(reorderGrip(page, REORDER_SOURCE), 'ArrowUp'),
};

type Perform = (duringPress?: DuringPress) => Promise<InteractionResult>;
type OutcomeCheck = (context: CaseContext, perform: Perform) => Promise<void>;

/** Closes the layer the interaction opened; a keyboard user gets focus back where it was. */
async function closeLayerWithEscape(
	{ page, guard }: CaseContext,
	layer: Locator,
	result: InteractionResult,
) {
	await page.keyboard.press('Escape');
	await expect(layer, 'Escape closes the opened layer').toBeHidden();
	const { focusOrigin } = result;
	if (focusOrigin !== undefined) {
		await guard.check(FOCUS_RETURNS, () => expect(focusOrigin, FOCUS_RETURNS).toBeFocused());
	}
}

/** Gives a wrongly pressed card a couple of frames to react before asserting it did not. */
async function expectNoCardPress(page: Page, role: Role) {
	await nextFrames(page);
	await expect(detailDialog(page, role), 'the card is not pressed').toHaveCount(0);
}

function isReorderResponse(response: Response): boolean {
	return response.request().method() === 'POST' && response.url().includes('reorderGifts');
}

function swapped(order: readonly string[], first: string, second: string): string[] {
	return order.map((name) => (name === first ? second : name === second ? first : name));
}

const OUTCOME_CHECKS: Record<GiftCardOutcome, OutcomeCheck> = {
	'opens-detail': async (context, perform) => {
		const { page, state } = context;
		const result = await perform();
		const detail = detailDialog(page, state.role);
		await expect(detail).toHaveCount(1);
		await expect(detail).toBeVisible();
		await expect(actionsSheet(page)).toHaveCount(0);
		await expect(page.getByRole('menu')).toHaveCount(0);
		if (state.role === 'visitor') {
			await closeLayerWithEscape(context, detail, result);
			return;
		}
		await expect(
			detail.getByRole('switch', { name: m.gift_price_range_toggle_label() }),
			'the opened editor stays unchanged',
		).not.toBeChecked();
		await closeLayerWithEscape(context, detail, result);
	},
	'opens-actions-sheet': async (context, perform) => {
		const { page, state, guard } = context;
		const result = await perform(async () => {
			await expect(
				actionsSheet(page),
				'the sheet opens while the finger is down',
			).toBeVisible({ timeout: PRESS_PHASE_TIMEOUT_MS });
		});
		await expect(actionsSheet(page)).toBeVisible();
		if (result.actionsOpenedAfterMs !== undefined) {
			const openedAfterMs = result.actionsOpenedAfterMs;
			await guard.check(LONG_PRESS_TIMING, () =>
				expect(openedAfterMs, LONG_PRESS_TIMING).toBeLessThan(
					LONG_PRESS_MS + LATE_TIMER_SLACK_MS,
				),
			);
		}
		await expect(page.getByRole('menu')).toHaveCount(0);
		await expectNoCardPress(page, state.role);
		if (result.nativeContextMenu !== undefined) {
			expect(
				result.nativeContextMenu?.defaultPrevented,
				'the browser menu is suppressed',
			).toBe(true);
		}
		await closeLayerWithEscape(context, actionsSheet(page), result);
	},
	'opens-actions-menu': async (context, perform) => {
		const { page, state } = context;
		const result = await perform();
		await expect(page.getByRole('menu')).toBeVisible();
		await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'true');
		await expect(actionsSheet(page)).toHaveCount(0);
		await expectNoCardPress(page, state.role);
		await closeLayerWithEscape(context, page.getByRole('menu'), result);
	},
	'opens-context-menu': async (context, perform) => {
		const { page, state } = context;
		const result = await perform();
		const menu = page.getByRole('menu');
		await expect(menu).toBeVisible();
		await expect(menu.getByRole('menuitem').first()).toBeVisible();
		await expectNoCardPress(page, state.role);
		await closeLayerWithEscape(context, menu, result);
	},
	'opens-category-popover': async (context, perform) => {
		const { page, state } = context;
		const result = await perform();
		await expect(categoryPopover(page)).toBeVisible();
		await expect(categoryPopover(page).getByRole('listitem')).toHaveCount(
			FIXTURE_GIFTS[0]!.categories!.length,
		);
		await expectNoCardPress(page, state.role);
		await closeLayerWithEscape(context, categoryPopover(page), result);
	},
	'opens-new-tab': async ({ page, session, state }, perform) => {
		const newPage = session.context.waitForEvent('page');
		await perform();
		const sourcePage = await newPage;
		await sourcePage.waitForLoadState();
		expect(new URL(sourcePage.url()).origin).toBe(SOURCE_ORIGIN);
		await sourcePage.close();
		await expectNoCardPress(page, state.role);
	},
	'toggles-like': async ({ page, state }, perform) => {
		const like = likeButton(page);
		const pressedBefore = await like.getAttribute('aria-pressed');
		await perform();
		await expect(like).toHaveAttribute(
			'aria-pressed',
			pressedBefore === 'true' ? 'false' : 'true',
		);
		await expectNoCardPress(page, state.role);
		const restored = page.waitForResponse((response) => response.url().includes('toggleLike'));
		await like.click();
		await expect(like).toHaveAttribute('aria-pressed', pressedBefore ?? 'false');
		await restored;
	},
	'toggles-selection': async ({ page, state, guard }, perform) => {
		const card = giftItem(page, PRESSED_GIFT);
		const selectedBefore = (await card.getAttribute('aria-selected')) ?? 'false';
		const result = await perform();
		await guard.check(SELECTION_TOGGLES, async () => {
			await expect(card, SELECTION_TOGGLES).toHaveAttribute(
				'aria-selected',
				selectedBefore === 'true' ? 'false' : 'true',
			);
			await expect(actionsSheet(page), 'no actions open').toHaveCount(0);
		});
		// Only the known-bug case can leave actions open or the selection unchanged here.
		await closeOpenLayers(page);
		await expectNoCardPress(page, state.role);
		await expect(categoryPopover(page)).toHaveCount(0);
		if (result.focusOrigin !== undefined) {
			await expect(result.focusOrigin).toBeFocused();
		}
		if ((await card.getAttribute('aria-selected')) !== selectedBefore) {
			await card.click();
		}
		await expect(card).toHaveAttribute('aria-selected', selectedBefore);
	},
	'no-long-press': async ({ page, guard }, perform) => {
		await perform(() =>
			guard.check(NO_LONG_PRESS, () =>
				expect(actionsSheet(page), NO_LONG_PRESS).toHaveCount(0, {
					timeout: PRESS_PHASE_TIMEOUT_MS,
				}),
			),
		);
		await expect(
			page.locator(LONG_PRESS_PENDING),
			'the release ends the pending long press',
		).toHaveCount(0);
		await nextFrames(page);
		await guard.check(NO_LONG_PRESS, () =>
			expect(actionsSheet(page), NO_LONG_PRESS).toHaveCount(0),
		);
		await expect(page.locator(REORDER_OVERLAY)).toHaveCount(0);
		// Whether the release then taps the card depends on the platform (see support/touch.ts).
		await closeOpenLayers(page);
	},
	'does-nothing': async ({ page, session }, perform) => {
		const orderBefore = await giftOrder(page);
		const selectionBefore = await selectionStates(page);
		const mutationsBefore = session.mutationRequests.length;
		await perform(async () => {
			await expect(page.locator(REORDER_OVERLAY), 'no drag starts').toHaveCount(0, {
				timeout: PRESS_PHASE_TIMEOUT_MS,
			});
			await expect(page.locator(OPEN_LAYERS), 'no layer opens').toHaveCount(0, {
				timeout: PRESS_PHASE_TIMEOUT_MS,
			});
		});
		await page.waitForTimeout(SETTLE_AFTER_GESTURE_MS);
		await expect(page.locator(OPEN_LAYERS), 'no layer opens').toHaveCount(0);
		expect(await giftOrder(page), 'the order is unchanged').toEqual(orderBefore);
		expect(await selectionStates(page), 'the selection is unchanged').toEqual(selectionBefore);
		expect(
			session.mutationRequests.slice(mutationsBefore).map((request) => request.url()),
			'nothing is saved',
		).toEqual([]);
	},
	'starts-drag-in-place': async (context, perform) => {
		const { page, state, guard } = context;
		const orderBefore = await giftOrder(page);
		const result = await perform(async () => {
			await expect(
				page.locator(REORDER_OVERLAY),
				'the held card lifts into a drag',
			).toHaveCount(1, { timeout: PRESS_PHASE_TIMEOUT_MS });
		});
		await expect(page.locator(REORDER_OVERLAY)).toHaveCount(0);
		expect(await giftOrder(page), 'dropping in place keeps the order').toEqual(orderBefore);
		if (result.nativeContextMenu === undefined) {
			await expect(page.locator(OPEN_LAYERS), 'no layer opens over the drag').toHaveCount(0);
		} else {
			await guard.check(DRAG_ABSORBS_CONTEXT_MENU, async () => {
				expect(result.nativeContextMenu?.defaultPrevented, DRAG_ABSORBS_CONTEXT_MENU).toBe(
					true,
				);
				await expect(page.locator(OPEN_LAYERS), DRAG_ABSORBS_CONTEXT_MENU).toHaveCount(0);
			});
			// Only a layer the known-bug case reports can still be open here.
			await closeOpenLayers(page);
		}
		await expectNoCardPress(page, state.role);
	},
	reorders: async ({ page, session }, perform) => {
		const orderBefore = await giftOrder(page);
		const expectedOrder = swapped(orderBefore, REORDER_SOURCE, REORDER_TARGET);
		const saved = page.waitForResponse(isReorderResponse);
		await perform(async () => {
			if (session.touch !== undefined) {
				await expect(page.locator(REORDER_OVERLAY)).toHaveCount(1, {
					timeout: PRESS_PHASE_TIMEOUT_MS,
				});
			}
		});
		await expect
			.poll(() => giftOrder(page), { message: 'the gifts swap' })
			.toEqual(expectedOrder);
		expect((await saved).ok(), 'the new order is saved').toBe(true);

		const restored = page.waitForResponse(isReorderResponse);
		await reorderGrip(page, REORDER_SOURCE).focus();
		await page.keyboard.press('ArrowDown');
		await expect.poll(() => giftOrder(page)).toEqual(orderBefore);
		expect((await restored).ok()).toBe(true);
		await expect(page.locator(OPEN_LAYERS)).toHaveCount(0);
	},
	'scrolls-page': async ({ page, state }, perform) => {
		const scrollBefore = await scrollContainer(page).evaluate((main) => main.scrollTop);
		const orderBefore = await giftOrder(page);
		await perform();
		await expect
			.poll(() => scrollContainer(page).evaluate((main) => main.scrollTop), {
				message: 'the page scrolls',
			})
			.toBeGreaterThan(scrollBefore + 40);
		// A tap during the fling would only stop it, so the settled check waits for it to end.
		await expectScrollAtRest(scrollContainer(page), 'top');
		await expect(
			page.locator(LONG_PRESS_PENDING),
			'scrolling cancels the pending long press',
		).toHaveCount(0);
		await expect(page.locator(OPEN_LAYERS), 'scrolling opens nothing').toHaveCount(0);
		await expect(page.locator(REORDER_OVERLAY)).toHaveCount(0);
		await expectNoCardPress(page, state.role);
		expect(await giftOrder(page)).toEqual(orderBefore);
	},
};

const KNOWN_PRODUCT_BUGS = [
	{
		assertion: FOCUS_RETURNS,
		bug: 'Escape from the keyboard-opened gift context menu leaves focus on <body>, not the card',
		issue: undefined,
		affects: ({ capability }: GiftCardCase) => capability.interaction === 'Shift+F10 on card',
	},
];

function fixtureList(state: GiftCardState): FixtureList {
	if (state.mode === 'reorder') {
		return 'reorder';
	}
	return state.role === 'visitor' ? 'shared' : 'managed';
}

describeSurfaceCases(
	test,
	{
		surface: GIFT_CARD_SURFACE,
		interactions: Object.keys(INTERACTIONS),
		knownBugs: KNOWN_PRODUCT_BUGS,
		// Reorder and like cases change shared data, so each kind runs in one worker, in order.
		groupKey: ({ state }) => {
			if (state.mode === 'reorder') {
				return 'manager reorder';
			}
			return state.role === 'visitor'
				? 'visitor browse'
				: `${state.viewport} manager ${state.mode}`;
		},
		compare: ({ state: first }, { state: second }) =>
			`${first.viewport} ${first.view} ${first.grouping}`.localeCompare(
				`${second.viewport} ${second.view} ${second.grouping}`,
			),
	},
	async (world, { capability, state, outcome }, guard) => {
		const session = await world.session(state.viewport, state.role, fixtureList(state));
		const { page } = session;
		await arrange(session, state);
		const expectedUrl = page.url();
		const context: CaseContext = { page, session, state, guard };

		await OUTCOME_CHECKS[outcome](context, (duringPress = async () => {}) =>
			INTERACTIONS[capability.interaction]!(context, duringPress),
		);

		await expectPageSettled(page, {
			errors: session.errors,
			expectedUrl,
			neutralTarget: page.getByRole('heading', { level: 1 }),
			touch: session.touch,
			transientStateSelectors: TRANSIENT_GESTURE_STATE,
			allowTextSelection:
				capability.input === 'mouse' && capability.interaction === 'release outside',
		});
	},
	(title, details, body) => test(title, details, body),
);
