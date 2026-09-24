import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	waitForDialogMotionToSettle,
} from './fixtures/wishlist-helpers.js';
import { createPixelAssertions } from '../helpers/pixel-assertions.mjs';

const { expectPixelsAtMost, expectPixelsNear } = createPixelAssertions(expect);

test.describe('Wishlist settings – controls and draft lifecycle', () => {
	test('real gift numeric fields suppress spinners and wheel only while focused', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('gift-number-inputs');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		await page.setViewportSize({ width: 500, height: 360 });
		await createWishlistAndNavigate(page, 'Číselná pole');
		await page
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const dialog = page.getByRole('dialog');
		const price = dialog.getByRole('spinbutton', { name: 'Cena' });
		const quantity = dialog.getByRole('spinbutton', { name: 'Počet (skryto při 1)' });
		for (const input of [price, quantity]) {
			expect(await input.evaluate((element) => getComputedStyle(element).appearance)).toBe(
				'textfield',
			);
		}

		await price.fill('99.99');
		const unfocused = await price.evaluate((element) => {
			(element as HTMLInputElement).blur();
			const event = new WheelEvent('wheel', { deltaY: -1, cancelable: true, bubbles: true });
			const dispatched = element.dispatchEvent(event);
			return {
				dispatched,
				prevented: event.defaultPrevented,
				value: (element as HTMLInputElement).value,
			};
		});
		expect(unfocused).toEqual({ dispatched: true, prevented: false, value: '99.99' });

		const focused = await price.evaluate((element) => {
			(element as HTMLInputElement).focus();
			const event = new WheelEvent('wheel', { deltaY: -1, cancelable: true, bubbles: true });
			const dispatched = element.dispatchEvent(event);
			return { dispatched, prevented: event.defaultPrevented };
		});
		expect(focused).toEqual({ dispatched: false, prevented: true });
		await expect(price).toHaveValue('100.99');

		// A synthetic dispatch verifies direct cancellation semantics, but does not expose
		// browsers ignoring preventDefault in passive listeners. Exercise a real gesture in
		// the short dialog's actual scroll region to guard against that regression.
		await price.fill('99.99');
		const scrollRegion = dialog.getByTestId('gift-detail-body');
		await price.scrollIntoViewIfNeeded();
		await price.focus();
		const scrollTopBefore = await scrollRegion.evaluate((element) => element.scrollTop);
		expect(scrollTopBefore).toBeGreaterThan(0);
		const priceBox = await price.boundingBox();
		expect(priceBox, 'price input has mouse-wheel geometry').not.toBeNull();
		await page.mouse.move(
			priceBox!.x + priceBox!.width / 2,
			priceBox!.y + priceBox!.height / 2,
		);
		await page.mouse.wheel(0, -100);
		await expect(price).toHaveValue('100.99');
		expect(await scrollRegion.evaluate((element) => element.scrollTop)).toBe(scrollTopBefore);
		await page.context().close();
	});
	test('short viewport keeps tabs and footer pinned around the scrollable settings body', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-short-viewport');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Nastavení v nízkém okně');
		await page.setViewportSize({ width: 900, height: 360 });
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();

		const dialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		const tablist = dialog.getByRole('tablist', { name: 'Nastavení seznamu' });
		const scrollRegion = dialog.getByTestId('wishlist-settings-scroll-region');
		const footer = dialog.getByTestId('wishlist-settings-footer');
		const saveButton = footer.getByRole('button', { name: 'Uložit' });
		await expect(dialog).toBeVisible({ timeout: 10_000 });
		await expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');

		const tabBoxes = await tablist
			.getByRole('tab')
			.evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect()));
		expectPixelsNear(
			Math.max(...tabBoxes.map((box) => box.y)),
			Math.min(...tabBoxes.map((box) => box.y)),
		);

		await waitForDialogMotionToSettle(dialog);
		const initialTablistBox = await tablist.boundingBox();
		const initialFooterBox = await footer.boundingBox();
		expect(initialTablistBox, 'tablist has viewport geometry').not.toBeNull();
		expect(initialFooterBox, 'settings footer has viewport geometry').not.toBeNull();

		for (const tabName of [
			'Podrobnosti',
			'Kategorie',
			'Vzhled',
			'Obrázek a ořezy',
			'Import a export',
			'Nebezpečná zóna',
		]) {
			await dialog.getByRole('tab', { name: tabName }).click();
			await expect(saveButton).toBeVisible();
		}
		await expect(saveButton).toHaveCount(1);

		await dialog.getByRole('tab', { name: 'Obrázek a ořezy' }).click();
		const overflow = await scrollRegion.evaluate((element) => ({
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
			overflowY: getComputedStyle(element).overflowY,
		}));
		expect(overflow.overflowY).toBe('auto');
		expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
		await scrollRegion.evaluate((element) => (element.scrollTop = element.scrollHeight));
		expect(await scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

		const scrolledTablistBox = await tablist.boundingBox();
		const scrolledFooterBox = await footer.boundingBox();
		expectPixelsNear(scrolledTablistBox!.y, initialTablistBox!.y);
		expectPixelsNear(scrolledFooterBox!.y, initialFooterBox!.y);
		expectPixelsAtMost(scrolledFooterBox!.y + scrolledFooterBox!.height, 360);
		await expect(saveButton).toBeVisible();

		await page.context().close();
	});

	test('dirty Escape then Continue editing preserves the visible draft and later reopen', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-dirty-escape');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(page, 'Zavření rozepsaných změn');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();

		const settings = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		const title = settings.getByRole('textbox', { name: 'Název' });
		const unsavedGuard = page.getByRole('dialog', { name: 'Máte neuložené změny' });
		await title.fill('Rozepsaný název');

		await page
			.locator('[data-slot="dialog-overlay"]:visible')
			.click({ position: { x: 8, y: 8 } });
		await expect(unsavedGuard).toBeVisible();
		await unsavedGuard.getByRole('button', { name: 'Pokračovat v úpravách' }).click();
		await expect(unsavedGuard).not.toBeVisible();
		await expect(settings).toBeVisible();
		await expect(title).toHaveValue('Rozepsaný název');

		await page.keyboard.press('Escape');
		await expect(unsavedGuard).toBeVisible();
		await unsavedGuard.getByRole('button', { name: 'Pokračovat v úpravách' }).click();

		await expect(unsavedGuard).not.toBeVisible();
		await expect(settings).toBeVisible();
		await expect(title).toHaveValue('Rozepsaný název');

		await settings.getByRole('button', { name: 'Zavřít' }).click();
		await expect(unsavedGuard).toBeVisible();
		await unsavedGuard.getByRole('button', { name: 'Pokračovat v úpravách' }).click();
		await expect(unsavedGuard).not.toBeVisible();
		await expect(settings).toBeVisible();
		await expect(title).toHaveValue('Rozepsaný název');

		await title.fill('Zavření rozepsaných změn');
		await settings.getByRole('button', { name: 'Zavřít' }).click();
		await expect(settings).not.toBeVisible();
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		await expect(settings).toBeVisible();
		await expect(settings.getByRole('textbox', { name: 'Název' })).toHaveValue(
			'Zavření rozepsaných změn',
		);

		await page.context().close();
	});
});
