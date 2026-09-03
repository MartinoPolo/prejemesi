import { test, expect, type Locator, type Page } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	createWishlistForSomeoneAndNavigate,
	addGift,
} from './fixtures/wishlist-helpers.js';

function gift(page: Page, name: string) {
	return page
		.locator('[data-gift-item]')
		.filter({ has: page.getByRole('heading', { name, exact: true }) });
}

async function openSelectionFromContext(page: Page, giftName: string) {
	await gift(page, giftName).getByRole('heading', { name: giftName, exact: true }).click({
		button: 'right',
	});
	await expect(page.getByRole('menuitem', { name: /Vybrat více dárků/ })).toBeVisible();
	await page.getByRole('menuitem', { name: /Vybrat více dárků/ }).click();
	return page.getByRole('region', { name: 'Nástroje výběru' });
}

async function openFilterMenu(page: Page) {
	await page.getByRole('button', { name: /Filtrovat/ }).click();
	await expect(page.getByRole('menu')).toBeVisible();
}

async function toggleFilterCheckbox(page: Page, name: string) {
	await openFilterMenu(page);
	await page.getByRole('menuitemcheckbox', { name }).click();
	await expect(page.getByRole('menu')).toBeVisible();
}

async function selectPriorityFilter(page: Page, name: string) {
	if (!(await page.getByRole('menu').isVisible())) {
		await openFilterMenu(page);
	}
	await expect(async () => {
		const option = page.getByRole('menuitemcheckbox', { name });
		await option.click();
		await expect(option).toHaveAttribute('aria-checked', 'true');
	}).toPass();
	await expect(page.getByRole('menu')).toBeVisible();
}

async function waitForReceivedState(giftRow: Locator, received: boolean) {
	await expect(giftRow.getByTestId('gift-received-toggle')).toHaveText(
		received ? /Označit jako nepřijatý/ : /Označit jako přijatý/,
	);
}

async function waitForToast(page: Page, text: string | RegExp) {
	await expect(page.locator('[data-sonner-toast]').filter({ hasText: text })).toBeVisible();
}

async function createActionFixture(page: Page) {
	await createWishlistAndNavigate(page, 'Akce s dárky');
	await addGift(page, 'Kolo pro výlety');
	await addGift(page, 'Stan pro dva');
	await expect(page.locator('[data-gift-item]')).toHaveCount(2, { timeout: 10_000 });
}

async function selectionCount(toolbar: Locator, count: number) {
	await expect(toolbar.getByText(new RegExp(`Vybráno ${count}`))).toBeVisible();
}

async function touchPoint(target: Locator) {
	const box = await target.boundingBox();
	expect(box).not.toBeNull();
	return { x: box!.x + 20, y: box!.y + 20 };
}

async function beginTouchLongPress(target: Locator) {
	const point = await touchPoint(target);
	await target.dispatchEvent('pointerdown', {
		pointerType: 'touch',
		clientX: point.x,
		clientY: point.y,
	});
	return point;
}

async function openMobileGiftActions(page: Page, target: Locator, giftName: string) {
	await beginTouchLongPress(target);
	const sheet = page.getByRole('dialog');
	await expect(sheet.getByRole('heading', { name: giftName })).toBeVisible();
	await target.dispatchEvent('pointerup', { pointerType: 'touch' });
	return sheet;
}

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

test('selection survives responsive reflow while normal controls remain replaced', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-selection-persistence'),
	);
	await createActionFixture(page);
	const toolbar = await openSelectionFromContext(page, 'Stan pro dva');
	await gift(page, 'Kolo pro výlety').click();
	await selectionCount(toolbar, 2);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'true');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('radio', { name: /Seznam/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Seskupení:/ })).toHaveCount(0);

	await page.setViewportSize({ width: 390, height: 844 });
	await selectionCount(toolbar, 2);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'true');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'true');
	await expect(
		toolbar.getByRole('checkbox', { name: 'Vybrat všechny viditelné dárky' }),
	).toBeChecked();
	await page.context().close();
});

