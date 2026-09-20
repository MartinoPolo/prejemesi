import { test, expect, type Locator, type Page } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	gift,
	createActionFixture,
	expectBodyPointerEventsRestored,
	selectionCount,
	openMobileGiftActions,
	openSelectionFromContext,
} from './wishlist-gift-actions.helpers.js';
import { startGiftReorder } from './fixtures/wishlist-helpers.js';

const DEPTH_MODES = ['soft', 'ink', 'black'] as const;
type DepthMode = (typeof DEPTH_MODES)[number];

test('desktop contextual selection works in both supported card and list views', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-desktop'),
	);
	await createActionFixture(page);

	await gift(page, 'Kolo pro výlety').click({ button: 'right', position: { x: 30, y: 30 } });
	await expect(page.getByRole('menu')).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /Upravit dárek/ })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /Priorita/ })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /Kategorie/ })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /Vybrat více dárků/ })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /rezerv|líbí/i })).toHaveCount(0);
	await page.getByRole('menuitem', { name: /Vybrat více dárků/ }).click();

	const toolbar = page.getByRole('region', { name: 'Nástroje výběru' });
	await expect(toolbar).toBeVisible();
	await selectionCount(toolbar, 1);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('button', { name: 'Hotovo' })).toBeVisible();
	await gift(page, 'Stan pro dva').click();
	await selectionCount(toolbar, 2);
	await page.getByRole('button', { name: 'Hotovo' }).click();
	await expect(toolbar).toBeHidden();

	await page.getByRole('radio', { name: /Seznam/ }).click();
	await gift(page, 'Stan pro dva').click({ button: 'right', position: { x: 30, y: 20 } });
	await expect(page.getByRole('menuitem', { name: /Vybrat více dárků/ })).toBeVisible();
	await page.getByRole('menuitem', { name: /Vybrat více dárků/ }).click();
	await expect(toolbar).toBeVisible();
	await selectionCount(toolbar, 1);
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'true');
	await page.getByRole('button', { name: 'Hotovo' }).click();
	await expect(toolbar).toBeHidden();
	await page.context().close();
});

test('desktop More uses a menu in card and list views with truthful state and focus lifecycle', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-desktop-more'),
	);
	await createActionFixture(page);

	for (const view of ['card', 'list'] as const) {
		if (view === 'list') {
			const listView = page.getByRole('radio', { name: m.gift_view_list() });
			// The sticky toolbar's top fade intentionally masks controls while the toolbar is
			// tucked under the header. Center it before exercising the normally clickable control.
			await listView.evaluate((element) => element.scrollIntoView({ block: 'center' }));
			await expect(listView).toBeVisible();
			const hitTest = await listView.evaluate((element) => {
				const box = element.getBoundingClientRect();
				const hit = document.elementFromPoint(
					box.left + box.width / 2,
					box.top + box.height / 2,
				);
				return {
					unobscured: hit !== null && (element === hit || element.contains(hit)),
					box: { top: box.top, left: box.left, width: box.width, height: box.height },
					hit: hit instanceof HTMLElement ? hit.outerHTML.slice(0, 300) : null,
				};
			});
			expect(hitTest.unobscured, JSON.stringify(hitTest)).toBe(true);
			await listView.click();
		}
		const activeCollection = page.locator(
			`[data-wishlist-gift-collection][data-view-mode="${view}"]:not([inert])`,
		);
		await expect(activeCollection).toBeVisible();
		await expect(activeCollection).not.toHaveAttribute('aria-hidden', 'true');
		const more = activeCollection
			.locator('[data-gift-item]')
			.filter({ has: page.getByRole('heading', { name: 'Kolo pro výlety', exact: true }) })
			.getByTestId('gift-more-actions');
		await expect(more).toHaveAttribute('aria-haspopup', 'menu');
		await expect(more).toHaveAttribute('aria-expanded', 'false');
		await more.press('ArrowDown');
		await expect(more).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('menu')).toBeVisible();
		await expect(page.getByRole('menu').getByRole('menuitem').first()).toBeFocused();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(more).toHaveAttribute('aria-expanded', 'false');
		await expect(more).toBeFocused();
		await expectBodyPointerEventsRestored(page);
	}

	const secondMore = gift(page, 'Stan pro dva').getByTestId('gift-more-actions');
	await secondMore.click();
	await page.getByRole('menuitem', { name: m.gift_context_edit() }).click();
	const editDialog = page.getByRole('dialog');
	await expect(editDialog).toBeVisible();
	await expect(editDialog.getByRole('textbox', { name: m.gift_name_label() })).toHaveValue(
		'Stan pro dva',
	);
	await expect
		.poll(() => editDialog.evaluate((dialog) => dialog.contains(document.activeElement)))
		.toBe(true);
	await expect(secondMore).not.toBeFocused();
	await page.keyboard.press('Escape');
	await expect(editDialog).toBeHidden();
	await expectBodyPointerEventsRestored(page);

	const cardView = page.getByRole('radio', { name: m.gift_view_card() });
	await cardView.click();
	await expect(cardView).toBeChecked();
	await gift(page, 'Stan pro dva').getByRole('heading', { name: 'Stan pro dva' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.context().close();
});

