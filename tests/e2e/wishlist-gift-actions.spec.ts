import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	gift,
	createActionFixture,
	expectBodyPointerEventsRestored,
	selectionCount,
	openMobileGiftActions,
} from './wishlist-gift-actions.helpers.js';

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
	await gift(page, 'Stan pro dva').click();
	await selectionCount(toolbar, 2);
	await page.getByRole('button', { name: 'Hotovo' }).click();
	await expect(toolbar).toBeHidden();

	await page.getByRole('radio', { name: /Seznam/ }).click();
	await gift(page, 'Stan pro dva').click({ button: 'right', position: { x: 30, y: 20 } });
	await page.getByRole('menuitem', { name: /Vybrat více dárků/ }).click();
	await selectionCount(toolbar, 1);
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'true');
	await page.getByRole('button', { name: 'Hotovo' }).click();
	await expect(toolbar).toBeHidden();
	await page.context().close();
});

test('desktop More uses a semantic menu with truthful state and focus lifecycle', async ({
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
		const viewControl = page.getByRole('radio', {
			name: view === 'card' ? m.gift_view_card() : m.gift_view_list(),
		});
		await viewControl.evaluate((element) => element.scrollIntoView({ block: 'center' }));
		await viewControl.click();
		const activeCollection = page.locator(
			`[data-wishlist-gift-collection][data-view-mode="${view}"]:not([inert])`,
		);
		await expect(activeCollection).toBeVisible();
		const more = activeCollection
			.locator('[data-gift-item]')
			.filter({ has: page.getByRole('heading', { name: 'Kolo pro výlety', exact: true }) })
			.getByTestId('gift-more-actions');
		await expect(more).toHaveAttribute('aria-haspopup', 'menu');
		await expect(more).toHaveAttribute('aria-expanded', 'false');
		await more.press('ArrowDown');
		await expect(more).toHaveAttribute('aria-expanded', 'true');
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
	await page.keyboard.press('Escape');
	await expect(editDialog).toBeHidden();
	await expectBodyPointerEventsRestored(page);
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

test('wide touch long press uses the Sheet while desktop More remains a menu', async ({
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
