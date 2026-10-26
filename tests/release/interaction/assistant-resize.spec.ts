import { expect, type Locator, type Page } from '@playwright/test';
import { SEED_PASSWORD } from '../../../src/lib/server/db/seed_credentials.js';
import { loginViaApi, waitForAppHydration } from '../../e2e/fixtures/auth-helpers.js';
import {
	ASSISTANT_RESIZE_SURFACE,
	type AssistantResizeOutcome,
	type AssistantResizeState,
} from './inventory.js';
import { describeSurfaceCases } from './support/cases.js';
import {
	openSession,
	releaseFocusAndPointer,
	testWithWorld,
	type InteractionSession,
} from './support/session.js';
import { expectPageSettled } from './support/settled.js';
import { pointOf } from './support/touch.js';

/*
 * Generated from `ASSISTANT_RESIZE_SURFACE` in ./inventory.ts. The assistant is allowlisted for the
 * seeded martin@test.cz only, so the cases open his seeded wishlist read-only; the panel width
 * lives in the browser, never on the server.
 */

const WISHLIST_PATH = '/w/xmas2026';
/** `.mpx/DECISIONS.md` 2026-10-26: opens 420 px wide, resizes from 360 px to the smaller of 640 px and half the viewport. */
const MIN_WIDTH = 360;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 420;
const DRAG_DISTANCE_PX = 120;
const SEED_IMAGE_STAND_IN =
	'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#ccc"/></svg>';

type Viewport = AssistantResizeState['viewport'];

const test = testWithWorld(async ({ browser, playwright, baseURL, sessions }) => {
	const request = await playwright.request.newContext();
	const cookies = await loginViaApi(request, baseURL, {
		email: 'martin@test.cz',
		password: SEED_PASSWORD,
	}).finally(() => request.dispose());
	const openWithSeedImages = async (viewport: Viewport) => {
		const session = await openSession(browser, baseURL, cookies, viewport);
		// Local databases are often seeded without the seed photos; a missing photo is not what
		// this surface is about, so it gets a stand-in instead of a 404.
		await session.context.route('**/api/upload/seed/**', (route) =>
			route.fulfill({ contentType: 'image/svg+xml', body: SEED_IMAGE_STAND_IN }),
		);
		return session;
	};
	return {
		session: (viewport: Viewport) => sessions.get(viewport, () => openWithSeedImages(viewport)),
	};
});

function panel(page: Page): Locator {
	return page.getByTestId('assistant-panel');
}

function handle(page: Page): Locator {
	return page.getByTestId('assistant-resize');
}

/** The largest width the requirement allows at this viewport. */
function maxWidthFor(page: Page): number {
	const { width } = page.viewportSize()!;
	return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(width / 2)));
}

function clampWidth(page: Page, width: number): number {
	return Math.min(maxWidthFor(page), Math.max(MIN_WIDTH, width));
}

function renderedWidth(page: Page): Promise<number> {
	return panel(page).evaluate((element) => Math.round(element.getBoundingClientRect().width));
}

/** The rendered width, once the separator reports the same value. */
async function settledWidth(page: Page): Promise<number> {
	let width = 0;
	await expect
		.poll(
			async () => {
				width = await renderedWidth(page);
				const reported = await handle(page).getAttribute('aria-valuenow');
				return `rendered ${width}, reported ${reported}`;
			},
			{ message: 'the separator reports the rendered width' },
		)
		.toMatch(/^rendered (\d+), reported \1$/);
	return width;
}

async function expectListSpaceReserved(page: Page) {
	const [contentRight, panelLeft] = await Promise.all([
		page
			.locator('main')
			.evaluate((element) => Math.round(element.getBoundingClientRect().right)),
		panel(page).evaluate((element) => Math.round(element.getBoundingClientRect().left)),
	]);
	expect(contentRight, 'the list ends where the panel begins').toBeLessThanOrEqual(panelLeft);
}

async function dragHandle(page: Page, deltaX: number) {
	const start = await pointOf(handle(page));
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x + deltaX, start.y, { steps: 10 });
	await page.mouse.up();
}

async function pressOnHandle(page: Page, key: string) {
	await handle(page).focus();
	await expect(handle(page)).toBeFocused();
	await page.keyboard.press(key);
}

async function doubleClickHandle(page: Page) {
	const point = await pointOf(handle(page));
	await page.mouse.dblclick(point.x, point.y);
}

/** Each start width is reached the way a user reaches it, through the handle itself. */
const START_WIDTHS: Record<
	AssistantResizeState['start'],
	{ reach: (page: Page) => Promise<void>; width: (page: Page) => number }
