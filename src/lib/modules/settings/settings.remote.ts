import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { account } from '$lib/server/db/auth.schema.js';
import { guardedQuery, guardedCommand, guardedCommandNoArgs } from '$lib/server/remote.js';
import {
	UpdateProfileInputSchema,
	UpdateAppBackgroundThemeInputSchema,
	UpdatePreferredLocaleInputSchema,
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

export const deleteAccount = guardedCommandNoArgs(async ({ user: authUser }) => {
	const database = getDb();

	await database.delete(user).where(eq(user.id, authUser.id));
});
