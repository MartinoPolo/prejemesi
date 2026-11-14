import { expect, test, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from '../e2e/fixtures/auth-helpers.js';
import { addGift, createWishlistAndNavigate } from '../e2e/fixtures/wishlist-helpers.js';

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

/** Sends a message and waits until its turn has finished with the given number of proposals. */
async function sendAndAwaitProposals(page: Page, text: string, proposalCount: number) {
	const panel = page.getByTestId('assistant-panel');
	await page.getByTestId('assistant-composer').fill(text);
	await page.getByTestId('assistant-send').click();
	await expect(panel.getByTestId('chat-proposal')).toHaveCount(proposalCount, {
		timeout: 15_000,
	});
	await expect(page.getByTestId('assistant-send')).toBeVisible({ timeout: 15_000 });
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

	test('previews proposals on the wishlist while they are decided', async ({
		page,
		request,
		baseURL,
	}) => {
		await loginAsMartin(page, request, baseURL!);
		await createWishlistAndNavigate(page, `Asistent náhled ${Date.now()}`);
		await addGift(page, GIFT_NAME);

		const panel = page.getByTestId('assistant-panel');
		const composer = page.getByTestId('assistant-composer');
		await page.getByTestId('assistant-fab').click();
		await composer.fill('Přidejte Stolní hra Azul');
		await page.getByTestId('assistant-send').click();

		const ghost = page.getByTestId('gift-live-preview-creation');
		await expect(ghost).toContainText('Stolní hra Azul', { timeout: 15_000 });
		await expect(ghost.getByTestId('gift-live-preview-badge')).toContainText('Návrh');

		await composer.fill(`Smažte ${GIFT_NAME}`);
		await page.getByTestId('assistant-send').click();
		const giftCard = page.locator('[data-gift-item]').filter({ hasText: GIFT_NAME });
		const deletionBadge = giftCard.getByTestId('gift-live-preview-badge');
		await expect(deletionBadge).toContainText('Čeká na smazání', { timeout: 15_000 });

		// The decision bar holds the newest proposal; rejecting it keeps the gift.
		await panel
			.getByRole('region', { name: 'Rozhodnutí o návrhu' })
			.getByTestId('chat-proposal-reject-all')
			.click();
		await expect(deletionBadge).toHaveCount(0);
		await expect(ghost).toHaveCount(1);

		await page.keyboard.press('Escape');
		await expect(panel).toBeHidden();
		await expect(ghost).toHaveCount(0);
	});

	test('the decision bar follows the newest pending proposal', async ({
		page,
		request,
		baseURL,
	}) => {
		await loginAsMartin(page, request, baseURL!);
		await createWishlistAndNavigate(page, `Asistent lišta ${Date.now()}`);
		await addGift(page, GIFT_NAME);

		const panel = page.getByTestId('assistant-panel');
		await page.getByTestId('assistant-fab').click();
		await expect(panel).toBeVisible();
		await sendAndAwaitProposals(page, `Vylepšete ${GIFT_NAME}`, 1);
		await sendAndAwaitProposals(page, 'Přidejte Stolní hra Azul', 2);

		const proposals = panel.getByTestId('chat-proposal');
		const olderProposal = proposals.filter({ hasText: GIFT_NAME });
		const newestProposal = proposals.filter({ hasText: 'Stolní hra Azul' });
		const decisionBar = panel.getByRole('region', { name: 'Rozhodnutí o návrhu' });
		const banner = page.getByTestId('pending-changes-item');
		await expect(decisionBar).toBeVisible();
		await expect(newestProposal.getByTestId('chat-proposal-controls')).toHaveCount(0);
		await expect(olderProposal.getByTestId('chat-proposal-controls')).toBeVisible();
		await expect(banner).toHaveCount(2);

		await decisionBar.getByTestId('chat-proposal-reject-all').click();
		const declineButton = decisionBar.getByTestId('chat-proposal-apply');
		await expect(declineButton).toHaveText('Zamítnout návrh');
		await declineButton.click();
		await expect(newestProposal).toContainText('Zamítnuto');

		// The older proposal is still pending, so the bar takes it over from its card.
		await expect(decisionBar).toBeVisible();
		await expect(olderProposal.getByTestId('chat-proposal-controls')).toHaveCount(0);
		await expect(banner).toHaveCount(1);

		await decisionBar.getByTestId('chat-proposal-apply').click();
		await expect(olderProposal.getByTestId('chat-proposal-undo')).toBeVisible();
		await expect(decisionBar).toHaveCount(0);
		await expect(banner).toHaveCount(0);
	});

	test('a deletion needs its own action', async ({ page, request, baseURL }) => {
		await loginAsMartin(page, request, baseURL!);
		await createWishlistAndNavigate(page, `Asistent mazání ${Date.now()}`);
		await addGift(page, GIFT_NAME);

		const panel = page.getByTestId('assistant-panel');
		await page.getByTestId('assistant-fab').click();
		await expect(panel).toBeVisible();
		await sendAndAwaitProposals(page, `Smažte ${GIFT_NAME}`, 1);

		const decisionBar = panel.getByRole('region', { name: 'Rozhodnutí o návrhu' });
		await expect(decisionBar.getByTestId('chat-proposal-reject-all')).toBeVisible();
		await expect(decisionBar.getByTestId('chat-proposal-accept-all')).toHaveCount(0);

		await decisionBar.getByTestId('chat-proposal-inspect').click();
		const row = panel.getByTestId('chat-proposal-row');
		const warning = row.getByText('trvale odstraněn');
		const keep = row.getByRole('button', { name: 'Ponechat', exact: true });
		await expect(warning).toBeVisible();

		await keep.click();
		await expect(warning).toHaveCount(0);

		// Pressing the active choice again clears it, so the deletion is possible again.
		await keep.click();
		await expect(warning).toBeVisible();
	});
});
