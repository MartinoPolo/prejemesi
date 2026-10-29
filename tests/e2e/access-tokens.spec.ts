import { test, expect, type APIRequestContext } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage, waitForAppHydration } from './fixtures/auth-helpers.js';

const TOKEN_NAME = 'E2E agent';

async function agentStatus(request: APIRequestContext, baseURL: string, tokenValue: string) {
	const response = await request.get(`${baseURL}/api/v1/me`, {
		headers: { Authorization: `Bearer ${tokenValue}` },
	});
	return response.status();
}

test.describe('access token settings', () => {
	test('creates, copies, regenerates and revokes a token', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('access-tokens'),
		);
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
			origin: baseURL!,
		});
		await page.goto('/settings');
		await waitForAppHydration(page);

		const section = page.getByTestId('settings-access-section');
		await expect(section.getByText('Zatím nemáte žádný token.')).toBeVisible();

		await section.getByRole('button', { name: 'Vytvořit token' }).click();
		const tokenDialog = page.getByTestId('access-token-dialog');
		await tokenDialog.getByLabel('Název').fill(TOKEN_NAME);
		await tokenDialog.getByRole('button', { name: 'Pokračovat' }).click();
		await tokenDialog.getByRole('checkbox', { name: /Úpravy dárků/ }).check();
		await tokenDialog.getByRole('button', { name: 'Vytvořit token' }).click();

		await expect(
			tokenDialog.getByRole('heading', { name: 'Token je připraven' }),
		).toBeVisible();
		await expect(tokenDialog.getByRole('alert')).toContainText('Token uvidíte jen teď');
		const createdValue = await tokenDialog.getByLabel('Váš token').inputValue();
		expect(createdValue).toMatch(/^pjs_/);

		await tokenDialog.getByRole('button', { name: 'Kopírovat' }).click();
		await expect(tokenDialog.getByRole('button', { name: 'Zkopírováno' })).toBeVisible();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(createdValue);

		// A copied value closes without the unsaved-token guard.
		await tokenDialog.getByRole('button', { name: 'Hotovo' }).click();
		await expect(tokenDialog).toBeHidden();
		await expect(page.getByTestId('access-token-close-guard')).toBeHidden();

		const row = section.getByTestId('access-grant-row').filter({ hasText: TOKEN_NAME });
		await expect(row).toContainText('Čte a upravuje dárky na všech seznamech');
		expect(await agentStatus(request, baseURL!, createdValue)).toBe(200);

		await row.getByRole('button', { name: `Vygenerovat znovu token ${TOKEN_NAME}` }).click();
		const regenerateDialog = page.getByTestId('token-regenerate-dialog');
		await expect(regenerateDialog.locator('[data-slot="select-trigger"]')).toHaveText('1 rok');
		await regenerateDialog.getByRole('button', { name: 'Vygenerovat znovu' }).click();

		await expect(
			tokenDialog.getByRole('heading', { name: 'Nový token je připraven' }),
		).toBeVisible();
		const regeneratedValue = await tokenDialog.getByLabel('Váš token').inputValue();
		expect(regeneratedValue).not.toBe(createdValue);
		expect(await agentStatus(request, baseURL!, createdValue)).toBe(401);
		expect(await agentStatus(request, baseURL!, regeneratedValue)).toBe(200);

		// Closing without copying asks first, because the value is never shown again.
		await tokenDialog.getByRole('button', { name: 'Hotovo' }).click();
		const closeGuard = page.getByTestId('access-token-close-guard');
		await expect(closeGuard).toBeVisible();
		await closeGuard.getByRole('button', { name: 'Přesto zavřít' }).click();
		await expect(tokenDialog).toBeHidden();

		await row.getByRole('button', { name: `Zrušit token ${TOKEN_NAME}` }).click();
		const revokeDialog = page.getByTestId('access-token-revoke-dialog');
		await revokeDialog.getByRole('button', { name: 'Zrušit token' }).click();
		await expect(row).toBeHidden();
		await expect(section.getByText('Zatím nemáte žádný token.')).toBeVisible();
		expect(await agentStatus(request, baseURL!, regeneratedValue)).toBe(401);
	});
});
