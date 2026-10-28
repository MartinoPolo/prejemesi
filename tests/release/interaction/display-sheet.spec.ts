import { expect, type Locator, type Page } from '@playwright/test';
import * as m from '../../../src/lib/paraglide/messages.js';
import { waitForAppHydration } from '../../e2e/fixtures/auth-helpers.js';
import { addGift, createWishlistAndNavigate } from '../../e2e/fixtures/wishlist-helpers.js';
import {
	DISPLAY_SHEET_SURFACE,
	type DisplaySheetOutcome,
	type DisplaySheetState,
} from './inventory.js';
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
import { expectAnimationsFinished, expectPageSettled } from './support/settled.js';

/*
 * Generated from `DISPLAY_SHEET_SURFACE` in ./inventory.ts. One account per run owns a wishlist
 * with one gift; cases open and close the Display surfaces, and the Reset case clears the one
 * filter it sets.
 */

type Viewport = DisplaySheetState['viewport'];
type Section = DisplaySheetState['section'];

const SECTION_LABELS: Record<Section, () => string> = {
	sort: () => m.gift_sort_by(),
	grouping: () => m.gift_grouping_label(),
	filter: () => m.gift_filter(),
};
/** Adjacent menus may overlap by their borders and shadow, not by their content. */
const CASCADE_OVERLAP_PX = 12;
const SHEET_MARK = 'data-interaction-sheet-mark';

