import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { notification } from '$lib/server/db/notification.schema.js';

const PUBLIC_PATH_PREFIXES = ['/w/'];

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isPublicRoute = PUBLIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

	if (locals.session == null || locals.user == null) {
		if (!isPublicRoute) {
			const redirectParam = encodeURIComponent(url.pathname);
			throw redirect(303, resolve('/login') + `?redirect=${redirectParam}`);
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