test('language and palette popovers close when their selected choice is reselected', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('choice-row-reselect'),
	);
	await createActionFixture(page);

	const languageTrigger = page.getByRole('button', { name: /Jazyk:/ });
	await languageTrigger.click();
	const languagePopover = page.locator(
		`[data-slot="popover-content"][aria-label="${m.settings_language_label()}"]`,
	);
	await languagePopover.getByRole('button', { pressed: true }).click();
	await expect(languagePopover).toBeHidden();
	await expect(languageTrigger).toBeFocused();

	const paletteTrigger = page.getByRole('button', {
		name: m.palette_switcher_label(),
		exact: true,
	});
	await paletteTrigger.click();
	const palettePopover = page.locator(
		`[data-slot="popover-content"][aria-label="${m.palette_switcher_label()}"]`,
	);
	await palettePopover.getByRole('button', { pressed: true }).click();
	await expect(palettePopover).toBeHidden();
	await expect(paletteTrigger).toBeFocused();
	await page.context().close();
});

test('wide touch long press uses the shared Sheet while desktop More remains a menu', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-wide-touch'),
	);
	await page.setViewportSize({ width: 1280, height: 800 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	await openMobileGiftActions(page, target, 'Kolo pro výlety');
	await expect(page.getByRole('menu')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expectBodyPointerEventsRestored(page);

	const more = target.getByTestId('gift-more-actions');
	await more.click();
	await expect(page.getByRole('menu')).toBeVisible();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.context().close();
});

test('gift action and contextual-control shadows stay nested across viewports and depth modes', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-footer-geometry'),
	);
	await createActionFixture(page);

	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 1024, height: 768 },
	]) {
		await page.setViewportSize(viewport);
		await expectActionGeometryStableAcrossDepthModes(page);
	}

	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('radio', { name: m.gift_view_card() }).click();
	await expect(
		page.locator('[data-wishlist-gift-collection][data-view-mode="card"]:not([inert])'),
	).toBeVisible();
	await openSelectionFromContext(page, 'Kolo pro výlety');
	const selectedGift = gift(page, 'Kolo pro výlety');
	let stableSelectionGeometry: Omit<
		Awaited<ReturnType<typeof measureSelectionControl>>,
		'shadow'
	> | null = null;
	for (const depth of DEPTH_MODES) {
		await setDepthMode(page, depth);
		const geometry = await measureSelectionControl(selectedGift);
		expect(geometry.leftInset).toBeCloseTo(geometry.topInset, 0);
		expect(geometry.markerRadius).toBeCloseTo(geometry.parentRadius - geometry.leftInset, 0);
		expect(geometry.shadow).not.toBe('none');
		const geometryWithoutShadow = {
			leftInset: geometry.leftInset,
			topInset: geometry.topInset,
			parentRadius: geometry.parentRadius,
			markerRadius: geometry.markerRadius,
		};
		if (stableSelectionGeometry === null) {
			stableSelectionGeometry = geometryWithoutShadow;
		} else {
			expect(geometryWithoutShadow).toEqual(stableSelectionGeometry);
		}
	}
	await page
		.getByRole('region', { name: m.gift_selection_toolbar() })
		.getByRole('button', { name: /^(Zrušit|Cancel)$/ })
		.click();

	await page.setViewportSize({ width: 320, height: 844 });
	await startGiftReorder(page);
	const reorderedGift = page
		.locator('[data-wishlist-gift-collection]:not([inert]) [data-gift-item]')
		.first();
	const lane = reorderedGift.getByTestId('gift-reorder-directional-actions');
	await expect(lane).toBeVisible();
	const reachableDirection = lane.locator('button:not(:disabled)').first();
	await expect(reachableDirection).toBeVisible();
	await expect(reachableDirection).toBeEnabled();
	let stableLaneGeometry: Record<string, number> | null = null;
	for (const depth of DEPTH_MODES) {
		await setDepthMode(page, depth);
		const geometry = await reorderedGift.evaluate((wrapper) => {
			const laneElement = wrapper.querySelector<HTMLElement>(
				'[data-testid="gift-reorder-directional-actions"]',
			)!;
			const buttons = [...laneElement.querySelectorAll<HTMLButtonElement>('button')];
			const first = buttons[0]!;
			const last = buttons.at(-1)!;
			const wrapperBox = wrapper.getBoundingClientRect();
			const laneBox = laneElement.getBoundingClientRect();
			const firstBox = first.getBoundingClientRect();
			const lastBox = last.getBoundingClientRect();
			const styles = getComputedStyle(wrapper);
			const shadowOffset = Number.parseFloat(
				styles.getPropertyValue('--elevation-ordinary-offset'),
			);
			return {
				rightInset: wrapperBox.right - laneBox.right,
				bottomInset: wrapperBox.bottom - laneBox.bottom,
				faceInset:
					Number.parseFloat(styles.borderTopRightRadius) -
					Number.parseFloat(getComputedStyle(last).borderTopRightRadius),
				gap: lastBox.left - firstBox.right,
				shadowOffset,
				shadow: getComputedStyle(last.querySelector<HTMLElement>('.elevation-surface')!)
					.boxShadow,
			};
		});
		expect(geometry.shadow).not.toBe('none');
		expect(geometry.rightInset).toBeCloseTo(geometry.faceInset + geometry.shadowOffset, 0);
		expect(geometry.bottomInset).toBeCloseTo(geometry.rightInset, 0);
		expect(geometry.gap).toBeCloseTo(8 + geometry.shadowOffset, 0);
		const geometryWithoutShadow = {
			rightInset: geometry.rightInset,
			bottomInset: geometry.bottomInset,
			faceInset: geometry.faceInset,
			gap: geometry.gap,
			shadowOffset: geometry.shadowOffset,
		};
		if (stableLaneGeometry === null) {
			stableLaneGeometry = geometryWithoutShadow;
		} else {
			expect(geometryWithoutShadow).toEqual(stableLaneGeometry);
		}
	}
	await page.context().close();
});

