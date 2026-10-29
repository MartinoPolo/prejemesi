import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import * as m from '../../../src/lib/paraglide/messages.js';
import { parseCookiesForContext, waitForAppHydration } from '../../e2e/fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from '../../e2e/fixtures/wishlist-helpers.js';
import { CAROUSEL_SURFACE, type CarouselOutcome, type CarouselState } from './inventory.js';
import { describeSurfaceCases, type AssertionGuard } from './support/cases.js';
import { oncePerRun } from './support/run-fixture.js';
import {
	openSession,
	registerUser,
	releaseFocusAndPointer,
	requireTouch,
	testWithWorld,
	type InteractionSession,
} from './support/session.js';
import {
	expectPageSettled,
	expectScrollAtRest,
	glideFrames,
	recordEveryFrame,
} from './support/settled.js';
import { pointOf, type ScreenPoint } from './support/touch.js';

/*
 * Generated from `CAROUSEL_SURFACE` in ./inventory.ts. Each run creates one account with more
 * lists than a category row shows, so Moje seznamy ends with „Zobrazit vše" and Nedávné is full.
 * Each (viewport, motion) pair reuses one page on /home, reloaded only for the page-scroll case.
 */

/** HOME_CATEGORY_CAP + 1, so the category row is capped and gets its trailing card. */
const FIXTURE_LIST_COUNT = 11;
const PARALLEL_CREATORS = 3;
const SWIPE_DISTANCE_PX = 200;
const PAGE_SPACER_MARKER = 'data-interaction-page-spacer';
const MOUSE_DRAG_DISTANCE_PX = 160;
/** #225 design brief: „peek ≥ 24px of the next card at all widths whenever the row overflows". */
const MIN_PEEK_PX = 24;
const ROW_TITLES = { recent: m.nav_recent(), category: m.nav_my_lists() } as const;

type Row = CarouselState['row'];
type Viewport = CarouselState['viewport'];
type Motion = CarouselState['motion'];

async function createFixtureLists(browser: Browser, baseURL: string, cookies: string[]) {
	const context = await browser.newContext({ baseURL });
	try {
		await context.addCookies(parseCookiesForContext(cookies, baseURL));
		const titles = Array.from(
			{ length: FIXTURE_LIST_COUNT },
			(_, index) => `Řada ${String(index + 1).padStart(2, '0')}`,
		);
		await Promise.all(
			Array.from({ length: PARALLEL_CREATORS }, async (_, creator) => {
				const page = await context.newPage();
				for (let index = creator; index < titles.length; index += PARALLEL_CREATORS) {
					await createWishlistAndNavigate(page, titles[index]!);
				}
			}),
		);
	} finally {
		await context.close();
	}
}

const test = testWithWorld(async ({ browser, playwright, workerInfo, baseURL, sessions }) => {
	const cookies = await oncePerRun(workerInfo, 'carousel-account', async () => {
		const accountCookies = await registerUser(playwright, baseURL, 'interaction-carousel');
		await createFixtureLists(browser, baseURL, accountCookies);
		return accountCookies;
	});
	return {
		session: (viewport: Viewport, motion: Motion) =>
			sessions.get(`${viewport} ${motion}`, () =>
				openSession(browser, baseURL, cookies, viewport, {
					reducedMotion: motion === 'reduced',
				}),
			),
	};
});

function shelf(page: Page, row: Row): Locator {
	return page.getByTestId('home-shelf').filter({
		has: page.getByRole('heading', { level: 2, name: ROW_TITLES[row], exact: true }),
	});
}

function scroller(page: Page, row: Row): Locator {
	return shelf(page, row).locator('[data-slot="carousel-content"]');
}

function pageScroller(page: Page): Locator {
	return page.locator('main');
}

function arrow(page: Page, row: Row, direction: 'next' | 'previous'): Locator {
	return shelf(page, row).getByRole('button', {
		name: direction === 'next' ? 'Další' : 'Předchozí',
		exact: true,
	});
}

interface RowGeometry {
	scrollLeft: number;
	maxScroll: number;
	/** The part of the row the user sees: the scroller clipped by the page's scroll container. */
	visibleLeft: number;
	visibleRight: number;
	cardTop: number;
	cardBottom: number;
	/** Each slide's card box, in row order. */
	cards: { left: number; right: number }[];
}

