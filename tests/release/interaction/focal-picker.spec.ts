import { expect, type Locator, type Page } from '@playwright/test';
import * as m from '../../../src/lib/paraglide/messages.js';
import { createWishlistAndNavigate } from '../../e2e/fixtures/wishlist-helpers.js';
import {
	FOCAL_PICKER_SURFACE,
	type FocalPickerOutcome,
	type FocalPickerState,
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
import { expectPageSettled } from './support/settled.js';
import { pointOf, type ScreenPoint } from './support/touch.js';
import { openSettingsTab, settingsDialog } from './support/wishlist.js';

/*
 * Generated from `FOCAL_PICKER_SURFACE` in ./inventory.ts. One account and wishlist per run; each
 * viewport keeps the settings dialog open on Vzhled with a library background and never saves, so
 * the wishlist is not changed.
 */

type Viewport = FocalPickerState['viewport'];

interface FocalPoint {
	x: number;
	y: number;
}

/** Where the point starts, as fractions of the preview. */
const START_POINTS: Record<FocalPickerState['start'], FocalPoint> = {
	center: { x: 0.5, y: 0.5 },
	corner: { x: 0, y: 0 },
};
/** Press and drag targets away from either start point, as fractions of the preview. */
const PRESS_TARGET: FocalPoint = { x: 0.3, y: 0.7 };
const DRAG_TARGET: FocalPoint = { x: 0.75, y: 0.4 };
const PAST_EDGE_PX = 24;
/** Pointer positions round to whole percent, so the point may sit this far from the press. */
const POSITION_TOLERANCE_PX = 3;
const LARGER_SHIFT_STEP = 'Shift+Arrow moves farther than a plain arrow step';

const test = testWithWorld(async ({ browser, playwright, workerInfo, baseURL, sessions }) => {
	const account = await oncePerRun(workerInfo, 'focal-picker-account', async () => {
		const cookies = await registerUser(playwright, baseURL, 'interaction-focal');
		const wishlistPath = await withSignedInPage(browser, baseURL, cookies, (page) =>
			createWishlistAndNavigate(page, 'Pozadí se středem'),
		);
		return { cookies, wishlistPath };
	});
	return {
		wishlistPath: account.wishlistPath,
		session: (viewport: Viewport) =>
			sessions.get(viewport, () => openSession(browser, baseURL, account.cookies, viewport)),
	};
});

function frame(page: Page): Locator {
	return page.getByTestId('wishlist-background-focal-frame');
}

function focalHandle(page: Page): Locator {
	return page.getByTestId('wishlist-background-focal-handle');
}

function focalLabel(point: FocalPoint): string {
	return m.wishlist_appearance_background_focal_value({ x: String(point.x), y: String(point.y) });
}

/** The point as the user sees it: where the handle is drawn, as preview percentages. */
async function drawnFocal(page: Page): Promise<FocalPoint & { center: ScreenPoint }> {
	const [frameBox, handleBox] = await Promise.all([
		frame(page).boundingBox(),
		focalHandle(page).boundingBox(),
	]);
	const center = {
		x: handleBox!.x + handleBox!.width / 2,
		y: handleBox!.y + handleBox!.height / 2,
	};
	return {
		x: Math.round(((center.x - frameBox!.x) / frameBox!.width) * 100),
		y: Math.round(((center.y - frameBox!.y) / frameBox!.height) * 100),
		center,
	};
}

async function framePoint(page: Page, fraction: FocalPoint): Promise<ScreenPoint> {
	const box = (await frame(page).boundingBox())!;
	// Keep presses inside the preview even at its 0 % and 100 % edges.
	const inset = (size: number, value: number) =>
		Math.min(size - 0.5, Math.max(0.5, size * value));
	return { x: box.x + inset(box.width, fraction.x), y: box.y + inset(box.height, fraction.y) };
}

function percentOf(fraction: FocalPoint): FocalPoint {
	return { x: Math.round(fraction.x * 100), y: Math.round(fraction.y * 100) };
}

async function expectFocal(page: Page, expected: FocalPoint) {
	await expect(focalHandle(page), 'the point announces its position').toHaveAccessibleName(
		focalLabel(expected),
	);
	const drawn = await drawnFocal(page);
	expect({ x: drawn.x, y: drawn.y }, 'the point is drawn at that position').toEqual(expected);
}

/** The scroll offset of whatever scrolls the settings content. */
function settingsScrollTop(page: Page): Promise<number> {
	return frame(page).evaluate((element) => {
		for (let node = element.parentElement; node !== null; node = node.parentElement) {
			const overflowY = getComputedStyle(node).overflowY;
			if (
				(overflowY === 'auto' || overflowY === 'scroll') &&
				node.scrollHeight > node.clientHeight
			) {
				return node.scrollTop;
			}
		}
		return document.scrollingElement?.scrollTop ?? 0;
	});
}

async function openLibraryBackground(page: Page, wishlistPath: string) {
	await openSettingsTab(page, wishlistPath, 'appearance');
	await settingsDialog(page)
		.getByRole('radio', { name: m.wishlist_appearance_background_library(), exact: true })
		.check();
	await expect(frame(page)).toBeVisible();
	await expect(frame(page).locator('img')).toHaveJSProperty('complete', true);
}

async function arrange(session: InteractionSession, wishlistPath: string, state: FocalPickerState) {
	const { page } = session;
	if (!(await frame(page).isVisible())) {
		await openLibraryBackground(page, wishlistPath);
	}
	await frame(page).evaluate((element) => element.scrollIntoView({ block: 'center' }));
	const start = await framePoint(page, START_POINTS[state.start]);
	await page.mouse.click(start.x, start.y);
	await expectFocal(page, percentOf(START_POINTS[state.start]));
	await releaseFocusAndPointer(session);
}

interface CaseContext {
	page: Page;
	session: InteractionSession;
	state: FocalPickerState;
}

/** Returns where the point must end up. */
type Interaction = (context: CaseContext) => Promise<FocalPoint>;

async function pastTopLeftEdge(page: Page): Promise<ScreenPoint> {
	const box = (await frame(page).boundingBox())!;
	const target = { x: Math.max(1, box.x - PAST_EDGE_PX), y: Math.max(1, box.y - PAST_EDGE_PX) };
	expect(target.x < box.x && target.y < box.y, 'the drag ends outside the preview').toBe(true);
	return target;
}

async function mouseDragPoint(page: Page, to: ScreenPoint) {
	const from = await pointOf(focalHandle(page));
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 12 });
	await page.mouse.up();
}

