import {
	test,
	expect,
	type APIRequestContext,
	type BrowserContext,
	type Page,
} from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { createTestUser } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';

type TestUser = ReturnType<typeof createTestUser>;

const APP_NAME = 'E2E Connector';
const REDIRECT_URI = 'https://connector.example/oauth/callback';

interface AuthorizationRequest {
	clientId: string;
	verifier: string;
	state: string;
	url: string;
}

async function startAuthorization(
	request: APIRequestContext,
	baseURL: string,
): Promise<AuthorizationRequest> {
	const registration = await request.post(`${baseURL}/api/auth/oauth2/register`, {
		data: {
			client_name: APP_NAME,
			redirect_uris: [REDIRECT_URI],
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
		},
	});
	expect(registration.ok()).toBe(true);
	const { client_id: clientId } = (await registration.json()) as { client_id: string };
	const verifier = randomBytes(32).toString('base64url');
	const state = randomBytes(12).toString('base64url');
	const url = new URL(`${baseURL}/api/auth/oauth2/authorize`);
	url.search = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		scope: 'read gifts:write offline_access',
		state,
		code_challenge: createHash('sha256').update(verifier).digest('base64url'),
		code_challenge_method: 'S256',
		resource: `${baseURL}/mcp`,
	}).toString();
	return { clientId, verifier, state, url: url.href };
}

/** Captures where the consent answer sends the browser, without leaving the test origin. */
async function captureAppRedirect(context: BrowserContext): Promise<() => URL | null> {
	let appRedirect: URL | null = null;
	await context.route('**/oauth/consent?/*', async (route) => {
		const response = await route.fetch({ maxRedirects: 0 });
		const location = response.headers().location ?? '';
		if (location.startsWith(REDIRECT_URI)) {
			appRedirect = new URL(location);
			await route.fulfill({
				status: 200,
				contentType: 'text/plain',
				body: 'returned to app',
			});
			return;
		}
		await route.fulfill({ response });
	});
	return () => appRedirect;
}

/** Signs in on the page the app's authorization sent a signed-out visitor to. */
async function signInFromAuthorization(page: Page, user: TestUser) {
	await waitForAppHydration(page);
	await page.locator('#login-email').fill(user.email);
	await page.locator('#login-password').fill(user.password);
	await page.locator('button[type="submit"]').first().click();
}

async function listWishlistsStatus(request: APIRequestContext, baseURL: string, token: string) {
	const response = await request.post(`${baseURL}/mcp`, {
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/json, text/event-stream',
		},
		data: {
			jsonrpc: '2.0',
			id: 1,
			method: 'tools/call',
			params: { name: 'listWishlists', arguments: {} },
		},
	});
	return response.status();
}