function rowGeometry(page: Page, row: Row): Promise<RowGeometry> {
	return scroller(page, row).evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		const main = element.closest('main')!;
		const mainBox = main.getBoundingClientRect();
		const mainContentRight = mainBox.left + main.clientLeft + main.clientWidth;
		const cards = Array.from(
			element.querySelectorAll<HTMLElement>('[data-slot="carousel-item"] > *'),
			(card) => {
				const box = card.getBoundingClientRect();
				return { left: box.left, right: box.right };
			},
		);
		const firstBox = element
			.querySelector('[data-slot="carousel-item"] > *')
			?.getBoundingClientRect();
		return {
			scrollLeft: element.scrollLeft,
			maxScroll: element.scrollWidth - element.clientWidth,
			visibleLeft: Math.max(bounds.left, mainBox.left + main.clientLeft, 0),
			visibleRight: Math.min(
				bounds.right,
				mainContentRight,
				document.documentElement.clientWidth,
			),
			cardTop: firstBox?.top ?? bounds.top,
			cardBottom: firstBox?.bottom ?? bounds.bottom,
			cards,
		};
	});
}

function fullyVisibleCardIndices(geometry: RowGeometry): number[] {
	return geometry.cards.flatMap((card, index) =>
		card.left >= geometry.visibleLeft - 1 && card.right <= geometry.visibleRight + 1
			? [index]
			: [],
	);
}

function pageScrollTop(page: Page): Promise<number> {
	return pageScroller(page).evaluate((main) => main.scrollTop);
}

function rowScrollLeft(page: Page, row: Row): Promise<number> {
	return scroller(page, row).evaluate((element) => element.scrollLeft);
}

/** A point on the cards, horizontally at `fraction` of the visible row. */
function pointOnRow(geometry: RowGeometry, fraction: number): ScreenPoint {
	return {
		x: geometry.visibleLeft + (geometry.visibleRight - geometry.visibleLeft) * fraction,
		y: (geometry.cardTop + geometry.cardBottom) / 2,
	};
}

async function scrollRowTo(page: Page, row: Row, position: CarouselState['position']) {
	const target = await scroller(page, row).evaluate((element, toEnd) => {
		element.scrollTo({ left: toEnd ? element.scrollWidth : 0, behavior: 'instant' });
		return toEnd ? element.scrollWidth - element.clientWidth : 0;
	}, position === 'end');
	await expect
		.poll(() => rowScrollLeft(page, row), { message: `the row starts at its ${position}` })
		.toBeCloseTo(target, 0);
}

async function arrange(
	session: InteractionSession,
	state: CarouselState,
	{ freshPage }: { freshPage: boolean },
) {
	const { page } = session;
	if (freshPage || new URL(page.url()).pathname !== '/home') {
		await page.goto('/home');
		await waitForAppHydration(page);
	}
	await expect(shelf(page, 'recent')).toBeVisible();
	await expect(shelf(page, 'category')).toBeVisible();
	// The fixture's rows fit on one screen; a spacer after them gives the page room to scroll.
	await pageScroller(page).evaluate((main, marker) => {
		if (main.querySelector(`[${marker}]`) === null) {
			const spacer = document.createElement('div');
			spacer.setAttribute(marker, '');
			spacer.style.height = '150vh';
			main.append(spacer);
		}
	}, PAGE_SPACER_MARKER);
	await releaseFocusAndPointer(session);
	await pageScroller(page).evaluate((main) => (main.scrollTop = 0));
	await scrollRowTo(page, 'recent', 'start');
	await scrollRowTo(page, 'category', 'start');
	await scrollRowTo(page, state.row, state.position);
	await shelf(page, state.row).evaluate((element) =>
		element.scrollIntoView({ block: 'center', behavior: 'instant' }),
	);
	await expectScrollAtRest(pageScroller(page), 'top');
}

interface CaseContext {
	page: Page;
	session: InteractionSession;
	state: CarouselState;
	guard: AssertionGuard;
}

/** Runs while the finger or button is still down, where the gesture has a press phase. */
type DuringPress = () => Promise<void>;
type Interaction = (context: CaseContext, duringPress: DuringPress) => Promise<void>;

/** The arrow that leads away from the row's current end. */
function inwardArrow({ page, state }: CaseContext): Locator {
	return arrow(page, state.row, state.position === 'start' ? 'next' : 'previous');
}

function firstVisibleCard(page: Page, row: Row): Promise<Locator> {
	return rowGeometry(page, row).then((geometry) => {
		const [index] = fullyVisibleCardIndices(geometry);
		expect(index, 'a card is fully visible').toBeDefined();
		return scroller(page, row).locator('[data-slot="carousel-item"] > *').nth(index!);
	});
}

