import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage, waitForAppHydration } from './fixtures/auth-helpers.js';
import { addGift, createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

const NEW_GIFT = 'Stolní hra Azul';
const EDITED_GIFT = 'Kniha Duna';
const RENAMED_GIFT = 'Kniha Duna (brožovaná)';
const DELETED_GIFT = 'Lego Titanic';

async function createGiftsToken(page: Page): Promise<string> {
	await page.goto('/settings');
	await waitForAppHydration(page);
	await page
		.getByTestId('settings-access-section')
		.getByRole('button', { name: 'Vytvořit token' })
		.click();
	const tokenDialog = page.getByTestId('access-token-dialog');
	await tokenDialog.getByLabel('Název').fill('E2E review agent');
	await tokenDialog.getByRole('button', { name: 'Pokračovat' }).click();
	await tokenDialog.getByRole('checkbox', { name: /Úpravy dárků/ }).check();
	await tokenDialog.getByRole('button', { name: 'Vytvořit token' }).click();
	const tokenValue = await tokenDialog.getByLabel('Váš token').inputValue();
	await tokenDialog.getByRole('button', { name: 'Hotovo' }).click();
	await page
		.getByTestId('access-token-close-guard')
		.getByRole('button', { name: 'Přesto zavřít' })
		.click();
	await expect(tokenDialog).toBeHidden();
	return tokenValue;
}

async function agentPost<Response>(
	request: APIRequestContext,
	url: string,
	tokenValue: string,
	data: unknown,
): Promise<Response> {
	const response = await request.post(url, {
		headers: { Authorization: `Bearer ${tokenValue}` },
		data,
	});
	expect(response.ok(), await response.text()).toBe(true);
	return response.json();
}

async function proposeChanges(
	request: APIRequestContext,
	baseURL: string,
	tokenValue: string,
	wishlistShortId: string,
): Promise<void> {
	const wishlist = await agentPost<{ result: { id: string } }>(
		request,
		`${baseURL}/api/v1/operations/readWishlist`,
		tokenValue,
		{ wishlistShortId },
	);
	const giftList = await agentPost<{ result: { gifts: { id: string; name: string }[] } }>(
		request,
		`${baseURL}/api/v1/operations/readWishlistGifts`,
		tokenValue,
		{ wishlistShortId },
	);
	const wishlistId = wishlist.result.id;
	const gifts = giftList.result.gifts;
	const giftId = (name: string) => gifts.find((gift) => gift.name === name)!.id;

	await agentPost<unknown>(request, `${baseURL}/api/v1/proposals`, tokenValue, {
		wishlistShortId,
		operations: [
			{ operation: 'createGift', input: { wishlistId, name: NEW_GIFT } },
			{ operation: 'updateGift', input: { id: giftId(EDITED_GIFT), name: RENAMED_GIFT } },
			{ operation: 'deleteGift', input: { giftId: giftId(DELETED_GIFT) } },
		],
	});
}

test.describe('agent change review', () => {
	test('reviews, applies and undoes an agent proposal from the pending banner', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('change-review'),
		);
		const wishlistPath = await createWishlistAndNavigate(page, 'Návrhy agenta');
		const wishlistShortId = wishlistPath.split('/').at(-1)!;
		await addGift(page, EDITED_GIFT);
		await addGift(page, DELETED_GIFT);

		const tokenValue = await createGiftsToken(page);
		await proposeChanges(request, baseURL!, tokenValue, wishlistShortId);

		await page.goto(wishlistPath);
		const banner = page.getByTestId('pending-changes-banner');
		await expect(banner).toContainText('Čekající změny (1)');
		await banner.getByTestId('pending-changes-review').click();

		const review = page.getByTestId('change-review');
		await expect(review).toHaveAttribute('data-state', 'pending');
		await waitForAppHydration(page);
		const row = (text: string) =>
			review.getByTestId('change-row').filter({ hasText: text }).getByRole('checkbox');
		const applyButton = page.getByTestId('change-review-apply');

		// A deletion waits for an explicit tick; the ordinary rows start ticked.
		await expect(row(NEW_GIFT)).toBeChecked();
		await expect(row(RENAMED_GIFT)).toBeChecked();
		await expect(row(DELETED_GIFT)).not.toBeChecked();
		await expect(applyButton).toHaveText('Použít 2 vybrané změny');

		await row(RENAMED_GIFT).click();
		await expect(applyButton).toHaveText('Použít 1 vybranou změnu');
		await row(RENAMED_GIFT).click();
		await expect(applyButton).toHaveText('Použít 2 vybrané změny');

		await applyButton.click();
		const applied = page.getByTestId('change-review-applied');
		await expect(applied).toContainText('Použity 2 změny');
		await expect(review).toHaveAttribute('data-state', 'applied');

		await applied.getByRole('button', { name: 'Vrátit celou dávku' }).click();
		await page
			.getByTestId('change-review-undo-dialog')
			.getByRole('button', { name: 'Vrátit celou dávku' })
			.click();
		await expect(page.getByTestId('change-review-undone')).toBeVisible();
		await expect(review).toHaveAttribute('data-state', 'undone');

		await page.goto(wishlistPath);
		await expect(page.getByRole('heading', { name: EDITED_GIFT, level: 3 })).toBeVisible();
		await expect(page.getByRole('heading', { name: DELETED_GIFT, level: 3 })).toBeVisible();
		await expect(page.getByRole('heading', { name: NEW_GIFT, level: 3 })).toBeHidden();
		await expect(page.getByTestId('pending-changes-banner')).toBeHidden();
	});
});
