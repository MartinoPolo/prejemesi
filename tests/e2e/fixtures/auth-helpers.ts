import type { Page, BrowserContext, Browser, APIRequestContext } from '@playwright/test';

interface TestUser {
	name: string;
	email: string;
	password: string;
}

export async function registerViaApi(
	request: APIRequestContext,
	baseURL: string,
	user: TestUser,
): Promise<string[]> {
	const response = await request.post(`${baseURL}/api/auth/sign-up/email`, {
		// better-auth rejects state-changing requests without an Origin header
		// (MISSING_OR_NULL_ORIGIN); Playwright's APIRequestContext omits it by default.
		headers: { Origin: baseURL, 'x-captcha-response': 'XXXX.DUMMY.TOKEN.XXXX' },
		data: { name: user.name, email: user.email, password: user.password },
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(`Registration failed (${response.status()}): ${body}`);
	}

	const allHeaders = response.headersArray();
	const cookies = allHeaders.filter((h) => h.name === 'set-cookie').map((h) => h.value);
	if (cookies.length === 0) {
		throw new Error('No session cookie returned from registration');
	}
	return cookies;
}

export async function loginViaApi(
	request: APIRequestContext,
	baseURL: string,
	user: Pick<TestUser, 'email' | 'password'>,
): Promise<string[]> {
	const response = await request.post(`${baseURL}/api/auth/sign-in/email`, {
		headers: { Origin: baseURL, 'x-captcha-response': 'XXXX.DUMMY.TOKEN.XXXX' },
		data: { email: user.email, password: user.password },
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(`Login failed (${response.status()}): ${body}`);
	}

	const allHeaders = response.headersArray();
	const cookies = allHeaders.filter((h) => h.name === 'set-cookie').map((h) => h.value);
	if (cookies.length === 0) {
		throw new Error('No session cookie returned from login');
	}
	return cookies;
}

function parseCookiesForContext(rawCookies: string[], baseURL: string) {
	const url = new URL(baseURL);
	return rawCookies.map((raw) => {
		const [nameValue] = raw.split(';');
		const eqIdx = nameValue!.indexOf('=');
		return {
			name: nameValue!.slice(0, eqIdx).trim(),
			value: decodeURIComponent(nameValue!.slice(eqIdx + 1).trim()),
			domain: url.hostname,
			path: '/',
		};
	});
}

export async function createAuthenticatedContext(
	browser: Browser,
	rawCookies: string[],
	baseURL: string,
): Promise<BrowserContext> {
	const cookies = parseCookiesForContext(rawCookies, baseURL);
	const context = await browser.newContext();
	await context.addCookies(cookies);
	return context;
}

export async function registerAndGetPage(
	browser: Browser,
	request: APIRequestContext,
	baseURL: string,
	user: TestUser,
): Promise<Page> {
	const cookies = await registerViaApi(request, baseURL, user);
	const context = await createAuthenticatedContext(browser, cookies, baseURL);
	return context.newPage();
}