test('mobile toolbar starts an empty selection from deterministic SSR markup', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-toolbar-selection'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const serverResponse = await page.context().request.get(page.url());
	expect(serverResponse.ok()).toBe(true);
	const serverRenderedHtml = await serverResponse.text();
	expect(
		serverRenderedHtml.match(/data-testid=(?:"gift-view-switcher"|'gift-view-switcher')/g) ??
			[],
	).toHaveLength(2);

	await page.getByRole('button', { name: m.gift_selection_toolbar(), exact: true }).click();
	const toolbar = page.getByRole('region', {
		name: m.gift_selection_toolbar(),
		exact: true,
	});
	await expect(toolbar).toBeVisible();
	await selectionCount(toolbar, 0);
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'false');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'false');
	await expect(page.getByTestId('gift-view-switcher')).toHaveCount(0);
	await page.context().close();
});

test('mobile long press opens Sheet drill-in and selection toolbar Actions row', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-actions-mobile');
	const authenticated = await registerAndGetPage(browser, request, baseURL!, user);
	await authenticated.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(authenticated);

	const target = gift(authenticated, 'Kolo pro výlety');
	await openMobileGiftActions(authenticated, target, 'Kolo pro výlety');
	await authenticated.getByRole('button', { name: 'Priorita' }).click();
	await expect(authenticated.getByRole('button', { name: 'Zpět' })).toBeVisible();
	await authenticated.getByRole('button', { name: 'Zpět' }).click();
	await authenticated.getByRole('button', { name: /Vybrat více dárků/ }).click();
	const toolbar = authenticated.getByRole('region', { name: 'Nástroje výběru' });
	const actions = toolbar.getByRole('button', { name: /Akce/ });
	await expect(actions).toBeVisible();
	await expect(toolbar.getByRole('button', { name: m.cancel() })).toBeVisible();

	await actions.click();
	await expect(authenticated.getByRole('menu')).toBeVisible();
	await authenticated.keyboard.press('Escape');
	await expect(authenticated.getByRole('menu')).toBeHidden();
	await selectionCount(toolbar, 1);
	await expect(target).toHaveAttribute('aria-selected', 'true');

	await authenticated.keyboard.press('Escape');
	await expect(toolbar).toBeHidden();
	await authenticated.context().close();
});

test('mobile movement beyond the tolerance cancels a pending long press', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-movement-cancel'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	const point = await beginTouchLongPress(target);
	await expect(target).toHaveAttribute('data-long-press-pending', 'true');
	await target.dispatchEvent('pointermove', {
		pointerType: 'touch',
		clientX: point.x + 9,
		clientY: point.y,
	});
	await expect(target).not.toHaveAttribute('data-long-press-pending', 'true');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.context().close();
});

test('mobile scroll cancels a pending long press', async ({ browser, request, baseURL }) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-scroll-cancel'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	await beginTouchLongPress(target);
	await expect(target).toHaveAttribute('data-long-press-pending', 'true');
	await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
	await expect(target).not.toHaveAttribute('data-long-press-pending', 'true');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.context().close();
});

test('mobile long press beginning on a card control does not open the actions Sheet', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-control-cancel'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	const receivedControl = target.getByTestId('gift-received-toggle');
	await expect(receivedControl).toBeVisible();
	await beginTouchLongPress(receivedControl);
	await expect(target).not.toHaveAttribute('data-long-press-pending', 'true');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.context().close();
});

test('mobile bulk actions expose mixed received state and apply a common value', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-mixed-bulk'),
	);
	await createActionFixture(page);
	const firstGift = gift(page, 'Kolo pro výlety');
	const secondGift = gift(page, 'Stan pro dva');
	await firstGift.getByTestId('gift-received-toggle').click();
	await waitForReceivedState(firstGift, true);
	await waitForReceivedState(secondGift, false);

	await page.setViewportSize({ width: 390, height: 844 });
	const sheet = await openMobileGiftActions(page, firstGift, 'Kolo pro výlety');
	await sheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
	const toolbar = page.getByRole('region', { name: 'Nástroje výběru' });
	await secondGift.click();
	await selectionCount(toolbar, 2);

	await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
	const mixedReceived = page.getByRole('menuitem', {
		name: `${m.gift_selection_received_state()}: ${m.gift_selection_mixed()}`,
	});
	await expect(mixedReceived).toBeVisible();
	await mixedReceived.click();
	await expect(page.getByText(m.gift_selection_mixed(), { exact: true }).last()).toBeVisible();
	const markReceived = page.getByRole('menuitemradio', { name: m.gift_mark_received() });
	const markUnreceived = page.getByRole('menuitemradio', { name: m.gift_mark_unreceived() });
	await expect(markReceived).toHaveAttribute('aria-checked', 'false');
	await expect(markUnreceived).toHaveAttribute('aria-checked', 'false');
	await markReceived.click();

	await waitForToast(page, m.gift_bulk_success({ count: 2 }));
	await selectionCount(toolbar, 2);
	await expect(firstGift).toHaveAttribute('aria-selected', 'true');
	await expect(secondGift).toHaveAttribute('aria-selected', 'true');
	await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
	await expect(
		page.getByRole('menuitem', {
			name: `${m.gift_selection_received_state()}: ${m.gift_mark_received()}`,
		}),
	).toBeVisible();
	await page.keyboard.press('Escape');

	await toolbar.getByRole('button', { name: m.cancel() }).click();
	await waitForReceivedState(firstGift, true);
	await waitForReceivedState(secondGift, true);
	await page.context().close();
});

