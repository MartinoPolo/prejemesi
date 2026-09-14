import { expect, test } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';
import { openDesktopDisplaySubmenu } from './fixtures/wishlist-helpers.js';
import {
	DROPDOWN_LAYER_SELECTOR,
	expectClosedLayersKeepTheirExitEndpoint,
	hoverDisplaySubmenu,
	installDropdownTransitionSampler,
	resetDropdownTransitionSamples,
	visibleDropdownRoot,
} from './dropdown-transitions.helpers.js';

const ROOT_SLOT = 'dropdown-menu-content';
const SUBMENU_SLOT = 'dropdown-menu-sub-content';

async function openSeedWishlist(
	page: Parameters<typeof waitForAppHydration>[0],
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
): Promise<void> {
	const cookies = await loginViaApi(request, baseURL, {
		email: 'martin@test.cz',
		password: ['password', '123'].join(''),
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.goto('/w/xmas2026', { waitUntil: 'domcontentloaded' });
	await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();
	await waitForAppHydration(page);
	await installDropdownTransitionSampler(page);
}

async function openDisplayRoot(page: Parameters<typeof waitForAppHydration>[0]) {
	const trigger = page.getByTestId('desktop-display-trigger').filter({ visible: true });
	await trigger.click();
	return { trigger, root: await visibleDropdownRoot(page) };
}

async function expectNoDropdownPortals(page: Parameters<typeof waitForAppHydration>[0]) {
	await expect(page.locator(DROPDOWN_LAYER_SELECTOR)).toHaveCount(0);
}

test.describe('issue #378 desktop dropdown transitions', () => {
	test.beforeEach(async ({ page, request, baseURL }) => {
		await page.setViewportSize({ width: 1100, height: 700 });
		await openSeedWishlist(page, request, baseURL!);
	});

	test('repeated pointer travel between Sort, Grouping, and Filter never restores an outgoing submenu', async ({
		page,
	}) => {
		const { root } = await openDisplayRoot(page);
		await hoverDisplaySubmenu(root, /Řadit podle/);
		await resetDropdownTransitionSamples(page);

		let latestSubmenu: Awaited<ReturnType<typeof hoverDisplaySubmenu>> | null = null;
		for (const name of [/Seskupení/, /Filtrovat/, /Řadit podle/, /Seskupení/, /Filtrovat/]) {
			latestSubmenu = await hoverDisplaySubmenu(root, name);
		}
		if (latestSubmenu === null) {
			throw new Error('Expected at least one submenu');
		}
		const intendedChild = latestSubmenu
			.locator('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
			.first();
		await intendedChild.hover();
		await expect(root).toHaveAttribute('data-state', 'open');
		await expect(intendedChild).toBeVisible();
		expect(await intendedChild.evaluate((element) => element.matches(':hover'))).toBe(true);

		await expectClosedLayersKeepTheirExitEndpoint(page, [SUBMENU_SLOT]);
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-slot="dropdown-menu-sub-content"]')).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expectNoDropdownPortals(page);
	});

	test('outside dismissal keeps a root-only dropdown at its exit endpoint until unmount', async ({
		page,
	}) => {
		const { root } = await openDisplayRoot(page);
		await root.evaluate(async (element) => {
			await Promise.all(
				element
					.getAnimations({ subtree: true })
					.map((animation) => animation.finished.catch(() => undefined)),
			);
		});
		await resetDropdownTransitionSamples(page);
		await page.mouse.click(4, 4);

		await expectClosedLayersKeepTheirExitEndpoint(page, [ROOT_SLOT]);
		await expectNoDropdownPortals(page);
	});

	test('outside dismissal keeps both nested dropdown layers at their exit endpoints until unmount', async ({
		page,
	}) => {
		const { root } = await openDisplayRoot(page);
		await hoverDisplaySubmenu(root, /Filtrovat/);
		await resetDropdownTransitionSamples(page);
		await page.mouse.click(4, 4);

		await expectClosedLayersKeepTheirExitEndpoint(page, [ROOT_SLOT, SUBMENU_SLOT]);
		await expectNoDropdownPortals(page);
	});

	test('rapid pointer switching leaves only the latest submenu interactive and leaks no portal', async ({
		page,
	}) => {
		const { trigger, root } = await openDisplayRoot(page);
		for (const name of [/Řadit podle/, /Seskupení/, /Filtrovat/]) {
			await hoverDisplaySubmenu(root, name);
		}

		const visibleSubmenu = page.locator('[data-slot="dropdown-menu-sub-content"]:visible');
		await expect(visibleSubmenu).toHaveCount(1);
		await expect(root.getByRole('menuitem', { name: /Filtrovat/ })).toHaveAttribute(
			'aria-expanded',
			'true',
		);
		await expect
			.poll(() =>
				visibleSubmenu.evaluate((element) => getComputedStyle(element).pointerEvents),
			)
			.toBe('auto');
		await page.mouse.click(4, 4);
		await expect(trigger).not.toHaveAttribute('data-state', 'open');
		await expectNoDropdownPortals(page);
	});

	test('keyboard sibling switching keeps the final submenu usable without destabilizing the root', async ({
		page,
	}) => {
		const { root } = await openDisplayRoot(page);
		const siblingNames = [/Řadit podle/, /Seskupení/, /Filtrovat/];
		await root.getByRole('menuitem', { name: siblingNames[0] }).focus();
		await resetDropdownTransitionSamples(page);

		for (const [index, name] of siblingNames.entries()) {
			const siblingTrigger = root.getByRole('menuitem', { name });
			await expect(siblingTrigger).toBeFocused();
			await page.keyboard.press('ArrowRight');
			const controlledId = await siblingTrigger.getAttribute('aria-controls');
			expect(controlledId).not.toBeNull();
			const submenu = page.locator(`[id=${JSON.stringify(controlledId)}]`);
			const focusedChild = submenu.locator(':focus');
			await expect(focusedChild).toBeVisible();
			await expect
				.poll(() => submenu.evaluate((element) => getComputedStyle(element).pointerEvents))
				.toBe('auto');
			await expect(root).toHaveAttribute('data-state', 'open');

			if (index < siblingNames.length - 1) {
				await page.keyboard.press('ArrowLeft');
				await expect(siblingTrigger).toBeFocused();
				await expect(submenu).toHaveCount(0);
				await page.keyboard.press('ArrowDown');
			}
		}

		await expectClosedLayersKeepTheirExitEndpoint(page, [SUBMENU_SLOT]);
		await expect(root).toHaveAttribute('data-state', 'open');
		await expect(root).toHaveCSS('opacity', '1');
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-slot="dropdown-menu-sub-content"]')).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expectNoDropdownPortals(page);
	});

	test('keyboard Escape returns focus through the submenu and root without a final-frame flash', async ({
		page,
	}) => {
		const trigger = page.getByTestId('desktop-display-trigger').filter({ visible: true });
		const submenu = await openDesktopDisplaySubmenu(page, /Seskupení/);
		const subTriggerId = await submenu.getAttribute('aria-labelledby');
		const subTrigger =
			subTriggerId !== null && subTriggerId.length > 0
				? page.locator(`[id=${JSON.stringify(subTriggerId)}]`)
				: page.getByRole('menuitem', { name: /Seskupení/ });
		await resetDropdownTransitionSamples(page);

		await page.keyboard.press('Escape');
		await expect(subTrigger).toBeFocused();
		await expect(page.locator('[data-slot="dropdown-menu-sub-content"]')).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(trigger).toBeFocused();
		await expectClosedLayersKeepTheirExitEndpoint(page, [ROOT_SLOT, SUBMENU_SLOT]);
		await expectNoDropdownPortals(page);
	});

	test('reduced motion closes nested dropdowns immediately while preserving focus cleanup', async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const trigger = page.getByTestId('desktop-display-trigger').filter({ visible: true });
		const submenu = await openDesktopDisplaySubmenu(page, /Filtrovat/);
		await expect
			.poll(() => submenu.evaluate((element) => getComputedStyle(element).animationName))
			.toBe('none');

		await page.keyboard.press('Escape');
		await expect(page.getByRole('menuitem', { name: /Filtrovat/ })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(trigger).toBeFocused();
		await expectNoDropdownPortals(page);
	});
});
