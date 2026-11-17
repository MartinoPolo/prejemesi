import { devices, expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from '../e2e/fixtures/test-data.js';
import {
	loginViaApi,
	parseCookiesForContext,
	registerAndGetPage,
	waitForAppHydration,
} from '../e2e/fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	openGiftImageFraming,
	uploadGiftEditorImage,
	waitForDialogMotionToSettle,
	waitForDialogOverlayRemoval,
} from '../e2e/fixtures/wishlist-helpers.js';
import { MAX_GIFT_IMAGES } from '../../src/lib/modules/gifts/gift_images.js';
import { SEED_PASSWORD } from '../../src/lib/server/db/seed_credentials.js';
import { createTouchInput } from './interaction/support/touch.js';

// Issue #706: the gift editor's main screen and framing step fit a 85dvh desktop dialog without
// scrolling and keep one height, and phones get a compact header with a one-row footer. A new
// account owns the editable gift; the seeded shared gift with a full gallery is opened read-only
// and never saved.
const SAMPLE_IMAGE_PATH = fileURLToPath(
	new URL('../e2e/fixtures/sample-image.jpg', import.meta.url),
);
const GIFT_NAME = 'Dárek pro rozvržení editoru';
const GIFT_LINK = 'https://www.example.com/obchod/darek';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
/** Short enough that the framing step scrolls, so a drag could scroll the body instead. */
const SHORT_PHONE = { width: 390, height: 600 };
/** The desktop dialog is pinned to this share of the viewport height. */
const DIALOG_HEIGHT_SHARE = 0.85;
/** Overlay scrollbars take no layout gutter but still paint over the scroller's right edge. */
const OVERLAY_SCROLLBAR_WIDTH_PX = 8;
const PIXEL_TOLERANCE = 1;
const SEEDED_OWNER = { email: 'martin@test.cz', password: SEED_PASSWORD };
const SEEDED_WISHLIST_PATH = '/w/xmas2026';
/** Shared, so its quantity is locked, and it holds a full gallery. */
const FULL_GALLERY_GIFT = 'PlayStation 5';