test('bulk hidden-selection confirmation preserves exact received state on undo', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-hidden-undo'),
	);
	await createWishlistForSomeoneAndNavigate(page, {
		title: 'Skrytý výběr',
		recipientName: 'Rosie',
	});
	await addGift(page, 'Kolo pro výlety');
	await addGift(page, 'Stan pro dva');
	await expect(page.locator('[data-gift-item]')).toHaveCount(2, { timeout: 10_000 });

	const firstGift = gift(page, 'Kolo pro výlety');
	const secondGift = gift(page, 'Stan pro dva');
	await toggleFilterCheckbox(page, m.gift_filter_show_received());
	await firstGift.getByTestId('gift-received-toggle').click();
	await waitForReceivedState(firstGift, true);
	await waitForReceivedState(secondGift, false);
	await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
	await selectPriorityFilter(page, m.gift_priority_none());
	const toolbar = await openSelectionFromContext(page, 'Kolo pro výlety');
	await gift(page, 'Stan pro dva').click();
	await selectionCount(toolbar, 2);

	await page.getByRole('button', { name: new RegExp(`${m.gift_priority_label()}:`) }).click();
	await page.getByRole('menuitemradio', { name: /Vysok/i }).click();
	await expect(toolbar.getByText(m.gift_selection_hidden_count({ count: 2 }))).toBeVisible();

	const selectionActionsButton = page.getByRole('button', { name: m.gift_selection_actions() });
	if (await selectionActionsButton.count()) {
		await selectionActionsButton.click();
		await page.getByRole('menuitem', { name: m.gift_selection_received_state() }).click();
	} else {
		await page.getByRole('button', { name: m.gift_selection_received_state() }).click();
	}
	await page.getByTestId('selection-received-true').click();
	await expect(page.getByRole('dialog')).toContainText(
		m.gift_hidden_selection_description({ count: 2 }),
	);
	await page.getByRole('button', { name: m.gift_hidden_selection_continue() }).click();
	await waitForToast(page, m.gift_bulk_success({ count: 2 }));
	await expect(toolbar.getByText(m.gift_selection_hidden_count({ count: 2 }))).toBeVisible();
	await page.getByRole('button', { name: m.gift_bulk_undo() }).click();
	await waitForToast(page, m.gift_bulk_undo_success());
	await expect(toolbar.getByText(m.gift_selection_hidden_count({ count: 2 }))).toBeVisible();

	await page.getByRole('button', { name: m.done() }).click();
	await page.getByRole('button', { name: m.gift_display_reset_aria() }).click();
	await expect(firstGift).toHaveCount(0);
	await waitForReceivedState(secondGift, false);
	await toggleFilterCheckbox(page, m.gift_filter_show_received());
	await waitForReceivedState(firstGift, true);
	await waitForReceivedState(secondGift, false);
	await page.context().close();
});

test('compact view remains excluded from gift actions', async ({ browser, request, baseURL }) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-compact'),
	);
	await createActionFixture(page);
	await expect(page.getByRole('button', { name: /Kompaktní/ })).toHaveCount(0);
	await page.evaluate(() => {
		window.localStorage.setItem('prejemesi-gift-view-mode', JSON.stringify('compact'));
	});
	await page.reload();
	await expect(page.locator('[data-view-mode="compact"]')).toBeVisible();
	await page.getByText('Kolo pro výlety', { exact: true }).click({
		button: 'right',
		position: { x: 30, y: 10 },
	});
	await expect(page.getByRole('menu')).toHaveCount(0);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Nástroje výběru' })).toHaveCount(0);
	await page.context().close();
});