async function expectActionGeometryStableAcrossDepthModes(page: Page) {
	for (const view of ['card', 'list'] as const) {
		await page
			.getByRole('radio', { name: view === 'card' ? m.gift_view_card() : m.gift_view_list() })
			.click();
		const collection = page.locator(
			`[data-wishlist-gift-collection][data-view-mode="${view}"]:not([inert])`,
		);
		await expect(collection).toBeVisible();
		const target = collection
			.locator('[data-gift-item]')
			.filter({ has: page.getByRole('heading', { name: 'Kolo pro výlety', exact: true }) });
		const container = target.getByTestId(
			view === 'card' ? 'gift-card-surface' : 'gift-list-item',
		);
		const action = target.getByTestId('gift-more-actions');
		await expect(action.locator(':scope > .elevation-surface')).toBeVisible();

		let stableGeometry: Omit<Awaited<ReturnType<typeof measureNestedAction>>, 'shadow'> | null =
			null;
		for (const depth of DEPTH_MODES) {
			await setDepthMode(page, depth);
			const geometry = await measureNestedAction(container, action);
			expect(geometry.shadow).not.toBe('none');
			expect(geometry.buttonRadius).toBeCloseTo(
				Math.max(0, geometry.outerRadius - (geometry.rightGap - geometry.shadowOffset)),
				0,
			);
			expect(geometry.bottomGap).toBeCloseTo(geometry.rightGap, 0);
			expect(geometry.rightGap).toBeGreaterThanOrEqual(geometry.shadowOffset);
			expect(geometry.bottomGap).toBeGreaterThanOrEqual(geometry.shadowOffset);
			const geometryWithoutShadow = {
				outerRadius: geometry.outerRadius,
				buttonRadius: geometry.buttonRadius,
				shadowOffset: geometry.shadowOffset,
				rightGap: geometry.rightGap,
				bottomGap: geometry.bottomGap,
			};
			if (stableGeometry === null) {
				stableGeometry = geometryWithoutShadow;
			} else {
				expect(geometryWithoutShadow).toEqual(stableGeometry);
			}
		}
	}
}