test.describe('connecting an app through OAuth consent', () => {
	test('consents, calls a tool, and stops working once disconnected in Settings', async ({
		browser,
		playwright,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('oauth-consent'),
		);
		// The app registers and calls from its own backend, without the user's cookies.
		const app = await playwright.request.newContext();
		const appRedirect = await captureAppRedirect(page.context());
		const authorization = await startAuthorization(app, baseURL!);

		await page.goto(authorization.url);
		await page.waitForURL(/\/oauth\/consent\?/);
		await waitForAppHydration(page);
		await expect(page.getByRole('heading', { name: `Propojit ${APP_NAME}?` })).toBeVisible();
		await expect(page.getByText('Název si aplikace uvedla sama, není ověřený.')).toBeVisible();
		await expect(page.getByText('Potom se vrátíte na connector.example.')).toBeVisible();
		await expect(page.getByRole('checkbox', { name: /Čtení/ })).toBeDisabled();
		await expect(page.getByRole('checkbox', { name: /Úpravy dárků/ })).toBeChecked();
		await expect(page.getByRole('checkbox', { name: /^Rezervace/ })).toHaveCount(0);

		await page.getByRole('button', { name: 'Povolit přístup' }).click();
		await expect(page.getByText('returned to app')).toBeVisible();
		const callback = appRedirect();
		expect(callback?.searchParams.get('state')).toBe(authorization.state);
		const code = callback?.searchParams.get('code');
		expect(code).toBeTruthy();

		const tokenResponse = await app.post(`${baseURL}/api/auth/oauth2/token`, {
			form: {
				grant_type: 'authorization_code',
				code: code!,
				redirect_uri: REDIRECT_URI,
				client_id: authorization.clientId,
				code_verifier: authorization.verifier,
				resource: `${baseURL}/mcp`,
			},
		});
		expect(tokenResponse.ok()).toBe(true);
		const tokens = (await tokenResponse.json()) as { access_token: string; scope: string };
		expect(tokens.scope.split(' ').sort()).toEqual(['gifts:write', 'offline_access', 'read']);
		expect(await listWishlistsStatus(app, baseURL!, tokens.access_token)).toBe(200);

		await page.goto('/settings');
		await waitForAppHydration(page);
		const section = page.getByTestId('settings-access-section');
		const row = section.getByTestId('connected-app-row').filter({ hasText: APP_NAME });
		await expect(row).toContainText('Čte a upravuje dárky na všech seznamech');
		await row.getByRole('button', { name: `Odpojit aplikaci ${APP_NAME}` }).click();
		await page
			.getByTestId('access-token-revoke-dialog')
			.getByRole('button', { name: 'Odpojit aplikaci', exact: true })
			.click();
		await expect(row).toHaveCount(0);

		// The access token has not expired, yet the next call already fails.
		expect(await listWishlistsStatus(app, baseURL!, tokens.access_token)).toBe(401);
		await app.dispose();
	});

	test('a signed-out visitor signs in from the app and continues to consent', async ({
		browser,
		playwright,
		request,
		baseURL,
	}) => {
		const user = createTestUser('oauth-sign-in');
		await registerViaApi(request, baseURL!, user);
		const context = await browser.newContext();
		const page = await context.newPage();
		const app = await playwright.request.newContext();
		const appRedirect = await captureAppRedirect(context);
		const authorization = await startAuthorization(app, baseURL!);

		await page.goto(authorization.url);
		await page.waitForURL(/\/login\?/);
		await signInFromAuthorization(page, user);
		await page.waitForURL(/\/oauth\/consent\?/);
		expect(new URL(page.url()).pathname).toBe('/oauth/consent');
		await waitForAppHydration(page);
		await expect(page.getByRole('heading', { name: `Propojit ${APP_NAME}?` })).toBeVisible();
		await page.getByRole('button', { name: 'Povolit přístup' }).click();
		await expect(page.getByText('returned to app')).toBeVisible();
		expect(appRedirect()?.searchParams.get('code')).toBeTruthy();
		expect(appRedirect()?.searchParams.get('state')).toBe(authorization.state);

		await app.dispose();
		await context.close();
	});

	test('an English visitor signs in and consents in English', async ({
		browser,
		playwright,
		request,
		baseURL,
	}) => {
		const user = createTestUser('oauth-english');
		await registerViaApi(request, baseURL!, user);
		const context = await browser.newContext();
		// The language a visitor chose earlier, as the language switch remembers it.
		await context.addCookies([{ name: 'PARAGLIDE_LOCALE', value: 'en', url: baseURL! }]);
		const page = await context.newPage();
		const app = await playwright.request.newContext();
		await captureAppRedirect(context);
		const authorization = await startAuthorization(app, baseURL!);

		await page.goto(authorization.url);
		await page.waitForURL(/\/en\/login\?/);
		await signInFromAuthorization(page, user);
		await page.waitForURL(/\/en\/oauth\/consent\?/);
		await waitForAppHydration(page);
		await expect(page.getByRole('heading', { name: `Connect ${APP_NAME}?` })).toBeVisible();

		await app.dispose();
		await context.close();
	});

	test('denying returns access_denied to the app and connects nothing', async ({
		browser,
		playwright,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('oauth-deny'),
		);
		// The app registers and calls from its own backend, without the user's cookies.
		const app = await playwright.request.newContext();
		const appRedirect = await captureAppRedirect(page.context());
		const authorization = await startAuthorization(app, baseURL!);

		await page.goto(authorization.url);
		await page.waitForURL(/\/oauth\/consent\?/);
		await waitForAppHydration(page);
		await page.getByRole('button', { name: 'Zamítnout' }).click();
		await expect(page.getByText('returned to app')).toBeVisible();
		expect(appRedirect()?.searchParams.get('error')).toBe('access_denied');
		expect(appRedirect()?.searchParams.get('state')).toBe(authorization.state);

		await page.goto('/settings');
		await waitForAppHydration(page);
		await expect(page.getByTestId('connected-app-row')).toHaveCount(0);
		await app.dispose();
	});
});
