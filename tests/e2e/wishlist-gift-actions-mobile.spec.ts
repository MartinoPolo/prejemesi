import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	gift,
	createActionFixture,
	openSelectionFromContext,
	selectionCount,
	openMobileGiftActions,
	beginTouchLongPress,
	expectBodyPointerEventsRestored,
} from './wishlist-gift-actions.helpers.js';

test('mobile More uses a Sheet and returns focus on Escape', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-more'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const more = gift(page, 'Kolo pro výlety').getByTestId('gift-more-actions');
	await expect(more).toHaveAttribute('aria-haspopup', 'dialog');
	await more.click();
	await expect(more).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByRole('dialog', { name: 'Kolo pro výlety' })).toBeVisible();
	await expect(page.getByRole('menu')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(more).toHaveAttribute('aria-expanded', 'false');
	await expect(more).toBeFocused();
	await expectBodyPointerEventsRestored(page);
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
	const selectVisible = toolbar.getByRole('checkbox', {
		name: 'Vybrat všechny viditelné dárky',
	});
	await expect(selectVisible).toBeChecked();
	await selectVisible.click();
	await selectionCount(toolbar, 0);
	await expect(selectVisible).not.toBeChecked();
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('role', 'checkbox');
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'false');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'false');

	await selectVisible.click();
	await selectionCount(toolbar, 2);
	await expect(selectVisible).toBeChecked();
	await expect(gift(page, 'Kolo pro výlety')).toHaveAttribute('aria-selected', 'true');
	await expect(gift(page, 'Stan pro dva')).toHaveAttribute('aria-selected', 'true');
	await page.context().close();
});

test('mobile toolbar starts with an observable empty selection', async ({
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

	await page.getByTestId('mobile-more-trigger').click();
	await page
		.getByRole('dialog', { name: m.wishlist_more_actions() })
		.getByRole('button', { name: m.gift_selection_toolbar(), exact: true })
		.click();
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

test('mobile long press supports drill-in, Back, and entering selection', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile'),
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await createActionFixture(page);

	const target = gift(page, 'Kolo pro výlety');
	const sheet = await openMobileGiftActions(page, target, 'Kolo pro výlety');
	const priorityAction = sheet.getByRole('button', { name: 'Priorita' });
	await priorityAction.click();
	const back = sheet.getByRole('button', { name: 'Zpět' });
	await expect(back).toBeVisible();
	await expect(back).toBeFocused();
	await back.click();
	await expect(priorityAction).toBeVisible();
	await sheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
	await expect(sheet).toBeHidden();
	const toolbar = page.getByRole('region', { name: m.gift_selection_toolbar(), exact: true });
	await expect(toolbar).toBeVisible();
	await selectionCount(toolbar, 1);
	await expect(target).toHaveAttribute('aria-selected', 'true');
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