async function touchDragPoint(page: Page, session: InteractionSession, to: ScreenPoint) {
	await requireTouch(session).drag([focalHandle(page), to], { endAtRest: true });
}

async function pressKeyOnPoint(page: Page, key: string) {
	await focalHandle(page).focus();
	await expect(focalHandle(page)).toBeFocused();
	await page.keyboard.press(key);
}

/** The direction of one arrow step, without assuming the step size. */
const STEP_DIRECTIONS: Record<string, FocalPoint> = {
	ArrowLeft: { x: -1, y: 0 },
	ArrowDown: { x: 0, y: 1 },
};

const INTERACTIONS: Record<string, Interaction> = {
	'click in the preview': async ({ page }) => {
		const point = await framePoint(page, PRESS_TARGET);
		await page.mouse.click(point.x, point.y);
		return percentOf(PRESS_TARGET);
	},
	'tap in the preview': async ({ page, session }) => {
		await requireTouch(session).tap(await framePoint(page, PRESS_TARGET));
		return percentOf(PRESS_TARGET);
	},
	'mouse drag the point': async ({ page }) => {
		await mouseDragPoint(page, await framePoint(page, DRAG_TARGET));
		return percentOf(DRAG_TARGET);
	},
	'touch drag the point': async ({ page, session }) => {
		await touchDragPoint(page, session, await framePoint(page, DRAG_TARGET));
		return percentOf(DRAG_TARGET);
	},
	'mouse drag past the preview edge': async ({ page }) => {
		await mouseDragPoint(page, await pastTopLeftEdge(page));
		return { x: 0, y: 0 };
	},
	'touch drag past the preview edge': async ({ page, session }) => {
		await touchDragPoint(page, session, await pastTopLeftEdge(page));
		return { x: 0, y: 0 };
	},
	'ArrowLeft on the point': async ({ page, state }) => {
		await pressKeyOnPoint(page, 'ArrowLeft');
		return percentOf(START_POINTS[state.start]);
	},
	'ArrowDown on the point': async ({ page, state }) => {
		await pressKeyOnPoint(page, 'ArrowDown');
		return percentOf(START_POINTS[state.start]);
	},
	'Shift+ArrowLeft on the point': async ({ page, state }) => {
		await pressKeyOnPoint(page, 'Shift+ArrowLeft');
		return percentOf(START_POINTS[state.start]);
	},
};

interface OutcomeContext extends CaseContext {
	interaction: string;
	perform: () => Promise<FocalPoint>;
	guard: AssertionGuard;
}

