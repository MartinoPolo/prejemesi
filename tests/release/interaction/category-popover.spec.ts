import { expect, type Locator, type Page } from '@playwright/test';
import { waitForAppHydration } from '../../e2e/fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from '../../e2e/fixtures/wishlist-helpers.js';
import {
	CATEGORY_POPOVER_SURFACE,
	type CategoryPopoverOutcome,
	type CategoryPopoverState,
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
import type { ScreenPoint } from './support/touch.js';
import { addFixtureGift } from './support/wishlist.js';

/*
 * Generated from `CATEGORY_POPOVER_SURFACE` in ./inventory.ts. One account per run owns a wishlist
 * with a gift carrying five categories, so its lane always ends in "+X", and a plain neighbour.
 */

type Viewport = CategoryPopoverState['viewport'];

const CATEGORIZED_GIFT = 'Kolo pro výlety';
const GIFT_CATEGORIES = ['Elektronika', 'Předplatné', 'Oblečení', 'Domácnost', 'Zážitky'];
const NEIGHBOUR_GIFT = 'Stan pro dva';
const SCROLL_DISTANCE_PX = 200;
const SPACER_ID = 'interaction-scroll-room';
/** Longer than common hover-intent delays, so a hover that opens the popover would have. */
const HOVER_WINDOW_MS = 1_200;

type CategoryPopoverCase = SurfaceCase<
	typeof CATEGORY_POPOVER_SURFACE.dimensions,
	CategoryPopoverOutcome
>;

const test = testWithWorld(async ({ browser, playwright, workerInfo, baseURL, sessions }) => {
	const account = await oncePerRun(workerInfo, 'category-popover-account', async () => {
		const cookies = await registerUser(playwright, baseURL, 'interaction-popover');
		const wishlistPath = await withSignedInPage(browser, baseURL, cookies, async (page) => {
			const path = await createWishlistAndNavigate(page, 'Kategorie navíc');
			await addFixtureGift(page, { name: CATEGORIZED_GIFT, categories: GIFT_CATEGORIES });
			await addFixtureGift(page, { name: NEIGHBOUR_GIFT });
			return path;
		});
		return { cookies, wishlistPath };
	});
	return {
		wishlistPath: account.wishlistPath,
		session: (viewport: Viewport) =>
			sessions.get(viewport, () => openSession(browser, baseURL, account.cookies, viewport)),
	};
});

function giftItem(page: Page, name: string): Locator {
	return page
		.locator('[data-wishlist-gift-collection]:not([inert]) [data-gift-item]')
		.filter({ has: page.getByRole('heading', { name, exact: true, level: 3 }) });
}

function moreChip(page: Page): Locator {
	return giftItem(page, CATEGORIZED_GIFT).getByTestId('gift-category-more');
}

function popover(page: Page): Locator {
	return page.getByTestId('gift-category-popover').filter({ visible: true });
}

function giftDetail(page: Page): Locator {
	return page.getByRole('dialog').filter({ has: page.getByTestId('gift-editor-header') });
}

function scroller(page: Page): Locator {
	return page.locator('main');
}

/** A point on the element that the open popover does not cover. */
async function uncoveredPointOf(target: Locator): Promise<ScreenPoint> {
	const point = await target.evaluate((element) => {
		const box = element.getBoundingClientRect();
		for (let row = 1; row < 10; row += 1) {
			for (let column = 1; column < 10; column += 1) {
				const x = box.left + (box.width * column) / 10;
				const y = box.top + (box.height * row) / 10;
				const hit = document.elementFromPoint(x, y);
				if (hit !== null && element.contains(hit) && hit.closest('a, button') === null) {
					return { x, y };
				}
			}
		}
		return null;
	});
	expect(point, 'part of the element is not under the popover').not.toBeNull();
	return point!;
}

function scrollTop(page: Page): Promise<number> {
	return scroller(page).evaluate((main) => main.scrollTop);
}

async function applyView(page: Page, view: CategoryPopoverState['view']) {
	const choice = page.getByTestId(`gift-view-${view}`).filter({ visible: true });
	if ((await choice.getAttribute('aria-checked')) !== 'true') {
		await choice.click();
		await expect(choice).toHaveAttribute('aria-checked', 'true');
	}
	await expect(
		page.locator(`[data-wishlist-gift-collection][data-view-mode="${view}"]:not([inert])`),
	).toHaveCount(1);
}

async function arrange(
	session: InteractionSession,
	wishlistPath: string,
	state: CategoryPopoverState,
	{ openPopover }: { openPopover: boolean },
) {
	const { page } = session;
	if (new URL(page.url()).pathname !== wishlistPath) {
		await page.goto(wishlistPath);
		await waitForAppHydration(page);
	}
	// A known-bug case ends where the bug left the page, possibly with a layer open.
	const openLayers = page.locator('[role="dialog"], [data-testid="gift-category-popover"]');
	for (
		let attempt = 0;
		attempt < 3 && (await openLayers.filter({ visible: true }).count()) > 0;
		attempt += 1
	) {
		await page.keyboard.press('Escape');
	}
	await expect(
		openLayers.filter({ visible: true }),
		'the case starts with nothing open',
	).toHaveCount(0);
	await releaseFocusAndPointer(session);
	await applyView(page, state.view);
	// Two gifts fit on one screen; room after them lets the list scroll.
	await scroller(page).evaluate((main, id) => {
		if (document.getElementById(id) === null) {
			const spacer = document.createElement('div');
			spacer.id = id;
			spacer.style.height = '150vh';
			main.append(spacer);
		}
		main.scrollTop = 0;
	}, SPACER_ID);
	await expectScrollAtRest(scroller(page), 'top');
	await expect(moreChip(page), 'the lane ends in "+X"').toHaveText(/^\+\d+$/);
	if (!openPopover) {
		return;
	}
	if (session.touch === undefined) {
		// A click would leave the pointer resting on the chip, where hover (see the known bugs)
		// also toggles the popover.
		await moreChip(page).focus();
		await page.keyboard.press('Enter');
	} else {
		await session.touch.tap(moreChip(page));
	}
	await expect(popover(page)).toBeVisible();
	await expectAnimationsFinished(page, '[data-testid="gift-category-popover"]');
	await expect(giftDetail(page), 'opening the popover does not press the card').toHaveCount(0);
}

type Interaction = (session: InteractionSession) => Promise<void>;

const INTERACTIONS: Record<string, Interaction> = {
	'popover open at rest': async () => {},
	'tap another gift while open': async (session) =>
		requireTouch(session).tap(await uncoveredPointOf(giftItem(session.page, NEIGHBOUR_GIFT))),
	'tap a category inside the popover': (session) =>
		requireTouch(session).tap(popover(session.page).getByRole('listitem').last()),
	'swipe the list while open': async (session) => {
		const start = await uncoveredPointOf(giftItem(session.page, NEIGHBOUR_GIFT));
		await requireTouch(session).swipe(start, { x: start.x, y: start.y - SCROLL_DISTANCE_PX });
	},
	'wheel over the list while open': async ({ page }) => {
		const point = await uncoveredPointOf(giftItem(page, NEIGHBOUR_GIFT));
		await page.mouse.move(point.x, point.y);
		await expect(popover(page), 'moving the pointer away keeps the popover open').toBeVisible();
		await page.mouse.wheel(0, SCROLL_DISTANCE_PX);
	},
	'click another gift while open': async ({ page }) => {
		const point = await uncoveredPointOf(giftItem(page, NEIGHBOUR_GIFT));
		await page.mouse.click(point.x, point.y);
	},
	'hover the "+X" chip': async ({ page }) => {
		await moreChip(page).hover();
		await page.waitForTimeout(HOVER_WINDOW_MS);
	},
};

async function closeWithEscape(page: Page) {
	await page.keyboard.press('Escape');
	await expect(popover(page)).toBeHidden();
}

const POPOVER_STAYS_CLOSED = 'hovering the chip opens nothing';
const NOTHING_BENEATH_PRESSED = 'the pressed gift does not open';

const OUTCOME_CHECKS: Record<
	CategoryPopoverOutcome,
	(page: Page, perform: () => Promise<void>, guard: AssertionGuard) => Promise<void>
> = {
	'fits-the-viewport': async (page, perform) => {
		await perform();
		await expect(popover(page).getByRole('listitem')).toHaveText(GIFT_CATEGORIES);
		const viewport = page.viewportSize()!;
		for (const badge of await popover(page).getByRole('listitem').all()) {
			const box = (await badge.boundingBox())!;
			const label = await badge.textContent();
			expect(box.x, `${label} starts inside the viewport`).toBeGreaterThanOrEqual(0);
			expect(box.y, `${label} starts inside the viewport`).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width, `${label} ends inside the viewport`).toBeLessThanOrEqual(
				viewport.width,
			);
			expect(box.y + box.height, `${label} ends inside the viewport`).toBeLessThanOrEqual(
				viewport.height,
			);
		}
		await closeWithEscape(page);
	},
	'dismisses-without-pressing': async (page, perform, guard) => {
		await perform();
		await expect(popover(page), 'the outside press closes the popover').toBeHidden();
		await nextFrames(page, 3);
		await guard.check(NOTHING_BENEATH_PRESSED, () =>
			expect(giftDetail(page), NOTHING_BENEATH_PRESSED).toHaveCount(0),
		);
		// Only the known-bug case can have opened the gift here.
		if ((await giftDetail(page).count()) > 0) {
			await page.keyboard.press('Escape');
			await expect(giftDetail(page)).toHaveCount(0);
		}
	},
	'stays-open': async (page, perform) => {
		await perform();
		await nextFrames(page, 3);
		// A closing popover stays visible while it fades out, so its state tells.
		await expectAnimationsFinished(page);
		await expect(popover(page), 'a press inside keeps the popover open').toHaveAttribute(
			'data-state',
			'open',
		);
		await expect(giftDetail(page), 'nothing underneath is pressed').toHaveCount(0);
		await closeWithEscape(page);
	},
	'dismisses-and-scrolls': async (page, perform) => {
		const scrolledBefore = await scrollTop(page);
		await perform();
		await expect
			.poll(() => scrollTop(page), { message: 'the list scrolls' })
			.toBeGreaterThan(scrolledBefore);
		await expect(popover(page), 'the popover does not trail the list').toBeHidden();
		// A tap during the fling would only stop it, so the settled check waits for it to end.
		await expectScrollAtRest(scroller(page), 'top');
		await expect(giftDetail(page), 'the swipe presses no gift').toHaveCount(0);
	},
	'stays-closed': async (page, perform, guard) => {
		await perform();
		await guard.check(POPOVER_STAYS_CLOSED, () =>
			expect(popover(page), POPOVER_STAYS_CLOSED).toBeHidden(),
		);
		await page.mouse.move(1, 1);
		// Only the known-bug case can leave the popover open here.
		if (await popover(page).isVisible()) {
			await closeWithEscape(page);
		}
	},
};

