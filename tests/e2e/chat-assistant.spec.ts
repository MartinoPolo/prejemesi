import { expect, test, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';
import { addGift, createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

// Playwright runs the fake chat provider with martin@test.cz on the family allowlist.
const GIFT_NAME = 'Kniha Duna';
const ENRICHMENT_TEXT = 'Hodnocení zákazníků: 4,6 z 5 (ukázka).';

async function loginAsMartin(
	page: Page,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
) {
	const cookies = await loginViaApi(request, baseURL, {
		email: 'martin@test.cz',
		password: ['password', '123'].join(''),
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.goto('/my-lists', { waitUntil: 'domcontentloaded' });
	await waitForAppHydration(page);
}

test.describe('AI assistant on a wishlist (issue #478)', () => {
	test('enriches a gift from its menu and applies the proposal from the panel', async ({
		page,
		request,
		baseURL,
	}) => {
		await loginAsMartin(page, request, baseURL!);
		await createWishlistAndNavigate(page, `Asistent ${Date.now()}`);
		await addGift(page, GIFT_NAME);

		const giftCard = page.locator('[data-gift-item]').filter({ hasText: GIFT_NAME });
		await giftCard.getByTestId('gift-more-actions').filter({ visible: true }).click();
		await page.getByRole('menuitem', { name: 'Vylepšit pomocí AI' }).click();

		const panel = page.getByTestId('assistant-panel');
		await expect(panel).toBeVisible();
		await expect(panel.getByText(`Vylepšete ${GIFT_NAME}`)).toBeVisible();
		const proposal = panel.getByTestId('chat-proposal');
		await expect(proposal).toBeVisible({ timeout: 15_000 });
		await expect(proposal).toContainText(GIFT_NAME);
		// The newest proposal hands its controls to the decision bar above the composer.
		await panel.getByTestId('chat-proposal-inspect').click();
		await expect(proposal.getByTestId('chat-proposal-row')).toHaveCount(1);

		const banner = page.getByTestId('pending-changes-item');
		await expect(banner).toContainText('1 změna z AI asistenta');

		await panel.getByTestId('chat-proposal-apply').click();
		await expect(proposal.getByTestId('chat-proposal-undo')).toBeVisible();
		await expect(banner).toHaveCount(0);
		await expect(giftCard).toContainText(ENRICHMENT_TEXT);
	});

	test('opens from the floating button, closes on Escape and lists the chat in history', async ({
		page,
		request,
		baseURL,
	}) => {
		await loginAsMartin(page, request, baseURL!);
		await createWishlistAndNavigate(page, `Asistent historie ${Date.now()}`);
		await addGift(page, GIFT_NAME);

		const fab = page.getByTestId('assistant-fab');
		const panel = page.getByTestId('assistant-panel');
		await fab.click();
		await expect(panel).toBeVisible();
		await expect(page.getByTestId('assistant-composer')).toBeFocused();

		await page.getByTestId('assistant-composer').fill(`Vylepšete ${GIFT_NAME}`);
		await page.getByTestId('assistant-send').click();
		await expect(panel.getByTestId('chat-proposal')).toBeVisible({ timeout: 15_000 });

		await page.keyboard.press('Escape');
		await expect(panel).toBeHidden();
		await expect(fab).toBeFocused();

		await fab.click();
		await panel.getByTestId('assistant-history-open').click();
		await expect(panel.getByTestId('assistant-history')).toContainText(GIFT_NAME);
	});
});