const INTERACTIONS: Record<string, Interaction> = {
	'row at rest': async () => {},
	'horizontal swipe': async ({ page, session, state }) => {
		const geometry = await rowGeometry(page, state.row);
		const toEnd = state.position === 'start';
		const start = pointOnRow(geometry, toEnd ? 0.75 : 0.25);
		await requireTouch(session).swipe(start, {
			x: start.x + (toEnd ? -SWIPE_DISTANCE_PX : SWIPE_DISTANCE_PX),
			y: start.y,
		});
	},
	'vertical swipe over a row': async ({ page, session, state }) => {
		const start = pointOnRow(await rowGeometry(page, state.row), 0.5);
		await requireTouch(session).swipe(start, { x: start.x, y: start.y - 250 });
	},
	'tap card': async ({ page, session, state }) =>
		requireTouch(session).tap(await firstVisibleCard(page, state.row)),
	'tap arrow': (context) => requireTouch(context.session).tap(inwardArrow(context)),
	'Shift+wheel': async ({ page, state }) => {
		const point = pointOnRow(await rowGeometry(page, state.row), 0.5);
		await page.mouse.move(point.x, point.y);
		await page.keyboard.down('Shift');
		try {
			await page.mouse.wheel(0, state.position === 'start' ? 300 : -300);
		} finally {
			await page.keyboard.up('Shift');
		}
	},
	'mouse drag across cards': async ({ page, state }, duringPress) => {
		const start = pointOnRow(await rowGeometry(page, state.row), 0.7);
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		await page.mouse.move(start.x - MOUSE_DRAG_DISTANCE_PX, start.y, { steps: 12 });
		await duringPress();
		// A quick last stretch keeps the release fast enough to glide.
		await page.mouse.move(start.x - MOUSE_DRAG_DISTANCE_PX - 40, start.y, { steps: 4 });
		await page.mouse.up();
	},
	'click card': async ({ page, state }) => {
		const point = await pointOf(await firstVisibleCard(page, state.row));
		await page.mouse.click(point.x, point.y);
	},
	'click arrow': async (context) => {
		const point = await pointOf(inwardArrow(context));
		await context.page.mouse.click(point.x, point.y);
	},
	'click Next twice quickly': async (context) => {
		const point = await pointOf(inwardArrow(context));
		await context.page.mouse.click(point.x, point.y);
		await context.page.mouse.click(point.x, point.y);
	},
	'Enter on an arrow button': async (context) => {
		const target = inwardArrow(context);
		await target.focus();
		await expect(target).toBeFocused();
		await context.page.keyboard.press('Enter');
	},
};

type Perform = (duringPress?: DuringPress) => Promise<void>;
/** Returns the URL the page must show afterwards when the outcome navigates. */
type OutcomeCheck = (context: CaseContext, perform: Perform) => Promise<string | void>;

const NEXT_CARD_PEEKS = `the next card peeks at least ${MIN_PEEK_PX} px into the row`;
const REDUCED_MOTION_JUMPS = 'reduced motion moves without gliding';
const LAST_CARD_VISIBLE = 'the last card is fully visible at the row end';

function movesByCards(cards: number): string {
	return `the row moves by exactly ${cards} card${cards === 1 ? '' : 's'}`;
}

/** The first card whose left edge is in view: the card the row is aligned to. */
function leadingCardIndex(geometry: RowGeometry): number {
	return geometry.cards.findIndex((card) => card.left >= geometry.visibleLeft - 1);
}

/** Moves by `cards` cards: the card that many places further becomes the leading one. */
function glidesCards(cards: number): OutcomeCheck {
	return async ({ page, state, guard }, perform) => {
		const before = await rowGeometry(page, state.row);
		const direction = state.position === 'start' ? 1 : -1;
		const stopRecording = await recordEveryFrame(scroller(page, state.row), 'scrollLeft');
		await perform();
		await expect
			.poll(() => rowScrollLeft(page, state.row), { message: 'the row moves' })
			.not.toBe(before.scrollLeft);
		await expectScrollAtRest(scroller(page, state.row), 'left');
		const samples = await stopRecording();
		const after = await rowGeometry(page, state.row);
		await guard.check(movesByCards(cards), () => {
			expect(leadingCardIndex(after), movesByCards(cards)).toBe(
				leadingCardIndex(before) + direction * cards,
			);
		});
		const glide = glideFrames(samples, before.scrollLeft, after.scrollLeft);
		if (state.motion === 'full') {
			expect(glide, 'the row glides through intermediate frames').toBeGreaterThan(1);
		} else {
			await guard.check(REDUCED_MOTION_JUMPS, () =>
				expect(glide, REDUCED_MOTION_JUMPS).toBe(0),
			);
		}
	};
}

async function opensCardLink({ page, state }: CaseContext, perform: Perform) {
	const card = await firstVisibleCard(page, state.row);
	const href = await card.getAttribute('href');
	expect(href, 'the pressed card is a link').not.toBeNull();
	await perform();
	await page.waitForURL((url) => url.pathname === href);
	await waitForAppHydration(page);
	return page.url();
}

