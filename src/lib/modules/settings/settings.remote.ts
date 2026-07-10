import { eq } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { account } from '$lib/server/db/auth.schema.js';
import {
	guardedQuery,
	guardedCommand,
	guardedCommandNoArgs,
	publicCommand,
} from '$lib/server/remote.js';
import { PALETTE_COOKIE_MAX_AGE_SECONDS, PALETTE_COOKIE_NAME } from '$lib/theme/palettes.js';
import {
	UpdateProfileInputSchema,
	UpdateAppBackgroundThemeInputSchema,
	UpdatePreferredLocaleInputSchema,
	SetUserPaletteInputSchema,
	type UserProfile,
} from './types.js';

export type { UserProfile } from './types.js';

// ── Queries ────────────────────────────────────────────────────────────────

export const getUserProfile = guardedQuery(async ({ user: authUser }): Promise<UserProfile> => {
	const database = getDb();

	const accounts = await database
		.select({ providerId: account.providerId })
		.from(account)
		.where(eq(account.userId, authUser.id));

	const isOAuthUser = accounts.some((a) => a.providerId !== 'credential');

	// Read profile fields from the DB (source of truth). The session user is cached by
	// better-auth and goes stale after updateProfile writes directly to the user table,
	// so reading name/image from the session would show pre-update values after a reload.
	const rows = await database
		.select({
			name: user.name,
			image: user.image,
			appBackgroundTheme: user.appBackgroundTheme,
			preferredLocale: user.preferredLocale,
		})
		.from(user)
		.where(eq(user.id, authUser.id))
		.limit(1);

	return {
		id: authUser.id,
		name: rows[0]?.name ?? authUser.name,
		email: authUser.email,
		image: rows[0]?.image ?? null,
		isOAuthUser,
		appBackgroundTheme: rows[0]?.appBackgroundTheme ?? 'default',
		preferredLocale: rows[0]?.preferredLocale ?? null,
	};
});

// ── Commands ───────────────────────────────────────────────────────────────

export const updateProfile = guardedCommand(
	UpdateProfileInputSchema,
	async ({ user: authUser }, input) => {
		const database = getDb();

		await database
			.update(user)
			.set({
				name: input.name,
				image: input.image,
				updatedAt: new Date(),
			})
			.where(eq(user.id, authUser.id));
	},
);

export const updateAppBackgroundTheme = guardedCommand(
	UpdateAppBackgroundThemeInputSchema,
	async ({ user: authUser }, input) => {
		const database = getDb();

		await database
			.update(user)
			.set({
				appBackgroundTheme: input.appBackgroundTheme,
				updatedAt: new Date(),
			})
			.where(eq(user.id, authUser.id));
	},
);

export const updatePreferredLocale = guardedCommand(
	UpdatePreferredLocaleInputSchema,
	async ({ user: authUser }, input) => {
		const database = getDb();

		await database
			.update(user)
			.set({
				preferredLocale: input.preferredLocale,
				updatedAt: new Date(),
			})
			.where(eq(user.id, authUser.id));
	},
);

/**
 * Persist the viewer's app-level palette (Redesign 2026, issue #102).
 *
 * Always mirrors the choice into the `app-palette` cookie so `paletteHandle`
 * (hooks.server.ts) themes the very next request; for anonymous users the cookie
 * is the only store. Logged-in users additionally get the palette persisted on
 * their user row, which serves as the fresh-device fallback when the cookie is
 * absent. Not httpOnly: the client may read it for instant theming.
 */
export const setUserPalette = publicCommand(
	SetUserPaletteInputSchema,
	async (authContext, palette) => {
		const event = getRequestEvent();
		event.cookies.set(PALETTE_COOKIE_NAME, palette, {
			path: '/',
			maxAge: PALETTE_COOKIE_MAX_AGE_SECONDS,
			httpOnly: false,
			sameSite: 'lax',
		});

		if (authContext === null) {
			return;
		}

		await getDb()
			.update(user)
			.set({ palette, updatedAt: new Date() })
			.where(eq(user.id, authContext.user.id));
	},
);

export const deleteAccount = guardedCommandNoArgs(async ({ user: authUser }) => {
	const database = getDb();

	await database.delete(user).where(eq(user.id, authUser.id));
});