interface Box {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

interface Viewport {
	width: number;
	height: number;
}

async function createGiftWithImageAndLink(page: Page) {
	await createWishlistAndNavigate(page, 'Rozvržení editoru dárku');
	await addGift(page, GIFT_NAME, {
		description: 'Popis dárku, který se vejde do editoru bez posouvání.',
		price: '1290',
		primaryLink: GIFT_LINK,
	});
	const dialog = await openEditor(page, GIFT_NAME);
	await uploadGiftEditorImage(page, dialog, SAMPLE_IMAGE_PATH);
	await dialog
		.getByTestId('gift-editor-footer')
		.getByRole('button', { name: 'Uložit', exact: true })
		.click();
	await expect(dialog).not.toBeVisible({ timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
}

async function openEditor(page: Page, giftName: string): Promise<Locator> {
	await page.getByText(giftName, { exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await waitForDialogMotionToSettle(dialog);
	await page.evaluate(() => document.fonts.ready);
	return dialog;
}

/** Opens the seeded full-gallery gift's editor in a fresh context; the caller closes the page. */
async function openFullGalleryEditor(
	browser: Browser,
	baseURL: string,
	request: Parameters<typeof loginViaApi>[0],
	contextOptions: Parameters<Browser['newContext']>[0],
): Promise<{ page: Page; dialog: Locator }> {
	const cookies = await loginViaApi(request, baseURL, SEEDED_OWNER);
	const context = await browser.newContext({ ...contextOptions, baseURL });
	await context.addCookies(parseCookiesForContext(cookies, baseURL));
	const page = await context.newPage();
	await page.goto(SEEDED_WISHLIST_PATH, { waitUntil: 'domcontentloaded' });
	await waitForAppHydration(page);
	const dialog = await openEditor(page, FULL_GALLERY_GIFT);
	await expect(
		dialog.locator('[data-gift-image-tile]'),
		'the seeded gift fills the gallery',
	).toHaveCount(MAX_GIFT_IMAGES);
	await expect(dialog.locator('#gift-quantity')).toHaveAccessibleDescription(
		'Počet kusů lze po sdílení pouze zvýšit.',
	);
	return { page, dialog };
}

function bodyOverflow(dialog: Locator): Promise<number> {
	return dialog
		.getByTestId('gift-detail-body')
		.evaluate((body) => body.scrollHeight - body.clientHeight);
}

async function boxOf(locator: Locator): Promise<Box> {
	const box = await locator.boundingBox();
	expect(box, 'the element is laid out').not.toBeNull();
	return { left: box!.x, top: box!.y, right: box!.x + box!.width, bottom: box!.y + box!.height };
}

function expectInside(inner: Box, outer: Box, message: string) {
	expect(inner.left, message).toBeGreaterThanOrEqual(outer.left - PIXEL_TOLERANCE);
	expect(inner.top, message).toBeGreaterThanOrEqual(outer.top - PIXEL_TOLERANCE);
	expect(inner.right, message).toBeLessThanOrEqual(outer.right + PIXEL_TOLERANCE);
	expect(inner.bottom, message).toBeLessThanOrEqual(outer.bottom + PIXEL_TOLERANCE);
}

function overlaps(first: Box, second: Box): boolean {
	return (
		first.left < second.right &&
		second.left < first.right &&
		first.top < second.bottom &&
		second.top < first.bottom
	);
}

function viewportBox(viewport: Viewport): Box {
	return { left: 0, top: 0, right: viewport.width, bottom: viewport.height };
}

/** The body, footer and dialog all stay inside the viewport without the body scrolling. */
async function expectScreenFits(dialog: Locator, viewport: Viewport, state: string) {
	expect(await bodyOverflow(dialog), `${state} fits without scrolling`).toBeLessThanOrEqual(0);
	const dialogBox = await boxOf(dialog);
	const footer = await boxOf(dialog.getByTestId('gift-editor-footer'));
	expectInside(footer, dialogBox, `${state}: the footer stays inside the dialog`);
	expectInside(footer, viewportBox(viewport), `${state}: the footer stays inside the viewport`);
	expectInside(
		dialogBox,
		viewportBox(viewport),
		`${state}: the dialog stays inside the viewport`,
	);
}

async function expectDesktopDialogHeight(dialog: Locator, state: string): Promise<number> {
	const { top, bottom } = await boxOf(dialog);
	const height = bottom - top;
	expect(height, `${state}: the dialog is at most 85 % of the viewport`).toBeLessThanOrEqual(
		DESKTOP.height * DIALOG_HEIGHT_SHARE + PIXEL_TOLERANCE,
	);
	return height;
}

interface ClosePlacement {
	close: Box;
	maximumRight: number;
	minimumTop: number;
	scrollbars: Box[];
}

/** Where the close sits against the dialog's inner edge, and every scrollbar inside the dialog. */
function closePlacement(dialog: Locator): Promise<ClosePlacement> {
	return dialog.evaluate((content, overlayScrollbarWidth) => {
		const toBox = (rect: DOMRect) => ({
			left: rect.left,
			top: rect.top,
			right: rect.right,
			bottom: rect.bottom,
		});
		const probe = document.createElement('div');
		probe.style.width = 'var(--overlay-close-inset)';
		content.append(probe);
		const inset = probe.getBoundingClientRect().width;
		probe.remove();
		const contentRect = content.getBoundingClientRect();
		const contentStyle = getComputedStyle(content);
		const scrollbars = [content, ...content.querySelectorAll('*')].flatMap((element) => {
			const style = getComputedStyle(element);
			if (
				!/auto|scroll/.test(style.overflowY) ||
				element.scrollHeight <= element.clientHeight
			) {
				return [];
			}
			const rect = element.getBoundingClientRect();
			const right = rect.right - Number.parseFloat(style.borderRightWidth);
			const gutterLeft = rect.left + element.clientLeft + element.clientWidth;
			const left = Math.min(gutterLeft, right - overlayScrollbarWidth);
			return [{ left, top: rect.top, right, bottom: rect.bottom }];
		});
		const close = content.querySelector('[data-slot="dialog-close"]')!;
		return {
			close: toBox(close.getBoundingClientRect()),
			maximumRight:
				contentRect.right - Number.parseFloat(contentStyle.borderRightWidth) - inset,
			minimumTop: contentRect.top + Number.parseFloat(contentStyle.borderTopWidth) + inset,
			scrollbars,
		};
	}, OVERLAY_SCROLLBAR_WIDTH_PX);
}

/** The close keeps the shared inset from the dialog edge and never sits on a scrollbar. */
async function expectCloseClearOfEdgeAndScrollbars(dialog: Locator): Promise<ClosePlacement> {
	const placement = await closePlacement(dialog);
	expect(
		placement.close.right,
		'the close keeps the inset from the right edge',
	).toBeLessThanOrEqual(placement.maximumRight + PIXEL_TOLERANCE);
	expect(
		placement.close.top,
		'the close keeps the inset from the top edge',
	).toBeGreaterThanOrEqual(placement.minimumTop - PIXEL_TOLERANCE);
	for (const scrollbar of placement.scrollbars) {
		expect(overlaps(placement.close, scrollbar), 'the close stays off every scrollbar').toBe(
			false,
		);
	}
	return placement;
}

async function expectFooterOneRow(dialog: Locator, buttonNames: readonly string[]) {
	const footer = dialog.getByTestId('gift-editor-footer');
	const buttonBoxes = await Promise.all(
		buttonNames.map((name) => boxOf(footer.getByRole('button', { name, exact: true }))),
	);
	const firstTop = buttonBoxes[0]!.top;
	for (const buttonBox of buttonBoxes) {
		expect(Math.abs(buttonBox.top - firstTop), 'footer buttons share one row').toBeLessThan(1);
	}
}

/** The title holds a single line and the header holds nothing but that title row. */
async function expectHeaderOneTitleLine(dialog: Locator) {
	const sizes = await dialog.evaluate((content) => {
		const header = content.querySelector<HTMLElement>('[data-testid="gift-editor-header"]')!;
		const title = header.querySelector<HTMLElement>('[data-slot="dialog-title"]')!;
		const headerStyle = getComputedStyle(header);
		const titleStyle = getComputedStyle(title);
		const titleHeight = title.getBoundingClientRect().height;
		return {
			titleHeight,
			oneLineTitleHeight: Math.max(
				Number.parseFloat(titleStyle.minHeight) || 0,
				Number.parseFloat(titleStyle.paddingTop) +
					Number.parseFloat(titleStyle.lineHeight) +
					Number.parseFloat(titleStyle.paddingBottom),
			),
			headerContentHeight:
				header.getBoundingClientRect().height -
				Number.parseFloat(headerStyle.paddingTop) -
				Number.parseFloat(headerStyle.paddingBottom),
		};
	});
	expect(sizes.titleHeight, 'the title is a single line').toBeLessThanOrEqual(
		sizes.oneLineTitleHeight + PIXEL_TOLERANCE,
	);
	expect(sizes.headerContentHeight, 'the header is only the title row').toBeLessThanOrEqual(
		sizes.titleHeight + PIXEL_TOLERANCE,
	);
}

/** The title's first line starts where the body content starts and shares the close's row. */
async function expectTitleStartsOnCloseRow(dialog: Locator) {
	const placement = await dialog.evaluate((content) => {
		const title = content.querySelector('[data-slot="dialog-title"]')!;
		const range = document.createRange();
		range.selectNodeContents(title);
		const firstLine = range.getClientRects()[0]!;
		const body = content.querySelector<HTMLElement>('[data-testid="gift-detail-body"]')!;
		const bodyStart =
			body.getBoundingClientRect().left +
			Number.parseFloat(getComputedStyle(body).paddingLeft);
		const close = content.querySelector('[data-slot="dialog-close"]')!.getBoundingClientRect();
		return {
			textLeft: firstLine.left,
			textMiddle: (firstLine.top + firstLine.bottom) / 2,
			bodyStart,
			closeTop: close.top,
			closeBottom: close.bottom,
		};
	});
	expect(
		Math.abs(placement.textLeft - placement.bodyStart),
		'the title starts at the dialog start inset, not centred',
	).toBeLessThanOrEqual(PIXEL_TOLERANCE);
	expect(placement.textMiddle, 'the title shares the close row').toBeGreaterThan(
		placement.closeTop,
	);
	expect(placement.textMiddle, 'the title shares the close row').toBeLessThan(
		placement.closeBottom,
	);
}

function cardSurface(framingStep: Locator): Locator {
	return framingStep.getByTestId('gift-framing-view-square').getByTestId('crop-pan-surface');
}

async function expectPhoneFramingFits(dialog: Locator, framingStep: Locator) {
	await expectScreenFits(dialog, PHONE, 'the phone framing step');
	expectInside(
		await boxOf(cardSurface(framingStep)),
		viewportBox(PHONE),
		'the phone framing surface stays inside the viewport',
	);
	await expectFooterOneRow(dialog, ['Hotovo', 'Uložit']);
}

test.describe('gift editor layout (issue #706)', () => {
	test('desktop main screen, expanded link and framing step fit one dialog height', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('gift-editor-desktop'),
		);
		try {
			await page.setViewportSize(DESKTOP);
			await createGiftWithImageAndLink(page);
			const dialog = await openEditor(page, GIFT_NAME);

			await expectScreenFits(dialog, DESKTOP, 'the main screen');
			const mainHeight = await expectDesktopDialogHeight(dialog, 'the main screen');
			await expectCloseClearOfEdgeAndScrollbars(dialog);

			await dialog.getByRole('button', { name: /example\.com\/obchod\/darek/ }).click();
			await expect(dialog.getByTestId('gift-link-panel')).toBeVisible();
			await expectScreenFits(dialog, DESKTOP, 'the main screen with a link expanded');
			await expectCloseClearOfEdgeAndScrollbars(dialog);

			await openGiftImageFraming(dialog);
			await waitForDialogMotionToSettle(dialog);
			await expectScreenFits(dialog, DESKTOP, 'the framing step');
			expect(
				await expectDesktopDialogHeight(dialog, 'the framing step'),
				'the framing step keeps the main screen height',
			).toBeCloseTo(mainHeight, 0);
			await expectCloseClearOfEdgeAndScrollbars(dialog);
		} finally {
			await page.context().close();
		}
	});

	test('phone header stays compact, the footer is one row and fields come first', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('gift-editor-phone'),
		);
		try {
			await page.setViewportSize(DESKTOP);
			await createGiftWithImageAndLink(page);
			await page.setViewportSize(PHONE);
			const dialog = await openEditor(page, GIFT_NAME);

			await expectHeaderOneTitleLine(dialog);
			await expectTitleStartsOnCloseRow(dialog);
			await expectFooterOneRow(dialog, ['Zrušit', 'Uložit']);

			const fields = await boxOf(dialog.getByTestId('gift-detail-column'));
			const images = await boxOf(dialog.getByTestId('gift-image-column'));
			expect(fields.bottom, 'fields come before the images').toBeLessThanOrEqual(images.top);
			const placement = await expectCloseClearOfEdgeAndScrollbars(dialog);
			expect(placement.scrollbars, 'the phone main screen scrolls its body').not.toHaveLength(
				0,
			);

			await dialog.getByTestId('gift-image-edit-entry').scrollIntoViewIfNeeded();
			const framingStep = await openGiftImageFraming(dialog);
			await waitForDialogMotionToSettle(dialog);
			await expectPhoneFramingFits(dialog, framingStep);
		} finally {
			await page.context().close();
		}
	});

	test('a shared gift with a full gallery fits the desktop main screen and the phone framing step', async ({
		browser,
		request,
		baseURL,
	}) => {
		const desktop = await openFullGalleryEditor(browser, baseURL!, request, {
			viewport: DESKTOP,
		});
		try {
			await expectScreenFits(desktop.dialog, DESKTOP, 'the full-gallery main screen');
			const mainHeight = await expectDesktopDialogHeight(
				desktop.dialog,
				'the full-gallery main screen',
			);
			await openGiftImageFraming(desktop.dialog);
			await waitForDialogMotionToSettle(desktop.dialog);
			await expectScreenFits(desktop.dialog, DESKTOP, 'the full-gallery framing step');
			expect(
				await expectDesktopDialogHeight(desktop.dialog, 'the full-gallery framing step'),
				'the framing step keeps the main screen height',
			).toBeCloseTo(mainHeight, 0);
		} finally {
			await desktop.page.context().close();
		}

		const phone = await openFullGalleryEditor(browser, baseURL!, request, {
			...devices['Pixel 7'],
			viewport: PHONE,
		});
		try {
			await phone.dialog.getByTestId('gift-image-edit-entry').scrollIntoViewIfNeeded();
			const framingStep = await openGiftImageFraming(phone.dialog);
			await waitForDialogMotionToSettle(phone.dialog);
			await expectPhoneFramingFits(phone.dialog, framingStep);
		} finally {
			await phone.page.context().close();
		}
	});

	// A real touch drag pans the photo, but Chromium lets this drag pan without touch-action too, so
	// the surface's claim on the gesture is asserted in crop_pan_surface.svelte.test.ts.
	test('a real touch drag pans the photo on a short phone', async ({
		browser,
		request,
		baseURL,
	}) => {
		const { page, dialog } = await openFullGalleryEditor(browser, baseURL!, request, {
			...devices['Pixel 7'],
			viewport: SHORT_PHONE,
		});
		try {
			const touch = await createTouchInput(page);
			await dialog.getByTestId('gift-image-edit-entry').scrollIntoViewIfNeeded();
			const framingStep = await openGiftImageFraming(dialog);
			await waitForDialogMotionToSettle(dialog);
			// Zoomed in, the photo can move both ways inside the card window.
			const zoomSlider = framingStep
				.getByTestId('gift-framing-controls-square')
				.getByRole('slider');
			await zoomSlider.focus();
			for (let step = 0; step < 4; step += 1) {
				await zoomSlider.press('ArrowRight');
			}

			expect(
				await bodyOverflow(dialog),
				'the short phone framing step scrolls',
			).toBeGreaterThan(0);
			const surface = cardSurface(framingStep);
			await surface.evaluate((element) => element.scrollIntoView({ block: 'center' }));
			const photo = surface.locator('img').first();
			// The framing reaches the photo as its object-position and zoom transform.
			const framingBefore = await photo.getAttribute('style');
			const scrollBefore = await page.evaluate(() => {
				const root = document.documentElement;
				root.dataset.testScrollEvents = '0';
				document.addEventListener(
					'scroll',
					() => {
						root.dataset.testScrollEvents = String(
							Number(root.dataset.testScrollEvents) + 1,
						);
					},
					{ capture: true },
				);
				const body = document.querySelector('[data-testid="gift-detail-body"]')!;
				return { body: body.scrollTop, page: window.scrollY };
			});
			const surfaceBox = await boxOf(surface);
			const start = {
				x: (surfaceBox.left + surfaceBox.right) / 2,
				y: (surfaceBox.top + surfaceBox.bottom) / 2,
			};
			await touch.drag([start, { x: start.x - 40, y: start.y - 30 }], { endAtRest: true });

			await expect(photo, 'the photo follows the finger').not.toHaveAttribute(
				'style',
				framingBefore ?? '',
			);
			const scrollAfter = await page.evaluate(() => ({
				body: document.querySelector('[data-testid="gift-detail-body"]')!.scrollTop,
				page: window.scrollY,
				events: Number(document.documentElement.dataset.testScrollEvents),
			}));
			expect(scrollAfter.body, 'the dialog body did not scroll').toBe(scrollBefore.body);
			expect(scrollAfter.page, 'the page did not scroll').toBe(scrollBefore.page);
			expect(scrollAfter.events, 'nothing scrolled during the drag').toBe(0);
		} finally {
			await page.context().close();
		}
	});
});
