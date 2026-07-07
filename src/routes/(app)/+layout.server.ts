import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { getActiveLocaleForUrl, localizeInternalHref } from '$lib/i18n/locale.js';

const PUBLIC_PATH_PREFIXES = ['/w/'];

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isPublicRoute = PUBLIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

	if (locals.session == null || locals.user == null) {
		if (!isPublicRoute) {
			const redirectParam = url.pathname + url.search;
			const loginHref = localizeInternalHref(resolve('/login'), getActiveLocaleForUrl(url));
			throw redirect(303, `${loginHref}?${new URLSearchParams({ redirect: redirectParam })}`);
		}
		return { user: null, unreadNotificationCount: 0 };
	}

	const database = getDb();
	const result = await database
		.select({ count: sql<number>`count(*)` })
		.from(notification)
		.where(and(eq(notification.userId, locals.user.id), eq(notification.read, false)));
	const unreadNotificationCount = Number(result[0]?.count ?? 0);

	return { user: locals.user, unreadNotificationCount };
};