> = {
	min: { reach: (page) => pressOnHandle(page, 'Home'), width: () => MIN_WIDTH },
	default: {
		reach: doubleClickHandle,
		width: (page) => clampWidth(page, DEFAULT_WIDTH),
	},
	max: { reach: (page) => pressOnHandle(page, 'End'), width: maxWidthFor },
};

async function arrange(session: InteractionSession, state: AssistantResizeState): Promise<number> {
	const { page } = session;
	if (new URL(page.url()).pathname !== WISHLIST_PATH) {
		await page.goto(WISHLIST_PATH);
		await waitForAppHydration(page);
	}
	if (!(await panel(page).isVisible())) {
		await page.getByTestId('assistant-fab').click();
		await expect(panel(page)).toBeVisible();
	}
	const start = START_WIDTHS[state.start];
	await start.reach(page);
	await expect
		.poll(() => renderedWidth(page), { message: 'the start width applies' })
		.toBe(start.width(page));
	await releaseFocusAndPointer(session);
	return settledWidth(page);
}

type Interaction = (page: Page) => Promise<void>;

const INTERACTIONS: Record<string, Interaction> = {
	'open panel at rest': async () => {},
	'drag handle 120 px left': (page) => dragHandle(page, -DRAG_DISTANCE_PX),
	'drag handle 120 px right': (page) => dragHandle(page, DRAG_DISTANCE_PX),
	'ArrowLeft on handle': (page) => pressOnHandle(page, 'ArrowLeft'),
	'ArrowRight on handle': (page) => pressOnHandle(page, 'ArrowRight'),
	'Home on handle': (page) => pressOnHandle(page, 'Home'),
	'End on handle': (page) => pressOnHandle(page, 'End'),
	'double-click handle': doubleClickHandle,
};

interface OutcomeContext {
	page: Page;
	interaction: string;
	startWidth: number;
	width: number;
}

const OUTCOME_CHECKS: Record<AssistantResizeOutcome, (context: OutcomeContext) => void> = {
	'follows-pointer-within-limits': ({ page, interaction, startWidth, width }) => {
		// The handle is on the panel's left edge, so moving left widens it.
		const delta = interaction.includes('left') ? DRAG_DISTANCE_PX : -DRAG_DISTANCE_PX;
		expect(width).toBe(clampWidth(page, startWidth + delta));
	},
	// One step is a step, not a jump: it changes the width without reaching the limit.
	'widens-one-step': ({ page, startWidth, width }) => {
		expect(width, 'the panel widens').toBeGreaterThan(startWidth);
		expect(width, 'by one step, short of the maximum').toBeLessThan(maxWidthFor(page));
	},
	'narrows-one-step': ({ startWidth, width }) => {
		expect(width, 'the panel narrows').toBeLessThan(startWidth);
		expect(width, 'by one step, short of the minimum').toBeGreaterThan(MIN_WIDTH);
	},
	'stays-at-max': ({ page, width }) => expect(width).toBe(maxWidthFor(page)),
	'stays-at-min': ({ width }) => expect(width).toBe(MIN_WIDTH),
	'jumps-to-min': ({ width }) => expect(width).toBe(MIN_WIDTH),
	'jumps-to-max': ({ page, width }) => expect(width).toBe(maxWidthFor(page)),
	'restores-default': ({ page, width }) => expect(width).toBe(clampWidth(page, DEFAULT_WIDTH)),
	'reserves-list-space': ({ page, startWidth, width }) => {
		expect(width, 'the panel keeps its width').toBe(startWidth);
		expect(width).toBeLessThanOrEqual(maxWidthFor(page));
	},
};

describeSurfaceCases(
	test,
	{
		surface: ASSISTANT_RESIZE_SURFACE,
		interactions: Object.keys(INTERACTIONS),
		knownBugs: [],
		groupKey: ({ state }) => state.viewport,
	},
	async (world, { capability, state, outcome }) => {
		const session = await world.session(state.viewport);
		const { page } = session;
		const startWidth = await arrange(session, state);

		await INTERACTIONS[capability.interaction]!(page);

		const width = await settledWidth(page);
		OUTCOME_CHECKS[outcome]({ page, interaction: capability.interaction, startWidth, width });
		await expectListSpaceReserved(page);
		await expectPageSettled(page, {
			errors: session.errors,
			expectedUrl: `${new URL(page.url()).origin}${WISHLIST_PATH}`,
			neutralTarget: page.getByRole('heading', { level: 1 }),
		});
	},
	(title, details, body) => test(title, details, body),
);
