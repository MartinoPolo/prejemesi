import { expect, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import * as m from '../../../src/lib/paraglide/messages.js';
import { createWishlistAndNavigate } from '../../e2e/fixtures/wishlist-helpers.js';
import { CROP_STAGE_SURFACE, type CropStageOutcome, type CropStageState } from './inventory.js';
import { describeSurfaceCases } from './support/cases.js';
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
import { mouseDrag, type ScreenPoint } from './support/touch.js';
import {
	openSettingsTab,
	saveButton,
	settingsDialog,
	showSavedSettings,
} from './support/wishlist.js';

/*
 * Generated from `CROP_STAGE_SURFACE` in ./inventory.ts. One account per run owns a wishlist with a
 * saved photo. Cases edit the card framing in Nastavení seznamu → Obrázek and never save; a dirty
 * draft is discarded before the next case.
 */

type Viewport = CropStageState['viewport'];

const SAMPLE_IMAGE_PATH = fileURLToPath(
	new URL('../../e2e/fixtures/sample-image.jpg', import.meta.url),
);
/** Zoom-in presses that turn the centred cover framing into a 200 % Manual crop. */
const MANUAL_ZOOM_PRESSES = 10;
const DRAG_DISTANCE_PX = 24;
/** Where wheel and pinch zooms aim, as fractions of the window: off-centre to expose drift. */
const ZOOM_ANCHOR = { x: 0.3, y: 0.3 };
/** The minimap point to centre, as fractions of the photo. */
const MINIMAP_POINT = { x: 0.3, y: 0.7 };
/** Photo fractions may drift this far through rounding and per-finger pinch steps. */
const PHOTO_FRACTION_TOLERANCE = 0.01;
const PIXEL_TOLERANCE = 1;

const test = testWithWorld(async ({ browser, playwright, workerInfo, baseURL, sessions }) => {
	const account = await oncePerRun(workerInfo, 'crop-stage-account', async () => {
		const cookies = await registerUser(playwright, baseURL, 'interaction-crop');
		const wishlistPath = await withSignedInPage(browser, baseURL, cookies, async (page) => {
			const path = await createWishlistAndNavigate(page, 'Fotka v okně');
			await openSettingsTab(page, path, 'image');
			const uploaded = page.waitForResponse(
				(response) =>
					response.request().method() === 'PUT' &&
					response.url().includes('/api/upload/') &&
					response.status() === 201,
			);
			await settingsDialog(page).locator('input[type=file]').setInputFiles(SAMPLE_IMAGE_PATH);
			await uploaded;
			await expect(cropWindow(page)).toBeVisible();
			await saveButton(page).click();
			await expect(saveButton(page), 'the photo is saved').toBeDisabled();
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

function stage(page: Page): Locator {
	return page.getByTestId('crop-stage');
}

function cropWindow(page: Page): Locator {
	return page.getByTestId('crop-stage-window');
}

function photo(page: Page): Locator {
	return stage(page).locator('img');
}

function framingOption(page: Page, framing: CropStageState['framing']): Locator {
	const names = {
		fill: m.image_fit_fill(),
		fit: m.image_fit_fit(),
		manual: m.image_fit_manual(),
	};
	return settingsDialog(page).getByRole('radio', { name: names[framing], exact: true });
}

interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface Geometry {
	window: Box;
	photo: Box;
}

async function geometry(page: Page): Promise<Geometry> {
	const [windowBox, photoBox] = await Promise.all([
		cropWindow(page).boundingBox(),
		photo(page).boundingBox(),
	]);
	expect(windowBox, 'the crop window is drawn').not.toBeNull();
	expect(photoBox, 'the photo is drawn').not.toBeNull();
	return { window: windowBox!, photo: photoBox! };
}

/** The screen point at a fraction of the crop window. */
function windowPoint({ window }: Geometry, fraction: { x: number; y: number }): ScreenPoint {
	return { x: window.x + window.width * fraction.x, y: window.y + window.height * fraction.y };
}

/** Which point of the photo, as fractions of it, lies under a screen point. */
function photoPointUnder({ photo: photoBox }: Geometry, point: ScreenPoint) {
	return {
		x: (point.x - photoBox.x) / photoBox.width,
		y: (point.y - photoBox.y) / photoBox.height,
	};
}

async function arrange(session: InteractionSession, wishlistPath: string, state: CropStageState) {
	const { page } = session;
	await showSavedSettings(page, wishlistPath, 'image');
	await expect(cropWindow(page), 'the saved photo has loaded').toBeVisible();
	await expect(framingOption(page, 'fill'), 'the saved card framing is Fill').toBeChecked();
	if (state.framing !== 'fill') {
		await framingOption(page, state.framing).click();
	}
	if (state.framing === 'manual') {
		const zoomIn = settingsDialog(page).getByRole('button', { name: m.image_crop_zoom_in() });
		for (let press = 0; press < MANUAL_ZOOM_PRESSES; press += 1) {
			await zoomIn.click();
		}
		await expect(page.getByTestId('crop-stage-zoom')).toHaveText('200 %');
	}
	await expect(framingOption(page, state.framing)).toBeChecked();
	await stage(page).evaluate((element) => element.scrollIntoView({ block: 'center' }));
	await releaseFocusAndPointer(session);
}

interface CaseContext {
	page: Page;
	session: InteractionSession;
	state: CropStageState;
	before: Geometry;
}

type Interaction = (context: CaseContext) => Promise<void>;

function dragPath({ before }: CaseContext): [ScreenPoint, ScreenPoint] {
	const from = windowPoint(before, { x: 0.5, y: 0.5 });
	return [from, { x: from.x, y: from.y + DRAG_DISTANCE_PX }];
}

async function pressStageKey(page: Page, key: string) {
	await stage(page).focus();
	await expect(stage(page)).toBeFocused();
	await page.keyboard.press(key);
}

const INTERACTIONS: Record<string, Interaction> = {
	'stage at rest': async () => {},
	'mouse drag the photo': (context) => mouseDrag(context.page, dragPath(context)),
	'touch drag the photo': (context) =>
		requireTouch(context.session).drag(dragPath(context), { endAtRest: true }),
	'pinch out over the photo': ({ session, before }) =>
		requireTouch(session).pinch(windowPoint(before, ZOOM_ANCHOR), {
			fromDistancePx: 40,
			toDistancePx: 120,
		}),
	'wheel up over the photo': async ({ page, before }) => {
		const anchor = windowPoint(before, ZOOM_ANCHOR);
		await page.mouse.move(anchor.x, anchor.y);
		await page.mouse.wheel(0, -300);
	},
	'+ on the stage': ({ page }) => pressStageKey(page, '+'),
	'ArrowRight on the stage': ({ page }) => pressStageKey(page, 'ArrowRight'),
	'Shift+ArrowRight on the stage': ({ page }) => pressStageKey(page, 'Shift+ArrowRight'),
	'0 on the stage': ({ page }) => pressStageKey(page, '0'),
	'press top-left on the pad': async ({ page, session }) => {
		const corner = settingsDialog(page).getByRole('button', {
			name: m.image_crop_align_top_left(),
		});
		await corner.scrollIntoViewIfNeeded();
		if (session.touch === undefined) {
			await corner.click();
		} else {
			await session.touch.tap(corner);
		}
	},
	'press the minimap': async ({ page }) => {
		const minimap = page.getByTestId('crop-navigator');
		const box = (await minimap.boundingBox())!;
		await minimap.click({
			position: { x: box.width * MINIMAP_POINT.x, y: box.height * MINIMAP_POINT.y },
		});
	},
};

interface OutcomeContext extends CaseContext {
	perform: () => Promise<void>;
}

function contains(outer: Box, inner: Box): boolean {
	const slack = 0.5;
	return (
		inner.x >= outer.x - slack &&
		inner.y >= outer.y - slack &&
		inner.x + inner.width <= outer.x + outer.width + slack &&
		inner.y + inner.height <= outer.y + outer.height + slack
	);
}

/** Waits until the photo has moved or resized, then returns where it settled. */
async function geometryAfterChange(page: Page, before: Geometry): Promise<Geometry> {
	await expect
		.poll(async () => JSON.stringify((await geometry(page)).photo), {
			message: 'the photo responds',
		})
		.not.toBe(JSON.stringify(before.photo));
	return geometry(page);
}

async function expectPromotedDraft(page: Page) {
	await expect(framingOption(page, 'manual'), 'the card framing becomes Manual').toBeChecked();
	await expect(saveButton(page), 'the change waits for Save').toBeEnabled();
}

function expectSameZoom(before: Geometry, after: Geometry) {
	expect(after.photo.width, 'the zoom stays the same').toBeCloseTo(before.photo.width, 0);
}

/** How far the photo moved sideways in one arrow press, at the same zoom and height. */
async function arrowStep(page: Page, before: Geometry): Promise<number> {
	const after = await geometryAfterChange(page, before);
	expectSameZoom(before, after);
	expect(after.photo.y, 'the photo stays at the same height').toBeCloseTo(before.photo.y, 0);
	return before.photo.x - after.photo.x;
}

/** Scroll offsets of everything around the stage, so a zoom gesture that scrolls them shows. */
function surroundingScroll(page: Page): Promise<number[]> {
	return stage(page).evaluate((element) => {
		const offsets = [window.scrollY];
		for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
			offsets.push(ancestor.scrollTop);
		}
		return offsets;
	});
}

async function expectZoomAround(
	page: Page,
	before: Geometry,
	anchor: { x: number; y: number },
	perform: () => Promise<void>,
) {
	const anchorPoint = windowPoint(before, anchor);
	const anchoredBefore = photoPointUnder(before, anchorPoint);
	const scrollBefore = await surroundingScroll(page);
	await perform();
	const after = await geometryAfterChange(page, before);
	expect(await surroundingScroll(page), 'the settings around the stage stay put').toEqual(
		scrollBefore,
	);
	expect(after.photo.width, 'the photo zooms in').toBeGreaterThan(before.photo.width + 1);
	const anchoredAfter = photoPointUnder(after, anchorPoint);
	expect(
		Math.abs(anchoredAfter.x - anchoredBefore.x),
		'the anchor stays put horizontally',
	).toBeLessThanOrEqual(PHOTO_FRACTION_TOLERANCE);
	expect(
		Math.abs(anchoredAfter.y - anchoredBefore.y),
		'the anchor stays put vertically',
	).toBeLessThanOrEqual(PHOTO_FRACTION_TOLERANCE);
	await expectPromotedDraft(page);
}

const OUTCOME_CHECKS: Record<CropStageOutcome, (context: OutcomeContext) => Promise<void>> = {
	'window-inside-stage': async ({ page, perform }) => {
		await perform();
		const [stageBox, windowBox, dialogBox] = await Promise.all([
			stage(page).boundingBox(),
			cropWindow(page).boundingBox(),
			settingsDialog(page).boundingBox(),
		]);
		expect(contains(stageBox!, windowBox!), 'the window sits whole inside the stage').toBe(
			true,
		);
		expect(contains(dialogBox!, stageBox!), 'the stage fits the settings dialog').toBe(true);
		const viewport = page.viewportSize()!;
		expect(stageBox!.x, 'the stage starts inside the viewport').toBeGreaterThanOrEqual(0);
		expect(
			stageBox!.x + stageBox!.width,
			'the stage ends inside the viewport',
		).toBeLessThanOrEqual(viewport.width);
	},
	'pans-with-pointer': async ({ page, before, perform }) => {
		await perform();
		const after = await geometryAfterChange(page, before);
		expectSameZoom(before, after);
		expect(after.photo.y - before.photo.y, 'the photo follows the pointer down').toBeCloseTo(
			DRAG_DISTANCE_PX,
			0,
		);
		expect(after.photo.x, 'the photo does not drift sideways').toBeCloseTo(before.photo.x, 0);
		await expectPromotedDraft(page);
	},
	'zooms-around-point': ({ page, before, perform }) =>
		expectZoomAround(page, before, ZOOM_ANCHOR, perform),
	'zooms-in-and-promotes': ({ page, before, perform }) =>
		expectZoomAround(page, before, { x: 0.5, y: 0.5 }, perform),
	'pans-one-step': async ({ page, before, perform }) => {
		await perform();
		const step = await arrowStep(page, before);
		expect(step, 'the photo moves left to show more of its right side').toBeGreaterThan(
			PIXEL_TOLERANCE,
		);
		await expect(saveButton(page), 'the change waits for Save').toBeEnabled();
	},
	'pans-larger-step': async ({ page, before, perform }) => {
		// A plain press first gives the step that Shift must exceed.
		await pressStageKey(page, 'ArrowRight');
		const plainStep = await arrowStep(page, before);
		const afterPlain = await geometry(page);
		await perform();
		const shiftStep = await arrowStep(page, afterPlain);
		expect(shiftStep, 'Shift moves further than a plain press').toBeGreaterThan(
			plainStep + PIXEL_TOLERANCE,
		);
	},
	recenters: async ({ page, before, perform }) => {
		await perform();
		const after = await geometryAfterChange(page, before);
		const windowCentre = windowPoint(after, { x: 0.5, y: 0.5 });
		expect(after.photo.x + after.photo.width / 2, 'the photo is centred').toBeCloseTo(
			windowCentre.x,
			0,
		);
		expect(after.photo.y + after.photo.height / 2, 'the photo is centred').toBeCloseTo(
			windowCentre.y,
			0,
		);
	},
	'aligns-to-corner': async ({ page, before, perform }) => {
		await perform();
		const after = await geometryAfterChange(page, before);
		expectSameZoom(before, after);
		expect(after.photo.x, 'the photo meets the left edge').toBeCloseTo(after.window.x, 0);
		expect(after.photo.y, 'the photo meets the top edge').toBeCloseTo(after.window.y, 0);
	},
	'centres-on-picked-point': async ({ page, before, perform }) => {
		await perform();
		const after = await geometryAfterChange(page, before);
		expectSameZoom(before, after);
		const centred = photoPointUnder(after, windowPoint(after, { x: 0.5, y: 0.5 }));
		expect(Math.abs(centred.x - MINIMAP_POINT.x), 'the picked point is centred').toBeLessThan(
			PHOTO_FRACTION_TOLERANCE * 2,
		);
		expect(Math.abs(centred.y - MINIMAP_POINT.y), 'the picked point is centred').toBeLessThan(
			PHOTO_FRACTION_TOLERANCE * 2,
		);
	},
};

describeSurfaceCases(
	test,
	{
		surface: CROP_STAGE_SURFACE,
		interactions: Object.keys(INTERACTIONS),
		knownBugs: [],
		groupKey: ({ state }) => state.viewport,
	},
	async (world, { capability, state, outcome }) => {
		const session = await world.session(state.viewport);
		const { page } = session;
		await arrange(session, world.wishlistPath, state);
		const context: CaseContext = { page, session, state, before: await geometry(page) };

		await OUTCOME_CHECKS[outcome]({
			...context,
			perform: () => INTERACTIONS[capability.interaction]!(context),
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
