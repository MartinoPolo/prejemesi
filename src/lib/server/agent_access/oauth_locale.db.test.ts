import {
	DB_READY,
	RECIPIENT_ID,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { oauthPageLocaleHref } from './oauth_locale.js';

const AUTHORIZATION_QUERY = '?client_id=app&scope=read&exp=1&sig=signed';

function oauthPageEvent(
	path: string,
	{
		signedIn = false,
		demo = false,
		localeCookie,
	}: { signedIn?: boolean; demo?: boolean; localeCookie?: string } = {},
): RequestEvent {
	return {
		url: new URL(`https://prejemesi.cz${path}${AUTHORIZATION_QUERY}`),
		locals: {
			...(signedIn ? { user: { id: RECIPIENT_ID }, session: { userId: RECIPIENT_ID } } : {}),
			...(demo ? { demoSession: { id: 'demo', expiresAt: new Date() } } : {}),
		},
		cookies: {
			get: (name: string) => (name === 'PARAGLIDE_LOCALE' ? localeCookie : undefined),
		},
		platform: undefined,
	} as unknown as RequestEvent;
}

async function preferLocale(locale: 'cs' | 'en' | null) {
	await getDb().update(user).set({ preferredLocale: locale }).where(eq(user.id, RECIPIENT_ID));
}

describe.skipIf(!DB_READY)('OAuth sign-in and consent locale', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('moves an English account from the Czech consent page to the English one, keeping the signed query', async () => {
		await preferLocale('en');

		await expect(
			oauthPageLocaleHref(oauthPageEvent('/oauth/consent', { signedIn: true })),
		).resolves.toBe(`/en/oauth/consent${AUTHORIZATION_QUERY}`);
	});

	it('follows the account language over a stale language cookie', async () => {
		await preferLocale('en');
		await expect(
			oauthPageLocaleHref(
				oauthPageEvent('/oauth/consent', { signedIn: true, localeCookie: 'cs' }),
			),
		).resolves.toBe(`/en/oauth/consent${AUTHORIZATION_QUERY}`);

		await preferLocale('cs');
		await expect(
			oauthPageLocaleHref(
				oauthPageEvent('/oauth/consent', { signedIn: true, localeCookie: 'en' }),
			),
		).resolves.toBeNull();
	});

	it('moves a signed-out English visitor to the English sign-in by their language cookie', async () => {
		await expect(
			oauthPageLocaleHref(oauthPageEvent('/login', { localeCookie: 'en' })),
		).resolves.toBe(`/en/login${AUTHORIZATION_QUERY}`);
		await expect(oauthPageLocaleHref(oauthPageEvent('/login'))).resolves.toBeNull();
	});

	it('keeps a page the visitor already opened in English', async () => {
		await preferLocale('cs');

		await expect(
			oauthPageLocaleHref(oauthPageEvent('/en/oauth/consent', { signedIn: true })),
		).resolves.toBeNull();
	});

	it("keeps a demo visitor's own language rather than the persona's", async () => {
		await preferLocale('en');

		await expect(
			oauthPageLocaleHref(oauthPageEvent('/oauth/consent', { signedIn: true, demo: true })),
		).resolves.toBeNull();
	});
});
