import { expect, type Locator, type Page } from '@playwright/test';
import * as m from '../../../src/lib/paraglide/messages.js';
import { addGift, createWishlistAndNavigate } from '../../e2e/fixtures/wishlist-helpers.js';
import {
	CATEGORY_SETTINGS_SURFACE,
	VIEWPORTS,
	type CategorySettingsOutcome,
	type CategorySettingsState,
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
import {
	expectAnimationsFinished,
	expectPageSettled,
	glideFrames,
	nextFrames,
	recordEveryFrame,
} from './support/settled.js';
import { pointOf, type ScreenPoint } from './support/touch.js';
import {
	openSettingsTab,
	saveButton,
	settingsDialog,
	showSavedSettings,
} from './support/wishlist.js';

/*
 * Generated from `CATEGORY_SETTINGS_SURFACE` in ./inventory.ts. One account per run owns a wishlist
 * whose first, middle and last default categories each hold a gift and the rest hold none. Cases
 * edit the settings draft and never save; a dirty draft is discarded before the next case.
 */

type Viewport = CategorySettingsState['viewport'];
type Motion = CategorySettingsState['motion'];

const DRAG_DISTANCE_ROWS = 2;
const RENAMED_LABEL = 'Technika';
const DRAG_STATE_SELECTORS = ['[data-gift-reorder-overlay]', '[data-gift-motion-dragging]'];

const test = testWithWorld(async ({ browser, playwright, workerInfo, baseURL, sessions }) => {
	const account = await oncePerRun(workerInfo, 'category-settings-account', async () => {
		const cookies = await registerUser(playwright, baseURL, 'interaction-categories');
		const wishlistPath = await withSignedInPage(browser, baseURL, cookies, async (page) => {
			const path = await createWishlistAndNavigate(page, 'Kategorie v pořadí');
			await openCategorySettings(page, path);
			const labels = await rowLabels(page);
			await settingsDialog(page).getByRole('button', { name: m.close() }).click();
			await expect(settingsDialog(page)).toBeHidden();
			for (const row of ['first', 'middle', 'last'] as const) {
				const category = labels[rowIndex(labels, row)]!;
				await addGift(page, `Dárek: ${category}`, { category });
			}
			return path;
		});
		return { cookies, wishlistPath };
	});
	return {
		wishlistPath: account.wishlistPath,
		session: (viewport: Viewport, motion: Motion) =>
			sessions.get(`${viewport} ${motion} motion`, () =>
				openSession(browser, baseURL, account.cookies, viewport, {
					reducedMotion: motion === 'reduced',
				}),
			),
	};
});

/** Rows of the list itself; a drag overlay or exit visual outside the form never counts. */
function rows(page: Page): Locator {
	return page.locator('#wishlist-categories-form [data-category-row]');
}

function rowNamed(page: Page, label: string): Locator {
	return rows(page).and(page.locator(`[data-category-label="${label}"]`));
}

function grip(page: Page, label: string): Locator {
	return page.getByRole('button', { name: m.gift_category_move_label({ category: label }) });
}

function renameTrigger(page: Page, label: string): Locator {
	return page.getByRole('button', { name: m.gift_category_rename_label({ category: label }) });
}

function removeButton(page: Page, label: string): Locator {
	return page.getByRole('button', { name: m.gift_category_remove_label({ category: label }) });
}

function rowLabels(page: Page): Promise<string[]> {
	return rows(page).evaluateAll((elements) =>
		elements.map((element) => (element as HTMLElement).dataset.categoryLabel ?? ''),
	);
}

function rowIndex(labels: readonly string[], row: CategorySettingsState['row']): number {
	return { first: 0, middle: Math.floor(labels.length / 2), last: labels.length - 1 }[row];
}

function countLabel(count: number): string {
	if (count === 1) {
		return m.gift_categories_count_one();
	}
	return count >= 2 && count <= 4
		? m.gift_categories_count_few({ count })
		: m.gift_categories_count_other({ count });
}

function moved(labels: readonly string[], from: number, to: number): string[] {
	const order = [...labels];
	const [label] = order.splice(from, 1);
	order.splice(to, 0, label!);
	return order;
}

async function expectOrder(page: Page, expected: readonly string[], message: string) {
	await expect.poll(() => rowLabels(page), { message }).toEqual(expected);
}

async function expectUsageLoaded(page: Page) {
	await expect(rows(page).first()).toBeVisible();
	await expect(
		rows(page).locator('[data-category-grip]').first(),
		'category usage has loaded',
	).toBeEnabled();
}

async function openCategorySettings(page: Page, wishlistPath: string) {
	await openSettingsTab(page, wishlistPath, 'categories');
	await expectUsageLoaded(page);
}

interface Arranged {
	labels: string[];
	index: number;
	label: string;
}

async function arrange(
	session: InteractionSession,
	wishlistPath: string,
	state: CategorySettingsState,
): Promise<Arranged> {
	const { page } = session;
	await showSavedSettings(page, wishlistPath, 'categories');
	await expectUsageLoaded(page);
	await releaseFocusAndPointer(session);
	// Controls fade in once usage loads; a fade still running would read as the case's motion.
	await expectAnimationsFinished(page, '#wishlist-categories-form');
	const labels = await rowLabels(page);
	const index = rowIndex(labels, state.row);
	const label = labels[index]!;
	await rowNamed(page, label).evaluate((element) => element.scrollIntoView({ block: 'center' }));
	return { labels, index, label };
}

interface CaseContext extends Arranged {
	page: Page;
	session: InteractionSession;
	state: CategorySettingsState;
}

type Interaction = (context: CaseContext) => Promise<void>;

/** The row the drag aims for: two rows down, or two rows up from the last row. */
function dragTargetIndex({ labels, index }: CaseContext): number {
	return index + DRAG_DISTANCE_ROWS < labels.length
		? index + DRAG_DISTANCE_ROWS
		: index - DRAG_DISTANCE_ROWS;
}

/** The grip's centre and the same point moved onto the target row. */
async function dragPath(context: CaseContext): Promise<[ScreenPoint, ScreenPoint]> {
	const { page, labels, label, index } = context;
	// Centring the row between both ends keeps the drag clear of the auto-scroll edge zones.
	const between = labels[(index + dragTargetIndex(context)) / 2]!;
	await rowNamed(page, between).evaluate((element) =>
		element.scrollIntoView({ block: 'center' }),
	);
	const from = await pointOf(grip(page, label));
	const [source, target] = await Promise.all([
		pointOf(rowNamed(page, label)),
		pointOf(rowNamed(page, labels[dragTargetIndex(context)]!)),
	]);
	return [from, { x: from.x, y: from.y + target.y - source.y }];
}

async function press(session: InteractionSession, target: Locator) {
	if (session.touch === undefined) {
		await target.click();
	} else {
		await session.touch.tap(target);
	}
}

async function pressKeyOnGrip(page: Page, label: string, key: string) {
	await grip(page, label).focus();
	await expect(grip(page, label)).toBeFocused();
	await page.keyboard.press(key);
}

async function startRename(session: InteractionSession, label: string) {
	await press(session, renameTrigger(session.page, label));
	const input = rowNamed(session.page, label).getByRole('textbox');
	await expect(input, 'the name turns into a focused input').toBeFocused();
}

const INTERACTIONS: Record<string, Interaction> = {
	'rows at rest': async () => {},
	'touch drag the grip two rows along': async (context) =>
		requireTouch(context.session).drag(await dragPath(context), { endAtRest: true }),
	'mouse drag the grip two rows along': async (context) => {
		const [from, to] = await dragPath(context);
		await context.page.mouse.move(from.x, from.y);
		await context.page.mouse.down();
		await context.page.mouse.move(to.x, to.y, { steps: 12 });
		await context.page.mouse.up();
	},
	'Escape during a mouse drag': async (context) => {
		const { page, labels } = context;
		const [from, to] = await dragPath(context);
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move(to.x, to.y, { steps: 12 });
		await expectOrder(
			page,
			moved(labels, context.index, dragTargetIndex(context)),
			'the drag previews the new order',
		);
		await page.keyboard.press('Escape');
		await page.mouse.up();
	},
	'ArrowUp on the grip': ({ page, label }) => pressKeyOnGrip(page, label, 'ArrowUp'),
	'ArrowDown on the grip': ({ page, label }) => pressKeyOnGrip(page, label, 'ArrowDown'),
	'rename and press Enter': async ({ page, session, label }) => {
		await startRename(session, label);
		await page.keyboard.type(RENAMED_LABEL);
		await page.keyboard.press('Enter');
	},
	'Escape while renaming': async ({ page, session, label }) => {
		await startRename(session, label);
		await page.keyboard.type(RENAMED_LABEL);
		await page.keyboard.press('Escape');
	},
	'remove a used category': ({ page, session, label }) =>
		press(session, removeButton(page, label)),
	'remove, then Vrátit': async ({ page, session, label }) => {
		await press(session, removeButton(page, label));
		await press(
			session,
			rowNamed(page, label).getByRole('button', { name: m.gift_category_removal_undo() }),
		);
	},
	'remove the unused row below': ({ page, session, labels, index }) =>
		press(session, removeButton(page, labels[index + 1]!)),
};

interface OutcomeContext extends CaseContext {
	interaction: string;
	perform: () => Promise<void>;
}

interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
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

async function expectDraftAwaitsSave(page: Page) {
	await expect(settingsDialog(page)).toBeVisible();
	await expect(saveButton(page), 'the change waits for Save').toBeEnabled();
}

async function expectSavedStateInOpenDialog(page: Page, labels: readonly string[]) {
	await expect(settingsDialog(page), 'the settings dialog stays open').toBeVisible();
	await expectOrder(page, labels, 'the saved order is back');
	await expect(saveButton(page), 'nothing is left to save').toBeDisabled();
}

const OUTCOME_CHECKS: Record<CategorySettingsOutcome, (context: OutcomeContext) => Promise<void>> =
	{
		'controls-fit-the-row': async ({ page, session, perform }) => {
			await perform();
			const viewport = page.viewportSize()!;
			const rowBoxes: Box[] = [];
			for (const row of await rows(page).all()) {
				await row.evaluate((element) => element.scrollIntoView({ block: 'nearest' }));
				const rowBox = (await row.boundingBox())!;
				const label = (await row.getAttribute('data-category-label'))!;
				expect(rowBox.x, `${label} starts inside the viewport`).toBeGreaterThanOrEqual(0);
				expect(
					rowBox.x + rowBox.width,
					`${label} ends inside the viewport`,
				).toBeLessThanOrEqual(viewport.width);
				for (const control of await row.getByRole('button').all()) {
					const name = await control.getAttribute('aria-label');
					expect(
						contains(rowBox, (await control.boundingBox())!),
						`${name} sits in its row`,
					).toBe(true);
				}
				// Offsets inside the list, so scrolling between rows does not move them.
				rowBoxes.push(
					await row.evaluate((element: HTMLElement) => ({
						x: element.offsetLeft,
						y: element.offsetTop,
						width: element.offsetWidth,
						height: element.offsetHeight,
					})),
				);
			}
			const [firstRow] = rowBoxes;
			for (const [index, rowBox] of rowBoxes.entries()) {
				expect(rowBox.x, 'rows share one column').toBeCloseTo(firstRow!.x, 0);
				if (index > 0) {
					const previous = rowBoxes[index - 1]!;
					expect(
						rowBox.y,
						'each row starts below the previous one',
					).toBeGreaterThanOrEqual(previous.y + previous.height - 0.5);
				}
			}
			if (VIEWPORTS[session.viewport].touch) {
				const form = page.locator('#wishlist-categories-form');
				expect(
					await form.evaluate((element) => element.scrollWidth <= element.clientWidth),
					'the list does not scroll sideways',
				).toBe(true);
			}
		},
		'moves-to-drop-position': async (context) => {
			const { page, labels, index } = context;
			await context.perform();
			await expectOrder(
				page,
				moved(labels, index, dragTargetIndex(context)),
				'the row lands where it was dropped',
			);
			await expectAnimationsFinished(page, '#wishlist-categories-form');
			await expectDraftAwaitsSave(page);
		},
		'restores-order-in-open-dialog': async ({ page, labels, perform }) => {
			await perform();
			await expectSavedStateInOpenDialog(page, labels);
		},
		'moves-one-place': async ({ page, labels, index, label, interaction, state, perform }) => {
			const target = interaction.startsWith('ArrowUp') ? index - 1 : index + 1;
			const movedRow = rowNamed(page, label);
			const stopRecording = await recordEveryFrame(movedRow, 'topInParent');
			await perform();
			await expectOrder(
				page,
				moved(labels, index, target),
				'the row swaps with its neighbour',
			);
			await expectAnimationsFinished(page, '#wishlist-categories-form');
			const samples = await stopRecording();
			const glide = glideFrames(samples, samples[0]!, samples.at(-1)!);
			if (state.motion === 'full') {
				expect(glide, 'the moved row glides to its place').toBeGreaterThan(1);
			} else {
				expect(glide, 'reduced motion moves the row without gliding').toBe(0);
			}
			await expect(grip(page, label), 'focus stays on the moved grip').toBeFocused();
			await expectDraftAwaitsSave(page);
		},
		'stays-in-place': async ({ page, labels, label, perform }) => {
			await perform();
			await nextFrames(page, 3);
			await expectSavedStateInOpenDialog(page, labels);
			await expect(grip(page, label), 'focus stays on the grip').toBeFocused();
		},
		'renames-and-returns-focus': async ({ page, labels, index, perform }) => {
			await perform();
			const renamed = labels.map((candidate, position) =>
				position === index ? RENAMED_LABEL : candidate,
			);
			await expectOrder(page, renamed, 'the row shows the new name in its place');
			await expect(
				renameTrigger(page, RENAMED_LABEL),
				'focus returns to the name',
			).toBeFocused();
			await expectDraftAwaitsSave(page);
		},
		'keeps-label-in-open-dialog': async ({ page, labels, label, perform }) => {
			await perform();
			await expectSavedStateInOpenDialog(page, labels);
			await expect(renameTrigger(page, label), 'focus returns to the name').toBeFocused();
		},
		'stages-removal-with-undo': async ({ page, labels, label, perform }) => {
			await perform();
			const row = rowNamed(page, label);
			await expect(row, 'the row is staged for removal').toHaveAttribute(
				'data-staged-for-removal',
			);
			await expectOrder(page, labels, 'the staged row keeps its place');
			await expect(row.getByTestId('gift-category-removal-note')).toHaveText(
				m.gift_category_removal_staged_one(),
			);
			await expect(
				row.getByRole('button', { name: m.gift_category_removal_undo() }),
				'focus moves to Vrátit',
			).toBeFocused();
			await expect(page.getByTestId('gift-category-count')).toHaveText(
				countLabel(labels.length - 1),
			);
			await expectDraftAwaitsSave(page);
		},
		'restores-row': async ({ page, labels, label, perform }) => {
			await perform();
			const row = rowNamed(page, label);
			await expect(row).not.toHaveAttribute('data-staged-for-removal');
			await expect(
				removeButton(page, label),
				'focus returns to the remove button',
			).toBeFocused();
			await expect(page.getByTestId('gift-category-count')).toHaveText(
				countLabel(labels.length),
			);
			await expectSavedStateInOpenDialog(page, labels);
		},
		'removes-unused-at-once': async ({ page, labels, index, perform }) => {
			await perform();
			await expectOrder(
				page,
				labels.filter((_, position) => position !== index + 1),
				'the unused category leaves the list at once',
			);
			await expect(page.getByTestId('gift-category-count')).toHaveText(
				countLabel(labels.length - 1),
			);
			await expectAnimationsFinished(page, '#wishlist-categories-form');
			await expectDraftAwaitsSave(page);
		},
	};

describeSurfaceCases(
	test,
	{
		surface: CATEGORY_SETTINGS_SURFACE,
		interactions: Object.keys(INTERACTIONS),
		knownBugs: [],
		groupKey: ({ state }) => `${state.viewport} ${state.motion} motion`,
	},
	async (world, { capability, state, outcome }) => {
		const session = await world.session(state.viewport, state.motion);
		const { page } = session;
		const arranged = await arrange(session, world.wishlistPath, state);
		const context: CaseContext = { ...arranged, page, session, state };

		await OUTCOME_CHECKS[outcome]({
			...context,
			interaction: capability.interaction,
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
			transientStateSelectors: DRAG_STATE_SELECTORS,
		});
	},
	(title, details, body) => test(title, details, body),
);