const OUTCOME_CHECKS: Record<CarouselOutcome, OutcomeCheck> = {
	'peeks-next-card': async ({ page, state, guard }, perform) => {
		await perform();
		const geometry = await rowGeometry(page, state.row);
		expect(geometry.scrollLeft).toBe(0);
		expect(geometry.maxScroll, 'the row overflows').toBeGreaterThan(0);
		await guard.check(NEXT_CARD_PEEKS, () => {
			const peeking = geometry.cards.find(
				(card) => card.left < geometry.visibleRight && card.right > geometry.visibleRight,
			);
			expect(peeking, 'a card is cut by the visible row edge').toBeDefined();
			expect(geometry.visibleRight - peeking!.left, NEXT_CARD_PEEKS).toBeGreaterThanOrEqual(
				MIN_PEEK_PX,
			);
		});
	},
	'reaches-row-end': async ({ page, state, guard }, perform) => {
		await perform();
		const geometry = await rowGeometry(page, state.row);
		expect(geometry.scrollLeft, 'the row is scrolled to its end').toBeCloseTo(
			geometry.maxScroll,
			0,
		);
		await guard.check(LAST_CARD_VISIBLE, () =>
			expect(fullyVisibleCardIndices(geometry), LAST_CARD_VISIBLE).toContain(
				geometry.cards.length - 1,
			),
		);
		if (state.row === 'category') {
			await expect(
				scroller(page, state.row).locator('[data-slot="carousel-item"]').last(),
				'the category row ends with „Zobrazit vše"',
			).toContainText(m.nav_view_all());
		}
	},
	'scrolls-row': async ({ page, state }, perform) => {
		const before = await rowGeometry(page, state.row);
		const pageScrollBefore = await pageScrollTop(page);
		await perform();
		await expect
			.poll(() => rowScrollLeft(page, state.row), {
				message: 'the row scrolls toward its other end',
			})
			[state.position === 'start' ? 'toBeGreaterThan' : 'toBeLessThan'](
				before.scrollLeft + (state.position === 'start' ? 40 : -40),
			);
		await expectScrollAtRest(scroller(page, state.row), 'left');
		expect(await pageScrollTop(page), 'the page does not scroll').toBe(pageScrollBefore);
	},
	'scrolls-page': async ({ page, state }, perform) => {
		const before = await rowGeometry(page, state.row);
		const pageScrollBefore = await pageScrollTop(page);
		await perform();
		await expect
			.poll(() => pageScrollTop(page), { message: 'the page scrolls' })
			.toBeGreaterThan(pageScrollBefore + 40);
		await expectScrollAtRest(pageScroller(page), 'top');
		expect(await rowScrollLeft(page, state.row), 'the row stays').toBe(before.scrollLeft);
	},
	'opens-card-link': opensCardLink,
	'drags-row-and-glides': async ({ page, state }, perform) => {
		const before = await rowGeometry(page, state.row);
		await perform(async () => {
			expect(await rowScrollLeft(page, state.row), 'the row follows the pointer').toBeCloseTo(
				before.scrollLeft + MOUSE_DRAG_DISTANCE_PX,
				0,
			);
		});
		const releasedAt = before.scrollLeft + MOUSE_DRAG_DISTANCE_PX + 40;
		await expect
			.poll(() => rowScrollLeft(page, state.row), {
				message: 'the row keeps gliding after release',
			})
			.toBeGreaterThan(releasedAt + 10);
		await expectScrollAtRest(scroller(page, state.row), 'left');
		await expect(scroller(page, state.row)).not.toHaveAttribute('data-dragging');
	},
	'glides-one-card': glidesCards(1),
	'glides-two-cards': glidesCards(2),
};

describeSurfaceCases(
	test,
	{
		surface: CAROUSEL_SURFACE,
		interactions: Object.keys(INTERACTIONS),
		knownBugs: [],
		groupKey: ({ state }) => `${state.viewport} ${state.motion}`,
	},
	async (world, { capability, state, outcome }, guard) => {
		const session = await world.session(state.viewport, state.motion);
		const { page } = session;
		await arrange(session, state, {
			// In Chromium's touch emulation, a row a script scrolled back after a touch scroll keeps
			// a vertical swipe starting on it from scrolling the page.
			freshPage: outcome === 'scrolls-page',
		});
		const context: CaseContext = { page, session, state, guard };

		const navigatedTo = await OUTCOME_CHECKS[outcome](context, (duringPress = async () => {}) =>
			INTERACTIONS[capability.interaction]!(context, duringPress),
		);

		await expectPageSettled(page, {
			errors: session.errors,
			expectedUrl: navigatedTo ?? `${new URL(page.url()).origin}/home`,
			neutralTarget: page.getByRole('heading', { level: 1 }),
			touch: session.touch,
		});
	},
	(title, details, body) => test(title, details, body),
);