async function setDepthMode(page: Page, depth: DepthMode) {
	await page.locator('html').evaluate((element, value) => {
		element.dataset.depth = value;
	}, depth);
	await page.mouse.move(0, 0);
}

async function measureSelectionControl(selectedGift: Locator) {
	return selectedGift.evaluate((wrapper) => {
		const marker = wrapper.querySelector<HTMLElement>(
			'[data-testid="gift-selection-control"]',
		)!;
		const markerSurface = marker.querySelector<HTMLElement>('.elevation-surface')!;
		const wrapperBox = wrapper.getBoundingClientRect();
		const markerBox = marker.getBoundingClientRect();
		const wrapperStyle = getComputedStyle(wrapper);
		const markerStyle = getComputedStyle(marker);
		return {
			leftInset: markerBox.left - wrapperBox.left,
			topInset: markerBox.top - wrapperBox.top,
			parentRadius: Number.parseFloat(wrapperStyle.borderTopLeftRadius),
			markerRadius: Number.parseFloat(markerStyle.borderTopLeftRadius),
			shadow: getComputedStyle(markerSurface).boxShadow,
		};
	});
}

async function measureNestedAction(container: Locator, action: Locator) {
	return container.evaluate(
		(containerElement, buttonElement) => {
			const containerBox = containerElement.getBoundingClientRect();
			const actionSurface = (buttonElement as HTMLElement).querySelector<HTMLElement>(
				'.elevation-surface',
			)!;
			const surfaceBox = actionSurface.getBoundingClientRect();
			const containerStyles = getComputedStyle(containerElement);
			const actionStyles = getComputedStyle(actionSurface);
			return {
				outerRadius: Number.parseFloat(containerStyles.borderTopRightRadius),
				buttonRadius: Number.parseFloat(actionStyles.borderTopRightRadius),
				shadowOffset: Number.parseFloat(
					actionStyles.getPropertyValue('--elevation-ordinary-offset'),
				),
				rightGap: containerBox.right - surfaceBox.right,
				bottomGap: containerBox.bottom - surfaceBox.bottom,
				shadow: actionStyles.boxShadow,
			};
		},
		await action.elementHandle(),
	);
}

test('list view persists on the local device after reload', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-view-mode-persistence'),
	);
	await createActionFixture(page);

	const listRadio = page.getByRole('radio', { name: m.gift_view_list(), exact: true });
	await listRadio.click();
	await expect(page.locator('[data-view-mode="list"]')).toBeVisible();
	await expect(listRadio).toBeChecked();

	await page.reload();
	await expect(page.locator('[data-view-mode="list"]')).toBeVisible();
	await expect(page.getByRole('radio', { name: m.gift_view_list(), exact: true })).toBeChecked();
	await page.context().close();
});
