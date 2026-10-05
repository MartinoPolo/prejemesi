import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { test, expect, type BrowserContext } from '@playwright/test';
import {
	waitForAppHydration,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';
import { createTestUser } from './fixtures/test-data.js';
import { DEMO_COOKIE_NAME } from '../../src/lib/server/demo/constants.js';
import { resolveIsolatedDemoTestDatabaseUrl } from '../../src/lib/server/demo/isolated_test_database.js';

// Cleanup must target the application server's database, which in CI is the disposable `local`
// service database. The opt-in never relaxes the rate limit.
const databaseUrl = resolveIsolatedDemoTestDatabaseUrl('DATABASE_URL', {
	allowSharedDevelopmentDatabase: true,
});
const isolatedDatabase = databaseUrl !== null;
test.skip(
	!isolatedDatabase,
	'Set DEMO_TEST_ISOLATED_DATABASE=1 and the server’s local DATABASE_URL',
);
// A serial retry would rerun every demo creation and hit the per-client creation throttle.
test.describe.configure({ mode: 'serial', retries: 0 });

const ownedTokenHashes = new Set<string>();
const ownedRealEmails = new Set<string>();
const suiteStartedAt = new Date();
async function rememberDemoSession(context: BrowserContext) {
	const token = (await context.cookies()).find(
		(cookie) => cookie.name === DEMO_COOKIE_NAME,
	)?.value;
	if (token === undefined || !/^[a-f0-9]{64}$/.test(token)) {
		throw new Error('Demo cookie was not issued');
	}
	ownedTokenHashes.add(createHash('sha256').update(token).digest('hex'));
}

test.afterAll(async () => {
	if (databaseUrl === null || (ownedTokenHashes.size === 0 && ownedRealEmails.size === 0)) {
		return;
	}
	const database = postgres(databaseUrl, { max: 1, connect_timeout: 5 });
	try {
		const hashes = [...ownedTokenHashes];
		let ownedSessions: { client_hash: string }[] = [];
		if (hashes.length > 0) {
			await database`
				delete from reservation where gift_id in (
					select g.id from gift g join wishlist w on w.id = g.wishlist_id
					join demo_session s on s.id = w.demo_session_id
					where s.token_hash in ${database(hashes)}
				)
			`;
			ownedSessions = await database<{ client_hash: string }[]>`
				delete from demo_session where token_hash in ${database(hashes)} returning client_hash
			`;
		}
		const ownedCounts = new Map<string, number>();
		for (const { client_hash } of ownedSessions) {
			ownedCounts.set(client_hash, (ownedCounts.get(client_hash) ?? 0) + 1);
		}
		for (const [clientHash, count] of ownedCounts) {
			await database`
				delete from demo_client_throttle
				where client_hash = ${clientHash} and creations = ${count}
				and window_started_at >= ${suiteStartedAt}
				and not exists (select 1 from demo_session where client_hash = ${clientHash})
			`;
		}
		if (ownedRealEmails.size > 0) {
			await database`delete from "user" where email in ${database([...ownedRealEmails])}`;
		}
	} finally {
		await database.end();
	}
});

const desktop = { width: 1280, height: 800 };
const mobile = { width: 390, height: 844 };

for (const locale of ['cs', 'en'] as const) {
	test(`landing entry and playground lifecycle in ${locale}`, async ({ page }) => {
		const english = locale === 'en';
		if (!english) {
			await page.clock.install();
		}
		await page.setViewportSize(desktop);
		await page.goto(english ? '/en' : '/');
		await waitForAppHydration(page);
		await expect(page.getByTestId('landing-demo')).toBeVisible();
		await expect(page.getByTestId('landing-demo-pane-gifter')).toBeAttached();
		await expect(
			page.locator(`a[href$="${english ? '/en/register' : '/register'}"]`).first(),
		).toBeVisible();
		const heroEntry = page.getByRole('button', {
			name: english ? 'Try demo' : 'Vyzkoušet demo',
			exact: true,
		});
		const exampleEntry = page.getByRole('button', {
			name: english ? 'Try the full demo' : 'Vyzkoušet celé demo',
		});
		await expect(heroEntry).toBeVisible();
		await expect(exampleEntry).toBeVisible();
		await page.setViewportSize(mobile);
		await expect(page.getByTestId('landing-demo')).toBeVisible();
		await expect(heroEntry).toBeVisible();
		await expect(exampleEntry).toBeVisible();

		// A rejected start stays on the landing page and can be retried; only the retry creates a session.
		const entry = english ? exampleEntry : heroEntry;
		await page.route('**/demo/start', async (route) => {
			await route.fulfill({ status: 503, body: 'Unavailable' });
		});
		await entry.click();
		await expect(entry.locator('..').getByRole('alert')).toBeVisible();
		await page.unroute('**/demo/start');
		await entry.click();
		await expect(page).toHaveURL(/\/home$/);
		await waitForAppHydration(page);
		await rememberDemoSession(page.context());
		const notice = page.getByTestId('demo-notice');
		await expect(notice).toContainText(english ? 'left' : 'zbývá');
		await expect(page.getByTestId('home-shelf').first()).toBeVisible();
		await expect(notice).toBeVisible();
		for (const action of english
			? ['Reset', 'Exit', 'Register']
			: ['Obnovit', 'Odejít', 'Registrovat se']) {
			await expect(notice.getByRole('button', { name: action, exact: true })).toBeVisible();
		}
		await page.setViewportSize(desktop);
		await expect(notice).toBeVisible();

		// An ordinary new list is private and survives a reload; cancelling Reset preserves it.
		await page
			.getByRole('button', { name: english ? /create/i : /vytvořit/i })
			.first()
			.click();
		await page.locator('#wishlist-title').fill(`Demo test ${locale}`);
		await page
			.getByRole('dialog')
			.getByRole('button', { name: english ? /create/i : /vytvořit/i })
			.last()
			.click();
		await expect(page).toHaveURL(/\/w\//);
		await expect(page.getByRole('heading', { name: `Demo test ${locale}` })).toBeVisible();
		await page.reload();
		await waitForAppHydration(page);
		await expect(page.getByRole('heading', { name: `Demo test ${locale}` })).toBeVisible();
		if (english) {
			const wishlistPath = new URL(page.url()).pathname;
			await page.goto('/en/settings');
			await waitForAppHydration(page);
			await page
				.getByRole('group', { name: 'Language' })
				.getByRole('button', { name: 'Čeština' })
				.click();
			await expect(page).toHaveURL(/\/settings$/);
			await page.goto(wishlistPath.replace('/en/w/', '/w/'));
			await expect(page.getByRole('heading', { name: `Demo test ${locale}` })).toBeVisible();
			await page.goto('/my-lists');
			await expect(page.getByRole('link', { name: 'Little everyday joys' })).toBeVisible();
			await page.goto('/settings');
			await waitForAppHydration(page);
			await page
				.getByRole('group', { name: 'Jazyk' })
				.getByRole('button', { name: 'English' })
				.click();
			await expect(page).toHaveURL(/\/en\/settings$/);
			await page.goto(wishlistPath);
			await waitForAppHydration(page);
		}
		await notice.getByRole('button', { name: english ? 'Reset' : 'Obnovit' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText(english ? 'edits' : 'úpravy');
		await dialog.getByRole('button', { name: english ? 'Cancel' : 'Zrušit' }).click();
		await expect(page.getByRole('heading', { name: `Demo test ${locale}` })).toBeVisible();

		await notice.getByRole('button', { name: english ? 'Reset' : 'Obnovit' }).click();
		if (english) {
			await dialog.getByRole('button', { name: 'Sample content language' }).click();
			await page.getByRole('option', { name: 'Čeština' }).click();
		}
		let failedOnce = false;
		await page.route('**/demo/reset', async (route) => {
			if (route.request().method() === 'POST' && !failedOnce) {
				failedOnce = true;
				await route.fulfill({ status: 503, body: 'Unavailable' });
			} else {
				await route.continue();
			}
		});
		const confirm = dialog.getByRole('button', {
			name: english ? 'Reset demo' : 'Obnovit demo',
		});
		await confirm.click();
		await expect(dialog.getByRole('alert')).toContainText(english ? 'retry' : 'Zkuste');
		await expect(page.getByRole('heading', { name: `Demo test ${locale}` })).toBeVisible();
		await confirm.click();
		await expect(page).toHaveURL(english ? /\/en\/home$/ : /\/home$/);
		await expect(page.getByRole('heading', { name: `Demo test ${locale}` })).toHaveCount(0);
		await page.unroute('**/demo/reset');
		await page.goto(english ? '/en/my-lists' : '/my-lists');
		await expect(page.getByRole('link', { name: 'Malé radosti' })).toBeVisible();
		if (english) {
			// The Czech sample catalog stays Czech under the English interface.
			await expect(page.getByRole('heading', { name: 'My lists' })).toBeVisible();
			await page.getByRole('link', { name: 'Malé radosti' }).first().click();
			await expect(page).toHaveURL(/\/en\/w\//);
			await expect(page.getByText('Keramická konvička').first()).toBeVisible();
			await expect(page.getByText('Ceramic teapot')).toHaveCount(0);
		}
		await page.goto(english ? '/en' : '/');
		await expect(page).toHaveURL(english ? /\/en\/home$/ : /\/home$/);
		await waitForAppHydration(page);

		if (english) {
			await notice.getByRole('button', { name: 'Register' }).click();
			await expect(page.getByRole('dialog')).toContainText('will not transfer');
			await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
			await notice.getByRole('button', { name: 'Register' }).click();
			await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click();
			await expect(page).toHaveURL(/\/en\/register$/);
			await expect(
				page
					.context()
					.cookies()
					.then((cookies) => cookies.map((cookie) => cookie.name)),
			).resolves.not.toContain(DEMO_COOKIE_NAME);
			await page.goto('/en/home');
			await expect(notice).toHaveCount(0);
		} else {
			await page.clock.fastForward(24 * 60 * 60 * 1000 + 60_000);
			await expect(page.getByTestId('demo-expired')).toBeVisible();
			await expect(
				page.getByRole('heading', { name: 'Platnost dema skončila' }),
			).toBeFocused();
			await expect(page.locator('.topbar')).toHaveCount(0);
			await expect(page.locator('.app-content')).toHaveCount(0);
			await page.getByTestId('demo-expired').getByRole('button', { name: 'Odejít' }).click();
			await expect(page).toHaveURL(/\/$/);
		}
	});
}

test('exit restores the independently signed-in real session', async ({
	browser,
	request,
	baseURL,
}) => {
	if (baseURL === undefined || baseURL === '') {
		throw new Error('Playwright baseURL is required');
	}
	const realUser = createTestUser('demo-real-session');
	ownedRealEmails.add(realUser.email);
	const realCookies = await registerViaApi(request, baseURL, realUser);
	const context = await createAuthenticatedContext(browser, realCookies, baseURL);
	try {
		const page = await context.newPage();
		await page.goto('/home');
		await expect(page.getByTestId('demo-notice')).toHaveCount(0);
		const start = await context.request.post('/demo/start', {
			form: { locale: 'cs' },
			headers: { Origin: baseURL },
		});
		expect(start.ok()).toBe(true);
		await rememberDemoSession(context);
		await page.goto('/home');
		await waitForAppHydration(page);
		await expect(page.getByTestId('demo-notice')).toBeVisible();
		await expect(page.getByTestId('home-shelf').first()).toBeVisible();
		await page.getByTestId('demo-notice').getByRole('button', { name: 'Odejít' }).click();
		await expect(page).toHaveURL(/\/home$/);
		await expect(page.getByTestId('demo-notice')).toHaveCount(0);
		await waitForAppHydration(page);
		await page.getByRole('button', { name: new RegExp(realUser.name) }).click();
		await expect(page.getByText(realUser.email)).toBeVisible();
	} finally {
		await context.close();
	}
});