const KNOWN_PRODUCT_BUGS = [
	{
		assertion: POPOVER_STAYS_CLOSED,
		bug: 'The "+X" trigger sets `openOnHover`, so resting the pointer on it opens the popover',
		issue: undefined,
		affects: ({ outcome }: CategoryPopoverCase) => outcome === 'stays-closed',
	},
	{
		assertion: NOTHING_BENEATH_PRESSED,
		bug: 'A mouse click outside the open "+X" popover closes it and also opens the gift beneath',
		issue: undefined,
		affects: ({ capability }: CategoryPopoverCase) =>
			capability.interaction === 'click another gift while open',
	},
];

describeSurfaceCases(
	test,
	{
		surface: CATEGORY_POPOVER_SURFACE,
		interactions: Object.keys(INTERACTIONS),
		knownBugs: KNOWN_PRODUCT_BUGS,
		groupKey: ({ state }) => state.viewport,
	},
	async (world, { capability, state, outcome }, guard) => {
		const session = await world.session(state.viewport);
		const { page } = session;
		await arrange(session, world.wishlistPath, state, {
			openPopover: outcome !== 'stays-closed',
		});

		await OUTCOME_CHECKS[outcome](
			page,
			() => INTERACTIONS[capability.interaction]!(session),
			guard,
		);

		await expectPageSettled(page, {
			errors: session.errors,
			expectedUrl: `${new URL(page.url()).origin}${world.wishlistPath}`,
			neutralTarget: page.getByRole('heading', { level: 1 }),
			touch: session.touch,
		});
	},
	(title, details, body) => test(title, details, body),
);