const test = testWithWorld(async ({ browser, playwright, workerInfo, baseURL, sessions }) => {
	const account = await oncePerRun(workerInfo, 'display-sheet-account', async () => {
		const cookies = await registerUser(playwright, baseURL, 'interaction-display');
		const wishlistPath = await withSignedInPage(browser, baseURL, cookies, async (page) => {
			const path = await createWishlistAndNavigate(page, 'Zobrazení seznamu');
			await addGift(page, 'Deskovka na večery');
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

function displaySheet(page: Page): Locator {
	return page.getByRole('dialog', { name: m.gift_display_options() });
}

function sectionSwitch(page: Page, section: Section): Locator {
	return page.getByTestId(`mobile-sheet-${section}-switch`);
}

/** What the active section offers; inactive sections are inert and hidden from roles. */
function sectionContent(container: Locator, section: Section): Locator {
	if (section === 'filter') {
		return container.getByRole('checkbox', { name: m.gift_filter_show_received() });
	}
	return container.getByRole('radiogroup', { name: SECTION_LABELS[section]() });
}

function resetButton(page: Page): Locator {
	return displaySheet(page).getByRole('button', {
		name: m.wishlist_detail_clear_filters(),
		exact: true,
	});
}

function displayMenu(page: Page): Locator {
	return page.getByRole('menu', { name: m.gift_display_options() });
}

function moreMenu(page: Page): Locator {
	return page.getByRole('menu', { name: m.wishlist_more_actions() });
}

function sectionTrigger(page: Page, section: Section): Locator {
	return displayMenu(page).getByRole('menuitem', {
		name: new RegExp(`^${SECTION_LABELS[section]()}`),
	});
}

/** The open submenu: every visible menu except Display itself. */
function sectionMenu(page: Page): Locator {
	return page
		.getByRole('menu')
		.filter({ visible: true })
		.and(page.locator(`:not([aria-label="${m.gift_display_options()}"])`));
}

async function arrange(session: InteractionSession, wishlistPath: string) {
	const { page } = session;
	if (new URL(page.url()).pathname !== wishlistPath) {
		await page.goto(wishlistPath);
		await waitForAppHydration(page);
	}
	const openLayers = page.locator('[role="dialog"], [role="menu"]').filter({ visible: true });
	for (let attempt = 0; attempt < 3 && (await openLayers.count()) > 0; attempt += 1) {
		await page.keyboard.press('Escape');
	}
	await expect(openLayers, 'the case starts with Display closed').toHaveCount(0);
	await releaseFocusAndPointer(session);
}

interface CaseContext {
	page: Page;
	session: InteractionSession;
	state: DisplaySheetState;
}

type Interaction = (context: CaseContext) => Promise<void>;

async function openSheet(session: InteractionSession) {
	await requireTouch(session).tap(session.page.getByTestId('mobile-display-trigger'));
	await expect(displaySheet(session.page)).toBeVisible();
	// A tap while the sheet still slides in lands on a moving target.
	await expectAnimationsFinished(session.page);
}

const INTERACTIONS: Record<string, Interaction> = {
	'tap Display': ({ session }) =>
		requireTouch(session).tap(session.page.getByTestId('mobile-display-trigger')),
	'tap a section switch in the sheet': ({ session, state }) =>
		requireTouch(session).tap(sectionSwitch(session.page, state.section)),
	'tap Reset after choosing a filter': ({ session }) =>
		requireTouch(session).tap(resetButton(session.page)),
	'ArrowRight into a section, then Escape twice': async ({ page, state }) => {
		await page.getByTestId('desktop-display-trigger').focus();
		await page.keyboard.press('Enter');
		await expect(displayMenu(page)).toBeVisible();
		await sectionTrigger(page, state.section).focus();
		await page.keyboard.press('ArrowRight');
	},
	'click More while Display is open': async ({ page }) => {
		await page.getByTestId('desktop-display-trigger').click();
		await expect(displayMenu(page)).toBeVisible();
		await page.getByTestId('desktop-more-trigger').click();
	},
};

interface OutcomeContext extends CaseContext {
	perform: () => Promise<void>;
}

async function expectActiveSection(page: Page, section: Section) {
	const sheet = displaySheet(page);
	for (const candidate of Object.keys(SECTION_LABELS) as Section[]) {
		await expect(sectionSwitch(page, candidate)).toHaveAttribute(
			'aria-pressed',
			String(candidate === section),
		);
	}
	await expect(sectionContent(sheet, section), 'the sheet shows that section').toBeVisible();
	await expect(sheet, 'the sheet names the section').toHaveAccessibleDescription(
		new RegExp(`^${SECTION_LABELS[section]()}: `),
	);
}

const OUTCOME_CHECKS: Record<DisplaySheetOutcome, (context: OutcomeContext) => Promise<void>> = {
	'opens-labeled-sheet': async ({ page, perform }) => {
		await perform();
		await expect(displaySheet(page), 'one labeled sheet opens').toHaveCount(1);
		await expect(displaySheet(page)).toBeVisible();
		await expectAnimationsFinished(page);
		await expectActiveSection(page, 'sort');
	},
	'switches-in-place': async ({ page, session, state, perform }) => {
		await openSheet(session);
		// A sheet that closes and reopens is a new element without the mark.
		await displaySheet(page).evaluate(
			(sheet, mark) => sheet.setAttribute(mark, 'opened'),
			SHEET_MARK,
		);
		await perform();
		await expectActiveSection(page, state.section);
		await expect(displaySheet(page), 'the same sheet stays open').toHaveAttribute(
			SHEET_MARK,
			'opened',
		);
		await expect(displaySheet(page)).toHaveAttribute('data-state', 'open');
	},
	'cascades-and-closes-one-layer': async ({ page, state, perform }) => {
		await perform();
		const submenu = sectionMenu(page);
		await expect(submenu, 'the section opens as its own menu').toHaveCount(1);
		await expect(displayMenu(page), 'its parent stays visible').toBeVisible();
		await expect(submenu.locator(':focus'), 'focus moves into the section').toHaveCount(1);
		const [parentBox, submenuBox] = await Promise.all([
			displayMenu(page).boundingBox(),
			submenu.boundingBox(),
		]);
		const besideRight = submenuBox!.x >= parentBox!.x + parentBox!.width - CASCADE_OVERLAP_PX;
		const besideLeft = submenuBox!.x + submenuBox!.width <= parentBox!.x + CASCADE_OVERLAP_PX;
		expect(besideRight || besideLeft, 'the section opens beside its parent').toBe(true);

		await page.keyboard.press('Escape');
		await expect(sectionMenu(page), 'Escape closes the section').toHaveCount(0);
		await expect(displayMenu(page), 'the parent stays open').toBeVisible();
		await expect(
			sectionTrigger(page, state.section),
			'focus returns to the section',
		).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(displayMenu(page), 'a second Escape closes Display').toBeHidden();
		await expect(page.getByTestId('desktop-display-trigger')).toBeFocused();
	},
	'swaps-menus-in-one-press': async ({ page, perform }) => {
		await perform();
		await expect(moreMenu(page), 'More opens').toBeVisible();
		await expect(displayMenu(page), 'Display closes').toBeHidden();
		await page.keyboard.press('Escape');
		await expect(moreMenu(page)).toBeHidden();
	},
	'resets-filters': async ({ page, session, perform }) => {
		await openSheet(session);
		await requireTouch(session).tap(sectionSwitch(page, 'filter'));
		await expectActiveSection(page, 'filter');
		const filter = sectionContent(displaySheet(page), 'filter');
		await requireTouch(session).tap(filter);
		await expect(filter, 'the filter is active').toBeChecked();
		await expect(resetButton(page), 'the Filter section offers Reset').toBeVisible();
		await expect(
			displaySheet(page).getByRole('button', {
				name: new RegExp(`^${m.filter_remove({ label: '' }).trim()}`),
			}),
			'the sheet shows no active-filter pills',
		).toHaveCount(0);
		await perform();
		await expect(filter, 'Reset clears the filter').not.toBeChecked();
		await expectActiveSection(page, 'filter');
	},
};

describeSurfaceCases(
	test,
	{
		surface: DISPLAY_SHEET_SURFACE,
		interactions: Object.keys(INTERACTIONS),
		knownBugs: [],
		groupKey: ({ state }) => state.viewport,
	},
	async (world, { capability, state, outcome }) => {
		const session = await world.session(state.viewport);
		const { page } = session;
		await arrange(session, world.wishlistPath);
		const context: CaseContext = { page, session, state };

		await OUTCOME_CHECKS[outcome]({
			...context,
			perform: () => INTERACTIONS[capability.interaction]!(context),
		});

		const sheetOpen = await displaySheet(page).isVisible();
		await expectPageSettled(page, {
			errors: session.errors,
			expectedUrl: `${new URL(page.url()).origin}${world.wishlistPath}`,
			neutralTarget: sheetOpen
				? displaySheet(page).getByRole('heading', { name: m.gift_display_options() })
				: page.getByRole('heading', { level: 1 }),
			touch: session.touch,
			allowedOpenLayers: sheetOpen ? ['dialog'] : [],
		});
	},
	(title, details, body) => test(title, details, body),
);
