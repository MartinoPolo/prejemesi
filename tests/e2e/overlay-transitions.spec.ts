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

async function openSeedWishlist(
	page: Page,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
	email = 'martin@test.cz',
) {
	const cookies = await loginViaApi(request, baseURL, {
		email,
		password: ['password', '123'].join(''),
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.goto('/w/xmas2026', { waitUntil: 'domcontentloaded' });
	await waitForAppHydration(page);
}

async function hoverDisplaySubmenu(page: Page, name: RegExp): Promise<Locator> {
	const root = page.locator('[data-slot="dropdown-menu-content"]:visible').last();
	const trigger = root.getByRole('menuitem', { name });
	await trigger.hover();
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	const controlledId = await trigger.getAttribute('aria-controls');
	expect(controlledId).not.toBeNull();
	const submenu = page.locator(`[id=${JSON.stringify(controlledId)}]`);
	await expect(submenu).toBeVisible();
	return submenu;
}

test('nested Display menus keep their transparent exit frame through switching and dismissal', async ({
	page,
	request,
	baseURL,
}) => {
	await page.setViewportSize({ width: 1100, height: 700 });
	await openSeedWishlist(page, request, baseURL!);
	await page.getByTestId('desktop-display-trigger').filter({ visible: true }).click();

	const root = page.locator('[data-slot="dropdown-menu-content"]:visible').last();
	const outgoingSubmenu = await hoverDisplaySubmenu(page, /Řadit podle/);
	await waitForAnimations(outgoingSubmenu);
	const outgoingRecording = await startExitRecording(outgoingSubmenu);
	const activeSubmenu = await hoverDisplaySubmenu(page, /Seskupení/);
	expectStableExit(await outgoingRecording.finish());

	const rootRecording = await startExitRecording(root);
	const submenuRecording = await startExitRecording(activeSubmenu);
	await page.mouse.click(4, 4);
	const [rootSamples, submenuSamples] = await Promise.all([
		rootRecording.finish(),
		submenuRecording.finish(),
	]);
	expectStableExit(rootSamples);
	expectStableExit(submenuSamples);
});

test('gift details retain their identity throughout the closing animation', async ({
	page,
	request,
	baseURL,
}) => {
	await openSeedWishlist(page, request, baseURL!, 'petr@test.cz');
	const giftName = 'PlayStation 5';
	const giftDescription = 'Nejnovější verze, s mechanikou na disky';
	const giftItem = page.locator('[data-gift-item]').filter({
		has: page.getByRole('heading', { name: giftName, exact: true }),
	});
	await giftItem.focus();
	await page.keyboard.press('Enter');

	const dialog = page.getByRole('dialog').filter({
		has: page.getByRole('heading', { name: giftName, exact: true }),
	});
	const overlay = page.locator('[data-slot="dialog-overlay"]:visible');
	await waitForAnimations(dialog);
	const dialogRecording = await startExitRecording(dialog);
	const overlayRecording = await startExitRecording(overlay);

	await page.keyboard.press('Escape');
	const [dialogSamples, overlaySamples] = await Promise.all([
		dialogRecording.finish(),
		overlayRecording.finish(),
	]);
	expectStableExit(dialogSamples);
	expectStableExit(overlaySamples);
	expect(
		dialogSamples
			.filter((sample) => sample.connected && sample.state === 'closed')
			.every(
				(sample) => sample.text.includes(giftName) && sample.text.includes(giftDescription),
			),
		'the outgoing dialog never changes to another gift or an empty form',
	).toBe(true);
	await expect(giftItem).toBeFocused();
});