/** Waits for the point to leave `start` and returns where it is drawn and announced. */
async function movedFocal(page: Page, start: FocalPoint): Promise<FocalPoint> {
	await expect
		.poll(async () => (await drawnFocal(page)).x, { message: 'the point moves' })
		.not.toBe(start.x);
	const { x, y } = await drawnFocal(page);
	await expectFocal(page, { x, y });
	return { x, y };
}

async function expectPointUnderPointer(page: Page, perform: () => Promise<FocalPoint>) {
	const scrollBefore = await settingsScrollTop(page);
	const expected = await perform();
	await expectFocal(page, expected);
	expect(await settingsScrollTop(page), 'the settings sheet does not scroll').toBe(scrollBefore);
}

/** Whether `value` moved from `start` toward the edge in `direction` without reaching that edge. */
function steppedTowardEdge(start: number, value: number, direction: number): boolean {
	if (direction === 0) {
		return value === start;
	}
	const edge = direction < 0 ? 0 : 100;
	return Math.min(start, edge) < value && value < Math.max(start, edge);
}

const OUTCOME_CHECKS: Record<FocalPickerOutcome, (context: OutcomeContext) => Promise<void>> = {
	'places-point-under-press': async ({ page, perform }) => {
		const expected = await perform();
		await expectFocal(page, expected);
		const pressed = await framePoint(page, { x: expected.x / 100, y: expected.y / 100 });
		const drawn = await drawnFocal(page);
		expect(Math.abs(drawn.center.x - pressed.x)).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
		expect(Math.abs(drawn.center.y - pressed.y)).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
	},
	'follows-pointer': ({ page, perform }) => expectPointUnderPointer(page, perform),
	'stops-at-preview-edge': ({ page, perform }) => expectPointUnderPointer(page, perform),
	'moves-one-step': async ({ page, interaction, perform }) => {
		const start = await perform();
		const direction = STEP_DIRECTIONS[interaction.split(' ')[0]!]!;
		await expect
			.poll(
				async () => {
					const drawn = await drawnFocal(page);
					return {
						x: steppedTowardEdge(start.x, drawn.x, direction.x),
						y: steppedTowardEdge(start.y, drawn.y, direction.y),
					};
				},
				{
					message:
						'the point moves in the arrow direction only, by a step that stays short of the edge',
				},
			)
			.toEqual({ x: true, y: true });
		const drawn = await drawnFocal(page);
		await expect(focalHandle(page)).toHaveAccessibleName(focalLabel(drawn));
		await expect(focalHandle(page), 'focus stays on the point').toBeFocused();
	},
	'moves-a-larger-step': async ({ page, state, perform, guard }) => {
		const start = percentOf(START_POINTS[state.start]);
		await pressKeyOnPoint(page, 'ArrowLeft');
		const plainStep = start.x - (await movedFocal(page, start)).x;
		await page.keyboard.press('ArrowRight');
		await expectFocal(page, start);

		await perform();
		const moved = await movedFocal(page, start);
		expect(moved.y, 'the point moves in the arrow direction only').toBe(start.y);
		expect(moved.x, 'the point moves left').toBeLessThan(start.x);
		await guard.check(LARGER_SHIFT_STEP, () =>
			expect(start.x - moved.x, LARGER_SHIFT_STEP).toBeGreaterThan(plainStep),
		);
		await expect(focalHandle(page), 'focus stays on the point').toBeFocused();
	},
	'stays-at-preview-edge': async ({ page, perform }) => {
		const start = await perform();
		await expectFocal(page, start);
		await expect(focalHandle(page), 'focus stays on the point').toBeFocused();
	},
};

describeSurfaceCases(
	test,
	{
		surface: FOCAL_PICKER_SURFACE,
		interactions: Object.keys(INTERACTIONS),
		knownBugs: [],
		groupKey: ({ state }) => state.viewport,
	},
	async (world, { capability, state, outcome }, guard) => {
		const session = await world.session(state.viewport);
		const { page } = session;
		await arrange(session, world.wishlistPath, state);
		const context: CaseContext = { page, session, state };

		await OUTCOME_CHECKS[outcome]({
			...context,
			interaction: capability.interaction,
			perform: () => INTERACTIONS[capability.interaction]!(context),
			guard,
		});

		await expectPageSettled(page, {
			errors: session.errors,
			expectedUrl: `${new URL(page.url()).origin}${world.wishlistPath}`,
			neutralTarget: settingsDialog(page).getByRole('heading', {
				name: m.wishlist_settings_title(),
			}),
			touch: session.touch,
			allowedOpenLayers: ['dialog'],
		});
	},
	(title, details, body) => test(title, details, body),
);
