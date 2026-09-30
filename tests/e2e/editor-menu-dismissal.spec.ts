import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';
import {
	expectStableExit,
	startExitRecording,
	waitForAnimations,
} from './overlay-transitions.helpers.js';

async function openWishlist(
	page: Page,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
) {
	const cookies = await loginViaApi(request, baseURL, {
		email: 'martin@test.cz',
		password: ['password', '123'].join(''),
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.goto('/w/xmas2026', { waitUntil: 'domcontentloaded' });
	await waitForAppHydration(page);
}

async function reopenBeforeExitCompletes(
	trigger: Locator,
	surfaceSlot: string,
	activation: 'pointerdown' | 'click',
) {
	await trigger.evaluate(
		(element, { slot, activation }) => {
			const closingSurface = document.querySelector(`[data-slot="${slot}"]`);
			if (
				closingSurface?.getAttribute('data-state') !== 'closed' ||
				!(element instanceof HTMLElement)
			) {
				throw new Error(`The ${slot} exit completed before reopening`);
			}
			if (activation === 'pointerdown') {
				element.dispatchEvent(
					new PointerEvent('pointerdown', {
						bubbles: true,
						button: 0,
						pointerType: 'mouse',
					}),
				);
			} else {
				element.click();
			}
		},
		{ slot: surfaceSlot, activation },
	);
}

async function expectAnimatedDismissal(page: Page, surface: Locator, dismiss: () => Promise<void>) {
	await waitForAnimations(surface);
	const recording = await startExitRecording(surface);
	await dismiss();
	expectStableExit(await recording.finish());
	await expect(surface).toHaveCount(0);
	await expect(
		page.locator('[data-slot="select-content"], [data-slot="sheet-content"]'),
	).toHaveCount(0);
}

for (const width of [1100, 390]) {
	test(`gift editor selects dismiss without rebound at ${width}px`, async ({
		page,
		request,
		baseURL,
	}) => {
		await page.setViewportSize({ width, height: 800 });
		await openWishlist(page, request, baseURL!);
		const gift = page.locator('[data-gift-item]').filter({
			has: page.getByRole('heading', { name: 'Kávovar DeLonghi', exact: true }),
		});
		await gift.focus();
		await page.keyboard.press('Enter');
		const editor = page.getByRole('dialog').filter({ has: page.locator('#gift-name') });
		await expect(editor).toBeVisible();
		const triggers = [
			editor.getByTestId('gift-price-currency-row').locator('[data-slot="select-trigger"]'),
			editor
				.getByTestId('gift-quantity-priority-row')
				.locator('[data-slot="select-trigger"]')
				.first(),
			editor
				.getByTestId('gift-quantity-priority-row')
				.locator('[data-slot="select-trigger"]')
				.nth(1),
		];
		for (const trigger of triggers) {
			await trigger.click();
			const content = page.locator('[data-slot="select-content"]');
			await expectAnimatedDismissal(page, content, () => page.keyboard.press('Escape'));
			await expect(editor).toBeVisible();
			await expect(trigger).toBeFocused();
		}
		const content = page.locator('[data-slot="select-content"]');
		await triggers[0]!.click();
		await waitForAnimations(content);
		await expectAnimatedDismissal(page, content, () =>
			content.locator('[data-slot="select-item"]').last().click(),
		);
		await expect(editor).toBeVisible();
		await triggers[0]!.click();
		await expectAnimatedDismissal(page, content, () => editor.locator('#gift-name').click());
		await expect(editor).toBeVisible();

		await triggers[0]!.click();
		await waitForAnimations(content);
		await page.keyboard.press('Escape');
		await reopenBeforeExitCompletes(triggers[0]!, 'select-content', 'pointerdown');
		await expect(
			content.filter({ has: page.locator('[data-slot="select-item"]') }),
		).toHaveCount(1);
		await expect(content).toHaveAttribute('data-state', 'open');
		await waitForAnimations(content);
		const finalRecording = await startExitRecording(content);
		await page.keyboard.press('Escape');
		expectStableExit(await finalRecording.finish());
		await expect(content).toHaveCount(0);
		await expect(editor).toBeVisible();
	});
}

test('mobile hero, gift and navigation sheets dismiss without rebound', async ({
	page,
	request,
	baseURL,
}) => {
	await page.setViewportSize({ width: 390, height: 800 });
	await openWishlist(page, request, baseURL!);
	const initialScrollStyles = await page.evaluate(() => ({
		body: document.body.style.overflow,
		html: document.documentElement.style.overflow,
		pointerEvents: document.body.style.pointerEvents,
	}));
	for (const trigger of [
		page.getByTestId('mobile-header-more-trigger').filter({ visible: true }).first(),
		page.locator('header button[aria-haspopup="dialog"]').first(),
		page
			.locator('[data-gift-item]')
			.filter({
				has: page.getByRole('heading', { name: 'Kávovar DeLonghi', exact: true }),
			})
			.getByTestId('gift-more-actions'),
	]) {
		await trigger.click();
		const sheet = page.locator('[data-slot="sheet-content"]');
		await expect(sheet).toBeVisible();
		await expect
			.poll(() => page.locator('body').evaluate((body) => body.style.pointerEvents))
			.toBe('none');
		await expectAnimatedDismissal(page, sheet, () => page.keyboard.press('Escape'));
		await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
		await expect
			.poll(() =>
				page.evaluate(() => ({
					body: document.body.style.overflow,
					html: document.documentElement.style.overflow,
					pointerEvents: document.body.style.pointerEvents,
				})),
			)
			.toEqual(initialScrollStyles);
		await expect(trigger).toBeFocused();
		await trigger.click();
		await expectAnimatedDismissal(page, sheet, () => page.mouse.click(380, 20));
		await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
	}
	const heroTrigger = page
		.getByTestId('mobile-header-more-trigger')
		.filter({ visible: true })
		.first();
	await heroTrigger.click();
	await expectAnimatedDismissal(page, page.locator('[data-slot="sheet-content"]'), () =>
		page.locator('[data-slot="sheet-content"]').getByRole('button', { name: 'Zavřít' }).click(),
	);
	await heroTrigger.click();
	const sheet = page.locator('[data-slot="sheet-content"]');
	await waitForAnimations(sheet);
	await page.keyboard.press('Escape');
	await reopenBeforeExitCompletes(heroTrigger, 'sheet-content', 'click');
	await expect(sheet).toHaveAttribute('data-state', 'open');
	await expect(sheet).toHaveCount(1);
	await waitForAnimations(sheet);
	const finalRecording = await startExitRecording(sheet);
	await page.keyboard.press('Escape');
	expectStableExit(await finalRecording.finish());
	await expect(sheet).toHaveCount(0);
});

test('dirty gift editor keeps its unsaved-change guard after menu dismissal', async ({
	page,
	request,
	baseURL,
}) => {
	await openWishlist(page, request, baseURL!);
	await page
		.getByRole('button', { name: /Přidat dárek/ })
		.first()
		.click();
	const editor = page.getByRole('dialog', { name: 'Přidat dárek' });
	await editor.locator('#gift-name').fill('Neuložený dárek');
	await editor
		.getByTestId('gift-price-currency-row')
		.locator('[data-slot="select-trigger"]')
		.click();
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-slot="select-content"]')).toHaveCount(0);
	await editor.getByRole('button', { name: 'Zrušit' }).click();
	const guard = page.getByRole('dialog', { name: 'Máte neuložené změny' });
	await expect(guard).toBeVisible();
	await guard.getByRole('button', { name: /Pokračovat/ }).click();
	await expect(editor.locator('#gift-name')).toHaveValue('Neuložený dárek');
	await editor.getByRole('button', { name: 'Zrušit' }).click();
	await guard.getByRole('button', { name: /Zahodit/ }).click();
	await expect(editor).toHaveCount(0);
});

test('reduced motion removes select and sheet animation without losing dismissal or focus', async ({
	page,
	request,
	baseURL,
}) => {
	await page.setViewportSize({ width: 390, height: 800 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await openWishlist(page, request, baseURL!);
	const sheetTrigger = page
		.getByTestId('mobile-header-more-trigger')
		.filter({ visible: true })
		.first();
	await sheetTrigger.click();
	const sheet = page.locator('[data-slot="sheet-content"]');
	await expect(sheet).toBeVisible();
	expect(await sheet.evaluate((element) => element.getAnimations().length)).toBe(0);
	await sheet.getByRole('button', { name: 'Zavřít' }).click();
	await expect(sheet).toHaveCount(0);
	await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
	await expect(sheetTrigger).toBeFocused();

	const gift = page.locator('[data-gift-item]').filter({
		has: page.getByRole('heading', { name: 'Kávovar DeLonghi', exact: true }),
	});
	await gift.focus();
	await page.keyboard.press('Enter');
	const editor = page.getByRole('dialog').filter({ has: page.locator('#gift-name') });
	const trigger = editor
		.getByTestId('gift-price-currency-row')
		.locator('[data-slot="select-trigger"]');
	await trigger.click();
	const select = page.locator('[data-slot="select-content"]');
	await expect(select).toBeVisible();
	expect(await select.evaluate((element) => element.getAnimations().length)).toBe(0);
	await select.locator('[data-slot="select-item"]').last().click();
	await expect(select).toHaveCount(0);
	await expect(editor).toBeVisible();
	await expect(trigger).toBeFocused();
});
