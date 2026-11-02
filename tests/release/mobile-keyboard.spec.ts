import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { loginViaApi, parseCookiesForContext } from '../e2e/fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from '../e2e/fixtures/wishlist-helpers.js';
import { createPixelAssertions } from '../helpers/pixel-assertions.mjs';

const { expectPixelsAtMost, expectPixelsNear } = createPixelAssertions(expect);

const PHONE = { width: 390, height: 844 };
const KEYBOARD_HEIGHT = 320;
// Leaves under 400px above the keyboard, where the design caps the composer at three lines.
const TALL_KEYBOARD_HEIGHT = 450;

// Emulation never opens an on-screen keyboard, so the visual viewport is shrunk the way
// Android Chrome and iOS Safari shrink it: the layout viewport keeps its height.
async function openMobilePage(
	browser: Browser,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
) {
	const context = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
	await context.addInitScript(() => {
		const height = Object.getOwnPropertyDescriptor(VisualViewport.prototype, 'height')!.get!;
		Object.defineProperty(VisualViewport.prototype, 'height', {
			get(this: VisualViewport) {
				const keyboard = Number(document.documentElement.dataset.simulatedKeyboard ?? 0);
				return height.call(this) - keyboard;
			},
		});
	});
	// Playwright runs the fake chat provider with martin@test.cz on the family allowlist.
	const cookies = await loginViaApi(request, baseURL, {
		email: 'martin@test.cz',
		password: ['password', '123'].join(''),
	});
	await context.addCookies(parseCookiesForContext(cookies, baseURL));
	return context.newPage();
}

async function setKeyboard(page: Page, height: number) {
	await page.evaluate((keyboard) => {
		document.documentElement.dataset.simulatedKeyboard = String(keyboard);
		window.visualViewport!.dispatchEvent(new Event('resize'));
	}, height);
}

async function bottomOf(locator: Locator) {
	return locator.evaluate((element) => element.getBoundingClientRect().bottom);
}

/** Space between the composer and the sheet's bottom edge beyond the footer's own padding. */
async function composerGapToSheetBottom(composer: Locator) {
	return composer.evaluate((element) => {
		const form = element.closest('form')!;
		const footer = form.closest('footer')!;
		const sheet = footer.closest('[data-testid="assistant-panel"]')!;
		return (
			sheet.getBoundingClientRect().bottom -
			form.getBoundingClientRect().bottom -
			parseFloat(getComputedStyle(footer).paddingBottom) -
			parseFloat(getComputedStyle(sheet).borderBottomWidth)
		);
	});
}

test.describe('layouts follow the mobile keyboard (issue #623)', () => {
	test('the assistant sheet sits on the keyboard and its controls keep the keyboard open', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await openMobilePage(browser, request, baseURL!);
		await createWishlistAndNavigate(page, `Klávesnice asistent ${Date.now()}`);

		const panel = page.getByTestId('assistant-panel');
		const composer = page.getByTestId('assistant-composer');
		await page.getByTestId('assistant-fab').tap();
		await expect(panel).toBeVisible();
		await composer.focus();
		await expect(page.getByTestId('assistant-more')).toBeHidden();

		await setKeyboard(page, KEYBOARD_HEIGHT);
		await expect(page.locator('html')).toHaveAttribute('data-keyboard', 'open');
		await expect.poll(() => bottomOf(panel)).toBeCloseTo(PHONE.height - KEYBOARD_HEIGHT, 0);
		expectPixelsNear(await composerGapToSheetBottom(composer), 0);
		await expect(page.getByTestId('assistant-starter-chip').first()).toBeVisible();

		// A taller keyboard moves the sheet again and leaves fewer composer lines before it scrolls.
		await setKeyboard(page, TALL_KEYBOARD_HEIGHT);
		await expect
			.poll(() => bottomOf(panel))
			.toBeCloseTo(PHONE.height - TALL_KEYBOARD_HEIGHT, 0);
		await composer.fill(Array.from({ length: 4 }, (_, line) => `Řádek ${line + 1}`).join('\n'));
		await expect
			.poll(() => composer.evaluate((element) => element.scrollHeight > element.clientHeight))
			.toBe(true);
		await composer.fill('');

		// An open proposal folds its decision bar to one line that keeps Použít in reach.
		await composer.fill('Přidejte Stolní hra Azul');
		await composer.press('Enter');
		const apply = panel.getByTestId('chat-proposal-apply');
		await expect(apply).toBeVisible({ timeout: 15_000 });
		expectPixelsAtMost(await bottomOf(apply), PHONE.height - TALL_KEYBOARD_HEIGHT);
		const rejectAll = panel.getByTestId('chat-proposal-reject-all');
		await expect(rejectAll).toBeHidden();
		await panel.getByTestId('chat-proposal-expand').tap();
		await expect(rejectAll).toBeVisible();
		await expect(composer).toBeFocused();

		// Header tools move into the overflow menu and leave the composer focused.
		await page.getByTestId('assistant-more').tap();
		await expect(page.getByTestId('assistant-history-open')).toBeVisible();
		await expect(composer).toBeFocused();

		await page.getByTestId('assistant-preview').tap();
		await expect(composer).not.toBeFocused();
		await setKeyboard(page, 0);
		await expect(page.locator('html')).not.toHaveAttribute('data-keyboard');
		await expect(page.getByTestId('assistant-more')).toBeHidden();
		await page.context().close();
	});

	test('the gift editor reaches the keyboard and saves from its title row', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await openMobilePage(browser, request, baseURL!);
		await createWishlistAndNavigate(page, `Klávesnice editor ${Date.now()}`);

		await page
			.getByRole('button', { name: /Přidat dárek/ })
			.first()
			.tap();
		const dialog = page.getByRole('dialog');
		const name = dialog.getByRole('textbox', { name: 'Název' });
		await name.fill('Dárek z klávesnice');
		await name.focus();
		const keyboardSave = page.getByTestId('gift-editor-keyboard-save');
		await expect(keyboardSave).toBeHidden();

		await setKeyboard(page, KEYBOARD_HEIGHT);
		await expect(keyboardSave).toBeVisible();
		await expect.poll(() => bottomOf(dialog)).toBeCloseTo(PHONE.height - KEYBOARD_HEIGHT, 0);
		await expect(page.getByRole('button', { name: 'Zrušit' })).toBeHidden();

		await keyboardSave.tap();
		await expect(dialog).toBeHidden();
		await expect(
			page.locator('[data-gift-item]').filter({ hasText: 'Dárek z klávesnice' }),
		).toBeVisible();
		await page.context().close();
	});
});
