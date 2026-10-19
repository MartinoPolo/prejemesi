import type { RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { baseLocale, cookieName } from '$lib/paraglide/runtime.js';
import {
	getActiveLocaleForUrl,
	localizeInternalHref,
	resolveLocalePreference,
} from '$lib/i18n/locale.js';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';

/** A demo keeps the visitor's own locale, never its persona's. */
async function accountLocaleOf(event: RequestEvent): Promise<string | null> {
	const { locals } = event;
	if (locals.user == null || locals.demoSession !== undefined) {
		return null;
	}
	const rows = await getDb(event)
		.select({ preferredLocale: user.preferredLocale })
		.from(user)
		.where(eq(user.id, locals.user.id))
		.limit(1);
	return rows[0]?.preferredLocale ?? null;
}

/**
 * BetterAuth sends an app's authorization to the unprefixed sign-in and consent paths, which are
 * the Czech pages; this is the same page in the visitor's own locale, or null to stay.
 */
export async function oauthPageLocaleHref(event: RequestEvent): Promise<string | null> {
	if (getActiveLocaleForUrl(event.url.pathname) !== baseLocale) {
		return null;
	}
	const locale = resolveLocalePreference(
		undefined,
		await accountLocaleOf(event),
		event.cookies.get(cookieName),
	);
	return locale === baseLocale
		? null
		: localizeInternalHref(`${event.url.pathname}${event.url.search}`, locale);
}
